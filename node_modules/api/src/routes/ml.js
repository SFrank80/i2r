import { Router } from "express";
import { classifyHandler } from "../ml/service.js";

const router = Router();

// used by the UI for the “AI suggestion” chip
router.post("/classify", classifyHandler);

// quiet the console 404s (no-op feedback endpoint)
router.post("/feedback", (_req, res) => res.sendStatus(204));

export default router;
