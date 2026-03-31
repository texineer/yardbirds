const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const queries = require('../db/queries');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const existing = await queries.getUserByEmail(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = await queries.createUser({ email: email.toLowerCase(), passwordHash, displayName });

    req.session.userId = id;
    const user = await queries.getUserById(id);
    const roles = await queries.getUserTeamRoles(id);
    res.json({ user, roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await queries.getUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    req.session.userId = user.id;
    const roles = await queries.getUserTeamRoles(user.id);
    const userObj = await queries.getUserById(user.id);
    res.json({ user: userObj, roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    if (!req.session?.userId) return res.json({ user: null, roles: [] });
    const user = await queries.getUserById(req.session.userId);
    if (!user) return res.json({ user: null, roles: [] });
    const roles = await queries.getUserTeamRoles(user.id);
    res.json({ user, roles });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  try {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await queries.getUserByEmail((await queries.getUserById(req.session.userId)).email);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    const { getDb, saveDb } = require('../db/schema');
    const db = await getDb();
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
    saveDb();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
