// This script won’t fight with CSV downloads and dev CORS
// FILE: api/src/middleware/security.js
import helmet from "helmet";
import cors from "cors";

export function applySecurity(app) {
  // Helmet v7 is ESM-only and defaults are safe.
  // Allow cross-origin resource policy so CSV downloads work in dev.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS: read from env or allow your vite dev host by default
  // .env: CORS_ORIGIN=http://localhost:5173
  const origins =
    process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? ["http://localhost:5173"];

  app.use(
    cors({
      origin: origins,
      credentials: true,
    })
  );
}
