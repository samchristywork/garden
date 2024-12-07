const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

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
          `${WITH_JOINS} WHERE strftime('%Y-%m', e.event_date) = ? ORDER BY e.event_date`,
        )
        .all(ym),
    );
  }
  res.json(db.prepare(`${WITH_JOINS} ORDER BY e.event_date`).all());
});

router.post("/", (req, res) => {
  const { title, event_date, type, plant_id, bed_id, notes } = req.body;
  if (!title || !event_date)
    return res.status(400).json({ error: "title and event_date are required" });
  const result = db
    .prepare(
      `
    INSERT INTO calendar_events (title, event_date, type, plant_id, bed_id, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      title,
      event_date,
      n(type) ?? "other",
      n(plant_id),
      n(bed_id),
      n(notes),
    );
  res
    .status(201)
    .json(
      db.prepare(`${WITH_JOINS} WHERE e.id = ?`).get(result.lastInsertRowid),
    );
});

module.exports = router;
