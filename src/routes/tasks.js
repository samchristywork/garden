const express = require("express");
const db = require("../db");
const router = express.Router();

const n = (v) => (v === undefined || v === "" || v === null ? null : v);

const WITH_JOINS = `
  SELECT t.*, p.name AS plant_name, b.name AS bed_name
  FROM tasks t
  LEFT JOIN plants p ON p.id = t.plant_id
  LEFT JOIN garden_beds b ON b.id = t.bed_id
`;

router.get("/", (req, res) => {
  if (req.query.completed !== undefined) {
    return res.json(
      db
        .prepare(
          `
      ${WITH_JOINS} WHERE t.completed = ?
      ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at
    `,
        )
        .all(req.query.completed === "true" ? 1 : 0),
    );
  }
  res.json(
    db
      .prepare(
        `
    ${WITH_JOINS}
    ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date, t.created_at
  `,
      )
      .all(),
  );
});
