const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

const WITH_JOINS = `
  SELECT t.*, p.name AS plant_name, b.name AS bed_name
  FROM tasks t
  LEFT JOIN plants p ON p.id = t.plant_id
  LEFT JOIN garden_beds b ON b.id = t.bed_id
`;

router.get("/", (req, res) => {
  if (req.query.completed !== undefined) {
    return res.json(
      db
        .prepare(
          `
      ${WITH_JOINS} WHERE t.completed = ?
      ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at
    `,
        )
        .all(req.query.completed === "true" ? 1 : 0),
    );
  }
  res.json(
    db
      .prepare(
        `
    ${WITH_JOINS}
    ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at
  `,
      )
      .all(),
  );
});

router.post("/", (req, res) => {
  const { title, type, due_date, plant_id, bed_id, notes } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const result = db
    .prepare(
      `
    INSERT INTO tasks (title, type, due_date, plant_id, bed_id, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      n(type) ?? "other",
      n(due_date),
      n(plant_id),
      n(bed_id),
      n(notes),
    );
  res
    .status(201)
    .json(
      db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(result.lastInsertRowid),
    );
});

router.put("/:id", (req, res) => {
  const { title, type, due_date, plant_id, bed_id, notes } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const info = db
    .prepare(
      `
    UPDATE tasks SET title=?, type=?, due_date=?, plant_id=?, bed_id=?, notes=?
    WHERE id=?
  `,
    )
    .run(
      title,
      n(type) ?? "other",
      n(due_date),
      n(plant_id),
      n(bed_id),
      n(notes),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(req.params.id));
});
