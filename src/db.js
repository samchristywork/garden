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
`);

module.exports = db;
