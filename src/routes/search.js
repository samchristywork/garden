'use strict';

const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const like = `%${q}%`;
  const results = [];

  const plants = db.prepare(`
    SELECT id, name AS title,
      COALESCE(variety, '') || CASE WHEN type IS NOT NULL THEN ' (' || type || ')' ELSE '' END AS description
    FROM plants
    WHERE name LIKE ? OR variety LIKE ? OR notes LIKE ?
    LIMIT 10
  `).all(like, like, like);
  plants.forEach(r => results.push({ ...r, section: 'plants', type: 'Plant' }));

  const beds = db.prepare(`
    SELECT id, name AS title, COALESCE(notes, '') AS description
    FROM garden_beds
    WHERE name LIKE ? OR notes LIKE ?
    LIMIT 10
  `).all(like, like);
  beds.forEach(r => results.push({ ...r, section: 'beds', type: 'Bed' }));

  const tasks = db.prepare(`
    SELECT id, title, COALESCE(notes, '') AS description
    FROM tasks
    WHERE title LIKE ? OR notes LIKE ?
    LIMIT 10
  `).all(like, like);
  tasks.forEach(r => results.push({ ...r, section: 'tasks', type: 'Task' }));

  const events = db.prepare(`
    SELECT id, title, COALESCE(notes, '') AS description
    FROM calendar_events
    WHERE title LIKE ? OR notes LIKE ?
    LIMIT 10
  `).all(like, like);
  events.forEach(r => results.push({ ...r, section: 'calendar', type: 'Event' }));

  const notes = db.prepare(`
    SELECT id, title, COALESCE(content, '') AS description
    FROM journal_entries
    WHERE title LIKE ? OR content LIKE ?
    LIMIT 10
  `).all(like, like);
  notes.forEach(r => results.push({ ...r, section: 'journal', type: 'Journal' }));

  res.json(results);
});

module.exports = router;
