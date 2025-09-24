// api/src/routes/ml.js
import { Router } from "express";
import { classifyHandler, feedbackHandler } from "../ml/service.js";

const router = Router();

// Your app mounts this router at `/ml` in src/index.js
router.post("/classify", classifyHandler);
router.post("/feedback", feedbackHandler); // 204 no-op to stop 404 spam in console

export default router;
