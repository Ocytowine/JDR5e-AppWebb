import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();
const scanRoots = [
  "narration-module/src/application",
  "src/narration-ui"
];

// G0 baseline. Values may decrease while the debt is removed; any increase or
// new file fails the gate. These counts are not quality targets and must never
// be used to justify a lexical interpretation rule.
const baseline = {
  "narration-module/src/application/NarrativeTurnController.ts": { functions: 2, operations: 4 },
  "narration-module/src/application/accessControl.ts": { functions: 1, operations: 1 },
  "narration-module/src/application/activeSceneNarrative.ts": { functions: 1, operations: 7 },
  "narration-module/src/application/aiIntentInterpretation.ts": { functions: 18, operations: 104 },
  "narration-module/src/application/aiNarrativeEnhancement.ts": { functions: 1, operations: 2 },
  "narration-module/src/application/campaignDynamicPlaceRuntime.ts": { functions: 1, operations: 2 },
  "narration-module/src/application/catalogInventoryTransactionRuntime.ts": { functions: 6, operations: 41 },
  "narration-module/src/application/catalogPlotCreationRuntime.ts": { functions: 3, operations: 8 },
  "narration-module/src/application/intentClarification.ts": { functions: 2, operations: 26 },
  "narration-module/src/application/narrativeResolution.ts": { functions: 2, operations: 6 },
  "narration-module/src/application/npcInformationResolution.ts": { functions: 1, operations: 1 },
  "narration-module/src/application/playableScene.ts": { functions: 2, operations: 2 },
  "narration-module/src/application/playerPublicContext.ts": { functions: 1, operations: 6 },
  "narration-module/src/application/presentationVariation.ts": { functions: 1, operations: 1 },
  "narration-module/src/application/referenceScene.ts": { functions: 9, operations: 47 },
  "src/narration-ui/playableCampaignAccessCatalog.ts": { functions: 4, operations: 26 },
  "src/narration-ui/playableCampaignMissionCatalog.ts": { functions: 1, operations: 8 }
};

const sourceFiles = scanRoots
  .flatMap(root => collectSourceFiles(path.join(projectRoot, root)))
  .sort();
const report = {};

for (const absolutePath of sourceFiles) {
  const sourceText = fs.readFileSync(absolutePath, "utf8");
  const source = ts.createSourceFile(
    absolutePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  let functions = 0;
  let operations = 0;
  visitFunctions(source, node => {
    const signals = lexicalSignals(node, source);
    if (!signals.referencesPlayerText || signals.operations === 0) return;
    functions += 1;
    operations += signals.operations;
  });
  if (functions === 0) continue;
  const relativePath = path.relative(projectRoot, absolutePath).replaceAll("\\", "/");
  report[relativePath] = { functions, operations };
}

if (process.argv.includes("--report")) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(0);
}

const issues = [];
for (const [file, counts] of Object.entries(report)) {
  const allowed = baseline[file];
  if (allowed === undefined) {
    issues.push(`${file}: new player-text lexical consumer (${counts.functions} function(s), ${counts.operations} lexical operation(s))`);
    continue;
  }
  if (counts.functions > allowed.functions || counts.operations > allowed.operations) {
    issues.push(`${file}: lexical debt increased from ${allowed.functions}/${allowed.operations} to ${counts.functions}/${counts.operations}`);
  }
}

if (issues.length > 0) {
  process.stderr.write([
    "OpenAI intent lexical-debt gate failed.",
    "The production path must consume structured interpretation instead of re-reading player words.",
    ...issues.map(issue => `- ${issue}`)
  ].join("\n") + "\n");
  process.exit(1);
}

process.stdout.write(`OpenAI intent lexical-debt gate passed (${Object.keys(report).length} debt file(s), no increase).\n`);

function collectSourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(target);
    return entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name) ? [target] : [];
  });
}

function visitFunctions(root, callback) {
  function visit(node) {
    if (isFunctionLike(node)) callback(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
}

function lexicalSignals(functionNode, source) {
  let referencesPlayerText = false;
  let operations = 0;
  function visit(node) {
    if (ts.isRegularExpressionLiteral(node)) operations += 1;
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ["includes", "match", "normalize", "test", "toLowerCase"].includes(node.expression.name.text)
    ) {
      operations += 1;
    }
    if (
      ts.isIdentifier(node)
      && ["rawInput", "answerRawInput", "actionHint", "interpretedMeaning", "requestedDimension", "subjectMention"].includes(node.text)
    ) {
      referencesPlayerText = true;
    }
    if (
      ts.isPropertyAccessExpression(node)
      && ["rawInput", "answerRawInput", "actionHint", "interpretedMeaning", "requestedDimension", "subjectMention"].includes(node.name.text)
    ) {
      referencesPlayerText = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(functionNode);
  return { referencesPlayerText, operations, preview: functionNode.getText(source).slice(0, 80) };
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}
