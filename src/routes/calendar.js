const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

function invalidRecurrenceRule(rule) {
  if (!rule) return false;
  if (rule === 'daily' || rule === 'weekly' || rule === 'monthly') return false;
  const days = parseInt(rule, 10);
  return !(String(days) === rule && days > 0);
}

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

function prevDate(dateStr, rule) {
  if (!dateStr || !rule) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (rule === 'daily') d.setDate(d.getDate() - 1);
  else if (rule === 'weekly') d.setDate(d.getDate() - 7);
  else if (rule === 'monthly') d.setMonth(d.getMonth() - 1);
  else {
    const days = parseInt(rule, 10);
    if (days > 0) d.setDate(d.getDate() - days);
    else return null;
  }
  return d.toISOString().slice(0, 10);
}

function generatePastRecurrences(db, baseDate, rule, title, event_time, type, plant_id, bed_id, notes, fromDate) {
  const insert = db.prepare(
    `INSERT INTO calendar_events (title, event_date, event_time, type, plant_id, bed_id, notes, recurrence_rule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let current = baseDate;
  while (true) {
    current = prevDate(current, rule);
    if (!current || current < fromDate) break;
    insert.run(title, current, event_time, type, plant_id, bed_id, notes, rule);
  }
}

function generateRecurrences(db, baseDate, rule, title, event_time, type, plant_id, bed_id, notes) {
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + 1);
  const limitStr = limit.toISOString().slice(0, 10);
  const insert = db.prepare(
    `INSERT INTO calendar_events (title, event_date, event_time, type, plant_id, bed_id, notes, recurrence_rule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let current = baseDate;
  while (true) {
    current = nextDate(current, rule);
    if (!current || current > limitStr) break;
    insert.run(title, current, event_time, type, plant_id, bed_id, notes, rule);
  }
}

const WITH_JOINS = `
  SELECT e.*, p.name AS plant_name, b.name AS bed_name
  FROM calendar_events e
  LEFT JOIN plants p ON p.id = e.plant_id
  LEFT JOIN garden_beds b ON b.id = e.bed_id
`;

router.get("/", (req, res) => {
  if (req.query.year && req.query.month) {
    const ym = `${req.query.year}-${String(req.query.month).padStart(2, "0")}`;
    return res.json(
      db
        .prepare(
          `${WITH_JOINS} WHERE strftime('%Y-%m', e.event_date) = ? ORDER BY e.event_date, e.event_time, e.id`,
        )
        .all(ym),
    );
  }
  res.json(db.prepare(`${WITH_JOINS} ORDER BY e.event_date, e.event_time, e.id`).all());
});

router.post("/", (req, res) => {
  const { title, event_date, event_time, type, plant_id, bed_id, notes, recurrence_rule, backfill_from } = req.body;
  if (!title || !event_date)
    return res.status(400).json({ error: "title and event_date are required" });
  if (invalidRecurrenceRule(n(recurrence_rule)))
    return res.status(400).json({ error: "recurrence_rule must be 'daily', 'weekly', 'monthly', or a positive integer (number of days)" });
  const result = db
    .prepare(
      `
    INSERT INTO calendar_events (title, event_date, event_time, type, plant_id, bed_id, notes, recurrence_rule)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      event_date,
      n(event_time),
      n(type) ?? "other",
      n(plant_id),
      n(bed_id),
      n(notes),
      n(recurrence_rule),
    );

  if (n(recurrence_rule)) {
    generateRecurrences(
      db, event_date, recurrence_rule, title,
      n(event_time), n(type) ?? "other", n(plant_id), n(bed_id), n(notes)
    );
    if (n(backfill_from)) {
      generatePastRecurrences(
        db, event_date, recurrence_rule, title,
        n(event_time), n(type) ?? "other", n(plant_id), n(bed_id), n(notes), backfill_from
      );
    }
  }

  res
    .status(201)
    .json(
      db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(result.lastInsertRowid),
    );
});

router.put("/:id", (req, res) => {
  const { title, event_date, event_time, type, plant_id, bed_id, notes, recurrence_rule, backfill_from } = req.body;
  if (!title || !event_date)
    return res.status(400).json({ error: "title and event_date are required" });
  if (invalidRecurrenceRule(n(recurrence_rule)))
    return res.status(400).json({ error: "recurrence_rule must be 'daily', 'weekly', 'monthly', or a positive integer (number of days)" });
  const info = db
    .prepare(
      `
    UPDATE calendar_events SET title=?, event_date=?, event_time=?, type=?, plant_id=?, bed_id=?, notes=?, recurrence_rule=?
    WHERE id=?
  `,
    )
    .run(
      title,
      event_date,
      n(event_time),
      n(type) ?? "other",
      n(plant_id),
      n(bed_id),
      n(notes),
      n(recurrence_rule),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  if (n(recurrence_rule) && n(backfill_from)) {
    generatePastRecurrences(
      db, event_date, recurrence_rule, title,
      n(event_time), n(type) ?? "other", n(plant_id), n(bed_id), n(notes), backfill_from
    );
  }
  res.json(db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM calendar_events WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

module.exports = router;
