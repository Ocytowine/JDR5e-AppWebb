import type { PlotCandidateV1, PlotGenerationContextV1 } from "../../src/application";

export const PLOT_CANDIDATE_J5_FIXTURE_VERSION = 1 as const;

export const PLOT_ADVENTURE_J5_EXCHANGES = [
  { player: "Je fouille attentivement les archives.", gm: "Une marque nette coupe la poussière de l'étagère vide." },
  { player: "Je demande au clerc quand il a vu le registre pour la dernière fois.", gm: "Le clerc se souvient qu'il était encore là avant la cloche." },
  { player: "Je pense que le registre a simplement été mal rangé.", gm: "Le clerc acquiesce avec hésitation : c'est aussi ce qu'il suppose." },
  { player: "J'examine la marque dans la poussière.", gm: "Elle suit le bord du registre : il a été retiré, pas renversé." },
  { player: "Je compare l'étagère aux rayonnages voisins.", gm: "Rien n'indique une chute ou un rangement accidentel." },
  { player: "J'attends la fin de la recherche dans les rayonnages.", gm: "Le temps passe tandis que les recherches continuent hors de ta vue." },
  { player: "J'observe ce qui a changé.", gm: "Deux échelles ont été déplacées près des rayonnages fermés." },
  { player: "Je demande au clerc pourquoi les échelles ont bougé.", gm: "Il admet avoir cherché le registre partout sans le retrouver." },
  { player: "Je reprends les deux indices ensemble.", gm: "La piste d'un simple mauvais rangement ne tient plus." },
  { player: "J'en conclus que l'archiviste a déplacé le registre pour le protéger d'une saisie.", gm: "Les éléments s'accordent enfin : le registre a été mis à l'abri volontairement." }
] as const;

export const PLOT_CANDIDATE_J5_CONTEXT: PlotGenerationContextV1 = {
  schemaVersion: 1,
  sceneId: "wiki-location:archives_de_lysenthe",
  allowedLocationRefs: ["wiki-location:archives_de_lysenthe", "wiki-location:place_des_archives"],
  allowedActorRefs: ["actor:archiviste", "actor:clerc"],
  allowedSourceRefs: ["lore:archives", "world:closing-bell", "actor:archiviste", "actor:clerc"],
  publicLoreFacts: [{ factRef: "fact:archives-access", text: "Les fonds privés sont contrôlés.", sourceRefs: ["lore:archives"] }],
  worldSignals: [{ signalRef: "signal:closing-bell", summary: "La cloche annonce la fermeture.", sourceRefs: ["world:closing-bell"] }],
  createdAtGameSecond: 0,
  complexity: "SIMPLE",
  version: 1
};

export function createPlotCandidateJ5Fixture(): PlotCandidateV1 {
  return {
    candidateId: "candidate:missing-register",
    plotId: "plot:missing-register",
    summary: "Un registre n'est plus à sa place après la fermeture.",
    hiddenTruth: {
      truthId: "truth:missing-register",
      statement: "L'archiviste a déplacé le registre pour le protéger d'une saisie.",
      groundingRefs: ["lore:archives", "world:closing-bell"]
    },
    commitments: ["Le registre a été déplacé après la cloche.", "Le clerc ignore la raison exacte du déplacement."],
    causalTimeline: [{
      stepId: "step:closing", causedByRefs: ["world:closing-bell"], actorRefs: ["actor:archiviste"],
      locationRef: "wiki-location:archives_de_lysenthe", privateOutcome: "L'archiviste met le registre à l'abri.", occurredAtGameSecond: 0
    }, {
      stepId: "step:empty-shelf", causedByRefs: ["step:closing"], actorRefs: ["actor:clerc"],
      locationRef: "wiki-location:archives_de_lysenthe", privateOutcome: "Le clerc découvre l'emplacement vide sans connaître la cause.", occurredAtGameSecond: 0
    }],
    actorMotivations: [{
      motivationId: "motivation:archiviste-protection", actorRef: "actor:archiviste",
      motivation: "Protéger le registre d'une saisie annoncée.", supportsStepRefs: ["step:closing"],
      sourceRefs: ["lore:archives", "world:closing-bell"]
    }, {
      motivationId: "motivation:clerc-rangement", actorRef: "actor:clerc",
      motivation: "Rétablir le rangement avant que l'absence ne soit remarquée.", supportsStepRefs: ["step:empty-shelf"],
      sourceRefs: ["actor:clerc"]
    }],
    actorPerspectives: [{
      perspectiveId: "perspective:archiviste", actorRef: "actor:archiviste", claim: "Le registre est en sécurité.",
      epistemicStatus: "KNOWS_TRUE", truthRelation: "PARTIAL", sourceRefs: ["actor:archiviste"]
    }, {
      perspectiveId: "perspective:clerc", actorRef: "actor:clerc", claim: "Le registre a probablement été mal rangé.",
      epistemicStatus: "BELIEVES_FALSE", truthRelation: "CONTRADICTS", sourceRefs: ["actor:clerc"]
    }],
    requiredRevelations: [{ revelationId: "revelation:register-moved", label: "Comprendre que le registre a été déplacé après la fermeture.", requiredForResolution: true }],
    clues: [{
      cluePathId: "clue:dust-mark", revelationId: "revelation:register-moved", independenceKey: "location:empty-shelf",
      publicSign: "Une marque nette coupe la poussière de l'étagère.", sceneId: "wiki-location:archives_de_lysenthe",
      presentation: "INFERENCE", actorRef: null, knowledgeChannelRef: null, sourceRefs: ["lore:archives"]
    }, {
      cluePathId: "clue:clerk-testimony", revelationId: "revelation:register-moved", independenceKey: "actor:clerc",
      publicSign: "Le clerc se souvient que le registre était encore présent avant la cloche.", sceneId: "wiki-location:archives_de_lysenthe",
      presentation: "TESTIMONY", actorRef: "actor:clerc", knowledgeChannelRef: "knowledge:clerc-testimony", sourceRefs: ["actor:clerc"]
    }],
    falseLeads: [{ falseLeadId: "false-lead:misfiled", claim: "Le registre a simplement été mal rangé.", refutationCluePathIds: ["clue:dust-mark"] }],
    futureEvents: [{
      plotEventId: "event:archive-search", dueAtGameSecond: 60, causedByRefs: ["step:empty-shelf"],
      locationRef: "wiki-location:archives_de_lysenthe", privateOutcome: "Une recherche discrète commence dans les rayonnages.",
      effects: [{
        effectId: "effect:moved-ladders", visibility: "IMMEDIATELY_VISIBLE", sceneId: "wiki-location:archives_de_lysenthe",
        publicSign: "Deux échelles ont été déplacées près des rayonnages fermés.", knowledgeChannelRef: null, sourceRefs: ["lore:archives"]
      }]
    }],
    sourceRefs: ["lore:archives", "world:closing-bell"]
  };
}
