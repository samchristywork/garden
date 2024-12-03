const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);
const i = (v) => (v === undefined || v === "" || v === null ? null : Number(v));

router.get("/", (req, res) => {
  const beds = db.prepare("SELECT * FROM garden_beds ORDER BY name").all();
  res.json(beds);
});

router.get("/:id", (req, res) => {
  const bed = db
    .prepare("SELECT * FROM garden_beds WHERE id = ?")
    .get(req.params.id);
  if (!bed) return res.status(404).json({ error: "Not found" });

  const cells = db
    .prepare(
      `
    SELECT bc.row_num, bc.col_num, bc.plant_id, p.name AS plant_name, p.color AS plant_color
    FROM bed_cells bc
    LEFT JOIN plants p ON p.id = bc.plant_id
    WHERE bc.bed_id = ? AND bc.plant_id IS NOT NULL
  `,
    )
    .all(req.params.id);

  res.json({ ...bed, cells });
});

router.post("/", (req, res) => {
  const { name, rows, cols, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const result = db
    .prepare(
      "INSERT INTO garden_beds (name, rows, cols, notes) VALUES (?, ?, ?, ?)",
    )
    .run(name, i(rows) ?? 4, i(cols) ?? 6, n(notes));
  res
    .status(201)
    .json(
      db
        .prepare("SELECT * FROM garden_beds WHERE id = ?")
        .get(result.lastInsertRowid),
    );
});
