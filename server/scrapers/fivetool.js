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

async function scrapeFiveToolTeam(teamUuid, season, orgId, teamId) {
  const url = teamUrl(season, teamUuid);
  console.log(`[ft-scraper] Fetching: ${url}`);

  const html = fetchWithCurl(url);

  const $ = cheerio.load(html);
  const result = { record: null, events: [], games: [] };

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
      // Game result row
      const scoreText = row['VS'].text.replace(/\s+/g, ' ').trim();
      const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)/);

      let scoreUs = null, scoreThem = null, opponentName = '';

      if (scoreMatch) {
        const s1 = parseInt(scoreMatch[1]);
        const s2 = parseInt(scoreMatch[2]);

        // The TEAM column shows the team listed first in the matchup.
        // The VS column shows: "opponent_score - our_score" when TEAM is us,
        // and "our_score - opponent_score" when TEAM is the opponent.
        // (Verified by cross-referencing event W-L-T records)
        const teamName = row['TEAM'].text.trim();
        const isUs = teamName.toLowerCase().includes('yardbird');

        if (isUs) {
          scoreThem = s1;
          scoreUs = s2;
          opponentName = '';
        } else {
          opponentName = teamName;
          scoreUs = s1;
          scoreThem = s2;
        }
      }

      let result_ = null;
      if (scoreUs !== null && scoreThem !== null) {
        if (scoreUs > scoreThem) result_ = 'W';
        else if (scoreUs < scoreThem) result_ = 'L';
        else result_ = 'T';
      }

      const eventName = row['EVENT'] ? row['EVENT'].text.trim() : '';
      const eventLink = row['EVENT'] ? row['EVENT'].link || '' : '';

      result.games.push({
        gameNum: row['#'].text.trim(),
        eventName,
        eventLink,
        opponentName,
        scoreUs,
        scoreThem,
        result: result_,
      });
    }
  }

  console.log(`[ft-scraper] Events: ${result.events.length}, Games: ${result.games.length}`);

  // Save events as tournaments
  for (const event of result.events) {
    await queries.upsertFtTournament({
      eventId: event.eventId,
      name: event.name,
      startDate: event.date,
      endDate: '',
      location: '',
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
