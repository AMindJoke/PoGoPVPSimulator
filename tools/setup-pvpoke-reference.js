"use strict";

const fs = require("fs");
const https = require("https");
const path = require("path");

const { PINNED_PVPOKE_REVISION, REQUIRED_MODULES, validateReferenceDirectory } = require("./pvpoke-reference-adapter");

const ROOT = path.resolve(__dirname, "..");
const REPO_PATH = path.join(ROOT, "vendor", "pvpoke");

function rawUrl(relativePath) {
  return `https://raw.githubusercontent.com/pvpoke/pvpoke/${PINNED_PVPOKE_REVISION}/${relativePath}`;
}

async function setup() {
  fs.mkdirSync(REPO_PATH, { recursive: true });
  for (const relativePath of REQUIRED_MODULES) {
    const destination = path.join(REPO_PATH, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const content = await fetchText(rawUrl(relativePath));
    fs.writeFileSync(destination, content, "utf8");
  }
  fs.writeFileSync(path.join(REPO_PATH, ".pinned-revision"), `${PINNED_PVPOKE_REVISION}\n`, "utf8");
  validateReferenceDirectory(REPO_PATH, PINNED_PVPOKE_REVISION);
  console.log(JSON.stringify({
    reference: "actual PvPoke runtime",
    repoPath: path.relative(ROOT, REPO_PATH).replace(/\\/g, "/"),
    pinnedRevision: PINNED_PVPOKE_REVISION,
    modules: REQUIRED_MODULES
  }, null, 2));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`GET ${url} failed with ${response.statusCode}`));
        response.resume();
        return;
      }
      response.setEncoding("utf8");
      let body = "";
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => resolve(body));
    }).on("error", reject);
  });
}

if (require.main === module) {
  setup().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { setup, REPO_PATH };
