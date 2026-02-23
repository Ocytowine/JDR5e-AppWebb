import type { CoherenceCheckResult, CoherenceViolation, RuntimeTransitionOutcome } from './types';

function isNonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export class CoherenceGates {
  public evaluate(outcome: RuntimeTransitionOutcome): CoherenceCheckResult {
    const violations: CoherenceViolation[] = [];
    const result = outcome.result;

    if (!isNonEmpty(result.ruleRef)) {
      violations.push({
        gate: 'regles',
        code: 'missing-rule-ref',
        message: 'ruleRef manquant sur la transition appliquée'
      });
    }

    if (!isNonEmpty(result.fromState) || !isNonEmpty(result.toState)) {
      violations.push({
        gate: 'temps',
        code: 'invalid-state-transition',
        message: 'fromState/toState invalide sur la transition appliquée'
      });
    }

    if (result.entityType === 'quest' || result.entityType === 'trama') {
      if (!isNonEmpty(result.playerFacingReason)) {
        violations.push({
          gate: 'lisibilite',
          code: 'missing-player-facing-reason',
          message: 'Raison joueur manquante pour un événement narratif majeur'
        });
      }
    }

    return {
      ok: violations.length === 0,
      violations
    };
  }
}
