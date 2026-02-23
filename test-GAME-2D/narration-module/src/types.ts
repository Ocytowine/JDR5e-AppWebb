export type NarrativeEntityType = 'quest' | 'trama' | 'companion' | 'trade';

export type ImpactScope = 'local' | 'regional' | 'global' | 'none';

export type LoreAnchorType = 'lieu' | 'faction' | 'histoire' | 'acteur';

export type TimeUnit = 'hour' | 'day' | 'special';

export interface LoreAnchor {
  type: LoreAnchorType;
  id: string;
  label?: string;
}

export interface TimeBlock {
  unit: TimeUnit;
  value: number;
}

export interface NarrativeTransition {
  id: string;
  entityType: NarrativeEntityType;
  fromState: string;
  trigger: string;
  toState: string;
  consequence: string;
  impactScope?: ImpactScope;
  ruleRef: string;
  loreAnchors: LoreAnchor[];
  playerFacingReason?: string;
  timeBlock: TimeBlock;
  notes?: string;
}

export interface NarrativeTransitionsRuntime {
  version: '1.0.0';
  generatedAt: string;
  transitions: NarrativeTransition[];
}

export interface TransitionRequest {
  entityType: NarrativeEntityType;
  fromState: string;
  trigger: string;
  loreAnchors?: LoreAnchor[];
  strictTrigger?: boolean;
}

export interface TransitionResult {
  transitionId: string;
  entityType: NarrativeEntityType;
  fromState: string;
  toState: string;
  consequence: string;
  impactScope: ImpactScope;
  ruleRef: string;
  timeBlock: TimeBlock;
  playerFacingReason?: string;
}

export type NarrativeStateBucket = Record<string, string>;

export interface NarrativeClock {
  hour: number;
  day: number;
  special: number;
}

export interface NarrativeHistoryEntry {
  at: string;
  transitionId: string;
  entityType: NarrativeEntityType;
  entityId: string;
  fromState: string;
  toState: string;
  trigger: string;
  consequence: string;
  impactScope: ImpactScope;
  ruleRef: string;
}

export interface NarrativeGameState {
  quests: NarrativeStateBucket;
  tramas: NarrativeStateBucket;
  companions: NarrativeStateBucket;
  trades: NarrativeStateBucket;
  clock: NarrativeClock;
  history: NarrativeHistoryEntry[];
}

export interface RuntimeTransitionCommand {
  entityType: NarrativeEntityType;
  entityId: string;
  trigger: string;
  strictTrigger?: boolean;
}

export interface RuntimeTransitionOutcome {
  state: NarrativeGameState;
  result: TransitionResult;
  historyEntry: NarrativeHistoryEntry;
}

export interface CoherenceViolation {
  gate: 'canon' | 'local' | 'faction' | 'temps' | 'regles' | 'lisibilite';
  code: string;
  message: string;
}

export interface CoherenceCheckResult {
  ok: boolean;
  violations: CoherenceViolation[];
}

export interface GuardedTransitionOutcome {
  applied: boolean;
  blockedByGuards: boolean;
  checks: CoherenceCheckResult;
  outcome: RuntimeTransitionOutcome | null;
}

export interface TickNarrationOutcome {
  decisionReason: string;
  decisionScore?: number;
  selectedCommand: RuntimeTransitionCommand | null;
  appliedOutcome: RuntimeTransitionOutcome | null;
  state: NarrativeGameState;
  guardBlocked?: boolean;
  guardViolations?: CoherenceViolation[];
  filteredCommands?: {
    command: RuntimeTransitionCommand;
    code: 'transition-not-found' | 'state-mismatch' | 'already-progressed' | 'cooldown-blocked';
    reason: string;
  }[];
}

export interface PlayerProfileInput {
  id: string;
  tags?: string[];
  backgroundTags?: string[];
  currentGoals?: string[];
}

export interface LoreRecord {
  id: string;
  type: LoreAnchorType;
  title: string;
  tags?: string[];
  summary?: string;
  body?: string;
  zoneId?: string;
  parentZoneIds?: string[];
  factionIds?: string[];
  actorIds?: string[];
  updatedAt?: string;
}

export interface ContextPackInput {
  query: string;
  activeZoneId?: string;
  parentZoneIds?: string[];
  playerProfile?: PlayerProfileInput;
  records: LoreRecord[];
  minAnchors?: number;
  maxRecords?: number;
}

export interface ScoredLoreRecord {
  record: LoreRecord;
  score: number;
  reasons: string[];
}

export interface ContextPack {
  query: string;
  anchors: LoreAnchor[];
  selectedRecords: ScoredLoreRecord[];
  facts: string[];
}
