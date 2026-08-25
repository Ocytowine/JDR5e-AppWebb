import type {
  AiOpenSemanticComponentV8,
  AiOpenSemanticFrameV8,
  AiSemanticCommitmentV8,
  AiSemanticUnderstandingStatusV8
} from "../../src/ai/types";
import type { OpenSemanticStepDispositionV1 } from "../../src/application/openSemanticExecution";
import type { InterpreterRuntimeContextV1 } from "../../src/application/runtimeCapabilityRouting";

export const OPEN_SEMANTIC_CORPUS_G6_VERSION = "open-semantic-evaluation-corpus/1" as const;

export interface OpenSemanticCorpusExpectationG6 {
  understandingStatus: AiSemanticUnderstandingStatusV8;
  overallCommitment: AiSemanticCommitmentV8;
  componentCommitments: AiSemanticCommitmentV8[];
  relations: AiOpenSemanticComponentV8["relationToPrevious"][];
  dispositions: OpenSemanticStepDispositionV1[];
  targetRefs: string[][];
  ambiguityCount: number;
  requiresClarification: boolean;
  noCommitBeforeOwnerValidation: true;
  noGameTimeBeforeOwnerValidation: true;
}

export interface OpenSemanticCorpusCaseG6 {
  schemaVersion: 1;
  corpusVersion: typeof OPEN_SEMANTIC_CORPUS_G6_VERSION;
  caseId: string;
  coverage: string[];
  paraphraseFamily: string | null;
  rawInput: string;
  frame: AiOpenSemanticFrameV8;
  expected: OpenSemanticCorpusExpectationG6;
}

export const OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6: InterpreterRuntimeContextV1 = {
  schemaVersion: 1,
  contractVersion: "interpreter-runtime-context/1",
  activeTravel: null,
  capabilities: [
    capability("scene.visible-actor-approach", "scene_resolution", "AVAILABLE"),
    capability("scene.visible-object-interaction", "scene_resolution", "AVAILABLE"),
    capability("scene.visible-nonverbal-signal", "scene_resolution", "AVAILABLE"),
    capability("scene.visible-dialogue", "social", "AVAILABLE"),
    capability("scene.visible-perception", "perception", "AVAILABLE"),
    capability("scene.context-response", "scene_resolution", "AVAILABLE"),
    capability("world.narrative-travel", "world", "AVAILABLE"),
    capability("inventory.mutation", "inventory", "AVAILABLE"),
    capability("rest.process", "rest", "AVAILABLE"),
    capability("tactical.generic-handoff", "tactical", "HANDOFF_ONLY"),
    capability("campaign.autonomous-boundaries", "world", "EXTERNAL_TRIGGER_ONLY")
  ]
};

const GUARD_REF = "npc:npc-garde-blesse";
const WAITRESS_REF = "npc:npc-serveuse-nerveuse";
const DOOR_REF = "poi:back-room-door";

export const OPEN_SEMANTIC_CORPUS_G6: readonly OpenSemanticCorpusCaseG6[] = [
  corpusCase({
    caseId: "dialogue-direct",
    coverage: ["dialogue_direct"],
    paraphraseFamily: "ask-visible-guard",
    rawInput: "Je demande au garde ce qu'il a vu dehors.",
    frame: understood("Le personnage demande directement au garde ce qu'il a vu dehors.", [
      component("ask-guard", 1, "Le personnage adresse au garde une question sur ce qu'il a vu.", "committed", "social", "scene.visible-dialogue", { targets: [["le garde", GUARD_REF]] })
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "dialogue-implicit",
    coverage: ["dialogue_implicit", "paraphrase"],
    paraphraseFamily: "ask-visible-guard",
    rawInput: "Son récit sur l'extérieur, j'aimerais l'entendre de sa bouche.",
    frame: understood("Le personnage sollicite implicitement le récit du garde sur l'extérieur.", [
      component("ask-guard", 1, "Le personnage adresse au garde une demande de récit sur l'extérieur.", "committed", "social", "scene.visible-dialogue", { targets: [["sa", GUARD_REF]] })
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "perception-focused",
    coverage: ["perception"],
    rawInput: "Je détaille la poignée sans encore y toucher.",
    frame: understood("Le personnage observe attentivement la poignée sans la manipuler.", [
      component("observe-door", 1, "Le personnage concentre son observation sur la poignée de la porte.", "committed", "perception", "scene.visible-perception", { targets: [["la poignée", DOOR_REF]] })
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "travel-committed",
    coverage: ["voyage"],
    paraphraseFamily: "leave-for-halles",
    rawInput: "Je prends la route des Halles dès maintenant.",
    frame: understood("Le personnage s'engage à partir vers les Halles.", [
      component("travel-halles", 1, "Le personnage entreprend le voyage vers les Halles.", "committed", "world", "world.narrative-travel")
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "travel-typos",
    coverage: ["voyage", "fautes", "paraphrase"],
    paraphraseFamily: "leave-for-halles",
    rawInput: "jpart o al pour les ales mtn",
    frame: understood("Le personnage s'engage à partir vers les Halles.", [
      component("travel-halles", 1, "Le personnage entreprend le voyage vers les Halles.", "committed", "world", "world.narrative-travel")
    ], "medium"),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "inventory-transfer",
    coverage: ["inventaire"],
    rawInput: "Je tends ma fiole à la serveuse pour qu'elle la garde.",
    frame: understood("Le personnage veut transférer une fiole qu'il possède à la serveuse.", [
      component("give-vial", 1, "Le personnage tente de remettre sa fiole à la serveuse.", "committed", "inventory", "inventory.mutation", { targets: [["la serveuse", WAITRESS_REF]] })
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "rest-request",
    coverage: ["repos"],
    rawInput: "Je m'installe ici pour une vraie nuit de sommeil.",
    frame: understood("Le personnage veut commencer un repos long à cet endroit.", [
      component("long-rest", 1, "Le personnage entreprend un repos long.", "committed", "rest", "rest.process")
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "magic-open-meaning",
    coverage: ["magie", "formulation_inedite"],
    rawInput: "Je laisse mon souvenir du soleil se déplier dans l'ombre du loquet.",
    frame: understood("Le personnage tente un effet magique personnel sur l'ombre du loquet.", [
      component("unpublished-magic", 1, "Le personnage mobilise une magie liée à un souvenir lumineux sur le loquet.", "committed", "magie", "déployer un souvenir lumineux", { targets: [["le loquet", DOOR_REF]] })
    ]),
    dispositions: ["UNDERSTOOD_UNSUPPORTED"]
  }),
  corpusCase({
    caseId: "tactical-intent",
    coverage: ["tactique"],
    rawInput: "Je dégaine et je me jette sur la menace.",
    frame: understood("Le personnage engage une confrontation violente.", [
      component("engage-conflict", 1, "Le personnage cherche à engager le combat contre la menace.", "committed", "tactical", "tactical.generic-handoff")
    ]),
    dispositions: ["HANDOFF_ONLY"]
  }),
  corpusCase({
    caseId: "autonomous-companion-request",
    coverage: ["compagnon_autonome", "dialogue_implicit"],
    rawInput: "À mon compagnon : couvre la porte pendant que je parle, si tu l'acceptes.",
    frame: understood("Le personnage demande à son compagnon de couvrir la porte, sans décider à sa place.", [
      component("ask-companion", 1, "Le personnage formule au compagnon une demande qu'il reste libre d'accepter ou de refuser.", "committed", "social", "scene.visible-dialogue")
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "gm-question",
    coverage: ["question_mj"],
    rawInput: "MJ, qu'est-ce que mon personnage se rappelle de cette auberge ?",
    frame: understood("Le joueur demande au MJ de rappeler une information publique déjà connue du personnage.", [
      component("ask-gm-context", 1, "Le joueur demande une clarification de contexte sans action diégétique.", "none", "scene_resolution", "scene.context-response")
    ]),
    dispositions: ["SKIPPED_NON_EXECUTABLE"]
  }),
  corpusCase({
    caseId: "pronoun-context",
    coverage: ["pronoms", "contexte"],
    rawInput: "Je lui demande pourquoi elle fixe toujours la porte.",
    frame: understood("Le personnage interroge la serveuse au sujet de son attention répétée vers la porte.", [
      component("ask-her", 1, "Le personnage adresse à la serveuse une question sur son regard vers la porte.", "committed", "social", "scene.visible-dialogue", { targets: [["lui", WAITRESS_REF], ["la porte", DOOR_REF]] })
    ]),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "ellipsis-context",
    coverage: ["ellipses", "contexte"],
    rawInput: "Et dehors ?",
    frame: understood("Le personnage poursuit l'échange en demandant au garde ce qu'il en est dehors.", [
      component("follow-up-outside", 1, "Le personnage adresse au garde une question elliptique sur l'extérieur.", "committed", "social", "scene.visible-dialogue", { targets: [["destinataire implicite", GUARD_REF]] })
    ], "medium"),
    dispositions: ["ROUTABLE"]
  }),
  corpusCase({
    caseId: "negated-action",
    coverage: ["negations"],
    rawInput: "Je ne touche surtout pas à la porte.",
    frame: understood("Le personnage affirme qu'il ne manipule pas la porte.", [
      component("do-not-touch", 1, "Le personnage exclut toute manipulation de la porte.", "none", "scene_resolution", "scene.visible-object-interaction", { negated: true, targets: [["la porte", DOOR_REF]] })
    ]),
    dispositions: ["SKIPPED_NON_EXECUTABLE"]
  }),
  corpusCase({
    caseId: "quoted-threat",
    coverage: ["citations"],
    rawInput: "Je répète ses mots exacts : « j'attaque le garde ».",
    frame: understood("Le personnage cite une menace formulée par quelqu'un d'autre sans l'exécuter.", [
      component("quote-threat", 1, "Le personnage rapporte textuellement une menace contre le garde.", "none", "tactical", "tactical.generic-handoff", { quoted: true, targets: [["le garde", GUARD_REF]] })
    ]),
    dispositions: ["SKIPPED_NON_EXECUTABLE"]
  }),
  corpusCase({
    caseId: "conditional-inventory",
    coverage: ["conditions", "inventaire"],
    rawInput: "S'il accepte de m'aider, alors je lui donne la fiole.",
    frame: understood("Le personnage prévoit de donner sa fiole au garde seulement s'il accepte de l'aider.", [
      component("conditional-gift", 1, "Le personnage conditionne le don de sa fiole à l'acceptation du garde.", "conditional", "inventory", "inventory.mutation", { conditions: ["le garde accepte d'aider"], targets: [["lui", GUARD_REF]] })
    ], "high", ["le garde accepte d'aider"]),
    dispositions: ["AWAITING_CONDITION"]
  }),
  corpusCase({
    caseId: "ellipsis-before-conditional-sequence",
    coverage: ["ellipses", "conditions", "actions_composees", "contexte", "ordre"],
    rawInput: "Et dehors ? S'il s'écarte ensuite, j'ouvre la porte du fond, puis je donne ma fiole à la serveuse.",
    frame: understood("Le personnage poursuit d'abord son échange avec le garde, puis prévoit deux actions seulement si le garde s'écarte.", [
      component("outside-follow-up", 1, "Le personnage adresse au garde une relance elliptique sur l'extérieur.", "committed", "social", "scene.visible-dialogue", { targets: [["destinataire implicite", GUARD_REF]] }),
      component("conditional-open", 2, "Si le garde s'écarte, le personnage prévoit d'ouvrir la porte du fond.", "conditional", "scene_resolution", "scene.visible-object-interaction", { relation: "THEN", conditions: ["le garde s'écarte"], targets: [["la porte du fond", DOOR_REF]] }),
      component("conditional-gift-after", 3, "Sous la même condition et après l'ouverture, le personnage prévoit de donner sa fiole à la serveuse.", "conditional", "inventory", "inventory.mutation", { relation: "THEN", conditions: ["le garde s'écarte"], dependencies: ["conditional-open"], targets: [["la serveuse", WAITRESS_REF]] })
    ], "high", [], "mixed"),
    dispositions: ["ROUTABLE", "AWAITING_CONDITION", "AWAITING_CONDITION"]
  }),
  corpusCase({
    caseId: "hypothetical-tactical",
    coverage: ["hypotheses", "tactique"],
    rawInput: "Si je frappais le garde, est-ce que la serveuse pourrait fuir ?",
    frame: understood("Le joueur envisage hypothétiquement les conséquences d'une attaque sans l'engager.", [
      component("hypothetical-attack", 1, "Le joueur évoque une attaque hypothétique contre le garde.", "hypothetical", "tactical", "tactical.generic-handoff", { targets: [["le garde", GUARD_REF]] })
    ]),
    dispositions: ["SKIPPED_NON_EXECUTABLE"]
  }),
  corpusCase({
    caseId: "composed-ordered-actions",
    coverage: ["actions_composees", "ordre", "multi_domaine"],
    rawInput: "Je demande au garde de patienter, puis je donne la fiole à la serveuse.",
    frame: understood("Le personnage parle d'abord au garde puis tente de donner sa fiole à la serveuse.", [
      component("ask-wait", 1, "Le personnage demande au garde de patienter.", "committed", "social", "scene.visible-dialogue", { targets: [["le garde", GUARD_REF]] }),
      component("give-after", 2, "Le personnage tente ensuite de remettre sa fiole à la serveuse.", "committed", "inventory", "inventory.mutation", { relation: "THEN", dependencies: ["ask-wait"], targets: [["la serveuse", WAITRESS_REF]] })
    ]),
    dispositions: ["ROUTABLE", "ROUTABLE"]
  }),
  corpusCase({
    caseId: "change-of-mind",
    coverage: ["changements_avis", "correction"],
    rawInput: "J'ouvre la porte — non, finalement je demande d'abord au garde.",
    frame: understood("Le personnage abandonne l'ouverture de la porte et choisit finalement de parler au garde.", [
      component("open-door-abandoned", 1, "Le personnage avait envisagé d'ouvrir la porte mais retire cette action.", "committed", "scene_resolution", "scene.visible-object-interaction", { targets: [["la porte", DOOR_REF]] }),
      component("ask-instead", 2, "Le personnage remplace cette action par une demande adressée au garde.", "committed", "social", "scene.visible-dialogue", { relation: "CORRECTION", supersedes: ["open-door-abandoned"], targets: [["le garde", GUARD_REF]] })
    ]),
    dispositions: ["SKIPPED_SUPERSEDED", "ROUTABLE"]
  }),
  corpusCase({
    caseId: "novel-unsupported",
    coverage: ["formulation_inedite"],
    rawInput: "Je confie mon prochain silence au bois de la table.",
    frame: understood("Le personnage accomplit un geste symbolique inédit envers la table.", [
      component("symbolic-silence", 1, "Le personnage associe symboliquement son prochain silence à la table.", "committed", "expression_symbolique", "confier un silence à un support")
    ], "medium"),
    dispositions: ["UNDERSTOOD_UNSUPPORTED"]
  }),
  clarificationCase(),
  corpusCase({
    caseId: "alternative-actions",
    coverage: ["actions_composees", "alternatives"],
    rawInput: "Soit je parle au garde, soit j'examine la porte ; je n'ai pas choisi.",
    frame: understood("Le personnage conserve deux possibilités alternatives sans en choisir une.", [
      component("option-talk", 1, "Première possibilité : parler au garde.", "unclear", "social", "scene.visible-dialogue", { alternativeGroupId: "choice-1", targets: [["le garde", GUARD_REF]] }),
      component("option-look", 2, "Seconde possibilité : examiner la porte.", "unclear", "perception", "scene.visible-perception", { relation: "ALTERNATIVE", alternativeGroupId: "choice-1", targets: [["la porte", DOOR_REF]] })
    ], "high", [], "unclear"),
    dispositions: ["AWAITING_PLAYER_CHOICE", "AWAITING_PLAYER_CHOICE"]
  }),
  corpusCase({
    caseId: "simultaneous-actions",
    coverage: ["actions_composees", "simultaneite"],
    rawInput: "Tout en surveillant la porte, je tends la fiole à la serveuse.",
    frame: understood("Le personnage veut observer la porte et remettre la fiole à la serveuse simultanément.", [
      component("watch-door", 1, "Le personnage surveille la porte.", "committed", "perception", "scene.visible-perception", { simultaneous: ["give-vial-same-time"], targets: [["la porte", DOOR_REF]] }),
      component("give-vial-same-time", 2, "Le personnage tente simultanément de remettre la fiole à la serveuse.", "committed", "inventory", "inventory.mutation", { relation: "SIMULTANEOUS", simultaneous: ["watch-door"], targets: [["la serveuse", WAITRESS_REF]] })
    ]),
    dispositions: ["AWAITING_ATOMIC_GROUP_OWNER", "AWAITING_ATOMIC_GROUP_OWNER"]
  })
] as const;

function capability(
  capabilityId: string,
  domain: InterpreterRuntimeContextV1["capabilities"][number]["domain"],
  availability: InterpreterRuntimeContextV1["capabilities"][number]["availability"]
): InterpreterRuntimeContextV1["capabilities"][number] {
  return { capabilityId, domain, availability, playerFacingScope: `Fixture G6 : ${capabilityId}.` };
}

function component(
  componentId: string,
  order: number,
  meaning: string,
  commitment: AiSemanticCommitmentV8,
  suggestedDomain: string | null,
  suggestedAction: string | null,
  options: {
    conditions?: string[];
    negated?: boolean;
    quoted?: boolean;
    relation?: AiOpenSemanticComponentV8["relationToPrevious"];
    alternativeGroupId?: string;
    dependencies?: string[];
    simultaneous?: string[];
    supersedes?: string[];
    targets?: Array<[surface: string, proposedRef: string | null]>;
  } = {}
): AiOpenSemanticComponentV8 {
  const suggestedCapabilityId = OPEN_SEMANTIC_CORPUS_RUNTIME_CONTEXT_G6.capabilities
    .some(capability => capability.capabilityId === suggestedAction)
      ? suggestedAction
      : null;
  return {
    componentId,
    order,
    meaning,
    commitment,
    conditions: options.conditions ?? [],
    negated: options.negated ?? false,
    quoted: options.quoted ?? false,
    relationToPrevious: options.relation ?? (order === 1 ? "NONE" : "THEN"),
    alternativeGroupId: options.alternativeGroupId ?? null,
    dependsOnComponentIds: options.dependencies ?? [],
    simultaneousWithComponentIds: options.simultaneous ?? [],
    supersedesComponentIds: options.supersedes ?? [],
    mentionedTargets: (options.targets ?? []).map(([surface, proposedRef]) => ({ surface, proposedRef })),
    suggestedDomain,
    suggestedAction: suggestedCapabilityId === null ? suggestedAction : meaning,
    suggestedCapabilityId
  };
}

function understood(
  overallMeaning: string,
  components: AiOpenSemanticComponentV8[],
  confidence: AiOpenSemanticFrameV8["confidence"] = "high",
  globalConditions: string[] = [],
  overallCommitment: AiSemanticCommitmentV8 = components.length === 1 ? components[0]!.commitment : "mixed"
): AiOpenSemanticFrameV8 {
  return {
    schemaVersion: 1,
    understandingStatus: "UNDERSTOOD",
    overallMeaning,
    overallCommitment,
    globalConditions,
    components,
    ambiguities: [],
    clarificationQuestion: null,
    confidence
  };
}

function corpusCase(input: {
  caseId: string;
  coverage: string[];
  rawInput: string;
  frame: AiOpenSemanticFrameV8;
  dispositions: OpenSemanticStepDispositionV1[];
  paraphraseFamily?: string;
}): OpenSemanticCorpusCaseG6 {
  return {
    schemaVersion: 1,
    corpusVersion: OPEN_SEMANTIC_CORPUS_G6_VERSION,
    caseId: input.caseId,
    coverage: input.coverage,
    paraphraseFamily: input.paraphraseFamily ?? null,
    rawInput: input.rawInput,
    frame: input.frame,
    expected: {
      understandingStatus: input.frame.understandingStatus,
      overallCommitment: input.frame.overallCommitment,
      componentCommitments: input.frame.components.map(entry => entry.commitment),
      relations: input.frame.components.map(entry => entry.relationToPrevious),
      dispositions: input.dispositions,
      targetRefs: input.frame.components.map(entry => entry.mentionedTargets.flatMap(target => target.proposedRef === null ? [] : [target.proposedRef])),
      ambiguityCount: input.frame.ambiguities.length,
      requiresClarification: input.frame.understandingStatus === "NEEDS_CLARIFICATION",
      noCommitBeforeOwnerValidation: true,
      noGameTimeBeforeOwnerValidation: true
    }
  };
}

function clarificationCase(): OpenSemanticCorpusCaseG6 {
  const frame: AiOpenSemanticFrameV8 = {
    schemaVersion: 1,
    understandingStatus: "NEEDS_CLARIFICATION",
    overallMeaning: "Le pronom et l'objet désignent plusieurs référents publics possibles.",
    overallCommitment: "unclear",
    globalConditions: [],
    components: [],
    ambiguities: [{ ambiguityId: "recipient-and-object", summary: "Le destinataire et l'objet ne sont pas déterminés.", affectedComponentIds: [] }],
    clarificationQuestion: "À qui veux-tu donner quel objet ?",
    confidence: "low"
  };
  return corpusCase({
    caseId: "ambiguous-pronouns",
    coverage: ["pronoms", "incertitudes", "clarification"],
    rawInput: "Je lui donne ça.",
    frame,
    dispositions: []
  });
}
