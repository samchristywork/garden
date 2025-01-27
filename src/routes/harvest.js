const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

const WITH_JOINS = `
  SELECT h.*, p.name AS plant_name, b.name AS bed_name
  FROM harvest_logs h
  LEFT JOIN plants p ON p.id = h.plant_id
  LEFT JOIN garden_beds b ON b.id = h.bed_id
`;

router.get("/", (req, res) => {
  res.json(
    db.prepare(`${WITH_JOINS} ORDER BY h.harvested_at DESC, h.created_at DESC`).all()
  );
});

router.post("/", (req, res) => {
  const { plant_id, bed_id, quantity, unit, harvested_at, notes } = req.body;
  const qty = Number(quantity);
  if (!quantity || !isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: "quantity must be a positive number" });
  }
  const result = db.prepare(`
    INSERT INTO harvest_logs (plant_id, bed_id, quantity, unit, harvested_at, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    n(plant_id),
    n(bed_id),
    qty,
    n(unit) ?? "lbs",
    n(harvested_at) ?? new Date().toISOString().slice(0, 10),
    n(notes)
  );
  res.status(201).json(
    db.prepare(`${WITH_JOINS} WHERE h.id = ?`).get(result.lastInsertRowid)
  );
});

router.put("/:id", (req, res) => {
  const { plant_id, bed_id, quantity, unit, harvested_at, notes } = req.body;
  const qty = Number(quantity);
  if (!quantity || !isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: "quantity must be a positive number" });
  }
  const info = db.prepare(`
    UPDATE harvest_logs SET plant_id=?, bed_id=?, quantity=?, unit=?, harvested_at=?, notes=?
    WHERE id=?
  `).run(
    n(plant_id),
    n(bed_id),
    qty,
    n(unit) ?? "lbs",
    n(harvested_at),
    n(notes),
    req.params.id
  );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare(`${WITH_JOINS} WHERE h.id = ?`).get(req.params.id));
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM harvest_logs WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

module.exports = router;
