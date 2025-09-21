import express from "express";
import cors from "cors";

import incidentsRouter from "./routes/incidents.js";
import analyticsRouter from "./routes/analytics.js";
import { scheduleSlaCheck, startSlaWorker } from "./jobs/sla.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/incidents", incidentsRouter);
app.use("/analytics", analyticsRouter);

const PORT = Number(process.env.PORT || 5050);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

// SLA
startSlaWorker();
scheduleSlaCheck();

if (process.env.SLA_INLINE === "1") {
  console.log("[SLA] Inline runner active (SLA_INLINE=1)");
}
