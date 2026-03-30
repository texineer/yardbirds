const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'bleacherbox.db');

async function seed() {
  const SQL = await initSqlJs();
  const buf = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buf);

  // Create two demo teams
  db.run(`INSERT OR IGNORE INTO teams (pg_org_id, pg_team_id, name, age_group, hometown, classification, slug)
    VALUES (99901, 99901, 'Demo Eagles', '12U', 'Austin, TX', 'Major', 'demo-eagles')`);
  db.run(`INSERT OR IGNORE INTO teams (pg_org_id, pg_team_id, name, age_group, hometown, classification, slug)
    VALUES (99902, 99902, 'Demo Sharks', '12U', 'Dallas, TX', 'Major', 'demo-sharks')`);

  // Eagles roster (12 players)
  const eagles = [
    ['Ethan Rivera', '1', 'SS', 'R', 'R'],
    ['Mason Clark', '7', 'CF', 'L', 'L'],
    ['Liam Johnson', '22', 'P', 'R', 'R'],
    ['Noah Williams', '5', '1B', 'L', 'R'],
    ['Jackson Lee', '14', 'C', 'R', 'R'],
    ['Aiden Brown', '3', '3B', 'R', 'R'],
    ['Lucas Davis', '11', 'LF', 'L', 'L'],
    ['Carter Wilson', '8', '2B', 'R', 'R'],
    ['Owen Martinez', '19', 'RF', 'R', 'R'],
    ['Jayden Thomas', '33', 'DH', 'L', 'R'],
    ['Caleb Anderson', '15', 'P', 'R', 'R'],
    ['Dylan Taylor', '21', 'P', 'R', 'L'],
  ];
  for (const [name, num, pos, bats, throws] of eagles) {
    db.run(`INSERT OR IGNORE INTO players (pg_org_id, pg_team_id, name, number, position, bats, throws)
      VALUES (99901, 99901, ?, ?, ?, ?, ?)`, [name, num, pos, bats, throws]);
  }

  // Sharks roster (12 players)
  const sharks = [
    ['Tyler Garcia', '2', 'SS', 'R', 'R'],
    ['Ryan Mitchell', '10', 'CF', 'R', 'R'],
    ['Jake Robinson', '18', 'P', 'L', 'L'],
    ['Brandon Hall', '44', '1B', 'R', 'R'],
    ['Connor Young', '6', 'C', 'R', 'R'],
    ['Austin King', '9', '3B', 'L', 'R'],
    ['Chase Wright', '12', 'LF', 'R', 'R'],
    ['Bryce Lopez', '4', '2B', 'R', 'R'],
    ['Nolan Hill', '17', 'RF', 'L', 'L'],
    ['Gavin Scott', '25', 'DH', 'R', 'R'],
    ['Landon Green', '31', 'P', 'R', 'R'],
    ['Colton Adams', '20', 'P', 'R', 'R'],
  ];
  for (const [name, num, pos, bats, throws] of sharks) {
    db.run(`INSERT OR IGNORE INTO players (pg_org_id, pg_team_id, name, number, position, bats, throws)
      VALUES (99902, 99902, ?, ?, ?, ?, ?)`, [name, num, pos, bats, throws]);
  }

  // Assign global admin (user id 1) as admin on both demo teams
  db.run(`INSERT OR IGNORE INTO user_team_roles (user_id, pg_org_id, pg_team_id, role) VALUES (1, 99901, 99901, 'admin')`);
  db.run(`INSERT OR IGNORE INTO user_team_roles (user_id, pg_org_id, pg_team_id, role) VALUES (1, 99902, 99902, 'admin')`);

  // Save
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));

  // Verify
  const teams = db.exec("SELECT slug, name, age_group FROM teams WHERE pg_org_id IN (99901, 99902)");
  console.log('Teams created:');
  for (const row of teams[0]?.values || []) {
    console.log(`  ${row[0]} - ${row[1]} (${row[2]})`);
  }
  const ec = db.exec("SELECT COUNT(*) FROM players WHERE pg_org_id = 99901");
  const sc = db.exec("SELECT COUNT(*) FROM players WHERE pg_org_id = 99902");
  console.log(`Eagles: ${ec[0].values[0][0]} players`);
  console.log(`Sharks: ${sc[0].values[0][0]} players`);
  console.log('Done!');
}

seed().catch(err => { console.error(err); process.exit(1); });
