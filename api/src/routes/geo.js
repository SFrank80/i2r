// FILE: api/src/routes/geo.js
import { Router } from "express";

const router = Router();

/**
 * GET /geo/geocode?q=<free text>
 * Uses OpenStreetMap Nominatim to geocode a single location.
 * Returns { ok, found, lon, lat, label } on success.
 */
router.get("/geocode", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ ok: false, reason: "missing_q" });

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;

    // Nominatim *requires* a meaningful User-Agent
    const r = await fetch(url, {
      headers: { "User-Agent": "i2r-demo/1.0 (contact: you@example.com)" },
    });

    if (!r.ok) {
      return res
        .status(502)
        .json({ ok: false, reason: "geocoder_failed", status: r.status });
    }

    const arr = await r.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return res.json({ ok: true, found: false });
    }

    const top = arr[0];
    return res.json({
      ok: true,
      found: true,
      lon: Number(top.lon),
      lat: Number(top.lat),
      label: top.display_name || q,
    });
  } catch (e) {
    console.error("[geo] geocode failed:", e);
    return res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

/**
 * (Optional) GET /geo/search?q=...
 * Same as above but returns a small list for future autosuggest UIs.
 */
router.get("/search", async (req, res) => {
  const q = (req.query.q || "").toString().trim();
  if (!q) return res.status(400).json({ ok: false, reason: "missing_q" });

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`;

    const r = await fetch(url, {
      headers: { "User-Agent": "i2r-demo/1.0 (contact: you@example.com)" },
    });

    if (!r.ok) {
      return res
        .status(502)
        .json({ ok: false, reason: "geocoder_failed", status: r.status });
    }

    const arr = (await r.json()) || [];
    const items = arr.map((x) => ({
      lat: Number(x.lat),
      lon: Number(x.lon),
      label: x.display_name,
    }));
    return res.json(items);
  } catch (e) {
    console.error("[geo] search failed:", e);
    return res.status(500).json({ ok: false, reason: "internal_error" });
  }
});

export default router;
