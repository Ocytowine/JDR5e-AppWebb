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
        return this.loadFromFile(resolveRuntimePath('Transitions-v1-runtime.example.json'));
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
