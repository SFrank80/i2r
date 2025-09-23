import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const CSV_PATH   = path.resolve(__dirname, "../data/training.csv");
const MODEL_PATH = path.resolve(__dirname, "../models/priority-nb.json");

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function parseCsv(raw) {
  const lines = raw.trim().split(/\r?\n/);
  const header = lines.shift().split(",").map(h => h.trim());
  const rows = [];
  for (const line of lines) {
    // very simple split; export_training.csv shouldn’t have embedded commas
    const cells = line.split(",").map(s => s.trim());
    const r = {};
    header.forEach((h, i) => (r[h] = cells[i] ?? ""));
    rows.push(r);
  }
  return rows;
}

async function main() {
  const raw = await fs.readFile(CSV_PATH, "utf8");
  const rows = parseCsv(raw);

  // counts
  const labels = new Set();
  const docsPerLabel = {};
  const tokenCounts = {};  // label -> token -> count
  const totalTokens = {};  // label -> total token count
  const vocabAll = new Set();

  for (const r of rows) {
    const label = String(r.priority || "MEDIUM").toUpperCase();
    const text = `${r.title ?? ""} ${r.description ?? ""}`;
    const tokens = tokenize(text);

    labels.add(label);
    docsPerLabel[label] = (docsPerLabel[label] ?? 0) + 1;
    tokenCounts[label] = tokenCounts[label] || {};
    totalTokens[label] = totalTokens[label] || 0;

    for (const t of tokens) {
      vocabAll.add(t);
      tokenCounts[label][t] = (tokenCounts[label][t] ?? 0) + 1;
      totalTokens[label] += 1;
    }
  }

  const labelList = [...labels];
  const totalDocs = rows.length || 1;
  const vocabSize = vocabAll.size || 1;

  // priors (log)
  const priors = {};
  for (const l of labelList) {
    priors[l] = Math.log((docsPerLabel[l] ?? 0.5) / totalDocs);
  }

  // likelihoods (log) with Laplace smoothing
  const vocab = {};
  for (const l of labelList) {
    const map = {};
    const denom = (totalTokens[l] ?? 0) + vocabSize; // Laplace
    for (const t of vocabAll) {
      const count = (tokenCounts[l]?.[t] ?? 0) + 1;
      map[t] = Math.log(count / denom);
    }
    vocab[l] = map;
  }

  const model = {
    labels: labelList,
    priors,
    vocab,
    meta: {
      totalDocs,
      vocabSize,
      updatedAt: new Date().toISOString()
    }
  };

  await fs.mkdir(path.dirname(MODEL_PATH), { recursive: true });
  await fs.writeFile(MODEL_PATH, JSON.stringify(model));
  console.log(`Model saved: ${MODEL_PATH}`);
}

main().catch(err => {
  console.error("Training failed:", err);
  process.exit(1);
});
