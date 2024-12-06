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

module.exports = router;
