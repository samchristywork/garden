const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/plants", require("./src/routes/plants"));
app.use("/api/beds", require("./src/routes/beds"));
app.use("/api/calendar", require("./src/routes/calendar"));
app.use("/api/tasks", require("./src/routes/tasks"));
app.use("/api/notes", require("./src/routes/notes"));
app.use("/api/harvest", require("./src/routes/harvest"));
app.use("/api/search", require("./src/routes/search"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Garden Planner running at http://localhost:${PORT}`);
});
