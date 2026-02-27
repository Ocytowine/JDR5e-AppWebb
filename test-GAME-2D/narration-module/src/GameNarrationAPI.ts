import { NarrativeRuntimeService } from './NarrativeRuntimeService';
import { NarrativeOrchestrator } from './NarrativeOrchestrator';
import { TransitionRepository } from './TransitionRepository';
import { ContextPackBuilder } from './ContextPackBuilder';
import type {
  AINarrationCandidate,
  AINarrationContractV1,
  MjNarrationGenerator,
  NarrativeEntityType,
  NarrativeGameState,
  NarrativeTransition,
  RuntimeTransitionCommand,
  RuntimeTransitionOutcome,
  TickNarrationAIOutcome,
  TickNarrationAIRequest,
  TickNarrationOutcome
} from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function ensureDefaultState(
  state: NarrativeGameState,
  bucket: keyof Pick<NarrativeGameState, 'quests' | 'tramas' | 'companions' | 'trades'>,
  entityId: string,
  defaultState: string
): NarrativeGameState {
  if (!state[bucket][entityId]) {
    state[bucket][entityId] = defaultState;
  }
  return state;
}

function defaultStateForEntityType(entityType: NarrativeEntityType): string {
  switch (entityType) {
    case 'quest':
      return 'Détectée';
    case 'trama':
      return 'Latente';
    case 'companion':
      return 'Non rencontré';
    case 'trade':
      return 'Offre initiale';
    default:
      return 'Unknown';
  }
}

function bucketForEntityType(
  entityType: NarrativeEntityType
): keyof Pick<NarrativeGameState, 'quests' | 'tramas' | 'companions' | 'trades'> {
  switch (entityType) {
    case 'quest':
      return 'quests';
    case 'trama':
      return 'tramas';
    case 'companion':
      return 'companions';
    case 'trade':
      return 'trades';
    default:
      return 'quests';
  }
}

export class GameNarrationAPI {
  private readonly service: NarrativeRuntimeService;

  constructor(service: NarrativeRuntimeService) {
    this.service = service;
  }

  public static createDefault(stateFilePath?: string): GameNarrationAPI {
    return new GameNarrationAPI(NarrativeRuntimeService.createDefault(stateFilePath));
  }

  public getState(): NarrativeGameState {
    return this.service.loadState();
  }

  public acceptQuest(questId: string, trigger = 'Le joueur accepte explicitement'): RuntimeTransitionOutcome {
    return this.applyDomainTransition('quest', questId, trigger, 'Détectée');
  }

  public escalateIgnoredQuest(questId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('quest', questId, 'Temps écoulé et ignorance répétée', 'Détectée');
  }

  public applyQuestContextShift(questId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition(
      'quest',
      questId,
      'Événement externe faction ou PNJ modifie le contexte',
      'Détectée'
    );
  }

  public completeQuest(questId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('quest', questId, 'Objectif atteint selon conditions de quête', 'Acceptée');
  }

  public failQuestWithBranch(questId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition(
      'quest',
      questId,
      'Délai dépassé ou condition critique non remplie',
      'Acceptée'
    );
  }

  public activateTrama(tramaId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trama', tramaId, 'Déclencheur actif validé', 'Latente');
  }

  public advanceTrama(tramaId: string, trigger: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trama', tramaId, trigger, 'Active');
  }

  public escalateTrama(tramaId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trama', tramaId, 'Temps écoulé sans intervention', 'Active');
  }

  public worsenTramaWithoutIntervention(tramaId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trama', tramaId, 'Non-intervention prolongée', 'Active');
  }

  public resolveTramaByPlayer(tramaId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trama', tramaId, 'Condition de clôture atteinte avec voie joueur', 'Active');
  }

  public meetCompanion(companionId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('companion', companionId, 'Déclencheur narratif de rencontre', 'Non rencontré');
  }

  public openCompanionNegotiation(companionId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition(
      'companion',
      companionId,
      'Conditions minimales de compatibilité atteintes',
      'Rencontré'
    );
  }

  public recruitCompanion(companionId: string, trigger: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('companion', companionId, trigger, 'Négociation');
  }

  public refuseCompanion(companionId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('companion', companionId, 'Désaccord ou refus explicite', 'Négociation');
  }

  public makeCompanionLeaveDurably(companionId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition(
      'companion',
      companionId,
      'Rupture de seuil relationnel et contexte défavorable',
      'Recruté'
    );
  }

  public openTradeNegotiation(tradeId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition(
      'trade',
      tradeId,
      'Le joueur engage une tentative de marchandage',
      'Offre initiale'
    );
  }

  public haggleTrade(tradeId: string, trigger: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trade', tradeId, trigger, 'Négociation de prix');
  }

  public failTradeNegotiation(tradeId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trade', tradeId, 'Test ou argument échoué', 'Négociation de prix');
  }

  public breakTradeNegotiation(tradeId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trade', tradeId, 'Échec critique ou exigence abusive', 'Négociation de prix');
  }

  public closeTradeTransaction(tradeId: string): RuntimeTransitionOutcome {
    return this.applyDomainTransition('trade', tradeId, 'Validation finale du joueur', 'Accord ajusté');
  }

  public tickNarration(
    availableCommands: RuntimeTransitionCommand[],
    minHoursBetweenMajorEvents = 1,
    options?: { blockOnGuardFailure?: boolean }
  ): TickNarrationOutcome {
    const state = this.service.loadState();
    const transitions = TransitionRepository.loadTransitions();
    const orchestrator = new NarrativeOrchestrator(minHoursBetweenMajorEvents);
    const decision = orchestrator.decideNext({ state, availableCommands });

    if (!decision.selectedCommand) {
      return {
        decisionReason: decision.reason,
        decisionScore: decision.priorityScore,
        selectedCommand: null,
        appliedOutcome: null,
        state
      };
    }

    const selected = decision.selectedCommand;
    const applicability = this.checkCommandApplicability(state, selected, transitions);
    if (!applicability.applicable) {
      return {
        decisionReason: `${decision.reason} (commande non applicable: ${applicability.code})`,
        decisionScore: decision.priorityScore,
        selectedCommand: selected,
        appliedOutcome: null,
        state,
        guardBlocked: false,
        guardViolations: [],
        filteredCommands: [
          {
            command: selected,
            code: applicability.code,
            reason: applicability.reason
          }
        ]
      };
    }

    const bucket = bucketForEntityType(selected.entityType);
    ensureDefaultState(state, bucket, selected.entityId, defaultStateForEntityType(selected.entityType));
    this.service.saveState(state);

    const guarded = this.service.applyTransitionAndSaveWithGuards(
      {
        entityType: selected.entityType,
        entityId: selected.entityId,
        trigger: selected.trigger,
        strictTrigger: selected.strictTrigger ?? true
      },
      { blockOnFailure: options?.blockOnGuardFailure ?? true }
    );

    if (!guarded.applied || !guarded.outcome) {
      return {
        decisionReason: `${decision.reason} (bloqué par guards)`,
        decisionScore: decision.priorityScore,
        selectedCommand: selected,
        appliedOutcome: null,
        state,
        guardBlocked: true,
        guardViolations: guarded.checks.violations
      };
    }

    return {
      decisionReason: decision.reason,
      decisionScore: decision.priorityScore,
      selectedCommand: selected,
      appliedOutcome: guarded.outcome,
      state: guarded.outcome.state,
      guardBlocked: false,
      guardViolations: guarded.checks.violations
    };
  }

  public tickNarrationSafe(
    availableCommands: RuntimeTransitionCommand[],
    minHoursBetweenMajorEvents = 1,
    options?: { blockOnGuardFailure?: boolean }
  ): TickNarrationOutcome {
    const state = this.service.loadState();
    const transitions = TransitionRepository.loadTransitions();

    const acceptedCommands: RuntimeTransitionCommand[] = [];
    const rejectedCommands: {
      command: RuntimeTransitionCommand;
      code: 'transition-not-found' | 'state-mismatch' | 'already-progressed' | 'cooldown-blocked';
      reason: string;
    }[] = [];

    for (const command of availableCommands) {
      const check = this.checkCommandApplicability(state, command, transitions);
      if (check.applicable) {
        acceptedCommands.push(command);
      } else {
        rejectedCommands.push({ command, code: check.code, reason: check.reason });
      }
    }

    if (!acceptedCommands.length) {
      return {
        decisionReason: 'Aucune commande applicable (déjà consommées, état incompatible ou transition introuvable)',
        selectedCommand: null,
        appliedOutcome: null,
        state,
        filteredCommands: rejectedCommands
      };
    }

    const outcome = this.tickNarration(acceptedCommands, minHoursBetweenMajorEvents, options);
    return {
      ...outcome,
      filteredCommands: rejectedCommands
    };
  }

  public async tickNarrationWithAI(
    request: TickNarrationAIRequest,
    generator: MjNarrationGenerator
  ): Promise<TickNarrationAIOutcome> {
    const state = this.service.loadState();
    const contextBuilder = new ContextPackBuilder();
    const contextPack = contextBuilder.build({
      query: request.query,
      records: request.records,
      activeZoneId: request.activeZoneId,
      parentZoneIds: request.parentZoneIds,
      playerProfile: request.playerProfile
    });

    const transitions = TransitionRepository.loadTransitions();
    const candidates = this.buildAICandidates(state, transitions, request.entityHints);

    if (!candidates.length) {
      const aiContract = this.makeAIContractFallback(null, null, 'No applicable candidate to generate');
      return {
        decisionReason: 'Aucune commande applicable après filtrage runtime',
        selectedCommand: null,
        appliedOutcome: null,
        state,
        aiReason: 'No applicable candidate to generate',
        aiContract,
        candidatesGenerated: 0,
        contextPack
      };
    }

    const aiDecision = await generator.generate({
      state,
      query: request.query,
      contextPack,
      candidates
    });

    if (aiDecision.selectedIndex == null) {
      const aiContract = aiDecision.contract ?? this.makeAIContractFallback(null, null, aiDecision.reason);
      return {
        decisionReason: 'Aucun événement retenu par le générateur MJ',
        selectedCommand: null,
        appliedOutcome: null,
        state,
        aiReason: aiDecision.reason,
        aiContract,
        candidatesGenerated: candidates.length,
        contextPack
      };
    }

    const selected = candidates[aiDecision.selectedIndex];
    if (!selected) {
      const aiContract = aiDecision.contract ?? this.makeAIContractFallback(null, null, aiDecision.reason);
      return {
        decisionReason: 'Sélection MJ invalide (index hors bornes)',
        selectedCommand: null,
        appliedOutcome: null,
        state,
        aiReason: aiDecision.reason,
        aiContract,
        candidatesGenerated: candidates.length,
        contextPack
      };
    }

    const outcome = this.tickNarrationSafe([selected.command], request.minHoursBetweenMajorEvents ?? 1, {
      blockOnGuardFailure: request.blockOnGuardFailure ?? true
    });

    return {
      ...outcome,
      aiReason: aiDecision.reason,
      aiContract: aiDecision.contract ?? this.makeAIContractFallback(selected, outcome.selectedCommand, aiDecision.reason),
      candidatesGenerated: candidates.length,
      contextPack
    };
  }

  private makeAIContractFallback(
    selectedCandidate: AINarrationCandidate | null,
    selectedCommand: RuntimeTransitionCommand | null,
    reason: string
  ): AINarrationContractV1 {
    const candidate = selectedCandidate;
    const command = selectedCommand ?? candidate?.command ?? null;
    return {
      schemaVersion: '1.0.0',
      intentType: 'story_action',
      commitment: command ? 'declaratif' : 'informatif',
      target: command
        ? {
            label: command.entityId,
            entityType: command.entityType,
            entityId: command.entityId,
            trigger: command.trigger
          }
        : {},
      socialFocus: {
        active: false
      },
      worldIntent: command
        ? {
            type: 'runtime_progress',
            reason,
            targetLabel: command.entityId,
            transitionId: candidate?.transitionId
          }
        : {
            type: 'none',
            reason
          },
      toolCalls: [],
      mjResponse: {
        scene: command
          ? `La narration se concentre sur ${command.entityId} (${command.entityType}).`
          : 'Aucune progression runtime retenue pour ce tour.',
        actionResult: candidate?.consequence ?? 'Aucune transition appliquee.',
        consequences: reason,
        options: []
      }
    };
  }

  private checkCommandApplicability(
    state: NarrativeGameState,
    command: RuntimeTransitionCommand,
    transitions: NarrativeTransition[]
  ): {
    applicable: boolean;
    code: 'transition-not-found' | 'state-mismatch' | 'already-progressed' | 'cooldown-blocked';
    reason: string;
  } {
    const bucket = bucketForEntityType(command.entityType);
    const currentState = state[bucket][command.entityId] ?? defaultStateForEntityType(command.entityType);
    const transition = transitions.find(
      (item) =>
        item.entityType === command.entityType &&
        normalize(item.trigger) === normalize(command.trigger) &&
        normalize(item.fromState) === normalize(currentState)
    );

    if (!transition) {
      const hasTrigger = transitions.some(
        (item) => item.entityType === command.entityType && normalize(item.trigger) === normalize(command.trigger)
      );
      return hasTrigger
        ? {
            applicable: false,
            code: 'state-mismatch',
            reason: `état incompatible (current=${currentState})`
          }
        : {
            applicable: false,
            code: 'transition-not-found',
            reason: 'transition introuvable pour ce trigger'
          };
    }

    if (normalize(currentState) === normalize(transition.toState)) {
      return {
        applicable: false,
        code: 'already-progressed',
        reason: `transition déjà consommée (state=${currentState})`
      };
    }

    if (normalize(currentState) !== normalize(transition.fromState)) {
      return {
        applicable: false,
        code: 'state-mismatch',
        reason: `état incompatible (current=${currentState}, attendu=${transition.fromState})`
      };
    }

    return {
      applicable: true,
      code: 'cooldown-blocked',
      reason: 'ok'
    };
  }

  private buildAICandidates(
    state: NarrativeGameState,
    transitions: NarrativeTransition[],
    entityHints?: Partial<Record<NarrativeEntityType, string[]>>
  ): AINarrationCandidate[] {
    const byType: Record<NarrativeEntityType, NarrativeTransition[]> = {
      quest: transitions.filter((item) => item.entityType === 'quest'),
      trama: transitions.filter((item) => item.entityType === 'trama'),
      companion: transitions.filter((item) => item.entityType === 'companion'),
      trade: transitions.filter((item) => item.entityType === 'trade')
    };

    const idSources: Record<NarrativeEntityType, string[]> = {
      quest: [...Object.keys(state.quests), ...(entityHints?.quest ?? [])],
      trama: [...Object.keys(state.tramas), ...(entityHints?.trama ?? [])],
      companion: [...Object.keys(state.companions), ...(entityHints?.companion ?? [])],
      trade: [...Object.keys(state.trades), ...(entityHints?.trade ?? [])]
    };

    const candidates: AINarrationCandidate[] = [];
    const seen = new Set<string>();

    const pushCandidate = (candidate: AINarrationCandidate): void => {
      const key = `${candidate.transitionId}::${candidate.command.entityId}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(candidate);
    };

    (['quest', 'trama', 'companion', 'trade'] as NarrativeEntityType[]).forEach((entityType) => {
      const ids = [...new Set(idSources[entityType])];
      if (!ids.length) return;

      for (const entityId of ids) {
        for (const transition of byType[entityType]) {
          const command: RuntimeTransitionCommand = {
            entityType,
            entityId,
            trigger: transition.trigger,
            strictTrigger: true
          };

          const applicability = this.checkCommandApplicability(state, command, transitions);
          if (!applicability.applicable) continue;

          pushCandidate({
            command,
            transitionId: transition.id,
            fromState: transition.fromState,
            toState: transition.toState,
            consequence: transition.consequence,
            impactScope: transition.impactScope ?? 'local',
            ruleRef: transition.ruleRef,
            playerFacingReason: transition.playerFacingReason
          });
        }
      }
    });

    return candidates;
  }

  private applyDomainTransition(
    entityType: NarrativeEntityType,
    entityId: string,
    trigger: string,
    defaultFromState: string
  ): RuntimeTransitionOutcome {
    const state = this.service.loadState();
    const bucket = bucketForEntityType(entityType);
    ensureDefaultState(state, bucket, entityId, defaultFromState);
    this.service.saveState(state);
    return this.service.applyTransitionAndSave({
      entityType,
      entityId,
      trigger,
      strictTrigger: true
    });
  }
}
