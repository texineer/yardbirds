const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'yardbirds.db');

let db = null;
let initPromise = null;

async function getDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initSchema();
    return db;
  })();

  return initPromise;
}

function initSchema() {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS teams (
      pg_org_id INTEGER NOT NULL,
      pg_team_id INTEGER NOT NULL,
      name TEXT,
      age_group TEXT,
      hometown TEXT,
      classification TEXT,
      record TEXT,
      pg_url TEXT,
      last_scraped TEXT,
      PRIMARY KEY (pg_org_id, pg_team_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pg_org_id INTEGER NOT NULL,
      pg_team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      number TEXT,
      position TEXT,
      bats TEXT,
      throws TEXT,
      grad_year TEXT,
      height TEXT,
      weight TEXT,
      hometown TEXT,
      UNIQUE(pg_org_id, pg_team_id, name)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      pg_event_id INTEGER PRIMARY KEY,
      name TEXT,
      start_date TEXT,
      end_date TEXT,
      location TEXT,
      pg_url TEXT,
      last_scraped TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS team_tournaments (
      pg_org_id INTEGER NOT NULL,
      pg_team_id INTEGER NOT NULL,
      pg_event_id INTEGER NOT NULL,
      PRIMARY KEY (pg_org_id, pg_team_id, pg_event_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pg_game_id INTEGER UNIQUE,
      pg_event_id INTEGER,
      team_org_id INTEGER NOT NULL,
      team_id INTEGER NOT NULL,
      opponent_name TEXT,
      opponent_org_id INTEGER,
      opponent_team_id INTEGER,
      game_date TEXT,
      game_time TEXT,
      field TEXT,
      score_us INTEGER,
      score_them INTEGER,
      result TEXT,
      pg_box_url TEXT,
      pg_recap_url TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pitch_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER,
      pg_event_id INTEGER,
      player_name TEXT NOT NULL,
      team_name TEXT,
      pitches INTEGER,
      innings REAL,
      strikeouts INTEGER,
      walks INTEGER
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_games_team ON games(team_org_id, team_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_games_event ON games(pg_event_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_pitch_counts_game ON pitch_counts(game_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_pitch_counts_event ON pitch_counts(pg_event_id)');
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    initPromise = null;
  }
}

module.exports = { getDb, saveDb, closeDb };
