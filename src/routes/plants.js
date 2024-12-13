const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);
const i = (v) => (v === undefined || v === "" || v === null ? null : Number(v));

router.get("/", (req, res) => {
  const plants = db.prepare("SELECT * FROM plants ORDER BY name").all();
  res.json(plants);
});

router.get("/:id", (req, res) => {
  const plant = db
    .prepare("SELECT * FROM plants WHERE id = ?")
    .get(req.params.id);
  if (!plant) return res.status(404).json({ error: "Not found" });
  res.json(plant);
});

router.post("/", (req, res) => {
  const {
    name,
    type,
    variety,
    sun_requirement,
    water_needs,
    spacing_inches,
    days_to_maturity,
    planting_depth,
    color,
    notes,
  } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const result = db
    .prepare(
      `
    INSERT INTO plants (name, type, variety, sun_requirement, water_needs,
      spacing_inches, days_to_maturity, planting_depth, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      name,
      n(type),
      n(variety),
      n(sun_requirement),
      n(water_needs),
      i(spacing_inches),
      i(days_to_maturity),
      n(planting_depth),
      n(color) ?? "#4a7c4e",
      n(notes),
    );
  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM plants WHERE id = ?")
        .get(result.lastInsertRowid),
    );
});

router.put("/:id", (req, res) => {
  const {
    name,
    type,
    variety,
    sun_requirement,
    water_needs,
    spacing_inches,
    days_to_maturity,
    planting_depth,
    color,
    notes,
  } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const info = db
    .prepare(
      `
    UPDATE plants SET name=?, type=?, variety=?, sun_requirement=?, water_needs=?,
      spacing_inches=?, days_to_maturity=?, planting_depth=?, color=?, notes=?
    WHERE id=?
  `,
    )
    .run(
      name,
      n(type),
      n(variety),
      n(sun_requirement),
      n(water_needs),
      i(spacing_inches),
      i(days_to_maturity),
      n(planting_depth),
      n(color) ?? "#4a7c4e",
      n(notes),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare("SELECT * FROM plants WHERE id = ?").get(req.params.id));
});
