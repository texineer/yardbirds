const { getDb, saveDb } = require('./schema');

// Helper: sql.js returns arrays of objects via stmt approach; this helper simplifies
function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// Teams
async function upsertTeam({ pgOrgId, pgTeamId, name, ageGroup, hometown, classification, record, pgUrl }) {
  const db = await getDb();
  run(db, `
    INSERT INTO teams (pg_org_id, pg_team_id, name, age_group, hometown, classification, record, pg_url, last_scraped)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pg_org_id, pg_team_id) DO UPDATE SET
      name=excluded.name, age_group=excluded.age_group, hometown=excluded.hometown,
      classification=excluded.classification, record=excluded.record, pg_url=excluded.pg_url,
      last_scraped=datetime('now')
  `, [pgOrgId, pgTeamId, name, ageGroup, hometown, classification, record, pgUrl]);
}

async function getTeam(orgId, teamId) {
  const db = await getDb();
  return get(db, 'SELECT * FROM teams WHERE pg_org_id = ? AND pg_team_id = ?', [orgId, teamId]);
}

async function searchTeams(query) {
  const db = await getDb();
  return all(db, 'SELECT * FROM teams WHERE name LIKE ? ORDER BY name LIMIT 50', [`%${query}%`]);
}

// Players
async function upsertPlayer({ pgOrgId, pgTeamId, name, number, position, bats, throws: th, gradYear, height, weight, hometown }) {
  const db = await getDb();
  run(db, `
    INSERT INTO players (pg_org_id, pg_team_id, name, number, position, bats, throws, grad_year, height, weight, hometown)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pg_org_id, pg_team_id, name) DO UPDATE SET
      number=excluded.number, position=excluded.position, bats=excluded.bats,
      throws=excluded.throws, grad_year=excluded.grad_year, height=excluded.height,
      weight=excluded.weight, hometown=excluded.hometown
  `, [pgOrgId, pgTeamId, name, number, position, bats, th, gradYear, height, weight, hometown]);
}

async function getPlayers(orgId, teamId) {
  const db = await getDb();
  return all(db, 'SELECT * FROM players WHERE pg_org_id = ? AND pg_team_id = ? ORDER BY name', [orgId, teamId]);
}

// Tournaments
async function upsertTournament({ pgEventId, name, startDate, endDate, location, pgUrl }) {
  const db = await getDb();
  run(db, `
    INSERT INTO tournaments (pg_event_id, name, start_date, end_date, location, pg_url, last_scraped)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(pg_event_id) DO UPDATE SET
      name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date,
      location=excluded.location, pg_url=excluded.pg_url, last_scraped=datetime('now')
  `, [pgEventId, name, startDate, endDate, location, pgUrl]);
}

async function linkTeamTournament(orgId, teamId, eventId) {
  const db = await getDb();
  run(db, 'INSERT OR IGNORE INTO team_tournaments (pg_org_id, pg_team_id, pg_event_id) VALUES (?, ?, ?)', [orgId, teamId, eventId]);
}

async function getTeamTournaments(orgId, teamId) {
  const db = await getDb();
  return all(db, `
    SELECT t.* FROM tournaments t
    JOIN team_tournaments tt ON t.pg_event_id = tt.pg_event_id
    WHERE tt.pg_org_id = ? AND tt.pg_team_id = ?
    ORDER BY t.start_date DESC
  `, [orgId, teamId]);
}

async function getTournament(eventId) {
  const db = await getDb();
  return get(db, 'SELECT * FROM tournaments WHERE pg_event_id = ?', [eventId]);
}

// Games
async function upsertGame({ pgGameId, pgEventId, teamOrgId, teamId, opponentName, opponentOrgId, opponentTeamId, gameDate, gameTime, field, scoreUs, scoreThem, result, pgBoxUrl, pgRecapUrl }) {
  const db = await getDb();
  run(db, `
    INSERT INTO games (pg_game_id, pg_event_id, team_org_id, team_id, opponent_name, opponent_org_id, opponent_team_id, game_date, game_time, field, score_us, score_them, result, pg_box_url, pg_recap_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(pg_game_id) DO UPDATE SET
      opponent_name=excluded.opponent_name, game_date=excluded.game_date, game_time=excluded.game_time,
      field=excluded.field, score_us=excluded.score_us, score_them=excluded.score_them,
      result=excluded.result, pg_box_url=excluded.pg_box_url, pg_recap_url=excluded.pg_recap_url
  `, [pgGameId, pgEventId, teamOrgId, teamId, opponentName, opponentOrgId, opponentTeamId, gameDate, gameTime, field, scoreUs, scoreThem, result, pgBoxUrl, pgRecapUrl]);
}

async function getTeamGames(orgId, teamId) {
  const db = await getDb();
  return all(db, `
    SELECT g.*, t.name as tournament_name FROM games g
    LEFT JOIN tournaments t ON g.pg_event_id = t.pg_event_id
    WHERE g.team_org_id = ? AND g.team_id = ?
    ORDER BY g.game_date DESC
  `, [orgId, teamId]);
}

async function getGame(gameId) {
  const db = await getDb();
  return get(db, `
    SELECT g.*, t.name as tournament_name FROM games g
    LEFT JOIN tournaments t ON g.pg_event_id = t.pg_event_id
    WHERE g.id = ?
  `, [gameId]);
}

async function getGameByPgId(pgGameId) {
  const db = await getDb();
  return get(db, 'SELECT * FROM games WHERE pg_game_id = ?', [pgGameId]);
}

async function getTournamentGames(eventId) {
  const db = await getDb();
  return all(db, 'SELECT * FROM games WHERE pg_event_id = ? ORDER BY game_date', [eventId]);
}

// Pitch Counts
async function insertPitchCount({ gameId, pgEventId, playerName, teamName, pitches, innings, strikeouts, walks }) {
  const db = await getDb();
  run(db, `
    INSERT INTO pitch_counts (game_id, pg_event_id, player_name, team_name, pitches, innings, strikeouts, walks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [gameId, pgEventId, playerName, teamName, pitches, innings, strikeouts, walks]);
}

async function clearPitchCounts(gameId) {
  const db = await getDb();
  run(db, 'DELETE FROM pitch_counts WHERE game_id = ?', [gameId]);
}

async function clearTournamentPitchCounts(eventId) {
  const db = await getDb();
  run(db, 'DELETE FROM pitch_counts WHERE pg_event_id = ?', [eventId]);
}

async function getGamePitchCounts(gameId) {
  const db = await getDb();
  return all(db, 'SELECT * FROM pitch_counts WHERE game_id = ? ORDER BY pitches DESC', [gameId]);
}

async function getTournamentPitchCounts(eventId) {
  const db = await getDb();
  return all(db, `
    SELECT * FROM pitch_counts
    WHERE pg_event_id = ?
    ORDER BY team_name, player_name
  `, [eventId]);
}

async function getTournamentPitcherTotals(eventId) {
  const db = await getDb();
  return all(db, `
    SELECT
      player_name,
      team_name,
      SUM(pitches) as total_pitches,
      COUNT(*) as appearances,
      SUM(innings) as total_innings,
      MAX(pitches) as max_pitches
    FROM pitch_counts
    WHERE pg_event_id = ?
    GROUP BY player_name, team_name
    ORDER BY total_pitches DESC
  `, [eventId]);
}

// Daily pitch totals: given a game, find all pitchers on the same date + team and sum their pitches
async function getDailyPitchTotals(gameId) {
  const db = await getDb();
  return all(db, `
    SELECT
      pc.player_name,
      pc.team_name,
      SUM(pc.pitches) as total_pitches,
      COUNT(*) as appearances,
      SUM(pc.innings) as total_innings,
      SUM(pc.strikeouts) as total_strikeouts,
      SUM(pc.walks) as total_walks
    FROM pitch_counts pc
    JOIN games g2 ON pc.game_id = g2.id
    JOIN games g1 ON g1.id = ?
    WHERE g2.game_date = g1.game_date
      AND g2.pg_event_id = g1.pg_event_id
    GROUP BY pc.player_name, pc.team_name
    ORDER BY pc.team_name, total_pitches DESC
  `, [gameId]);
}

// Get total pitch count per game (for badge display)
async function getGamesPitchTotals(gameIds) {
  if (!gameIds.length) return {};
  const db = await getDb();
  const placeholders = gameIds.map(() => '?').join(',');
  const rows = all(db, `
    SELECT game_id, SUM(pitches) as total_pitches, COUNT(*) as pitcher_count
    FROM pitch_counts
    WHERE game_id IN (${placeholders})
    GROUP BY game_id
  `, gameIds);
  const map = {};
  for (const r of rows) map[r.game_id] = { totalPitches: r.total_pitches, pitcherCount: r.pitcher_count };
  return map;
}

// Five Tool upserts
async function upsertFtTournament({ eventId, name, startDate, endDate, location, ftUrl }) {
  const db = await getDb();
  run(db, `
    INSERT INTO tournaments (pg_event_id, name, start_date, end_date, location, pg_url, last_scraped, source)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'ft')
    ON CONFLICT(pg_event_id) DO UPDATE SET
      name=excluded.name, start_date=excluded.start_date, end_date=excluded.end_date,
      location=excluded.location, pg_url=excluded.pg_url, last_scraped=datetime('now'), source='ft'
  `, [eventId, name, startDate, endDate, location, ftUrl]);
}

async function upsertFtGame({ sourceGameKey, pgEventId, teamOrgId, teamId, opponentName, gameDate, gameTime, field, scoreUs, scoreThem, result }) {
  const db = await getDb();
  const existing = get(db, 'SELECT id FROM games WHERE source_game_key = ?', [sourceGameKey]);
  if (existing) {
    run(db, `
      UPDATE games SET opponent_name=?, game_date=?, game_time=COALESCE(?, game_time), field=COALESCE(?, field), score_us=?, score_them=?, result=?
      WHERE source_game_key=?
    `, [opponentName, gameDate, gameTime || null, field || null, scoreUs, scoreThem, result, sourceGameKey]);
  } else {
    run(db, `
      INSERT INTO games (pg_event_id, team_org_id, team_id, opponent_name, game_date, game_time, field, score_us, score_them, result, source, source_game_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ft', ?)
    `, [pgEventId, teamOrgId, teamId, opponentName, gameDate, gameTime || '', field || '', scoreUs, scoreThem, result, sourceGameKey]);
  }
}

// Combined record across all sources
async function getCombinedRecord(orgId, teamId) {
  const db = await getDb();
  return get(db, `
    SELECT
      SUM(CASE WHEN result = 'W' THEN 1 ELSE 0 END) as wins,
      SUM(CASE WHEN result = 'L' THEN 1 ELSE 0 END) as losses,
      SUM(CASE WHEN result = 'T' THEN 1 ELSE 0 END) as ties
    FROM games WHERE team_org_id = ? AND team_id = ?
  `, [orgId, teamId]);
}

// Opponent pitcher totals for a tournament
async function getOpponentPitcherTotals(eventId, opponentName) {
  const db = await getDb();
  return all(db, `
    SELECT
      player_name,
      SUM(pitches) as total_pitches,
      COUNT(*) as appearances,
      SUM(innings) as total_innings,
      MAX(pitches) as max_pitches
    FROM pitch_counts
    WHERE pg_event_id = ? AND team_name = ?
    GROUP BY player_name
    ORDER BY total_pitches DESC
  `, [eventId, opponentName]);
}

module.exports = {
  upsertTeam, getTeam, searchTeams,
  upsertPlayer, getPlayers,
  upsertTournament, linkTeamTournament, getTeamTournaments, getTournament,
  upsertGame, getTeamGames, getGame, getGameByPgId, getTournamentGames,
  insertPitchCount, clearPitchCounts, clearTournamentPitchCounts, getGamePitchCounts, getTournamentPitchCounts, getTournamentPitcherTotals,
  getDailyPitchTotals, getGamesPitchTotals,
  upsertFtTournament, upsertFtGame, getCombinedRecord, getOpponentPitcherTotals,
};
