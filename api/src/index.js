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

app.use(helmet());
app.use(cors());
app.use(express.json());

// keep your security bundle
applySecurity(app);

// helpful health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// mount once (do not duplicate prefixes inside the routers)
app.use("/ml", mlRouter);
app.use("/assets", assetsRouter);
app.use("/incidents", incidentsRouter);
app.use("/analytics", analyticsRouter);

const PORT = Number(process.env.PORT || 5050);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

startSlaWorker();
scheduleSlaCheck();

if (process.env.SLA_INLINE === "1") {
  console.log("[SLA] Inline runner active (SLA_INLINE=1)");
}

export default app;
