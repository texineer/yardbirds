const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const { scrapeAll } = require('./scrapers/run');
const { getDb, closeDb } = require('./db/schema');

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
    console.log(`[server] Yardbirds API running on http://localhost:${PORT}`);
    console.log(`[server] API docs: http://localhost:${PORT}/api/teams/50903/276649`);
  });

  // Cron: scrape every 6 hours (adjust as needed)
  // Format: minute hour * * *
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Starting scheduled scrape...');
    try {
      await scrapeAll();
    } catch (err) {
      console.error('[cron] Scrape failed:', err.message);
    }
  });

  // Run initial scrape if DB is empty
  const { getTeam } = require('./db/queries');
  const team = await getTeam(50903, 276649);
  if (!team) {
    console.log('[server] No data found, running initial scrape...');
    scrapeAll().catch(err => console.error('[server] Initial scrape failed:', err.message));
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
