const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

function nextDate(dateStr, rule) {
  if (!dateStr || !rule) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (rule === 'daily') d.setDate(d.getDate() + 1);
  else if (rule === 'weekly') d.setDate(d.getDate() + 7);
  else if (rule === 'monthly') d.setMonth(d.getMonth() + 1);
  else {
    const days = parseInt(rule, 10);
    if (days > 0) d.setDate(d.getDate() + days);
    else return null;
  }
  return d.toISOString().slice(0, 10);
}

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
  const { title, type, due_date, plant_id, bed_id, notes, recurrence_rule } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const result = db
    .prepare(
      `
    INSERT INTO tasks (title, type, due_date, plant_id, bed_id, notes, recurrence_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      n(type) ?? "other",
      n(due_date),
      n(plant_id),
      n(bed_id),
      n(notes),
      n(recurrence_rule),
    );
  res
    .status(201)
    .json(
      db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(result.lastInsertRowid),
    );
});

router.put("/:id", (req, res) => {
  const { title, type, due_date, plant_id, bed_id, notes, recurrence_rule } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });
  const info = db
    .prepare(
      `
    UPDATE tasks SET title=?, type=?, due_date=?, plant_id=?, bed_id=?, notes=?, recurrence_rule=?
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
      n(recurrence_rule),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(req.params.id));
});

router.patch("/:id/complete", (req, res) => {
  const { completed } = req.body;
  const task = db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(req.params.id);
  if (!task) return res.status(404).json({ error: "Not found" });

  db.prepare(`UPDATE tasks SET completed=?, completed_at=? WHERE id=?`)
    .run(
      completed ? 1 : 0,
      completed ? new Date().toISOString() : null,
      req.params.id,
    );

  // Auto-spawn next occurrence when completing a recurring task
  if (completed && task.recurrence_rule) {
    const nextDue = nextDate(task.due_date, task.recurrence_rule);
    if (nextDue) {
      db.prepare(
        `INSERT INTO tasks (title, type, due_date, plant_id, bed_id, notes, recurrence_rule)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(task.title, task.type, nextDue, task.plant_id, task.bed_id, task.notes, task.recurrence_rule);
    }
  }

  res.json(db.prepare(`${WITH_JOINS} WHERE t.id = ?`).get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

module.exports = router;
