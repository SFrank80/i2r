// FILE: api/src/index.js
import "dotenv/config"; // <-- keep this as line 1

import express from "express";
import cors from "cors";
import helmet from "helmet";

import mlRouter from "./routes/ml.js";
import incidentsRouter from "./routes/incidents.js";
import assetsRouter from "./routes/assets.js";
import analyticsRouter from "./routes/analytics.js";

import { scheduleSlaCheck, startSlaWorker } from "./jobs/sla.js";
import { applySecurity } from "./middleware/security.js";

const app = express();

/* ----- core middlewares (order matters) ----- */
app.use(helmet());
app.use(cors());
app.use(express.json());           // parse JSON before routers
// app.use(express.urlencoded({ extended: true })); // uncomment if any form posts

/* ----- security bundle (kept) ----- */
applySecurity(app);

/* ----- health check ----- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ----- API routers (mount once; do not duplicate prefixes) ----- */
app.use("/ml", mlRouter);
app.use("/assets", assetsRouter);
app.use("/incidents", incidentsRouter);
app.use("/analytics", analyticsRouter);

/* ----- not found + error handling (prevents confusing 404s) ----- */
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
app.use((err, _req, res, _next) => {
  console.error("[API] Uncaught error:", err);
  res.status(500).json({ ok: false, reason: "internal_error" });
});

/* ----- server start ----- */
const PORT = Number(process.env.PORT || 5050);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

/* ----- SLA worker (kept) ----- */
startSlaWorker();
scheduleSlaCheck();
if (process.env.SLA_INLINE === "1") {
  console.log("[SLA] Inline runner active (SLA_INLINE=1)");
}

export default app;
