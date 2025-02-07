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

router.get("/analytics", (req, res) => {
  const by_plant = db.prepare(`
    SELECT COALESCE(p.name, 'Unknown') AS plant_name, h.plant_id, h.unit, SUM(h.quantity) AS total
    FROM harvest_logs h
    LEFT JOIN plants p ON p.id = h.plant_id
    GROUP BY h.plant_id, h.unit
    ORDER BY total DESC
  `).all();

  const by_unit = db.prepare(`
    SELECT unit, ROUND(SUM(quantity), 2) AS total
    FROM harvest_logs
    GROUP BY unit
    ORDER BY total DESC
  `).all();

  res.json({ by_plant, by_unit });
});

router.get("/", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];
  if (req.query.plant_id) {
    conditions.push("h.plant_id = ?");
    params.push(req.query.plant_id);
  }
  if (req.query.bed_id) {
    conditions.push("h.bed_id = ?");
    params.push(req.query.bed_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM harvest_logs h ${where}`).get(...params).n;
  const data = db.prepare(`${WITH_JOINS} ${where} ORDER BY h.harvested_at DESC, h.created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ data, total });
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
