const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { scrapeAllTeams } = require('./scrapers/run');
const { getDb, closeDb, seedGlobalAdmin } = require('./db/schema');
const { getAllTeams } = require('./db/queries');
const SqliteSessionStore = require('./db/sessionStore');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Session
app.use(session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET || 'bleacherbox-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Serve uploaded walkup audio files
app.use('/walkups', express.static(path.join(__dirname, '..', 'data', 'walkups')));

// Serve baseball card images
app.use('/cards', express.static(path.join(__dirname, '..', 'data', 'cards')));

// Serve static frontend (production)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

// Initialize DB and start server
async function start() {
  await getDb();
  await seedGlobalAdmin();
  console.log('[db] Database initialized');

  app.listen(PORT, () => {
    console.log(`[server] BleacherBox running on http://localhost:${PORT}`);
  });

  // Cron: scrape all registered teams every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Starting scheduled scrape for all teams...');
    try {
      await scrapeAllTeams();
    } catch (err) {
      console.error('[cron] Scrape failed:', err.message);
    }
  });

  // Run initial scrape if no registered teams have data
  const teams = await getAllTeams();
  if (teams.length === 0) {
    console.log('[server] No registered teams found. Add teams via POST /api/teams');
  } else {
    console.log(`[server] ${teams.length} registered team(s): ${teams.map(t => t.slug).join(', ')}`);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[server] Shutting down...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

start().catch(err => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
