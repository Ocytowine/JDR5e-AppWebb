export interface ContextCorpusCaseJ10K0 {
  caseId: string;
  rawInput: string;
  expectedSubjectRef: string | null;
  expectedUnderstanding: "UNDERSTOOD" | "NEEDS_CLARIFICATION";
  rationale: string;
}

export const CONTEXT_CORPUS_J10K0: readonly ContextCorpusCaseJ10K0[] = [
  {
    caseId: "current-country",
    rawInput: "pouvez vous me dire qui gouverne le pays ?",
    expectedSubjectRef: "lore-entity:astryade",
    expectedUnderstanding: "UNDERSTOOD",
    rationale: "Astryade est l'unique royaume relié au territoire de la scène des Archives."
  },
  {
    caseId: "current-city",
    rawInput: "qui dirige la ville ?",
    expectedSubjectRef: "lore-entity:lysenthe",
    expectedUnderstanding: "UNDERSTOOD",
    rationale: "Lysenthe est l'unique ville de la portée publique de la scène."
  },
  {
    caseId: "current-region",
    rawInput: "qui gouverne la région ?",
    expectedSubjectRef: "lore-entity:ylssea",
    expectedUnderstanding: "UNDERSTOOD",
    rationale: "Ylsséa est l'unique région de la portée publique de la scène."
  },
  {
    caseId: "active-interlocutor",
    rawInput: "pouvez vous me dire qui gouverne le pays ?",
    expectedSubjectRef: "lore-entity:astryade",
    expectedUnderstanding: "UNDERSTOOD",
    rationale: "La question reste adressée au garde actif et son sujet factuel reste Astryade."
  },
  {
    caseId: "genuine-ambiguity",
    rawInput: "lequel de ces deux pays est gouverné par un conseil ?",
    expectedSubjectRef: null,
    expectedUnderstanding: "NEEDS_CLARIFICATION",
    rationale: "Deux territoires également saillants exigent un choix du joueur."
  }
] as const;
