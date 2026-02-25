import { TransitionEngine } from './TransitionEngine';
import { NarrativeMemoryEngine } from './NarrativeMemoryEngine';
import {
  type NarrativeGameState,
  type NarrativeStateBucket,
  type NarrativeEntityType,
  type RuntimeTransitionCommand,
  type RuntimeTransitionOutcome
} from './types';

function cloneBucket(bucket: NarrativeStateBucket): NarrativeStateBucket {
  return { ...bucket };
}

function cloneState(state: NarrativeGameState): NarrativeGameState {
  return {
    quests: cloneBucket(state.quests),
    tramas: cloneBucket(state.tramas),
    companions: cloneBucket(state.companions),
    trades: cloneBucket(state.trades),
    clock: { ...state.clock },
    history: [...state.history],
    memory: {
      shortTerm: state.memory.shortTerm.map((entry) => ({ ...entry })),
      longTerm: state.memory.longTerm.map((entry) => ({ ...entry }))
    }
  };
}

function bucketForEntityType(state: NarrativeGameState, entityType: NarrativeEntityType): NarrativeStateBucket {
  switch (entityType) {
    case 'quest':
      return state.quests;
    case 'trama':
      return state.tramas;
    case 'companion':
      return state.companions;
    case 'trade':
      return state.trades;
    default:
      throw new Error(`entityType non supporté: ${entityType}`);
  }
}

export class NarrativeRuntime {
  private readonly transitionEngine: TransitionEngine;
  private readonly memoryEngine: NarrativeMemoryEngine;

  constructor(transitionEngine: TransitionEngine) {
    this.transitionEngine = transitionEngine;
    this.memoryEngine = new NarrativeMemoryEngine();
  }

  public static createInitialState(): NarrativeGameState {
    return {
      quests: {},
      tramas: {},
      companions: {},
      trades: {},
      clock: { hour: 0, day: 0, special: 0 },
      history: [],
      memory: {
        shortTerm: [],
        longTerm: []
      }
    };
  }

  public applyTransition(state: NarrativeGameState, command: RuntimeTransitionCommand): RuntimeTransitionOutcome {
    const nextState = cloneState(state);
    const bucket = bucketForEntityType(nextState, command.entityType);
    const currentState = bucket[command.entityId] ?? 'Unknown';

    const result = this.transitionEngine.apply({
      entityType: command.entityType,
      fromState: currentState,
      trigger: command.trigger,
      strictTrigger: command.strictTrigger
    });

    bucket[command.entityId] = result.toState;

    const timeUnit = result.timeBlock.unit;
    nextState.clock[timeUnit] += result.timeBlock.value;

    const historyEntry = {
      at: new Date().toISOString(),
      transitionId: result.transitionId,
      entityType: result.entityType,
      entityId: command.entityId,
      fromState: result.fromState,
      toState: result.toState,
      trigger: command.trigger,
      consequence: result.consequence,
      impactScope: result.impactScope,
      ruleRef: result.ruleRef
    };

    nextState.history.push(historyEntry);

    const withMemory = this.memoryEngine.apply(nextState, {
      state: nextState,
      result,
      historyEntry
    });

    return {
      state: withMemory,
      result,
      historyEntry
    };
  }
}
