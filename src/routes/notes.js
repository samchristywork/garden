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

module.exports = router;
