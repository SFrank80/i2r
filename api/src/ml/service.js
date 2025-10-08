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

  let parsed;
  let loadedPath;

  for (const p of MODEL_PATHS) {
    try {
      const raw = await readFile(p, "utf8");
      parsed = JSON.parse(raw);
      loadedPath = p;
      break;
    } catch {
      /* try next */
    }
  }

  if (!parsed) throw new Error("Not Trained");

  // Accept both shapes:
  // 1) { classifier: { features, classifier: { classFeatures, classTotals, totalExamples, smoothing } } }
  // 2) { classifier: { features, classFeatures, classTotals, totalExamples, smoothing } }
  let features, classFeatures, classTotals, totalExamples, smoothing;

  const c = parsed.classifier || parsed; // tolerate missing root wrapper
  if (c && c.features && c.classifier && c.classifier.classFeatures) {
    features = c.features;
    classFeatures = c.classifier.classFeatures;
    classTotals = c.classifier.classTotals;
    totalExamples = c.classifier.totalExamples;
    smoothing = c.classifier.smoothing ?? 1;
  } else if (c && c.features && c.classFeatures) {
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
    .filter((t) => !STOP.has(t))
    .map(lightStem);
}

/* ---------------- domain boost (hybrid rules) ---------------- */
// Tunable boosts (log-space). Keep modest; the model still leads.
const BOOST_HIGH = Number(process.env.ML_BOOST_HIGH ?? 1.0);
const BOOST_CRITICAL = Number(process.env.ML_BOOST_CRITICAL ?? 2.0);

// Patterns with light tags so you can see what fired
const CRITICAL_RULES = [
  { rx: /boil[-\s]?water|advisory/, tag: "boil_water_advisory" },
  { rx: /\b(e\.?\s*coli|fecal (?:coliform)?)\b/, tag: "contamination" },
  { rx: /\b(sewage (?:overflow|spill)|\bSSO\b)\b/, tag: "sso" },
  { rx: /\bforce\s+main\b/, tag: "force_main" },
  { rx: /treatment\s+plant.*(offline|shutdown|down)/, tag: "plant_offline" },
  { rx: /pressure.*(<\s*20\s*psi|below\s*20\s*psi|under\s*20\s*psi)/, tag: "pressure_below_20psi" },
  { rx: /\b(sinkhole|road\s+undermined)\b/, tag: "sinkhole" },
  { rx: /\b(24|30|36|42)(?:-? ?inch|["])?\s*(?:transmission\s+)?main.*(break|rupture)/, tag: "transmission_main_break" },
  { rx: /no\s+water.*(hospital|school|fire\s+station)/, tag: "critical_facility_outage" },
  { rx: /chlorine\s+(leak|release|spill)/, tag: "chlorine_release" },
];

const HIGH_RULES = [
  { rx: /water\s+main\s+break|major\s+main\s+break/, tag: "water_main_break" },
  { rx: /\b(major|large)\s+leak\b/, tag: "large_leak" },
  { rx: /low\s+pressure.*(area|zone|widespread)/, tag: "widespread_low_pressure" },
  { rx: /pump\s+station\s+(failure|alarm)/, tag: "pump_station" },
  { rx: /backflow\s+(event|incident)|cross[-\s]?connection/, tag: "backflow_event" },
  { rx: /valve\s+(failure|stuck\s+(closed|open))/, tag: "valve_failure" },
  { rx: /road\s+(closure|flooded)/, tag: "road_impact" },
];

// Apply boosts in-place to the logScores map; return tags that fired
function applyDomainBoost(rawText, logScores) {
  const text = (rawText || "").toLowerCase();
  const tags = [];

  const has = (k) => Object.prototype.hasOwnProperty.call(logScores, k);

  for (const rule of CRITICAL_RULES) {
    if (rule.rx.test(text)) {
      if (has("CRITICAL")) logScores.CRITICAL += BOOST_CRITICAL;
      tags.push(rule.tag);
    }
  }
  for (const rule of HIGH_RULES) {
    if (rule.rx.test(text)) {
      if (has("HIGH")) logScores.HIGH += BOOST_HIGH;
      tags.push(rule.tag);
    }
  }

  return tags;
}

/* ---------------- NB scoring ---------------- */
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

function classifyTokens(tokens, rawTextForRules) {
  const { features, classFeatures, classTotals, totalExamples, smoothing } = MODEL;
  const vocabSize = Object.keys(features).length;
  const classWordTotals = computeClassWordTotals(classFeatures);

  const labels = Object.keys(classTotals);
  if (!labels.length) throw new Error("Not Trained");

  const logScores = {};
  for (const label of labels) {
    // Prior (Laplace on priors; keep your current behavior)
    const priorNum = (classTotals[label] ?? 0) + 1;
    const priorDen = (totalExamples ?? 1) + labels.length;
    let score = Math.log(priorNum) - Math.log(priorDen);

    // Likelihood
    const denom = (classWordTotals[label] ?? 0) + smoothing * vocabSize;
    const cf = classFeatures[label] || {};

    for (const tok of tokens) {
      const idx = features[tok];
      if (idx === undefined) continue;
      const count = cf[idx] ?? 0;
      score += Math.log(count + smoothing) - Math.log(denom);
    }

    logScores[label] = score;
  }

  // ---- Hybrid safety net: domain boosts (before softmax) ----
  const tags = applyDomainBoost(rawTextForRules, logScores);

  // softmax for confidence
  const max = Math.max(...Object.values(logScores));
  const exps = Object.fromEntries(Object.entries(logScores).map(([k, v]) => [k, Math.exp(v - max)]));
  const Z = Object.values(exps).reduce((a, b) => a + b, 0) || 1;
  const probs = Object.fromEntries(Object.entries(exps).map(([k, v]) => [k, v / Z]));

  let best = labels[0];
  for (const l of labels) if (probs[l] > probs[best]) best = l;

  return { label: best, confidence: probs[best] ?? 0, tags };
}

/* ---------------- public API ---------------- */
export async function smartClassify({ title = "", description = "" }) {
  await loadModelIfNeeded();

  const rawText = `${title ?? ""} ${description ?? ""}`.trim();
  const toks = [...tokenize(title), ...tokenize(description)];

  if (!toks.length) return { priority: "MEDIUM", confidence: 0 };

  const { label, confidence, tags } = classifyTokens(toks, rawText);

  // Show a single representative tag if any fired
  const inferredType = tags.length ? tags[0] : undefined;

  return { priority: label, confidence, inferredType };
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
    if (String(err?.message) === "Not Trained") {
      return res.json({ ok: false, reason: "not_trained" });
    }
    console.error("[ML] classify error:", err);
    return res.status(500).json({ ok: false, reason: "internal_error" });
  }
}

export async function feedbackHandler(req, res) {
  try {
    const body = req.body || {};
    const dir = path.resolve(__dirname, "../../data");
    await mkdir(dir, { recursive: true });
    const line =
      JSON.stringify({
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
