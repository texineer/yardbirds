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
const isProd = process.env.NODE_ENV === 'production';

// A signed-session secret is mandatory in production — refuse to start with the
// known dev fallback so cookies can't be forged with a public secret.
const SESSION_SECRET = process.env.SESSION_SECRET || (isProd ? null : 'bleacherbox-dev-secret');
if (!SESSION_SECRET) {
  console.error('[server] SESSION_SECRET must be set in production. Refusing to start.');
  process.exit(1);
}

// CORS: restrict to an explicit allowlist in production; reflect localhost in dev.
// Set ALLOWED_ORIGINS to a comma-separated list of front-end origins.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);
const corsOptions = {
  credentials: true,
  origin(origin, cb) {
    // Same-origin / non-browser requests send no Origin header — allow them.
    if (!origin) return cb(null, true);
    if (!isProd) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Session
app.use(session({
  store: new SqliteSessionStore(),
  secret: SESSION_SECRET,
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
