const session = require('express-session');
const { getDb, saveDb } = require('./schema');

class SqliteSessionStore extends session.Store {
  constructor(options = {}) {
    super(options);
    this.cleanupInterval = options.cleanupInterval || 15 * 60 * 1000;
    this._startCleanup();
  }

  async get(sid, callback) {
    try {
      const db = await getDb();
      const stmt = db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?');
      stmt.bind([sid, Date.now()]);
      let row = null;
      if (stmt.step()) row = stmt.getAsObject();
      stmt.free();
      if (!row) return callback(null, null);
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  async set(sid, sess, callback) {
    try {
      const db = await getDb();
      const maxAge = sess.cookie?.maxAge || 7 * 24 * 60 * 60 * 1000;
      const expiredAt = Date.now() + maxAge;
      db.run(
        `INSERT INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expired_at=excluded.expired_at`,
        [sid, JSON.stringify(sess), expiredAt]
      );
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async destroy(sid, callback) {
    try {
      const db = await getDb();
      db.run('DELETE FROM sessions WHERE sid = ?', [sid]);
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  async touch(sid, sess, callback) {
    try {
      const db = await getDb();
      const maxAge = sess.cookie?.maxAge || 7 * 24 * 60 * 60 * 1000;
      const expiredAt = Date.now() + maxAge;
      db.run('UPDATE sessions SET expired_at = ? WHERE sid = ?', [expiredAt, sid]);
      saveDb();
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(async () => {
      try {
        const db = await getDb();
        db.run('DELETE FROM sessions WHERE expired_at < ?', [Date.now()]);
        saveDb();
      } catch {}
    }, this.cleanupInterval);
    if (this._cleanupTimer.unref) this._cleanupTimer.unref();
  }
}

module.exports = SqliteSessionStore;
