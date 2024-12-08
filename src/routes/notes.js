const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

const WITH_JOINS = `
  SELECT e.*, p.name AS plant_name, b.name AS bed_name
  FROM journal_entries e
  LEFT JOIN plants p ON p.id = e.plant_id
  LEFT JOIN garden_beds b ON b.id = e.bed_id
`;

router.get("/", (req, res) => {
  res.json(
    db
      .prepare(`${WITH_JOINS} ORDER BY e.entry_date DESC, e.created_at DESC`)
      .all(),
  );
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
      n(entry_date) ?? new Date().toISOString().slice(0, 10),
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
      n(entry_date) ?? new Date().toISOString().slice(0, 10),
      n(plant_id),
      n(bed_id),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(req.params.id));
});

module.exports = router;
