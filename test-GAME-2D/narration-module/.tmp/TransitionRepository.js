"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransitionRepository = void 0;
const fs = require('fs');
const path = require('path');
const TransitionEngine_1 = require("./TransitionEngine");
function resolveRuntimePath(fileName) {
    return path.resolve(__dirname, '..', 'runtime', fileName);
}
class TransitionRepository {
    static loadFromFile(filePath) {
        const resolvedPath = path.resolve(filePath);
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        return JSON.parse(raw);
    }
    static loadDefaultRuntime() {
        const primaryPath = resolveRuntimePath('Transitions-v1-runtime.v1.json');
        if (fs.existsSync(primaryPath)) {
            return this.loadFromFile(primaryPath);
        }
        const allowExampleFallback = String(process.env.NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK ?? '0') === '1';
        const examplePath = resolveRuntimePath('Transitions-v1-runtime.example.json');
        if (allowExampleFallback && fs.existsSync(examplePath)) {
            return this.loadFromFile(examplePath);
        }
        throw new Error(`Runtime transitions introuvable: ${primaryPath}. ` +
            `Active NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK=1 pour utiliser l'exemple temporairement.`);
    }
    static loadTransitions(filePath) {
        const runtime = filePath ? this.loadFromFile(filePath) : this.loadDefaultRuntime();
        return runtime.transitions;
    }
    static createEngine(filePath) {
        const transitions = this.loadTransitions(filePath);
        return new TransitionEngine_1.TransitionEngine(transitions);
    }
}
exports.TransitionRepository = TransitionRepository;
