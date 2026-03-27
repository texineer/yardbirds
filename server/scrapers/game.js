const axios = require('axios');
const cheerio = require('cheerio');
const { PG_BASE } = require('./team');

// DiamondKast box score pitch counts are behind a paywall (DK Plus subscription).
// The line score (R/H/E per inning) is available for free.
// For pitch counts, use the tournament PitchingRestrictions page instead.

async function scrapeGameLineScore(pgGameId) {
  const url = `${PG_BASE}/DiamondKast/Game.aspx?gameid=${pgGameId}`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(html);
    const result = {};

    // Extract team names from spans with known ASP.NET IDs
    const awayTeam = $('[id*="lblAwayTeam"]').text().trim() || $('[id*="lblAway"]').first().text().trim();
    const homeTeam = $('[id*="lblHomeTeam"]').text().trim() || $('[id*="lblHome"]').first().text().trim();
    result.awayTeam = awayTeam;
    result.homeTeam = homeTeam;

    // Extract score
    const awayScore = $('[id*="lblAwayScore"]').text().trim() || $('[id*="lblAwayRuns"]').text().trim();
    const homeScore = $('[id*="lblHomeScore"]').text().trim() || $('[id*="lblHomeRuns"]').text().trim();
    result.awayScore = parseInt(awayScore) || 0;
    result.homeScore = parseInt(homeScore) || 0;

    // Try to get game status
    const status = $('[id*="lblStatus"]').text().trim() || $('[id*="lblGameStatus"]').text().trim();
    result.status = status;

    return result;
  } catch (err) {
    console.log(`[scraper] Failed to fetch line score for game ${pgGameId}: ${err.message}`);
    return null;
  }
}

module.exports = { scrapeGameLineScore };
