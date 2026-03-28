const express = require('express');
const router = express.Router();
const queries = require('../db/queries');
const { scrapeAll } = require('../scrapers/run');
const { scrapeTournamentSchedule } = require('../scrapers/tournament');

// Pitch count rules by age group
const PITCH_RULES = {
  '8U':  { dailyMax: 50,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }] },
  '9U':  { dailyMax: 75,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '10U': { dailyMax: 75,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '11U': { dailyMax: 85,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '12U': { dailyMax: 85,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '13U': { dailyMax: 95,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '14U': { dailyMax: 95,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 66, rest: 4 }] },
  '15U': { dailyMax: 95,  thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 76, rest: 4 }] },
  '16U': { dailyMax: 105, thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 76, rest: 4 }] },
  '17U': { dailyMax: 105, thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 76, rest: 4 }] },
  '18U': { dailyMax: 105, thresholds: [{ pitches: 1, rest: 0 }, { pitches: 21, rest: 1 }, { pitches: 36, rest: 2 }, { pitches: 51, rest: 3 }, { pitches: 76, rest: 4 }] },
};

// GET /api/pitch-rules/:ageGroup
router.get('/pitch-rules/:ageGroup', (req, res) => {
  const rules = PITCH_RULES[req.params.ageGroup.toUpperCase()];
  if (!rules) return res.status(404).json({ error: 'Unknown age group' });
  res.json(rules);
});

// GET /api/pitch-rules
router.get('/pitch-rules', (req, res) => {
  res.json(PITCH_RULES);
});

// GET /api/teams/:orgId/:teamId
router.get('/teams/:orgId/:teamId', async (req, res) => {
  try {
    const team = await queries.getTeam(parseInt(req.params.orgId), parseInt(req.params.teamId));
    if (!team) return res.status(404).json({ error: 'Team not found. Try scraping first.' });
    const players = await queries.getPlayers(team.pg_org_id, team.pg_team_id);
    const combinedRecord = await queries.getCombinedRecord(parseInt(req.params.orgId), parseInt(req.params.teamId));
    res.json({ ...team, players, combinedRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:orgId/:teamId/schedule
router.get('/teams/:orgId/:teamId/schedule', async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId);
    const teamId = parseInt(req.params.teamId);
    const games = await queries.getTeamGames(orgId, teamId);
    const tournaments = await queries.getTeamTournaments(orgId, teamId);

    // Get pitch count totals per game
    const gameIds = games.map(g => g.id);
    const pitchTotals = await queries.getGamesPitchTotals(gameIds);

    // Attach pitch totals to games
    const gamesWithPitches = games.map(g => ({
      ...g,
      totalPitches: pitchTotals[g.id]?.totalPitches || 0,
      pitcherCount: pitchTotals[g.id]?.pitcherCount || 0,
    }));

    // Group games by tournament
    const grouped = {};
    for (const t of tournaments) {
      grouped[t.pg_event_id] = { tournament: t, games: [] };
    }
    for (const g of gamesWithPitches) {
      if (g.pg_event_id && grouped[g.pg_event_id]) {
        grouped[g.pg_event_id].games.push(g);
      }
    }

    res.json({ tournaments: Object.values(grouped), ungroupedGames: gamesWithPitches.filter(g => !g.pg_event_id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:orgId/:teamId/tournaments
router.get('/teams/:orgId/:teamId/tournaments', async (req, res) => {
  try {
    const tournaments = await queries.getTeamTournaments(parseInt(req.params.orgId), parseInt(req.params.teamId));
    res.json(tournaments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/search?q=name
router.get('/teams/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (q.length < 2) return res.json([]);
    const teams = await queries.searchTeams(q);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId
router.get('/games/:gameId', async (req, res) => {
  try {
    const game = await queries.getGame(parseInt(req.params.gameId));
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const pitchCounts = await queries.getGamePitchCounts(game.id);
    res.json({ ...game, pitchCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId/pitchcounts
router.get('/games/:gameId/pitchcounts', async (req, res) => {
  try {
    const pitchCounts = await queries.getGamePitchCounts(parseInt(req.params.gameId));
    res.json(pitchCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId/daily-totals
router.get('/games/:gameId/daily-totals', async (req, res) => {
  try {
    const totals = await queries.getDailyPitchTotals(parseInt(req.params.gameId));
    res.json(totals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:eventId
router.get('/tournaments/:eventId', async (req, res) => {
  try {
    const tournament = await queries.getTournament(parseInt(req.params.eventId));
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    const games = await queries.getTournamentGames(tournament.pg_event_id);
    res.json({ ...tournament, games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:eventId/full-schedule - scrape all games from PG event page
router.get('/tournaments/:eventId/full-schedule', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const tournament = await queries.getTournament(eventId);
    // Only scrape PG tournament schedules (FT doesn't have accessible schedule pages)
    if (tournament && tournament.source === 'ft') {
      return res.json({ tournament, games: [] });
    }
    const games = await scrapeTournamentSchedule(eventId);
    res.json({ tournament, games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/:eventId/pitching-report
router.get('/tournaments/:eventId/pitching-report', async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    // FT tournaments have no pitch count data
    const tournament = await queries.getTournament(eventId);
    if (tournament && tournament.source === 'ft') {
      return res.json({ totals: [], details: [] });
    }
    const totals = await queries.getTournamentPitcherTotals(eventId);
    const details = await queries.getTournamentPitchCounts(eventId);
    res.json({ totals, details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scrape/:orgId/:teamId - trigger manual scrape
router.post('/scrape/:orgId/:teamId', async (req, res) => {
  try {
    const orgId = parseInt(req.params.orgId);
    const teamId = parseInt(req.params.teamId);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    res.json({ status: 'started', message: 'Scrape started in background' });

    // Run scrape in background (don't await)
    scrapeAll(orgId, teamId, year).catch(err => {
      console.error(`[api] Background scrape failed: ${err.message}`);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
