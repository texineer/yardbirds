const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const { scrapeAllTeams } = require('./scrapers/run');
const { getDb, closeDb } = require('./db/schema');
const { getAllTeams } = require('./db/queries');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

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
