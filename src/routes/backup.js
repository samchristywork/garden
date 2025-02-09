const { Router } = require('express');
const db = require('../db');

const router = Router();

const TABLES = [
  'plants',
  'garden_beds',
  'bed_cells',
  'calendar_events',
  'tasks',
  'journal_entries',
  'harvest_logs',
  'bed_templates',
  'bed_template_cells',
];

// GET /api/backup - download a full JSON dump of the database
router.get('/', (req, res) => {
  const backup = {
    version: 1,
    exported_at: new Date().toISOString(),
    tables: {},
  };
  for (const table of TABLES) {
    backup.tables[table] = db.prepare(`SELECT * FROM ${table}`).all();
  }
  const filename = `garden-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(backup);
});

// POST /api/backup/restore - restore the database from a JSON backup
router.post('/restore', (req, res) => {
  const backup = req.body;

  if (!backup || backup.version !== 1 || !backup.tables || typeof backup.tables !== 'object') {
    return res.status(400).json({ error: 'Invalid backup file format' });
  }

  const unknownTables = Object.keys(backup.tables).filter(t => !TABLES.includes(t));
  if (unknownTables.length) {
    return res.status(400).json({ error: `Unrecognized tables: ${unknownTables.join(', ')}` });
  }

  try {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('BEGIN');
    // Delete in reverse dependency order
    for (const table of [...TABLES].reverse()) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    // Reset autoincrement counters (sqlite_sequence may not exist on a fresh DB)
    const hasSeq = db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`
    ).get();
    if (hasSeq) {
      db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES.map(() => '?').join(',')})`).run(...TABLES);
    }
    // Insert in dependency order
    for (const table of TABLES) {
      const rows = backup.tables[table];
      if (!rows || !rows.length) continue;
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(', ');
      const stmt = db.prepare(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`
      );
      for (const row of rows) {
        stmt.run(cols.map(c => row[c]));
      }
    }
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = ON');
    res.json({ ok: true });
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    db.exec('PRAGMA foreign_keys = ON');
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
