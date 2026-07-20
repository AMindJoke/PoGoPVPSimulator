"use strict";

const fs = require("fs");
const path = require("path");
const battleReliability = require("../src/reliability/battle-reliability");

const ROOT = path.resolve(__dirname, "..");
const CACHE_ROOT = path.join(ROOT, "data", "matchup-cache", "great-league");

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function pokemonIdFromSignature(signature) {
  return String(signature || "").split(":", 1)[0];
}

function cellTargetsPokemon(cellKey, pokemonIds) {
  const defenderId = String(cellKey || "").split(":", 1)[0];
  return pokemonIds.has(defenderId);
}

function writeJsonAtomic(file, value) {
  const temporaryFile = `${file}.refresh-${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(value)}\n`, "utf8");
  fs.renameSync(temporaryFile, file);
}

function refreshCache({ pokemonIds, fromVersion, targetVersion, apply = false }) {
  if (!pokemonIds.size) throw new Error("Provide at least one Pokemon ID with --pokemon=id1,id2.");
  if (!fs.existsSync(CACHE_ROOT)) throw new Error(`Cache directory not found: ${CACHE_ROOT}`);

  const summary = {
    apply,
    fromVersion,
    targetVersion,
    pokemonIds: [...pokemonIds],
    filesScanned: 0,
    filesChanged: 0,
    attackerFilesReset: 0,
    defenderCellsRemoved: 0,
    cellsPreserved: 0,
    versionCounts: {},
    skippedVersions: {}
  };

  const profileDirs = fs.readdirSync(CACHE_ROOT, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(CACHE_ROOT, entry.name));

  for (const profileDir of profileDirs) {
    const files = fs.readdirSync(profileDir)
      .filter(name => name.endsWith(".json"))
      .map(name => path.join(profileDir, name));

    for (const file of files) {
      const cache = JSON.parse(fs.readFileSync(file, "utf8"));
      summary.filesScanned++;
      const version = String(cache.matrixVersion || "unknown");
      summary.versionCounts[version] = (summary.versionCounts[version] || 0) + 1;

      if (version !== fromVersion && version !== targetVersion) {
        summary.skippedVersions[version] = (summary.skippedVersions[version] || 0) + 1;
        continue;
      }

      const attackerId = pokemonIdFromSignature(cache.attackerSignature);
      const existingCells = cache.cells && typeof cache.cells === "object" ? cache.cells : {};
      let changed = version !== targetVersion;

      if (pokemonIds.has(attackerId)) {
        summary.attackerFilesReset++;
        summary.defenderCellsRemoved += Object.keys(existingCells).length;
        cache.cells = {};
        changed = true;
      } else {
        const retainedCells = {};
        for (const [key, value] of Object.entries(existingCells)) {
          if (cellTargetsPokemon(key, pokemonIds)) {
            summary.defenderCellsRemoved++;
            changed = true;
          } else {
            retainedCells[key] = value;
            summary.cellsPreserved++;
          }
        }
        cache.cells = retainedCells;
      }

      if (!changed) continue;
      summary.filesChanged++;
      cache.matrixVersion = targetVersion;
      cache.generatedAt = new Date().toISOString();
      cache.refresh = {
        type: "selective-pokemon-invalidation",
        pokemonIds: [...pokemonIds],
        previousVersion: version,
        refreshedAt: cache.generatedAt
      };
      if (apply) writeJsonAtomic(file, cache);

      if (summary.filesScanned % 100 === 0) {
        console.log(`Scanned ${summary.filesScanned} cache files...`);
      }
    }
  }

  return summary;
}

if (require.main === module) {
  const pokemonIds = new Set(option("pokemon").split(",").map(value => value.trim()).filter(Boolean));
  const fromVersion = option("from-version", "live-worker-v1");
  const targetVersion = option("target-version", battleReliability.BATTLE_ENGINE_VERSION);
  const apply = process.argv.includes("--apply");
  const summary = refreshCache({ pokemonIds, fromVersion, targetVersion, apply });
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) console.log("Dry run only. Re-run with --apply to update the cache.");
}

module.exports = { refreshCache, pokemonIdFromSignature, cellTargetsPokemon };
