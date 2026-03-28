const { execSync } = require('child_process');
const cheerio = require('cheerio');
const queries = require('../db/queries');

const FT_BASE = 'https://play.fivetoolyouth.org';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Use curl to bypass Cloudflare bot detection (axios gets 403)
// Retry up to 3 times with cookie jar for session persistence
function fetchWithCurl(url) {
  const os = require('os');
  const path = require('path');
  const cookieJar = path.join(os.tmpdir(), 'ft_cookies.txt');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const cmd = `curl -s -L -b "${cookieJar}" -c "${cookieJar}" -H "User-Agent: ${UA}" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" -H "Accept-Language: en-US,en;q=0.5" "${url}"`;
      const html = execSync(cmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }).toString();
      if (html.includes('Just a moment') || html.length < 5000) {
        console.log(`[ft-scraper] Cloudflare challenge on attempt ${attempt}, retrying...`);
        // Wait before retry
        execSync('sleep 3');
        continue;
      }
      return html;
    } catch (err) {
      if (attempt === 3) throw err;
    }
  }
  throw new Error('Failed to fetch Five Tool page after 3 attempts (Cloudflare challenge)');
}

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

async function scrapeFiveToolTeam(teamUuid, season, orgId, teamId, ourTeamName = null) {
  const url = teamUrl(season, teamUuid);
  console.log(`[ft-scraper] Fetching: ${url}`);

  const html = fetchWithCurl(url);

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

  // Separate event rows (have DATE + EVENT + W-L-T) from game rows (have # + TEAM + VS)
  for (const row of rows) {
    if (row['EVENT'] && row['DATE'] && row['W-L-T']) {
      // Event/tournament row
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
      // Game result row — store raw data, we'll fix scores after
      const scoreText = row['VS'].text.replace(/\s+/g, ' ').trim();
      const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/);
      const teamName = row['TEAM'].text.trim();
      const teamLink = row['TEAM'].link || '';
      const isUs = teamLink.includes(teamUuid);
      const eventName = row['EVENT'] ? row['EVENT'].text.trim() : '';
      const eventLink = row['EVENT'] ? row['EVENT'].link || '' : '';

      if (scoreMatch) {
        result.games.push({
          gameNum: row['#'].text.trim(),
          eventName,
          eventLink,
          opponentName: isUs ? '' : teamName,
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

  // Auto-detect score direction by cross-validating against event W-L-T records.
  // Try both interpretations and pick the one that matches.
  // Interpretation A: VS = "s1 - s2" where for US rows: scoreUs=s1, for OPP rows: scoreThem=s1
  // Interpretation B: VS = "s1 - s2" where for US rows: scoreThem=s1, for OPP rows: scoreUs=s1
  for (const interp of ['A', 'B']) {
    let allMatch = true;
    for (const event of result.events) {
      const wltMatch = event.wlt.match(/(\d+)-(\d+)-(\d+)/);
      if (!wltMatch) continue;
      const expectedW = parseInt(wltMatch[1]), expectedL = parseInt(wltMatch[2]), expectedT = parseInt(wltMatch[3]);
      if (expectedW + expectedL + expectedT === 0) continue; // no games yet

      const eventGames = result.games.filter(g => g.eventName === event.name);
      let w = 0, l = 0, t = 0;
      for (const g of eventGames) {
        let us, them;
        if (interp === 'A') {
          us = g.isUs ? g.s1 : g.s2;
          them = g.isUs ? g.s2 : g.s1;
        } else {
          us = g.isUs ? g.s2 : g.s1;
          them = g.isUs ? g.s1 : g.s2;
        }
        if (us > them) w++; else if (us < them) l++; else t++;
      }
      if (w !== expectedW || l !== expectedL || t !== expectedT) { allMatch = false; break; }
    }
    if (allMatch) {
      console.log(`[ft-scraper] Score interpretation: ${interp}`);
      for (const g of result.games) {
        if (interp === 'A') {
          g.scoreUs = g.isUs ? g.s1 : g.s2;
          g.scoreThem = g.isUs ? g.s2 : g.s1;
        } else {
          g.scoreUs = g.isUs ? g.s2 : g.s1;
          g.scoreThem = g.isUs ? g.s1 : g.s2;
        }
        g.result = g.scoreUs > g.scoreThem ? 'W' : g.scoreUs < g.scoreThem ? 'L' : 'T';
      }
      break;
    }
  }

  // Scrape event pages for date ranges and locations
  for (const event of result.events) {
    try {
      const eventHtml = fetchWithCurl(event.ftUrl);
      const $e = cheerio.load(eventHtml);
      const titleText = $e('title').text().trim();
      // Title format: "Event Name MM/DD/YYYY - MM/DD/YYYY - ..."
      const dateRangeMatch = titleText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if (dateRangeMatch) {
        const [_, sd, ed] = dateRangeMatch;
        // Convert MM/DD/YYYY to YYYY-MM-DD
        event.startDate = `${sd.slice(6)}-${sd.slice(0,2)}-${sd.slice(3,5)}`;
        event.endDate = `${ed.slice(6)}-${ed.slice(0,2)}-${ed.slice(3,5)}`;
      }
      // Try to find location from page text
      const bodyText = $e('body').text();
      const locMatch = bodyText.match(/(?:Location|Venue|City)[:\s]*([A-Z][A-Za-z\s.]+,\s*[A-Z]{2})/);
      if (locMatch) event.location = locMatch[1].trim();
    } catch (err) {
      console.log(`[ft-scraper] Could not fetch event details for ${event.name}: ${err.message}`);
    }
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

  // Save games - associate each with its event
  for (const game of result.games) {
    // Find which event this game belongs to
    const matchingEvent = result.events.find(e => e.name === game.eventName);
    const eventId = matchingEvent ? matchingEvent.eventId : null;

    // Skip games where we couldn't parse scores
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

  return result;
}

module.exports = { scrapeFiveToolTeam, FT_BASE, ftEventHash };
