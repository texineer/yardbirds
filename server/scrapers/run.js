const { scrapeTeamPage } = require('./team');
const { scrapeTournamentPage, scrapePitchingReport, scrapeTournamentSchedule } = require('./tournament');
const { scrapeFiveToolTeam } = require('./fivetool');
const queries = require('../db/queries');
const { closeDb, saveDb } = require('../db/schema');

// Team config — override via environment variables
const DEFAULT_ORG_ID = parseInt(process.env.PG_ORG_ID) || 50903;
const DEFAULT_TEAM_ID = parseInt(process.env.PG_TEAM_ID) || 276649;
const DEFAULT_YEAR = parseInt(process.env.YEAR) || 2026;

// Five Tool config
const FT_TEAM_UUID = process.env.FT_TEAM_UUID || 'cc705482-b247-41d9-8591-dc97f17a1ca2';
const FT_SEASONS = (process.env.FT_SEASONS || '2026-baseball').split(',');

async function scrapeAll(orgId = DEFAULT_ORG_ID, teamId = DEFAULT_TEAM_ID, year = DEFAULT_YEAR) {
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
    if (FT_TEAM_UUID) {
      console.log('\n--- Five Tool Youth ---');
      for (const ftSeason of FT_SEASONS) {
        try {
          await scrapeFiveToolTeam(FT_TEAM_UUID, ftSeason, orgId, teamId);
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

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const orgId = args[0] ? parseInt(args[0]) : DEFAULT_ORG_ID;
  const teamId = args[1] ? parseInt(args[1]) : DEFAULT_TEAM_ID;
  const year = args[2] ? parseInt(args[2]) : DEFAULT_YEAR;

  scrapeAll(orgId, teamId, year)
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

module.exports = { scrapeAll };
