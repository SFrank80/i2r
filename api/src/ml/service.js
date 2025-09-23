import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const MODEL_PATH = path.resolve(__dirname, "../models/priority-nb.json");

let MODEL = null;

// simple tokenizer: lowercase, alnum only
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

async function ensureModel() {
  if (MODEL) return MODEL;
  try {
    const raw = await fs.readFile(MODEL_PATH, "utf8");
    MODEL = JSON.parse(raw);
    return MODEL;
  } catch {
    throw new Error("Not Trained");
  }
}

function scoreWithModel(model, text) {
  const tokens = tokenize(text);
  const { labels = [], priors = {}, vocab = {} } = model;

  let best = { label: "MEDIUM", score: -Infinity };
  for (const label of labels) {
    let s = Number(priors[label] ?? Math.log(1 / Math.max(labels.length, 1)));
    for (const t of tokens) {
      const w = vocab[label]?.[t];
      if (typeof w === "number") s += w; // log-likelihood already
    }
    if (s > best.score) best = { label, score: s };
  }

  // rough confidence from log-score magnitude
  const confidence = Math.min(99, Math.max(0, Math.round((best.score + 20) * 2)));
  return { priority: best.label, confidence };
}

export async function classifyHandler(req, res) {
  try {
    const { title = "", description = "" } = req.body || {};
    const text = `${title} ${description}`.trim();

    if (text.length < 6) {
      return res.status(200).json({ ok: false, reason: "text_too_short" });
    }

    const model = await ensureModel();
    const result = scoreWithModel(model, text);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const reason = err?.message === "Not Trained" ? "not_trained" : "internal_error";
    console.error("[ML] classify error:", err?.message || err);
    return res.status(200).json({ ok: false, reason });
  }
}
