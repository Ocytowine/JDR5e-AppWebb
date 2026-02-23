declare const require: any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');
import type { NarrativeTransition, NarrativeTransitionsRuntime } from './types';
import { TransitionEngine } from './TransitionEngine';

function resolveRuntimePath(fileName: string): string {
  return path.resolve(__dirname, '..', 'runtime', fileName);
}

export class TransitionRepository {
  public static loadFromFile(filePath: string): NarrativeTransitionsRuntime {
    const resolvedPath = path.resolve(filePath);
    const raw = fs.readFileSync(resolvedPath, 'utf-8');
    return JSON.parse(raw) as NarrativeTransitionsRuntime;
  }

  public static loadDefaultRuntime(): NarrativeTransitionsRuntime {
    return this.loadFromFile(resolveRuntimePath('Transitions-v1-runtime.example.json'));
  }

  public static loadTransitions(filePath?: string): NarrativeTransition[] {
    const runtime = filePath ? this.loadFromFile(filePath) : this.loadDefaultRuntime();
    return runtime.transitions;
  }

  public static createEngine(filePath?: string): TransitionEngine {
    const transitions = this.loadTransitions(filePath);
    return new TransitionEngine(transitions);
  }
}
