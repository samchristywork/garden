const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'garden.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS plants (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    type             TEXT,
    variety          TEXT,
    sun_requirement  TEXT,
    water_needs      TEXT,
    spacing_inches   INTEGER,
    days_to_maturity INTEGER,
    planting_depth   TEXT,
    color            TEXT NOT NULL DEFAULT '#4a7c4e',
    notes            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS garden_beds (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    rows       INTEGER NOT NULL DEFAULT 4,
    cols       INTEGER NOT NULL DEFAULT 6,
    notes      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bed_cells (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    bed_id   INTEGER NOT NULL REFERENCES garden_beds(id) ON DELETE CASCADE,
    row_num  INTEGER NOT NULL,
    col_num  INTEGER NOT NULL,
    plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    UNIQUE(bed_id, row_num, col_num)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    event_date TEXT NOT NULL,
    type       TEXT NOT NULL DEFAULT 'other',
    plant_id   INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    bed_id     INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    notes      TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
