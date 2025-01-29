const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

const localDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const WITH_JOINS = `
  SELECT e.*, p.name AS plant_name, b.name AS bed_name
  FROM journal_entries e
  LEFT JOIN plants p ON p.id = e.plant_id
  LEFT JOIN garden_beds b ON b.id = e.bed_id
`;

router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];
  if (req.query.search) {
    conditions.push("(e.title LIKE ? OR e.content LIKE ?)");
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  if (req.query.plant_id) {
    conditions.push("e.plant_id = ?");
    params.push(req.query.plant_id);
  }
  if (req.query.bed_id) {
    conditions.push("e.bed_id = ?");
    params.push(req.query.bed_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM journal_entries e ${where}`).get(...params).n;
  const data = db.prepare(`${WITH_JOINS} ${where} ORDER BY e.entry_date DESC, e.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ data, total });
});

router.get("/:id", (req, res) => {
  const entry = db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(req.params.id);
  if (!entry) return res.status(404).json({ error: "Not found" });
  res.json(entry);
});

router.post("/", (req, res) => {
  const { title, content, entry_date, plant_id, bed_id } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const result = db
    .prepare(
      `
    INSERT INTO journal_entries (title, content, entry_date, plant_id, bed_id)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      n(content),
      n(entry_date) ?? localDateString(),
      n(plant_id),
      n(bed_id),
    );
  res
    .status(201)
    .json(
      db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(result.lastInsertRowid),
    );
});

router.put("/:id", (req, res) => {
  const { title, content, entry_date, plant_id, bed_id } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const info = db
    .prepare(
      `
    UPDATE journal_entries
    SET title=?, content=?, entry_date=?, plant_id=?, bed_id=?, updated_at=datetime('now')
    WHERE id=?
  `,
    )
    .run(
      title,
      n(content),
      n(entry_date) ?? localDateString(),
      n(plant_id),
      n(bed_id),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM journal_entries WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

module.exports = router;
