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

  CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'other',
    due_date     TEXT,
    plant_id     INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    bed_id       INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    notes        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    content    TEXT,
    entry_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    plant_id   INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    bed_id     INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS harvest_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    plant_id     INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    bed_id       INTEGER REFERENCES garden_beds(id) ON DELETE SET NULL,
    quantity     REAL NOT NULL,
    unit         TEXT NOT NULL DEFAULT 'lbs',
    harvested_at TEXT NOT NULL DEFAULT (date('now')),
    notes        TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try {
  db.exec(`ALTER TABLE calendar_events ADD COLUMN event_time TEXT`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`ALTER TABLE tasks ADD COLUMN spawned_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`ALTER TABLE calendar_events ADD COLUMN recurrence_rule TEXT`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`ALTER TABLE plants ADD COLUMN image_url TEXT`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bed_templates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      rows       INTEGER NOT NULL,
      cols       INTEGER NOT NULL,
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS bed_template_cells (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL REFERENCES bed_templates(id) ON DELETE CASCADE,
      row_num     INTEGER NOT NULL,
      col_num     INTEGER NOT NULL,
      plant_id    INTEGER REFERENCES plants(id) ON DELETE SET NULL,
      UNIQUE(template_id, row_num, col_num)
    );
  `);
} catch (e) { /* tables already exist */ }

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_bed_cells_plant_id ON bed_cells(plant_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_plant_id ON calendar_events(plant_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_bed_id ON calendar_events(bed_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_plant_id ON tasks(plant_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_bed_id ON tasks(bed_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_plant_id ON journal_entries(plant_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_bed_id ON journal_entries(bed_id);
    CREATE INDEX IF NOT EXISTS idx_harvest_logs_plant_id ON harvest_logs(plant_id);
    CREATE INDEX IF NOT EXISTS idx_harvest_logs_bed_id ON harvest_logs(bed_id);
  `);
} catch (e) { /* indexes already exist */ }

// Seed catalog only on fresh installs
const plantCount = db.prepare('SELECT COUNT(*) as c FROM plants').get();
if (plantCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO plants (name, type, variety, sun_requirement, water_needs, spacing_inches, days_to_maturity, planting_depth, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seeds = require('./seeds/plants.json');
  for (const s of seeds) {
    insert.run(s.name, s.type, s.variety, s.sun_requirement, s.water_needs, s.spacing_inches, s.days_to_maturity, s.planting_depth, s.color, s.notes);
  }
}

module.exports = db;
