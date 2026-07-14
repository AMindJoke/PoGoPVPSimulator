const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const childProcess = require("child_process");
const { BATTLE_ENGINE_VERSION, createMatchupProvenance } = require("../src/reliability/battle-reliability");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_DATASET = "data/great-league-rankings.json";
const REPORT_DIR = "data/reports";
const DATASET_VERSION = 1;
const GOLDEN_MATCHUPS = "data/golden-matchups/great-league.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const file = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fs.statSync(file).size;
}

function fileSize(relativePath) {
  const file = path.join(ROOT, relativePath);
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

function hashFile(relativePath) {
  const file = path.join(ROOT, relativePath);
  if (!fs.existsSync(file)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
}

function gitSha() {
  try {
    return childProcess.execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function hasInvalidPrimitive(value) {
  if (value === undefined) return true;
  if (typeof value === "number") return !Number.isFinite(value);
  return false;
}

function scanInvalidValues(value, prefix, issues, limit = 60) {
  if (issues.length >= limit) return;
  if (hasInvalidPrimitive(value)) {
    issues.push(`${prefix} contains an invalid value.`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanInvalidValues(item, `${prefix}[${index}]`, issues, limit));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    scanInvalidValues(item, `${prefix}.${key}`, issues, limit);
  }
}

function loadKnownPokemonIds() {
  const source = path.join(ROOT, "gamemaster-data.js");
  if (!fs.existsSync(source)) return null;
  const code = fs.readFileSync(source, "utf8");
  const match = code.match(/window\.PVPOKE_GAMEMASTER\s*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) return null;
  const data = JSON.parse(match[1]);
  return new Set((data.pokemon || []).map(p => p.speciesId).filter(Boolean));
}

function scoreValue(entry) {
  return Number(entry.overallScore ?? entry.competitiveScore ?? entry.weightedScore ?? entry.averageScore ?? 0);
}

function expectedShieldKey(state) {
  return Array.isArray(state) ? `${state[0]}-${state[1]}` : String(state);
}

function validateDataset(dataset, options = {}) {
  const issues = [];
  const warnings = [];
  const metadata = dataset.metadata || {};
  const entries = Array.isArray(dataset.entries) ? dataset.entries : [];
  const knownPokemonIds = options.skipKnownPokemonCheck ? null : loadKnownPokemonIds();

  if (!dataset || typeof dataset !== "object") issues.push("Dataset root must be an object.");
  if (!Array.isArray(dataset.entries)) issues.push("Dataset entries must be an array.");
  if (!metadata || typeof metadata !== "object") issues.push("Dataset metadata is missing.");
  if (!dataset.schemaVersion) issues.push("Dataset schemaVersion is missing.");
  if (dataset.league !== "great") warnings.push(`Dataset league is '${dataset.league}', expected 'great'.`);

  const profiles = Array.isArray(metadata.profiles) && metadata.profiles.length ? metadata.profiles : ["rank1"];
  const shieldStates = Array.isArray(metadata.shieldScenarios) ? metadata.shieldScenarios.map(expectedShieldKey) : [];
  const selfSkipped = metadata.opponentPool === "all";
  const expectedOpponents = Number(metadata.opponentPokemonCount || 0);
  const expectedPerShield = expectedOpponents ? expectedOpponents - (selfSkipped ? 1 : 0) : null;
  const expectedMatchups = expectedPerShield && shieldStates.length ? expectedPerShield * shieldStates.length : null;
  const expectedEntries = Number(metadata.pokemonCount || 0);

  if (!metadata.generatedAt) issues.push("metadata.generatedAt is missing.");
  if (!metadata.datasetVersion) warnings.push("metadata.datasetVersion is missing.");
  if (!metadata.gameMasterHash) warnings.push("metadata.gameMasterHash is missing.");
  const provenance = createMatchupProvenance({
    source: "offline-generated",
    datasetEngineVersion: metadata.engineVersion || metadata.matrixVersion,
    datasetVersion: metadata.datasetVersion,
    generatedAt: metadata.generatedAt
  });
  if (provenance.stale) warnings.push(`Dataset planner version is stale: ${provenance.datasetEngineVersion || "missing"}; current ${BATTLE_ENGINE_VERSION}.`);
  if (!shieldStates.length) issues.push("metadata.shieldScenarios is missing or empty.");
  if (expectedEntries && entries.length !== expectedEntries) {
    issues.push(`Entry count mismatch: found ${entries.length}, metadata says ${expectedEntries}.`);
  }

  const keys = new Set();
  const ids = new Set();
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const key = `${entry.profile || "rank1"}:${entry.id}`;
    if (!entry.id) issues.push(`Entry ${index + 1} is missing id.`);
    if (!entry.name) issues.push(`Entry ${key} is missing name.`);
    if (keys.has(key)) issues.push(`Duplicate Pokemon/profile entry: ${key}.`);
    keys.add(key);
    ids.add(entry.id);
    if (knownPokemonIds && entry.id && !knownPokemonIds.has(entry.id)) {
      issues.push(`Unknown Pokemon id in ranking: ${entry.id}.`);
    }
    const score = scoreValue(entry);
    if (!Number.isFinite(score) || score < 0 || score > 1000) {
      issues.push(`Invalid score for ${key}: ${score}.`);
    }
    if (entry.rank !== index + 1) {
      issues.push(`Rank mismatch for ${key}: expected ${index + 1}, found ${entry.rank}.`);
    }
    if (index > 0 && score > scoreValue(entries[index - 1])) {
      issues.push(`Ranking sort mismatch: ${entry.name} appears after a lower score.`);
    }
    if (expectedMatchups && entry.matchups !== expectedMatchups) {
      issues.push(`Coverage mismatch for ${key}: ${entry.matchups} matchups, expected ${expectedMatchups}.`);
    }
    for (const stateKey of shieldStates) {
      const state = entry.shieldStates && entry.shieldStates[stateKey];
      if (!state) {
        issues.push(`Missing shield state ${stateKey} for ${key}.`);
        continue;
      }
      if (expectedPerShield && state.matchups !== expectedPerShield) {
        issues.push(`Shield state ${stateKey} for ${key} has ${state.matchups} matchups, expected ${expectedPerShield}.`);
      }
      const stateScore = Number(state.averageScore);
      if (!Number.isFinite(stateScore) || stateScore < 0 || stateScore > 1000) {
        issues.push(`Invalid shield score for ${key} ${stateKey}: ${state.averageScore}.`);
      }
    }
  }

  if (metadata.pokemonCount && ids.size !== Number(metadata.pokemonCount)) {
    issues.push(`Pokemon id count mismatch: ${ids.size} unique ids, metadata says ${metadata.pokemonCount}.`);
  }
  if (profiles.length > 1 && keys.size !== ids.size * profiles.length) {
    warnings.push("Multiple profiles are configured; verify profile coverage if this dataset is consumed by the website.");
  }

  const invalidValueIssues = [];
  scanInvalidValues(dataset, "dataset", invalidValueIssues);
  issues.push(...invalidValueIssues);

  return {
    valid: issues.length === 0,
    issues,
    warnings,
    expected: {
      entries: expectedEntries || entries.length,
      matchupsPerEntry: expectedMatchups,
      matchupsPerShieldState: expectedPerShield,
      shieldStates
    }
  };
}

function sanityReport(dataset) {
  const entries = Array.isArray(dataset.entries) ? dataset.entries : [];
  const byScore = [...entries].sort((a, b) => scoreValue(b) - scoreValue(a));
  const shieldSwing = entries.map(entry => {
    const states = entry.shieldStates || {};
    const zero = Number(states["0-0"] && states["0-0"].averageScore);
    const one = Number(states["1-1"] && states["1-1"].averageScore);
    const two = Number(states["2-2"] && states["2-2"].averageScore);
    const values = [zero, one, two].filter(Number.isFinite);
    return {
      rank: entry.rank,
      name: entry.name,
      zero,
      one,
      two,
      spread: values.length ? Math.max(...values) - Math.min(...values) : 0
    };
  }).sort((a, b) => b.spread - a.spread);
  const surprise = entries.map(entry => ({
    rank: entry.rank,
    name: entry.name,
    score: scoreValue(entry),
    rawScore: entry.rawScore,
    competitiveScore: entry.competitiveScore,
    winRate: entry.winRate,
    scoreStdDev: entry.scoreStdDev,
    delta: Math.abs(Number(entry.rawScore || 0) - Number(entry.competitiveScore || entry.overallScore || 0))
  })).sort((a, b) => b.delta - a.delta || b.scoreStdDev - a.scoreStdDev);

  return {
    top50: byScore.slice(0, 50).map(compactSanityEntry),
    bottom20: byScore.slice(-20).reverse().map(compactSanityEntry),
    largestShieldDifferences: shieldSwing.slice(0, 20),
    largestRankingSurprises: surprise.slice(0, 25),
    extremeHighWinRate: entries.filter(entry => Number(entry.winRate) >= .9).slice(0, 25).map(compactSanityEntry),
    extremeLowWinRate: entries.filter(entry => Number(entry.winRate) <= .1).slice(0, 25).map(compactSanityEntry),
    suspiciousScores: entries.filter(entry => scoreValue(entry) <= 100 || scoreValue(entry) >= 900).map(compactSanityEntry)
  };
}

function compactSanityEntry(entry) {
  return {
    rank: entry.rank,
    name: entry.name,
    score: scoreValue(entry),
    rawScore: entry.rawScore,
    competitiveScore: entry.competitiveScore,
    winRate: entry.winRate
  };
}

function loadGoldenMatchups() {
  const file = path.join(ROOT, GOLDEN_MATCHUPS);
  if (!fs.existsSync(file)) return [];
  return readJson(GOLDEN_MATCHUPS).matchups || [];
}

function evaluateGoldenMatchups() {
  const matchups = loadGoldenMatchups();
  return {
    total: matchups.length,
    active: matchups.filter(item => item.enabled !== false && item.expected).length,
    pending: matchups.filter(item => item.enabled === false || !item.expected).map(item => item.name || `${item.a} vs ${item.b}`),
    issues: []
  };
}

function outputFiles(datasetPath, dataset) {
  const candidates = [
    datasetPath,
    "data/great-league-rankings.js",
    "data/rankings/great-league-full.json"
  ];
  if (!(dataset.metadata && dataset.metadata.rankingOnly)) {
    candidates.push("data/great-league-matchups.json");
  }
  const files = candidates.filter((item, index) => candidates.indexOf(item) === index && fileSize(item));
  return files.map(relativePath => ({ path: relativePath, bytes: fileSize(relativePath) }));
}

function buildReport({ datasetPath = DEFAULT_DATASET, validation, dataset, generatedAt = new Date().toISOString() }) {
  const metadata = dataset.metadata || {};
  const files = outputFiles(datasetPath, dataset);
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const generationDuration = Number(metadata.generationDurationSeconds || metadata.generationDuration || 0);
  const cells = Number(metadata.cells || 0);
  const sanity = sanityReport(dataset);
  const golden = evaluateGoldenMatchups();
  const provenance = createMatchupProvenance({
    source: "offline-generated",
    datasetEngineVersion: metadata.engineVersion || metadata.matrixVersion,
    datasetVersion: metadata.datasetVersion || DATASET_VERSION,
    generatedAt: metadata.generatedAt
  });

  return {
    generatedAt,
    status: validation.valid ? "VALID" : "INVALID",
    generation: {
      datasetVersion: metadata.datasetVersion || DATASET_VERSION,
      simulatorVersion: metadata.matrixVersion || null,
      currentEngineVersion: BATTLE_ENGINE_VERSION,
      provenance,
      simulatorSource: metadata.simulatorSource || null,
      gameMasterHash: metadata.gameMasterHash || hashFile("gamemaster-data.js"),
      gitCommitSha: metadata.gitCommitSha || gitSha(),
      datasetGeneratedAt: metadata.generatedAt || null
    },
    coverage: {
      pokemonIncluded: metadata.pokemonCount || dataset.entries.length,
      pokemonConfigured: metadata.configuredPokemonCount || null,
      pokemonExcluded: Array.isArray(metadata.skippedPokemon) ? metadata.skippedPokemon.length : 0,
      exclusionReasons: {
        missingFromGameMasterOrNotEligible: metadata.skippedPokemon || []
      },
      shieldStates: metadata.shieldScenarios || []
    },
    simulationStatistics: {
      theoreticalSimulations: validation.expected.entries && validation.expected.matchupsPerEntry
        ? validation.expected.entries * validation.expected.matchupsPerEntry
        : cells,
      completedSimulations: cells,
      failedSimulations: metadata.failedSimulations || 0,
      skippedSimulations: metadata.skippedSimulations || 0,
      retries: metadata.retries || 0
    },
    performance: {
      totalRuntimeSeconds: generationDuration || null,
      averageSimulationMs: generationDuration && cells ? Number(((generationDuration * 1000) / cells).toFixed(4)) : null,
      simulationsPerSecond: generationDuration && cells ? Number((cells / generationDuration).toFixed(2)) : null,
      peakMemoryBytes: metadata.peakMemoryBytes || null
    },
    output: {
      files,
      totalBytes
    },
    validation,
    sanity,
    goldenMatchups: golden
  };
}

function markdownReport(report) {
  const lines = [];
  lines.push(`# Great League Dataset Quality Report`);
  lines.push("");
  lines.push(`Status: **Dataset ${report.status}**`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push(`## Generation`);
  lines.push(`- Dataset version: ${report.generation.datasetVersion}`);
  lines.push(`- Simulator version: ${report.generation.simulatorVersion || "unknown"}`);
  lines.push(`- Game Master hash: ${report.generation.gameMasterHash || "unknown"}`);
  lines.push(`- Git commit: ${report.generation.gitCommitSha || "unknown"}`);
  lines.push("");
  lines.push(`## Coverage`);
  lines.push(`- Pokemon included: ${report.coverage.pokemonIncluded}`);
  lines.push(`- Pokemon excluded: ${report.coverage.pokemonExcluded}`);
  lines.push(`- Shield states: ${report.coverage.shieldStates.map(expectedShieldKey).join(", ")}`);
  lines.push("");
  lines.push(`## Simulation Statistics`);
  lines.push(`- Theoretical simulations: ${report.simulationStatistics.theoreticalSimulations}`);
  lines.push(`- Completed simulations: ${report.simulationStatistics.completedSimulations}`);
  lines.push(`- Failed simulations: ${report.simulationStatistics.failedSimulations}`);
  lines.push(`- Skipped simulations: ${report.simulationStatistics.skippedSimulations}`);
  lines.push("");
  lines.push(`## Output`);
  for (const file of report.output.files) {
    lines.push(`- ${file.path}: ${file.bytes.toLocaleString()} bytes`);
  }
  lines.push(`- Total dataset size: ${report.output.totalBytes.toLocaleString()} bytes`);
  lines.push("");
  lines.push(`## Validation`);
  if (report.validation.issues.length) {
    lines.push(`### Issues`);
    report.validation.issues.forEach(issue => lines.push(`- ${issue}`));
  } else {
    lines.push(`- No blocking issues found.`);
  }
  if (report.validation.warnings.length) {
    lines.push(`### Warnings`);
    report.validation.warnings.forEach(warning => lines.push(`- ${warning}`));
  }
  lines.push("");
  lines.push(`## Sanity Check`);
  lines.push(`### Top 50`);
  report.sanity.top50.forEach(entry => lines.push(`- #${entry.rank} ${entry.name}: ${entry.score}`));
  lines.push("");
  lines.push(`### Bottom 20`);
  report.sanity.bottom20.forEach(entry => lines.push(`- #${entry.rank} ${entry.name}: ${entry.score}`));
  lines.push("");
  lines.push(`### Biggest 0-0 / 1-1 / 2-2 Differences`);
  report.sanity.largestShieldDifferences.slice(0, 10).forEach(entry => {
    lines.push(`- #${entry.rank} ${entry.name}: spread ${entry.spread} (0-0 ${entry.zero}, 1-1 ${entry.one}, 2-2 ${entry.two})`);
  });
  lines.push("");
  lines.push(`### Largest Ranking Surprises`);
  report.sanity.largestRankingSurprises.slice(0, 10).forEach(entry => {
    lines.push(`- #${entry.rank} ${entry.name}: raw ${entry.rawScore}, competitive ${entry.competitiveScore}, delta ${entry.delta}`);
  });
  lines.push("");
  lines.push(`## Golden Matchups`);
  lines.push(`- Configured: ${report.goldenMatchups.total}`);
  lines.push(`- Active checks: ${report.goldenMatchups.active}`);
  if (report.goldenMatchups.pending.length) {
    lines.push(`- Pending manual baselines: ${report.goldenMatchups.pending.join(", ")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function updateDatasetMetadata(datasetPath, dataset, report) {
  dataset.metadata = {
    ...dataset.metadata,
    datasetVersion: dataset.metadata.datasetVersion || DATASET_VERSION,
    validationPassed: report.status === "VALID",
    validationGeneratedAt: report.generatedAt,
    validationReport: path.join(REPORT_DIR, "great-league-quality-report.md").replace(/\\/g, "/"),
    gameMasterHash: dataset.metadata.gameMasterHash || report.generation.gameMasterHash,
    gitCommitSha: dataset.metadata.gitCommitSha || report.generation.gitCommitSha
  };
  writeJson(datasetPath, dataset);
  if (datasetPath === DEFAULT_DATASET || datasetPath.endsWith("great-league-rankings.json")) {
    fs.writeFileSync(
      path.join(ROOT, "data", "great-league-rankings.js"),
      `window.GREAT_LEAGUE_RANKINGS = ${JSON.stringify(dataset, null, 2)};\n`,
      "utf8"
    );
    if (fs.existsSync(path.join(ROOT, "data", "rankings", "great-league-full.json"))) {
      writeJson("data/rankings/great-league-full.json", dataset);
    }
  }
}

function runQualityPipeline(options = {}) {
  const datasetPath = options.datasetPath || DEFAULT_DATASET;
  const dataset = readJson(datasetPath);
  const validation = validateDataset(dataset, options);
  const report = buildReport({ datasetPath, validation, dataset });
  if (options.writeMetadata) updateDatasetMetadata(datasetPath, dataset, report);
  if (options.writeReport !== false) {
    writeJson(path.join(REPORT_DIR, "great-league-quality-report.json"), report);
    fs.writeFileSync(path.join(ROOT, REPORT_DIR, "great-league-quality-report.md"), markdownReport(report), "utf8");
  }
  return report;
}

function cli() {
  const args = new Set(process.argv.slice(2));
  const datasetArg = process.argv.find(arg => arg.startsWith("--dataset="));
  const datasetPath = datasetArg ? datasetArg.split("=").slice(1).join("=") : DEFAULT_DATASET;
  const report = runQualityPipeline({
    datasetPath,
    writeMetadata: args.has("--write-metadata"),
    writeReport: !args.has("--no-report")
  });
  console.log(`Dataset ${report.status}`);
  if (report.validation.issues.length) {
    console.log("Issues:");
    report.validation.issues.forEach(issue => console.log(`- ${issue}`));
  }
  if (report.validation.warnings.length) {
    console.log("Warnings:");
    report.validation.warnings.forEach(warning => console.log(`- ${warning}`));
  }
  if (report.status !== "VALID") process.exitCode = 1;
}

if (require.main === module) cli();

module.exports = {
  validateDataset,
  sanityReport,
  buildReport,
  runQualityPipeline
};
