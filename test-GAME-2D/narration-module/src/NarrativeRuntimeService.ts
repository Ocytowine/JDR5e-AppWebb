import { NarrativeRuntime } from './NarrativeRuntime';
import { StateRepository } from './StateRepository';
import { TransitionRepository } from './TransitionRepository';
import { CoherenceGates } from './CoherenceGates';
import {
  type RuntimeTransitionCommand,
  type RuntimeTransitionOutcome,
  type NarrativeGameState,
  type GuardedTransitionOutcome
} from './types';

export class NarrativeRuntimeService {
  private readonly runtime: NarrativeRuntime;
  private readonly gates: CoherenceGates;
  private readonly stateFilePath?: string;

  constructor(runtime: NarrativeRuntime, stateFilePath?: string) {
    this.runtime = runtime;
    this.gates = new CoherenceGates();
    this.stateFilePath = stateFilePath;
  }

  public static createDefault(stateFilePath?: string): NarrativeRuntimeService {
    const transitionEngine = TransitionRepository.createEngine();
    const runtime = new NarrativeRuntime(transitionEngine);
    return new NarrativeRuntimeService(runtime, stateFilePath);
  }

  public loadState(): NarrativeGameState {
    return StateRepository.load(this.stateFilePath);
  }

  public saveState(state: NarrativeGameState): void {
    StateRepository.save(state, this.stateFilePath);
  }

  public applyTransitionAndSave(command: RuntimeTransitionCommand): RuntimeTransitionOutcome {
    const state = this.loadState();
    const outcome = this.runtime.applyTransition(state, command);
    this.saveState(outcome.state);
    return outcome;
  }

  public applyTransitionAndSaveWithGuards(
    command: RuntimeTransitionCommand,
    options?: { blockOnFailure?: boolean }
  ): GuardedTransitionOutcome {
    const blockOnFailure = options?.blockOnFailure ?? true;
    const state = this.loadState();
    const outcome = this.runtime.applyTransition(state, command);
    const checks = this.gates.evaluate(outcome);

    if (!checks.ok && blockOnFailure) {
      return {
        applied: false,
        blockedByGuards: true,
        checks,
        outcome: null
      };
    }

    this.saveState(outcome.state);
    return {
      applied: true,
      blockedByGuards: false,
      checks,
      outcome
    };
  }
}
