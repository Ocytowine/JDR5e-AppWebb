declare const require: any;
declare const __dirname: string;
declare const process: any;

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
    const primaryPath = resolveRuntimePath('Transitions-v1-runtime.v1.json');
    if (fs.existsSync(primaryPath)) {
      return this.loadFromFile(primaryPath);
    }

    const allowExampleFallback = String(process.env.NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK ?? '0') === '1';
    const examplePath = resolveRuntimePath('Transitions-v1-runtime.example.json');
    if (allowExampleFallback && fs.existsSync(examplePath)) {
      return this.loadFromFile(examplePath);
    }

    throw new Error(
      `Runtime transitions introuvable: ${primaryPath}. ` +
        `Active NARRATION_ALLOW_EXAMPLE_TRANSITIONS_FALLBACK=1 pour utiliser l'exemple temporairement.`
    );
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
