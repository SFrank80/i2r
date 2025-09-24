// api/src/ml/train.js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import natural from "natural";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Prefer the fresh export in api/data; fall back to api/src/data only if needed */
const trainingCandidates = [
  path.resolve(__dirname, "../../data/training.csv"),
  path.resolve(__dirname, "../data/training.csv"),
];

/* ---------- tiny CSV helpers (handle quotes, commas) ---------- */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"'; i++;        // escaped quote
      } else {
        inQ = !inQ;
      }
    } else if (c === "," && !inQ) {
      out.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function findCol(header, names) {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const n of names) {
    const idx = lower.indexOf(n);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { header: [], rows: [] };

  const header = splitCsvLine(lines[0]);
  const titleIdx = findCol(header, ["title", "subject", "name"]);
  const descIdx  = findCol(header, ["description", "details", "detail", "notes", "note", "body", "text"]);
  const prioIdx  = findCol(header, ["priority", "label", "class", "severity"]);

  const allowed = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const title = titleIdx >= 0 ? (cols[titleIdx] ?? "") : "";
    const description = descIdx >= 0 ? (cols[descIdx] ?? "") : "";
    const pr = (prioIdx >= 0 ? cols[prioIdx] ?? "" : "").toUpperCase().trim();
    if (!allowed.has(pr)) continue;

    const textRaw = `${title} ${description}`.trim();
    if (!textRaw) continue; // skip empty text rows

    rows.push({ text: textRaw, priority: pr });
  }
  return { header, rows, indices: { titleIdx, descIdx, prioIdx } };
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  // Locate CSV
  let trainingCsvPath = null;
  let csvText = null;
  for (const candidate of trainingCandidates) {
    try {
      csvText = await readFile(candidate, "utf8");
      trainingCsvPath = candidate;
      break;
    } catch { /* keep trying */ }
  }
  if (!csvText) {
    throw new Error(`training.csv not found. Tried: ${trainingCandidates.join(" , ")}`);
  }
  console.log(`[ML] Using training: ${trainingCsvPath}`);

  // Parse + validate
  const parsed = parseCsv(csvText);
  const { rows, indices } = parsed;
  if (rows.length === 0) {
    console.error("[ML] Parsed header:", parsed.header);
    console.error("[ML] Column indices:", indices);
    throw new Error("No valid rows parsed from training.csv (check header names and content).");
  }
  console.log(`[ML] Training on ${rows.length} examples.`);
  console.log(`[ML] Column indices -> title:${indices.titleIdx} description:${indices.descIdx} priority:${indices.prioIdx}`);

  // Train Bayes
  const classifier = new natural.BayesClassifier();
  for (const r of rows) {
    const text = normalize(r.text);
    if (text) classifier.addDocument(text, r.priority);
  }

  if (!classifier.docs || classifier.docs.length === 0) {
    throw new Error("No documents added to classifier; check training data.");
  }

  classifier.train();

  // ---- SAVE: avoid .toJSON(), use .save() then read back the JSON it wrote ----
  const modelsDir = path.resolve(__dirname, "../../models");
  await mkdir(modelsDir, { recursive: true });

  const tmpFile = path.join(os.tmpdir(), `nb-${Date.now()}.json`);
  await new Promise((resolve, reject) => {
    classifier.save(tmpFile, (err) => (err ? reject(err) : resolve()));
  });
  const naturalJson = JSON.parse(await readFile(tmpFile, "utf8"));

  const outFile = path.join(modelsDir, "priority-nb.json");
  const payload = {
    _eventsCount: rows.length,
    classifier: naturalJson,          // what service.js restores from
  };
  await writeFile(outFile, JSON.stringify(payload), "utf8");
  console.log(`[ML] Model saved to ${outFile}`);
}

main().catch((err) => {
  console.error("Training failed:", err);
  process.exit(1);
});
