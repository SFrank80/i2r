import "dotenv/config";
import { scheduleSlaCheck, startSlaWorker } from "./sla.js";

(async () => {
  try {
    await scheduleSlaCheck();
    await startSlaWorker();
    console.log("[SLA] Runner is active. Press Ctrl+C to exit.");
  } catch (err) {
    console.error("[SLA] Runner failed to start:", err);
    process.exit(1);
  }
})();
