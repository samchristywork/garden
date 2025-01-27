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
    entry_date TEXT NOT NULL DEFAULT (date('now')),
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
  db.exec(`ALTER TABLE calendar_events ADD COLUMN recurrence_rule TEXT`);
} catch (e) { /* column already exists */ }

try {
  db.exec(`ALTER TABLE plants ADD COLUMN image_url TEXT`);
} catch (e) { /* column already exists */ }

// Seed catalog only on fresh installs
const plantCount = db.prepare('SELECT COUNT(*) as c FROM plants').get();
if (plantCount.c === 0) {
  const insert = db.prepare(`
    INSERT INTO plants (name, type, variety, sun_requirement, water_needs, spacing_inches, days_to_maturity, planting_depth, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seeds = [
    // Vegetables
    ['Tomato', 'Vegetable', 'Cherry', 'Full Sun', 'Moderate', 24, 70, '1/4 inch', '#c0392b', 'Stake or cage when tall. Pinch suckers for larger fruit.'],
    ['Tomato', 'Vegetable', 'Beefsteak', 'Full Sun', 'Moderate', 36, 85, '1/4 inch', '#e74c3c', 'Needs strong support. Deep water 2x/week.'],
    ['Zucchini', 'Vegetable', null, 'Full Sun', 'Moderate', 36, 55, '1 inch', '#27ae60', 'Harvest when 6-8 inches. Prolific producer.'],
    ['Cucumber', 'Vegetable', 'Bush Pickle', 'Full Sun', 'Moderate', 12, 50, '1 inch', '#2ecc71', 'Trellis to save space. Keep soil evenly moist.'],
    ['Bell Pepper', 'Vegetable', null, 'Full Sun', 'Moderate', 18, 75, '1/4 inch', '#f39c12', 'Needs warm soil. Mulch to retain moisture.'],
    ['Jalapeño', 'Vegetable', null, 'Full Sun', 'Low', 18, 70, '1/4 inch', '#e67e22', 'Hot and productive. Drought tolerant once established.'],
    ['Lettuce', 'Vegetable', 'Butterhead', 'Partial Shade', 'Moderate', 8, 55, '1/8 inch', '#82e0aa', 'Bolt resistant. Cut-and-come-again.'],
    ['Spinach', 'Vegetable', null, 'Partial Shade', 'Moderate', 6, 40, '1/2 inch', '#1e8449', 'Cool-season crop. Bolts in heat.'],
    ['Kale', 'Vegetable', 'Lacinato', 'Full Sun', 'Moderate', 18, 60, '1/2 inch', '#145a32', 'Frost improves flavor. Harvest outer leaves.'],
    ['Carrot', 'Vegetable', 'Nantes', 'Full Sun', 'Moderate', 3, 70, '1/4 inch', '#e67e22', 'Needs deep, loose soil. Thin to 3 inches.'],
    ['Radish', 'Vegetable', 'Cherry Belle', 'Full Sun', 'Moderate', 2, 25, '1/2 inch', '#c0392b', 'Fast grower. Great for marking slow rows.'],
    ['Beet', 'Vegetable', 'Detroit Dark Red', 'Full Sun', 'Moderate', 4, 55, '1/2 inch', '#922b21', 'Both roots and greens are edible.'],
    ['Green Bean', 'Vegetable', 'Bush Blue Lake', 'Full Sun', 'Moderate', 6, 55, '1 inch', '#27ae60', 'Bush type, no staking needed. Heavy producer.'],
    ['Pea', 'Vegetable', 'Sugar Snap', 'Full Sun', 'Moderate', 4, 60, '1 inch', '#a9cce3', 'Needs trellis. Cool-season, plant early.'],
    ['Broccoli', 'Vegetable', null, 'Full Sun', 'Moderate', 18, 80, '1/4 inch', '#1d8348', 'Harvest main head before flowers open. Side shoots follow.'],
    ['Cauliflower', 'Vegetable', null, 'Full Sun', 'Moderate', 24, 85, '1/4 inch', '#f7f9f9', 'Blanch heads by tying leaves over them.'],
    ['Cabbage', 'Vegetable', 'Early Jersey Wakefield', 'Full Sun', 'Moderate', 24, 65, '1/4 inch', '#a9dfbf', 'Cool-season. Watch for cabbage worms.'],
    ['Onion', 'Vegetable', 'Yellow Sweet Spanish', 'Full Sun', 'Low', 4, 110, '1/2 inch', '#f0b27a', 'Long day type. Cure bulbs before storing.'],
    ['Garlic', 'Vegetable', 'Hardneck', 'Full Sun', 'Low', 6, 240, '2 inches', '#fdfefe', 'Plant cloves in fall. Harvest when lower leaves brown.'],
    ['Potato', 'Vegetable', 'Yukon Gold', 'Full Sun', 'Moderate', 12, 80, '4 inches', '#f4d03f', 'Hill up soil as plants grow. Harvest after vines die.'],
    ['Sweet Corn', 'Vegetable', 'Silver Queen', 'Full Sun', 'Moderate', 12, 92, '1 inch', '#f9e79f', 'Plant in blocks of 4+ rows for pollination.'],
    ['Pumpkin', 'Vegetable', 'Sugar Pie', 'Full Sun', 'Moderate', 60, 100, '1 inch', '#e67e22', 'Needs lots of space. Great for fall harvest.'],
    ['Winter Squash', 'Vegetable', 'Butternut', 'Full Sun', 'Low', 48, 110, '1 inch', '#d68910', 'Cure after harvest for long storage.'],
    ['Eggplant', 'Vegetable', null, 'Full Sun', 'Moderate', 24, 80, '1/4 inch', '#7d3c98', 'Needs warm soil. Harvest while skin is glossy.'],
    // Herbs
    ['Basil', 'Herb', 'Sweet', 'Full Sun', 'Moderate', 12, 60, '1/4 inch', '#52be80', 'Pinch flowers to keep leafy. Plant near tomatoes.'],
    ['Basil', 'Herb', 'Thai', 'Full Sun', 'Moderate', 12, 60, '1/4 inch', '#1a5276', 'Licorice flavor. More heat tolerant than sweet basil.'],
    ['Parsley', 'Herb', 'Italian Flat Leaf', 'Full Sun', 'Moderate', 8, 70, '1/4 inch', '#28b463', 'Biennial. Soak seeds overnight before planting.'],
    ['Cilantro', 'Herb', null, 'Partial Shade', 'Moderate', 6, 45, '1/4 inch', '#a9dfbf', 'Bolts quickly in heat. Succession plant every 3 weeks.'],
    ['Dill', 'Herb', null, 'Full Sun', 'Low', 12, 40, '1/4 inch', '#a9cce3', 'Self-sows freely. Keep away from fennel.'],
    ['Mint', 'Herb', 'Spearmint', 'Partial Shade', 'Moderate', 18, 90, '1/4 inch', '#1abc9c', 'Very invasive. Grow in containers or buried pots.'],
    ['Chives', 'Herb', null, 'Full Sun', 'Low', 6, 80, '1/4 inch', '#82e0aa', 'Perennial. Edible purple flowers attract pollinators.'],
    ['Thyme', 'Herb', 'English', 'Full Sun', 'Low', 12, 85, '1/8 inch', '#d5d8dc', 'Drought tolerant perennial. Great for borders.'],
    ['Rosemary', 'Herb', null, 'Full Sun', 'Low', 24, 180, '1/4 inch', '#2874a6', 'Perennial in zones 7+. Excellent drainage required.'],
    ['Sage', 'Herb', 'Garden', 'Full Sun', 'Low', 18, 75, '1/4 inch', '#7fb3d3', 'Perennial. Prune hard in spring to keep compact.'],
    ['Oregano', 'Herb', 'Greek', 'Full Sun', 'Low', 12, 80, '1/8 inch', '#a04000', 'Perennial. Harvest before flowering for best flavor.'],
    ['Lavender', 'Herb', 'Hidcote', 'Full Sun', 'Low', 24, 90, '1/8 inch', '#9b59b6', 'Perennial. Excellent pollinator plant. Well-drained soil.'],
    ['Lemon Balm', 'Herb', null, 'Partial Shade', 'Moderate', 18, 60, '1/4 inch', '#f9e79f', 'Perennial. Calming tea herb. Can be invasive.'],
    ['Fennel', 'Herb', null, 'Full Sun', 'Low', 18, 65, '1/4 inch', '#f0e68c', 'Keep away from most vegetables. Host for swallowtail butterflies.'],
    // Flowers
    ['Sunflower', 'Flower', 'Mammoth', 'Full Sun', 'Low', 24, 80, '1 inch', '#f4d03f', 'Grows 6-12 ft. Great for pollinators and bird food.'],
    ['Sunflower', 'Flower', 'Teddy Bear', 'Full Sun', 'Low', 12, 55, '1 inch', '#f39c12', 'Compact double-flowered variety. No pollen.'],
    ['Marigold', 'Flower', 'French', 'Full Sun', 'Low', 8, 50, '1/4 inch', '#e67e22', 'Repels pests. Plant near tomatoes and peppers.'],
    ['Marigold', 'Flower', 'African', 'Full Sun', 'Low', 12, 70, '1/4 inch', '#f39c12', 'Large blooms. Strong pest-deterrent scent.'],
    ['Nasturtium', 'Flower', null, 'Full Sun', 'Low', 12, 50, '1/2 inch', '#e74c3c', 'Edible flowers and leaves. Repels aphids.'],
    ['Zinnia', 'Flower', 'State Fair', 'Full Sun', 'Low', 12, 60, '1/4 inch', '#ff69b4', 'Excellent cut flower. Attracts butterflies.'],
    ['Cosmos', 'Flower', 'Sensation', 'Full Sun', 'Low', 12, 55, '1/8 inch', '#d7bde2', 'Feathery foliage. Self-sows. Great pollinator plant.'],
    ['Borage', 'Flower', null, 'Full Sun', 'Low', 12, 55, '1/4 inch', '#2e86c1', 'Edible blue flowers. Deters tomato hornworm.'],
    ['Calendula', 'Flower', null, 'Full Sun', 'Low', 10, 50, '1/4 inch', '#f39c12', 'Edible petals. Cool-season. Medicinal uses.'],
    ['Sweet Pea', 'Flower', null, 'Full Sun', 'Moderate', 6, 65, '1 inch', '#d98880', 'Fragrant climber. Cool-season. NOT edible.'],
    ['Bachelor Button', 'Flower', null, 'Full Sun', 'Low', 8, 60, '1/4 inch', '#2980b9', 'Easy annual. Edible flowers. Self-sows readily.'],
    ['Dianthus', 'Flower', 'Sweet William', 'Full Sun', 'Moderate', 10, 60, '1/8 inch', '#e91e63', 'Fragrant biennial. Attracts pollinators.'],
  ];
  for (const s of seeds) insert.run(...s);
}

module.exports = db;
