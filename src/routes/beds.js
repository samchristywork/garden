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

router.put("/:id", (req, res) => {
  const { name, rows, cols, notes } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const info = db
    .prepare(
      "UPDATE garden_beds SET name=?, rows=?, cols=?, notes=? WHERE id=?",
    )
    .run(name, i(rows) ?? 4, i(cols) ?? 6, n(notes), req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.json(
    db.prepare("SELECT * FROM garden_beds WHERE id = ?").get(req.params.id),
  );
});

router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM garden_beds WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

// PUT /api/beds/:id/cells/:row/:col  — assign or clear a cell
router.put("/:id/cells/:row/:col", (req, res) => {
  const { id, row, col } = req.params;
  const { plant_id } = req.body;

  if (plant_id == null) {
    db.prepare(
      "DELETE FROM bed_cells WHERE bed_id=? AND row_num=? AND col_num=?",
    ).run(Number(id), Number(row), Number(col));
  } else {
    db.prepare(
      `
      INSERT INTO bed_cells (bed_id, row_num, col_num, plant_id) VALUES (?, ?, ?, ?)
      ON CONFLICT(bed_id, row_num, col_num) DO UPDATE SET plant_id=excluded.plant_id
    `,
    ).run(Number(id), Number(row), Number(col), Number(plant_id));
  }
  res.status(204).end();
});

module.exports = router;
