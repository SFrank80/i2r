// FILE: api/src/index.js
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import mlRouter from "./routes/ml.js";
import incidentsRouter from "./routes/incidents.js";
import assetsRouter from "./routes/assets.js";
import analyticsRouter from "./routes/analytics.js";

// ADD THIS:
import geoRouter from "./routes/geo.js";

import { scheduleSlaCheck, startSlaWorker } from "./jobs/sla.js";
import { applySecurity } from "./middleware/security.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Security bundle
applySecurity(app);

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));

// Routers
app.use("/ml", mlRouter);
app.use("/assets", assetsRouter);
app.use("/incidents", incidentsRouter);
app.use("/analytics", analyticsRouter);

// ADD THIS:
app.use("/geo", geoRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, _req, res, _next) => {
  console.error("[API] Uncaught error:", err);
  res.status(500).json({ ok: false, reason: "internal_error" });
});

const PORT = Number(process.env.PORT || 5050);
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));

startSlaWorker();
scheduleSlaCheck();
if (process.env.SLA_INLINE === "1") {
  console.log("[SLA] Inline runner active (SLA_INLINE=1)");
}

export default app;
