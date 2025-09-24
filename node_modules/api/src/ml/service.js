// api/src/ml/service.js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Where the serialized model lives
const MODEL_PATHS = [
  path.resolve(__dirname, "../../models/priority-nb.json"),
  path.resolve(__dirname, "../models/priority-nb.json"), // fallback
];

let MODEL = null; // { features, classFeatures, classTotals, totalExamples, smoothing }
let LOADED_FROM = null;

async function loadModelIfNeeded() {
  if (MODEL) return;

  let raw;
  let parsed;
  let loadedPath;

  for (const p of MODEL_PATHS) {
    try {
      raw = await readFile(p, "utf8");
      parsed = JSON.parse(raw);
      loadedPath = p;
      break;
    } catch { /* try next */ }
  }

  if (!parsed) {
    throw new Error("Not Trained");
  }

  // Accept both shapes:
  // 1) { classifier: { features, classifier: { classFeatures, classTotals, totalExamples, smoothing } } }
  // 2) { classifier: { features, classFeatures, classTotals, totalExamples, smoothing } }
  let features, classFeatures, classTotals, totalExamples, smoothing;

  const c = parsed.classifier || parsed; // tolerate missing root wrapper

  if (c && c.features && c.classifier && c.classifier.classFeatures) {
    // your current file shape (classifier.classifier.…)
    features = c.features;
    classFeatures = c.classifier.classFeatures;
    classTotals = c.classifier.classTotals;
    totalExamples = c.classifier.totalExamples;
    smoothing = c.classifier.smoothing ?? 1;
  } else if (c && c.features && c.classFeatures) {
    // flat variant
    features = c.features;
    classFeatures = c.classFeatures;
    classTotals = c.classTotals;
    totalExamples = c.totalExamples;
    smoothing = c.smoothing ?? 1;
  } else {
    throw new Error("Not Trained");
  }

  MODEL = { features, classFeatures, classTotals, totalExamples, smoothing };
  LOADED_FROM = loadedPath;
  console.log(`[ML] Model loaded from ${LOADED_FROM}`);
}

/* ---------------- tokenization ---------------- */
const STOP = new Set([
  "the","a","an","and","or","but","of","on","at","to","for","from","by","with","in","into","over","under",
  "is","are","was","were","be","been","being","this","that","these","those","as","it","its","we","you"
]);

function lightStem(w) {
  // very light stem to better match your saved tokens (e.g., "inspection" -> "inspect")
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
  return w;
}

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .filter(t => !STOP.has(t))
    .map(lightStem);
}

/* ---------------- scoring ---------------- */
function computeClassWordTotals(classFeatures) {
  const totals = {};
  for (const label of Object.keys(classFeatures)) {
    let sum = 0;
    const map = classFeatures[label] || {};
    for (const k of Object.keys(map)) sum += map[k];
    totals[label] = sum;
  }
  return totals;
}

function classifyTokens(tokens) {
  const { features, classFeatures, classTotals, totalExamples, smoothing } = MODEL;
  const vocabSize = Object.keys(features).length;
  const classWordTotals = computeClassWordTotals(classFeatures);

  const labels = Object.keys(classTotals);
  if (!labels.length) throw new Error("Not Trained");

  const logScores = {};
  for (const label of labels) {
    // prior
    const priorNum = (classTotals[label] ?? 0) + 1; // Laplace on priors
    const priorDen = (totalExamples ?? 1) + labels.length;
    let score = Math.log(priorNum) - Math.log(priorDen);

    // likelihood
    const denom = (classWordTotals[label] ?? 0) + smoothing * vocabSize;
    const cf = classFeatures[label] || {};

    for (const tok of tokens) {
      const idx = features[tok];
      if (idx === undefined) continue; // unseen token; contributes only smoothing term implicitly
      const count = cf[idx] ?? 0;
      const num = count + smoothing;
      score += Math.log(num) - Math.log(denom);
    }

    logScores[label] = score;
  }

  // softmax for confidence
  const max = Math.max(...Object.values(logScores));
  const exps = Object.fromEntries(
    Object.entries(logScores).map(([k, v]) => [k, Math.exp(v - max)])
  );
  const Z = Object.values(exps).reduce((a, b) => a + b, 0) || 1;
  const probs = Object.fromEntries(
    Object.entries(exps).map(([k, v]) => [k, v / Z])
  );

  let best = labels[0];
  for (const l of labels) if (probs[l] > probs[best]) best = l;

  return { label: best, confidence: probs[best] ?? 0 };
}

/* ---------------- public API ---------------- */
export async function smartClassify({ title = "", description = "" }) {
  await loadModelIfNeeded();
  const toks = [...tokenize(title), ...tokenize(description)];
  if (!toks.length) return { priority: "MEDIUM", confidence: 0 }; // neutral fallback
  const { label, confidence } = classifyTokens(toks);
  return { priority: label, confidence, inferredType: undefined };
}

export async function classifyHandler(req, res) {
  try {
    const body = req.body || {};
    const result = await smartClassify({
      title: String(body.title ?? ""),
      description: String(body.description ?? ""),
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (String(err.message || err) === "Not Trained") {
      return res.json({ ok: false, reason: "not_trained" });
    }
    console.error("[ML] classify error:", err);
    return res.status(500).json({ ok: false, reason: "internal_error" });
  }
}

export async function feedbackHandler(req, res) {
  try {
    const body = req.body || {};
    // Append lightweight feedback log (optional)
    const dir = path.resolve(__dirname, "../../data");
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      action: body.action,
      suggested: body.suggested,
      final: body.final,
    }) + "\n";
    await writeFile(path.join(dir, "ml_feedback.log"), line, { flag: "a" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[ML] feedback error:", err);
    return res.status(500).json({ ok: false });
  }
}
