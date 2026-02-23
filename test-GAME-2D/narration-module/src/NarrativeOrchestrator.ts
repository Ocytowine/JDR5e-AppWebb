import type {
  NarrativeEntityType,
  NarrativeGameState,
  RuntimeTransitionCommand
} from './types';

export interface OrchestrationInput {
  state: NarrativeGameState;
  availableCommands: RuntimeTransitionCommand[];
}

export interface OrchestrationDecision {
  selectedCommand: RuntimeTransitionCommand | null;
  reason: string;
  priorityScore?: number;
}

function nowToHourIndex(): number {
  const date = new Date();
  return date.getHours();
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function baseEntityWeight(entityType: NarrativeEntityType): number {
  switch (entityType) {
    case 'trama':
      return 4;
    case 'quest':
      return 3;
    case 'companion':
      return 2;
    case 'trade':
      return 1;
    default:
      return 0;
  }
}

function urgencyFromTrigger(trigger: string): number {
  const t = normalize(trigger);
  if (t.includes('échéance') || t.includes('urgence') || t.includes('temps écoulé')) return 3;
  if (t.includes('ignorance') || t.includes('événement externe')) return 2;
  return 1;
}

export class NarrativeOrchestrator {
  private readonly minHoursBetweenMajorEvents: number;

  constructor(minHoursBetweenMajorEvents = 1) {
    this.minHoursBetweenMajorEvents = Math.max(0, minHoursBetweenMajorEvents);
  }

  public decideNext(input: OrchestrationInput): OrchestrationDecision {
    if (!input.availableCommands.length) {
      return {
        selectedCommand: null,
        reason: 'Aucune commande narrative disponible'
      };
    }

    const majorCooldown = this.isMajorCooldownActive(input.state);

    const scored = input.availableCommands
      .map((command) => {
        const base = baseEntityWeight(command.entityType);
        const urgency = urgencyFromTrigger(command.trigger);
        const cooldownPenalty = majorCooldown && (command.entityType === 'trama' || command.entityType === 'quest') ? 3 : 0;
        const score = base + urgency - cooldownPenalty;
        return { command, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    return {
      selectedCommand: best.command,
      priorityScore: best.score,
      reason: majorCooldown
        ? 'Cooldown actif après événement majeur: priorité modulée pour éviter un enchaînement brutal'
        : 'Priorisation standard selon type d’entité et urgence du déclencheur'
    };
  }

  private isMajorCooldownActive(state: NarrativeGameState): boolean {
    if (!state.history.length) return false;

    const last = state.history[state.history.length - 1];
    const isMajorType = last.entityType === 'trama' || last.entityType === 'quest';
    if (!isMajorType) return false;

    const currentHour = nowToHourIndex();
    const elapsedInClock = state.clock.hour;

    return elapsedInClock < this.minHoursBetweenMajorEvents && currentHour >= 0;
  }
}
