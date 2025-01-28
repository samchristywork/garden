const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);
const i = (v) => (v === undefined || v === "" || v === null ? null : Number(v));

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

function imageTooBig(image_url) {
  if (!image_url || !image_url.startsWith("data:")) return false;
  const base64 = image_url.split(",")[1] || "";
  return Math.ceil(base64.length * 3 / 4) > MAX_IMAGE_BYTES;
}

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
    image_url,
  } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (imageTooBig(image_url)) return res.status(400).json({ error: "Image must be 10 MB or smaller" });
  const result = db
    .prepare(
      `
    INSERT INTO plants (name, type, variety, sun_requirement, water_needs,
      spacing_inches, days_to_maturity, planting_depth, color, notes, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      n(image_url),
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
    image_url,
  } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  if (imageTooBig(image_url)) return res.status(400).json({ error: "Image must be 10 MB or smaller" });
  const info = db
    .prepare(
      `
    UPDATE plants SET name=?, type=?, variety=?, sun_requirement=?, water_needs=?,
      spacing_inches=?, days_to_maturity=?, planting_depth=?, color=?, notes=?, image_url=?
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
      n(image_url),
      req.params.id,
    );
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(db.prepare("SELECT * FROM plants WHERE id = ?").get(req.params.id));
});

router.get("/:id/links", (req, res) => {
  const plant = db.prepare("SELECT id FROM plants WHERE id = ?").get(req.params.id);
  if (!plant) return res.status(404).json({ error: "Not found" });
  const bed_cells = db.prepare("SELECT COUNT(*) AS n FROM bed_cells WHERE plant_id = ?").get(req.params.id).n;
  const calendar_events = db.prepare("SELECT COUNT(*) AS n FROM calendar_events WHERE plant_id = ?").get(req.params.id).n;
  const tasks = db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE plant_id = ?").get(req.params.id).n;
  const journal_entries = db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE plant_id = ?").get(req.params.id).n;
  res.json({ bed_cells, calendar_events, tasks, journal_entries });
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM plants WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

module.exports = router;
