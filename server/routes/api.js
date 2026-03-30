const express = require('express');
const router = express.Router();
const queries = require('../db/queries');
const { scrapeAll } = require('../scrapers/run');
const { scrapeTournamentSchedule } = require('../scrapers/tournament');
const { requireAuth, requireTeamRole } = require('../middleware/auth');

// GET /api/teams - list all registered teams
router.get('/teams', async (req, res) => {
  try {
    const teams = await queries.getAllTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/by-slug/:slug - get team by URL slug
router.get('/teams/by-slug/:slug', async (req, res) => {
  try {
    const team = await queries.getTeamBySlug(req.params.slug);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const combinedRecord = await queries.getCombinedRecord(team.pg_org_id, team.pg_team_id);
    const players = await queries.getPlayers(team.pg_org_id, team.pg_team_id);
    res.json({ ...team, players, combinedRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams - register a new team (requires auth, creator becomes admin)
router.post('/teams', requireAuth, async (req, res) => {
  try {
    const { slug, pgOrgId, pgTeamId, name, ageGroup, ftTeamUuid, ftSeasons, logoUrl } = req.body;
    if (!slug || !pgOrgId || !pgTeamId) return res.status(400).json({ error: 'slug, pgOrgId, pgTeamId required' });
    await queries.registerTeam({ slug, pgOrgId, pgTeamId, name: name || '', ageGroup: ageGroup || '', ftTeamUuid, ftSeasons, logoUrl });
    // Auto-assign admin role to creator
    await queries.setUserTeamRole(req.user.id, parseInt(pgOrgId), parseInt(pgTeamId), 'admin');
    res.json({ status: 'ok', slug });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// GET /api/games/:gameId/opponent-pitchers
router.get('/games/:gameId/opponent-pitchers', async (req, res) => {
  try {
    const game = await queries.getGame(parseInt(req.params.gameId));
    if (!game) return res.status(404).json({ error: 'Game not found' });
    if (!game.pg_event_id) {
      return res.json({ opponentName: game.opponent_name || 'Unknown', opponentPitchers: [], ourPitchers: [] });
    }
    // Get our team name from pitch counts (it's stored as team_name)
    const team = await queries.getTeam(game.team_org_id, game.team_id);
    const ourTeamName = team ? team.name : '';
    const opponentPitchers = game.opponent_name ? await queries.getOpponentPitcherTotals(game.pg_event_id, game.opponent_name) : [];
    const ourPitchers = ourTeamName ? await queries.getOpponentPitcherTotals(game.pg_event_id, ourTeamName) : [];
    res.json({ opponentName: game.opponent_name, ourTeamName, opponentPitchers, ourPitchers });
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

// ── Live Scorebook ────────────────────────────────────────────────────────────

const requireScorekeeper = requireTeamRole(['admin', 'scorekeeper']);

// GET /api/games/:gameId/scorebook
router.get('/games/:gameId/scorebook', async (req, res) => {
  try {
    const data = await queries.getFullScorebookState(parseInt(req.params.gameId));
    if (!data) return res.status(404).json({ scorebook: null });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:gameId/live-pitch-counts
router.get('/games/:gameId/live-pitch-counts', async (req, res) => {
  try {
    const counts = await queries.getLivePitchCounts(parseInt(req.params.gameId));
    res.json(counts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/init
router.post('/games/:gameId/scorebook/init', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { homeTeamName, awayTeamName, ourSide } = req.body;
    await queries.initScorebookState({ gameId, homeTeamName, awayTeamName, ourSide: ourSide || 'home' });
    const state = await queries.getScorebookState(gameId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/start
router.post('/games/:gameId/scorebook/start', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    await queries.startGame(gameId);
    const state = await queries.getScorebookState(gameId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:gameId/scorebook/state
router.put('/games/:gameId/scorebook/state', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { inning, half, outs, balls, strikes, runner1b, runner2b, runner3b, status } = req.body;
    await queries.updateScorebookState({ gameId, status, inning, half, outs, balls, strikes, runner1b, runner2b, runner3b });
    const state = await queries.getScorebookState(gameId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:gameId/scorebook/lineup
router.put('/games/:gameId/scorebook/lineup', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { teamSide, entries } = req.body;
    for (const e of entries) {
      if (e.playerName) {
        await queries.upsertLineupEntry({ gameId, teamSide, battingOrder: e.battingOrder, playerName: e.playerName, jerseyNumber: e.jerseyNumber, position: e.position });
      }
    }
    const lineup = await queries.getLineup(gameId, teamSide);
    res.json(lineup);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:gameId/scorebook/inning/:inning/:half
router.put('/games/:gameId/scorebook/inning/:inning/:half', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const inning = parseInt(req.params.inning);
    const half = req.params.half;
    const { runs, hits, errors } = req.body;
    await queries.upsertInningScore({ gameId, inning, half, runs: runs ?? 0, hits: hits ?? 0, errors: errors ?? 0 });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/plate-appearance
router.post('/games/:gameId/scorebook/plate-appearance', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { inning, half, battingOrderPos, teamSide, playerName, pitcherName } = req.body;
    const paId = await queries.insertPlateAppearance({ gameId, inning, half, battingOrderPos, teamSide, playerName, pitcherName });
    res.json({ paId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:gameId/scorebook/plate-appearance/:paId
router.put('/games/:gameId/scorebook/plate-appearance/:paId', requireScorekeeper, async (req, res) => {
  try {
    const paId = parseInt(req.params.paId);
    const { outcome, rbi, pitchSequence } = req.body;
    await queries.updatePlateAppearanceOutcome({ paId, outcome, rbi, pitchSequence });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/pitch
router.post('/games/:gameId/scorebook/pitch', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { paId, pitcherName, pitcherTeamSide, pitchType, inning, half } = req.body;
    await queries.logPitch({ gameId, paId, pitcherName, pitcherTeamSide, pitchType, inning, half });
    const pitchCounts = await queries.getLivePitchCounts(gameId);
    res.json({ ok: true, pitchCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/games/:gameId/scorebook/pitch/last
router.delete('/games/:gameId/scorebook/pitch/last', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    await queries.deleteLastPitch(gameId);
    const pitchCounts = await queries.getLivePitchCounts(gameId);
    res.json({ ok: true, pitchCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/substitution
router.post('/games/:gameId/scorebook/substitution', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { teamSide, battingOrder, newPlayerName, jerseyNumber, position } = req.body;
    await queries.recordSubstitution({ gameId, teamSide, battingOrder, newPlayerName, jerseyNumber, position });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/:gameId/scorebook/end
router.post('/games/:gameId/scorebook/end', requireScorekeeper, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const sbState = await queries.getScorebookState(gameId);
    const inningScores = await queries.getInningScores(gameId);
    const ourHalf = sbState?.our_side === 'home' ? 'bottom' : 'top';
    const themHalf = sbState?.our_side === 'home' ? 'top' : 'bottom';
    const scoreUs = inningScores.filter(s => s.half === ourHalf).reduce((sum, s) => sum + s.runs, 0);
    const scoreThem = inningScores.filter(s => s.half === themHalf).reduce((sum, s) => sum + s.runs, 0);
    await queries.endGame(gameId, scoreUs, scoreThem);
    const game = await queries.getGame(gameId);
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Team Member Management ───────────────────────────────────────────────────

const requireAdmin = requireTeamRole(['admin']);

// GET /api/teams/:orgId/:teamId/members
router.get('/teams/:orgId/:teamId/members', requireAdmin, async (req, res) => {
  try {
    const members = await queries.getTeamMembers(parseInt(req.params.orgId), parseInt(req.params.teamId));
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:orgId/:teamId/members - add member by email
router.post('/teams/:orgId/:teamId/members', requireAdmin, async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || !role) return res.status(400).json({ error: 'email and role required' });
    if (!['admin', 'scorekeeper', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const user = await queries.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'No user found with that email' });
    await queries.setUserTeamRole(user.id, parseInt(req.params.orgId), parseInt(req.params.teamId), role);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:orgId/:teamId/members/:userId - update role
router.put('/teams/:orgId/:teamId/members/:userId', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !['admin', 'scorekeeper', 'viewer'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await queries.setUserTeamRole(parseInt(req.params.userId), parseInt(req.params.orgId), parseInt(req.params.teamId), role);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:orgId/:teamId/members/:userId - remove member
router.delete('/teams/:orgId/:teamId/members/:userId', requireAdmin, async (req, res) => {
  try {
    await queries.removeUserTeamRole(parseInt(req.params.userId), parseInt(req.params.orgId), parseInt(req.params.teamId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scrape/:slug - trigger manual scrape for a team by slug
router.post('/scrape/:slug', async (req, res) => {
  try {
    const { scrapeBySlug } = require('../scrapers/run');
    res.json({ status: 'started', message: 'Scrape started in background' });
    scrapeBySlug(req.params.slug).catch(err => {
      console.error(`[api] Background scrape failed: ${err.message}`);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scrape - scrape all registered teams
router.post('/scrape', async (req, res) => {
  try {
    const { scrapeAllTeams } = require('../scrapers/run');
    res.json({ status: 'started', message: 'Scraping all teams in background' });
    scrapeAllTeams().catch(err => {
      console.error(`[api] Background scrape-all failed: ${err.message}`);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
