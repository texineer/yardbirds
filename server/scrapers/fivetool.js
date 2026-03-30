const cheerio = require('cheerio');
const queries = require('../db/queries');
const { fetchRenderedHtml, closeBrowser } = require('./browser');

const FT_BASE = 'https://play.fivetoolyouth.org';

// Generate a deterministic integer from a string (for event IDs)
// Offset to 20M+ range to avoid collision with PG event IDs (typically 5-6 digits)
function ftEventHash(slug) {
  let hash = 0;
  for (const ch of slug) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return (hash & 0x7FFFFFFF) + 20000000;
}

function teamUrl(season, teamUuid) {
  return `${FT_BASE}/team/details/${season}/${teamUuid}`;
}

// Scrape the FT event schedule page to get game times and matchups
async function scrapeFtEventSchedule(eventSlug, teamName) {
  const url = `${FT_BASE}/events/${eventSlug}/schedule/all`;
  console.log(`[ft-scraper] Fetching event schedule: ${url}`);

  try {
    const { getBrowser } = require('./browser');
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    let scheduleJson = null;
    page.on('response', async (response) => {
      if (response.url().includes('schedule_ajax') && response.status() === 200) {
        try { scheduleJson = await response.json(); } catch (e) {}
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(8000);
    await context.close();

    if (!scheduleJson?.schedules) {
      console.log(`[ft-scraper] No schedule data from AJAX for ${eventSlug}`);
      return [];
    }

    // Extract games that match our team
    const games = [];
    const teamLower = (teamName || '').toLowerCase();

    for (const [dateKey, dayData] of Object.entries(scheduleJson.schedules)) {
      if (!dayData.teams || !Array.isArray(dayData.teams)) continue;
      const gameDate = dayData.date_short || ''; // "03/28/2026"
      // Convert MM/DD/YYYY to YYYY-MM-DD
      let isoDate = '';
      if (gameDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        isoDate = `${gameDate.slice(6)}-${gameDate.slice(0, 2)}-${gameDate.slice(3, 5)}`;
      }

      for (const game of dayData.teams) {
        const t1 = game.team_name_1 || '';
        const t2 = game.team_name_2 || '';
        const t1Lower = t1.toLowerCase();
        const t2Lower = t2.toLowerCase();

        // Check if our team is in this game (flexible matching — either contains the other)
        const isT1 = teamLower && (t1Lower.includes(teamLower) || teamLower.includes(t1Lower));
        const isT2 = teamLower && (t2Lower.includes(teamLower) || teamLower.includes(t2Lower));
        if (!isT1 && !isT2) continue;

        const opponentName = isT1 ? t2 : t1;
        const gameTime = game.start_time || '';
        const field = game.location_name || '';
        const score1 = parseInt(game.team_score_1) || null;
        const score2 = parseInt(game.team_score_2) || null;

        let scoreUs = null, scoreThem = null, result = null;
        if (score1 !== null && score2 !== null) {
          scoreUs = isT1 ? score1 : score2;
          scoreThem = isT1 ? score2 : score1;
          result = scoreUs > scoreThem ? 'W' : scoreUs < scoreThem ? 'L' : 'T';
        }

        games.push({
          gameDate: isoDate,
          gameTime,
          field,
          opponentName,
          scoreUs,
          scoreThem,
          result,
          division: game.division || '',
        });
      }
    }

    console.log(`[ft-scraper] Found ${games.length} scheduled games for team in ${eventSlug}`);
    return games;
  } catch (err) {
    console.log(`[ft-scraper] Error scraping event schedule ${eventSlug}: ${err.message}`);
    return [];
  }
}

// Scrape all registered teams from an FT event teams page
// Teams are in hidden <a> tags with /team/details/ URLs on the /teams page
async function scrapeFtEventTeams(eventSlug) {
  const url = `${FT_BASE}/events/${eventSlug}/teams`;
  console.log(`[ft-scraper] Fetching event teams: ${url}`);

  try {
    const { getBrowser } = require('./browser');
    const browser = await getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(6000);

    // Extract team names from all /team/details/ links in the DOM (even hidden ones)
    const teams = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('a[href*="/team/details/"]').forEach(a => {
        const name = a.textContent.trim();
        const href = a.href;
        if (name && name.length > 2) {
          results.push({ name, href });
        }
      });
      return results;
    });

    await context.close();

    // Deduplicate and sort
    const teamMap = new Map();
    for (const t of teams) {
      teamMap.set(t.name.toLowerCase(), { name: t.name, href: t.href });
    }

    const result = [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    console.log(`[ft-scraper] Found ${result.length} registered teams for ${eventSlug}`);
    return result;
  } catch (err) {
    console.log(`[ft-scraper] Error fetching event teams ${eventSlug}: ${err.message}`);
    return [];
  }
}

async function scrapeFiveToolTeam(teamUuid, season, orgId, teamId) {
  const url = teamUrl(season, teamUuid);
  console.log(`[ft-scraper] Fetching: ${url}`);

  const html = await fetchRenderedHtml(url);

  const $ = cheerio.load(html);
  const result = { record: null, events: [], games: [], teamName: '' };

  // Detect our team name from the page title
  const titleText = $('title').text().trim();
  const titleMatch = titleText.match(/^(.+?)\s*Team Profile/i);
  if (titleMatch) result.teamName = titleMatch[1].trim();
  console.log(`[ft-scraper] Team name: "${result.teamName}"`);

  // Parse season record: "W-L-T 7-5-1"
  const recordText = $('.team-record-tables').text().replace(/\s+/g, ' ');
  const recordMatch = recordText.match(/W-L-T\s+(\d+-\d+-\d+)/);
  if (recordMatch) {
    result.record = recordMatch[1];
    console.log(`[ft-scraper] Record: ${result.record}`);
  }

  // Parse events and game results from tables
  const rows = [];
  $('td[data-title]').closest('tr').each((_, row) => {
    const cells = {};
    $(row).find('td[data-title]').each((_, td) => {
      const title = $(td).attr('data-title');
      const text = $(td).find('.table-text').text().trim() || $(td).text().trim();
      const link = $(td).find('a').attr('href') || '';
      cells[title] = { text, link };
    });
    if (Object.keys(cells).length > 1) rows.push(cells);
  });

  // Separate event rows from game rows
  for (const row of rows) {
    if (row['EVENT'] && row['DATE'] && row['W-L-T']) {
      const eventLink = row['EVENT'].link || '';
      const slug = eventLink.replace(FT_BASE + '/events/', '').replace(/\/$/, '');
      const eventId = ftEventHash(slug);

      const event = {
        eventId,
        name: row['EVENT'].text.trim(),
        date: row['DATE'].text.trim(),
        division: row['DIVISION'] ? row['DIVISION'].text.trim() : '',
        wlt: row['W-L-T'].text.trim(),
        ftUrl: eventLink,
        slug,
      };
      result.events.push(event);
    } else if (row['#'] && row['TEAM'] && row['VS']) {
      const scoreText = row['VS'].text.replace(/\s+/g, ' ').trim();
      const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/);
      const teamLink = row['TEAM'].link || '';
      const isUs = teamLink.includes(teamUuid);
      const eventName = row['EVENT'] ? row['EVENT'].text.trim() : '';

      if (scoreMatch) {
        result.games.push({
          gameNum: row['#'].text.trim(),
          eventName,
          opponentName: isUs ? '' : row['TEAM'].text.trim(),
          s1: parseInt(scoreMatch[1]),
          s2: parseInt(scoreMatch[2]),
          isUs,
          scoreUs: null,
          scoreThem: null,
          result: null,
        });
      }
    }
  }

  console.log(`[ft-scraper] Events: ${result.events.length}, Games: ${result.games.length}`);

  // Auto-detect score direction by cross-validating against event W-L-T records
  for (const interp of ['A', 'B']) {
    let allMatch = true;
    for (const event of result.events) {
      const wltMatch = event.wlt.match(/(\d+)-(\d+)-(\d+)/);
      if (!wltMatch) continue;
      const expectedW = parseInt(wltMatch[1]), expectedL = parseInt(wltMatch[2]), expectedT = parseInt(wltMatch[3]);
      if (expectedW + expectedL + expectedT === 0) continue;

      const eventGames = result.games.filter(g => g.eventName === event.name);
      let w = 0, l = 0, t = 0;
      for (const g of eventGames) {
        let us, them;
        if (interp === 'A') { us = g.isUs ? g.s1 : g.s2; them = g.isUs ? g.s2 : g.s1; }
        else { us = g.isUs ? g.s2 : g.s1; them = g.isUs ? g.s1 : g.s2; }
        if (us > them) w++; else if (us < them) l++; else t++;
      }
      if (w !== expectedW || l !== expectedL || t !== expectedT) { allMatch = false; break; }
    }
    if (allMatch) {
      console.log(`[ft-scraper] Score interpretation: ${interp}`);
      for (const g of result.games) {
        if (interp === 'A') { g.scoreUs = g.isUs ? g.s1 : g.s2; g.scoreThem = g.isUs ? g.s2 : g.s1; }
        else { g.scoreUs = g.isUs ? g.s2 : g.s1; g.scoreThem = g.isUs ? g.s1 : g.s2; }
        g.result = g.scoreUs > g.scoreThem ? 'W' : g.scoreUs < g.scoreThem ? 'L' : 'T';
      }
      break;
    }
  }

  // Scrape event pages for date ranges and scheduled games
  for (const event of result.events) {
    try {
      const eventHtml = await fetchRenderedHtml(event.ftUrl);
      const $e = cheerio.load(eventHtml);
      const evTitle = $e('title').text().trim();
      const dateRangeMatch = evTitle.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateRangeMatch) {
        const [_, sd, ed] = dateRangeMatch;
        event.startDate = `${sd.slice(6)}-${sd.slice(0, 2)}-${sd.slice(3, 5)}`;
        event.endDate = `${ed.slice(6)}-${ed.slice(0, 2)}-${ed.slice(3, 5)}`;
      }
    } catch (err) {
      console.log(`[ft-scraper] Could not fetch event details for ${event.name}: ${err.message}`);
    }

    // Scrape scheduled games from the event schedule page
    // Remove trailing year from team name (page title adds "2026" but schedule doesn't)
    const matchName = result.teamName.replace(/\s*\d{4}\s*$/, '').toLowerCase();
    const scheduledGames = await scrapeFtEventSchedule(event.slug, matchName);
    event.scheduledGames = scheduledGames;
  }

  // Save events as tournaments
  for (const event of result.events) {
    await queries.upsertFtTournament({
      eventId: event.eventId,
      name: event.name,
      startDate: event.startDate || event.date,
      endDate: event.endDate || '',
      location: event.location || '',
      ftUrl: event.ftUrl,
    });
    await queries.linkTeamTournament(orgId, teamId, event.eventId);
  }

  // Save completed game results
  for (const game of result.games) {
    const matchingEvent = result.events.find(e => e.name === game.eventName);
    const eventId = matchingEvent ? matchingEvent.eventId : null;
    if (game.scoreUs === null) continue;

    const sourceGameKey = `ft:${eventId || 'unknown'}:${game.gameNum}:${game.scoreUs}-${game.scoreThem}`;
    await queries.upsertFtGame({
      sourceGameKey,
      pgEventId: eventId,
      teamOrgId: orgId,
      teamId,
      opponentName: game.opponentName || 'Unknown',
      gameDate: matchingEvent ? matchingEvent.date : '',
      scoreUs: game.scoreUs,
      scoreThem: game.scoreThem,
      result: game.result,
    });
  }

  // Save scheduled (upcoming) games from event schedules
  for (const event of result.events) {
    if (!event.scheduledGames?.length) continue;
    for (const sg of event.scheduledGames) {
      // Skip if this game already has a result in our completed games
      const alreadyHasResult = result.games.some(g =>
        g.eventName === event.name && g.opponentName === sg.opponentName && g.scoreUs !== null
      );
      if (alreadyHasResult) continue;

      const sourceGameKey = `ft:${event.eventId}:sched:${sg.gameDate}:${sg.gameTime}:${sg.opponentName}`;
      await queries.upsertFtGame({
        sourceGameKey,
        pgEventId: event.eventId,
        teamOrgId: orgId,
        teamId,
        opponentName: sg.opponentName,
        gameDate: sg.gameDate,
        gameTime: sg.gameTime,
        field: sg.field,
        scoreUs: sg.scoreUs,
        scoreThem: sg.scoreThem,
        result: sg.result,
      });
    }
  }

  return result;
}

module.exports = { scrapeFiveToolTeam, scrapeFtEventTeams, FT_BASE, ftEventHash };
