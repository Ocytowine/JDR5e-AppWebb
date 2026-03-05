const { execSync } = require("node:child_process");
const path = require("node:path");

function run(command, options = {}) {
  return execSync(command, { stdio: "pipe", encoding: "utf-8", ...options }).trim();
}

function main() {
  const repoRoot = run("git rev-parse --show-toplevel");
  const hooksPath = path.join(repoRoot, ".githooks");

  execSync(`git config core.hooksPath "${hooksPath}"`, { stdio: "inherit" });
  console.log(`[PASS] Git hooks path configured: ${hooksPath}`);
  console.log("[INFO] Hooks enabled: pre-commit, pre-push");
}

main();

