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
