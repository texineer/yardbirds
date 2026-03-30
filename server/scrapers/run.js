const { scrapeTeamPage } = require('./team');
const { scrapeTournamentPage, scrapePitchingReport, scrapeTournamentSchedule } = require('./tournament');
const { scrapeGameScore } = require('./game');
const { scrapeFiveToolTeam } = require('./fivetool');
const queries = require('../db/queries');
const { closeDb, saveDb } = require('../db/schema');

const DEFAULT_YEAR = parseInt(process.env.YEAR) || 2026;

// Scrape a specific team by slug (looks up config from DB)
async function scrapeBySlug(slug, year = DEFAULT_YEAR) {
  const team = await queries.getTeamBySlug(slug);
  if (!team) throw new Error(`Team not found: ${slug}`);
  const ftUuid = team.ft_team_uuid || null;
  const ftSeasons = team.ft_seasons ? team.ft_seasons.split(',') : [];
  return scrapeAll(team.pg_org_id, team.pg_team_id, year, ftUuid, ftSeasons);
}

// Scrape all registered teams
async function scrapeAllTeams(year = DEFAULT_YEAR) {
  const teams = await queries.getAllTeams();
  console.log(`\n=== Scraping ${teams.length} registered teams ===\n`);
  for (const team of teams) {
    const ftUuid = team.ft_team_uuid || null;
    const ftSeasons = team.ft_seasons ? team.ft_seasons.split(',') : [];
    try {
      await scrapeAll(team.pg_org_id, team.pg_team_id, year, ftUuid, ftSeasons);
    } catch (err) {
      console.error(`[scraper] Failed to scrape ${team.slug}: ${err.message}`);
    }
  }
  saveDb();
}

async function scrapeAll(orgId, teamId, year = DEFAULT_YEAR, ftTeamUuid = null, ftSeasons = []) {
  console.log(`\n=== Scraping team ${orgId}/${teamId} for ${year} ===\n`);

  try {
    // Step 1: Scrape team page (roster, schedule, tournaments)
    const teamResult = await scrapeTeamPage(orgId, teamId, year);

    // Step 2: Scrape each tournament page for details + pitch counts
    for (const tournament of teamResult.tournaments) {
      try {
        await scrapeTournamentPage(tournament.pgEventId);
        await sleep(1000);

        // Scrape scheduled games from the tournament event page
        const scheduledGames = await scrapeTournamentSchedule(tournament.pgEventId);

        // Get our team name for fuzzy matching
        const team = await queries.getTeam(orgId, teamId);
        const teamName = team ? team.name.toLowerCase() : '';

        for (const sg of scheduledGames) {
          // Find if this team is in the game (by ID or name match)
          const teamEntry = sg.teams.find(t =>
            (t.orgId === orgId && t.teamId === teamId) ||
            (teamName && t.name && t.name.toLowerCase().includes(teamName)) ||
            (teamName && t.name && teamName.includes(t.name.toLowerCase()))
          );
          if (!teamEntry) {
            if (sg.teams.length > 0) {
              console.log(`[scraper] No match for game ${sg.pgGameId}: teams=${JSON.stringify(sg.teams.map(t=>t.name))}, looking for "${teamName}"`);
            }
            continue;
          }

          // The other team is the opponent
          const opponent = sg.teams.find(t => t !== teamEntry) || { name: 'TBD', orgId: null, teamId: null };

          // Determine game date from tournament dates or leave blank
          // The event page groups by date but we extract time per game
          await queries.upsertGame({
            pgGameId: sg.pgGameId,
            pgEventId: sg.pgEventId,
            teamOrgId: orgId,
            teamId: teamId,
            opponentName: opponent.name,
            opponentOrgId: opponent.orgId,
            opponentTeamId: opponent.teamId,
            gameDate: sg.gameDate || '',
            gameTime: sg.gameTime,
            field: sg.field,
            scoreUs: null,
            scoreThem: null,
            result: null,
            pgBoxUrl: sg.pgBoxUrl,
            pgRecapUrl: '',
          });
        }
        const savedCount = scheduledGames.filter(sg => sg.teams.some(t =>
          (t.orgId === orgId && t.teamId === teamId) ||
          (teamName && t.name && t.name.toLowerCase().includes(teamName)) ||
          (teamName && t.name && teamName.includes(t.name.toLowerCase()))
        )).length;
        console.log(`[scraper] Saved ${savedCount} scheduled games for team`);

        await sleep(1000);

        // Scrape pitching restrictions (free pitch count data!)
        const pitchData = await scrapePitchingReport(tournament.pgEventId);

        // Clear old data and save fresh pitch counts
        if (pitchData.length > 0) {
          await queries.clearTournamentPitchCounts(tournament.pgEventId);
        }
        for (const entry of pitchData) {
          await queries.insertPitchCount({
            gameId: null, // We don't have per-game mapping from this page
            pgEventId: tournament.pgEventId,
            playerName: entry.playerName,
            teamName: entry.teamName,
            pitches: entry.pitches,
            innings: entry.innings,
            strikeouts: entry.strikeouts,
            walks: entry.walks,
          });
        }

        await sleep(1500);
      } catch (err) {
        console.error(`[scraper] Error scraping tournament ${tournament.pgEventId}: ${err.message}`);
      }
    }

    // Step 3: Scrape Five Tool Youth
    if (ftTeamUuid) {
      console.log('\n--- Five Tool Youth ---');
      for (const ftSeason of ftSeasons) {
        try {
          await scrapeFiveToolTeam(ftTeamUuid, ftSeason, orgId, teamId);
          await sleep(1500);
        } catch (err) {
          console.error(`[ft-scraper] Error scraping ${ftSeason}: ${err.message}`);
        }
      }
      // Close the Playwright browser after FT scraping
      try {
        const { closeBrowser } = require('./browser');
        await closeBrowser();
      } catch (e) {}
    }

    // Step 4: Fetch scores for PG games that don't have them yet
    console.log('\n--- Fetching missing game scores ---');
    const allGames = await queries.getTeamGames(orgId, teamId);
    const gamesNeedingScores = allGames.filter(g => g.pg_game_id && !g.result && g.source !== 'ft');
    console.log(`[scraper] ${gamesNeedingScores.length} games need scores`);
    for (const game of gamesNeedingScores) {
      try {
        const score = await scrapeGameScore(game.pg_game_id);
        if (score && score.isFinal) {
          // Determine which score is ours
          const team = await queries.getTeam(orgId, teamId);
          const teamName = (team?.name || '').toLowerCase();
          const homeIsUs = score.homeName.toLowerCase().includes(teamName) || teamName.includes(score.homeName.toLowerCase());
          const scoreUs = homeIsUs ? score.homeScore : score.visitorScore;
          const scoreThem = homeIsUs ? score.visitorScore : score.homeScore;
          const result = scoreUs > scoreThem ? 'W' : scoreUs < scoreThem ? 'L' : 'T';
          await queries.upsertGame({
            pgGameId: game.pg_game_id,
            pgEventId: game.pg_event_id,
            teamOrgId: orgId, teamId: teamId,
            opponentName: game.opponent_name,
            opponentOrgId: game.opponent_org_id, opponentTeamId: game.opponent_team_id,
            gameDate: game.game_date, gameTime: game.game_time, field: game.field,
            scoreUs, scoreThem, result,
            pgBoxUrl: game.pg_box_url, pgRecapUrl: game.pg_recap_url || '',
          });
          console.log(`[scraper] Score for game ${game.id}: ${scoreUs}-${scoreThem} (${result})`);
        }
        await sleep(500);
      } catch (err) {
        console.log(`[scraper] Score fetch error for game ${game.pg_game_id}: ${err.message}`);
      }
    }

    saveDb();
    console.log('\n=== Scrape complete ===\n');
    return teamResult;
  } catch (err) {
    console.error(`[scraper] Fatal error: ${err.message}`);
    throw err;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run if called directly: node run.js [slug] or node run.js [orgId] [teamId]
if (require.main === module) {
  const args = process.argv.slice(2);
  const run = async () => {
    const { getDb } = require('../db/schema');
    await getDb();
    if (args[0] && isNaN(args[0])) {
      // Argument is a slug
      await scrapeBySlug(args[0]);
    } else if (args.length === 0) {
      // No args — scrape all registered teams
      await scrapeAllTeams();
    } else {
      // Legacy: orgId teamId [year]
      await scrapeAll(parseInt(args[0]), parseInt(args[1]), parseInt(args[2]) || DEFAULT_YEAR);
    }
  };
  run()
    .then(() => {
      closeDb();
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      closeDb();
      process.exit(1);
    });
}

module.exports = { scrapeAll, scrapeBySlug, scrapeAllTeams };
