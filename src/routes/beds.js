const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);
const i = (v) => (v === undefined || v === "" || v === null ? null : Number(v));

router.get("/", (req, res) => {
  const beds = db.prepare("SELECT * FROM garden_beds ORDER BY name").all();
  const cellsByBed = db.prepare(`
    SELECT bc.bed_id, bc.row_num, bc.col_num, p.color AS plant_color
    FROM bed_cells bc
    JOIN plants p ON p.id = bc.plant_id
  `).all();
  const cellMap = {};
  for (const c of cellsByBed) {
    if (!cellMap[c.bed_id]) cellMap[c.bed_id] = [];
    cellMap[c.bed_id].push({ row_num: c.row_num, col_num: c.col_num, plant_color: c.plant_color });
  }
  res.json(beds.map(b => ({ ...b, cells: cellMap[b.id] || [] })));
});

router.get("/templates", (req, res) => {
  const templates = db.prepare("SELECT * FROM bed_templates ORDER BY name").all();
  const cellsByTemplate = db.prepare(`
    SELECT btc.template_id, btc.row_num, btc.col_num, p.color AS plant_color
    FROM bed_template_cells btc
    JOIN plants p ON p.id = btc.plant_id
  `).all();
  const cellMap = {};
  for (const c of cellsByTemplate) {
    if (!cellMap[c.template_id]) cellMap[c.template_id] = [];
    cellMap[c.template_id].push(c);
  }
  res.json(templates.map(t => ({ ...t, cells: cellMap[t.id] || [] })));
});

router.post("/templates", (req, res) => {
  const { name, bed_id } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const bed = db.prepare("SELECT * FROM garden_beds WHERE id = ?").get(bed_id);
  if (!bed) return res.status(404).json({ error: "Bed not found" });

  const result = db.prepare(
    "INSERT INTO bed_templates (name, rows, cols, notes) VALUES (?, ?, ?, ?)"
  ).run(name, bed.rows, bed.cols, n(bed.notes));
  const templateId = result.lastInsertRowid;

  const cells = db.prepare(
    "SELECT row_num, col_num, plant_id FROM bed_cells WHERE bed_id = ? AND plant_id IS NOT NULL"
  ).all(bed_id);
  const insertCell = db.prepare(
    "INSERT INTO bed_template_cells (template_id, row_num, col_num, plant_id) VALUES (?, ?, ?, ?)"
  );
  for (const c of cells) insertCell.run(templateId, c.row_num, c.col_num, c.plant_id);

  res.status(201).json(db.prepare("SELECT * FROM bed_templates WHERE id = ?").get(templateId));
});

router.delete("/templates/:id", (req, res) => {
  const info = db.prepare("DELETE FROM bed_templates WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

router.post("/from-template/:templateId", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const template = db.prepare("SELECT * FROM bed_templates WHERE id = ?").get(req.params.templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const result = db.prepare(
    "INSERT INTO garden_beds (name, rows, cols, notes) VALUES (?, ?, ?, ?)"
  ).run(name, template.rows, template.cols, n(template.notes));
  const bedId = result.lastInsertRowid;

  const cells = db.prepare(
    "SELECT row_num, col_num, plant_id FROM bed_template_cells WHERE template_id = ? AND plant_id IS NOT NULL"
  ).all(req.params.templateId);
  const insertCell = db.prepare(
    "INSERT INTO bed_cells (bed_id, row_num, col_num, plant_id) VALUES (?, ?, ?, ?)"
  );
  for (const c of cells) insertCell.run(bedId, c.row_num, c.col_num, c.plant_id);

  res.status(201).json(db.prepare("SELECT * FROM garden_beds WHERE id = ?").get(bedId));
});

router.post("/:id/apply-template/:templateId", (req, res) => {
  const bed = db.prepare("SELECT * FROM garden_beds WHERE id = ?").get(req.params.id);
  if (!bed) return res.status(404).json({ error: "Bed not found" });
  const template = db.prepare("SELECT * FROM bed_templates WHERE id = ?").get(req.params.templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const cells = db.prepare(
    "SELECT row_num, col_num, plant_id FROM bed_template_cells WHERE template_id = ? AND plant_id IS NOT NULL"
  ).all(req.params.templateId);

  db.transaction(() => {
    db.prepare("DELETE FROM bed_cells WHERE bed_id = ?").run(req.params.id);
    const insertCell = db.prepare(
      "INSERT INTO bed_cells (bed_id, row_num, col_num, plant_id) VALUES (?, ?, ?, ?)"
    );
    for (const c of cells) insertCell.run(req.params.id, c.row_num, c.col_num, c.plant_id);
  })();

  res.status(204).end();
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
  const parsedRows = i(rows) ?? 4;
  const parsedCols = i(cols) ?? 6;
  if (parsedRows < 1 || parsedCols < 1) return res.status(400).json({ error: "rows and cols must be at least 1" });
  if (parsedRows > 50 || parsedCols > 50) return res.status(400).json({ error: "rows and cols must be 50 or less" });
  const result = db
    .prepare(
      "INSERT INTO garden_beds (name, rows, cols, notes) VALUES (?, ?, ?, ?)",
    )
    .run(name, parsedRows, parsedCols, n(notes));
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
  const parsedRows = i(rows) ?? 4;
  const parsedCols = i(cols) ?? 6;
  if (parsedRows < 1 || parsedCols < 1) return res.status(400).json({ error: "rows and cols must be at least 1" });
  if (parsedRows > 50 || parsedCols > 50) return res.status(400).json({ error: "rows and cols must be 50 or less" });
  const info = db
    .prepare(
      "UPDATE garden_beds SET name=?, rows=?, cols=?, notes=? WHERE id=?",
    )
    .run(name, parsedRows, parsedCols, n(notes), req.params.id);
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
