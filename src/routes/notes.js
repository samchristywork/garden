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

module.exports = router;
