import type { AiStructuredSemanticIntentV1 } from "../ai/types";

export type NpcDialogueActKindV1 = NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]>["act"];

export interface NpcDialogueFallbackV1 {
  text: string;
  nonVerbalReaction: string;
}

export function buildNpcDialogueFallbackV1(
  actorId: string,
  dialogueAct: NpcDialogueActKindV1,
  actorDisplayName?: string | null,
  presentationVariant = 0
): NpcDialogueFallbackV1 {
  const isWaitress = actorId === "npc:npc-serveuse-nerveuse" || actorId === "npc-serveuse-nerveuse";
  const isGuard = actorId === "npc:npc-garde-blesse" || actorId === "npc-garde-blesse";
  const dynamicSubject = actorDisplayName?.trim() || "L'interlocuteur";
  const subject = isWaitress ? "La serveuse" : isGuard ? "Le garde" : dynamicSubject;
  if (dialogueAct === "INITIATE_CONVERSATION") {
    return isWaitress
      ? { text: "La serveuse suspend son geste et relève brièvement les yeux vers toi. « Bonjour. » Son attention revient ensuite vers la porte du fond.", nonVerbalReaction: "geste suspendu, regard bref vers l'interlocuteur" }
      : { text: `${subject} tourne son attention vers toi et incline légèrement la tête. « Bonjour. »`, nonVerbalReaction: "attention tournée vers l'interlocuteur" };
  }
  if (dialogueAct === "ASK_QUESTION") {
    const variants = isWaitress
      ? [{
          text: "La serveuse écoute jusqu'au bout. « Je comprends votre question, mais je ne peux rien confirmer à ce sujet ici. »",
          nonVerbalReaction: "écoute prudente"
        }, {
          text: "La serveuse suspend son geste. « Votre question est claire. Je ne peux pourtant rien confirmer au-delà de ce que j'ai vérifié. »",
          nonVerbalReaction: "geste suspendu, réponse mesurée"
        }, {
          text: "La serveuse parle à voix basse. « Sur cette question, je ne veux rien confirmer sans l'avoir vérifié. »",
          nonVerbalReaction: "voix basse, regard attentif"
        }]
      : [{
          text: `${subject} écoute jusqu'au bout. « Je comprends votre question, mais je ne peux rien confirmer à ce sujet ici. »`,
          nonVerbalReaction: "attention maintenue"
        }, {
          text: `${subject} prend un court instant avant de répondre. « Votre question est claire. Je ne peux pourtant rien confirmer au-delà de ce que j'ai vérifié. »`,
          nonVerbalReaction: "courte réflexion"
        }, {
          text: `${subject} garde un ton mesuré. « Sur cette question, je ne veux rien confirmer sans l'avoir vérifié. »`,
          nonVerbalReaction: "réponse mesurée"
        }];
    return variants[normalizedVariant(presentationVariant, variants.length)]!;
  }
  if (dialogueAct === "MAKE_STATEMENT") {
    return isWaitress
      ? { text: "La serveuse relève les yeux et accuse réception de tes paroles. « Je vous ai entendu. »", nonVerbalReaction: "regard relevé brièvement" }
      : { text: `${subject} incline légèrement la tête. « Je vous ai entendu. »`, nonVerbalReaction: "léger signe de tête" };
  }
  if (dialogueAct === "REQUEST_ACTION") {
    return isWaitress
      ? { text: "La serveuse hésite. « Je ne peux pas vous promettre de faire cela. »", nonVerbalReaction: "hésitation visible" }
      : { text: `${subject} secoue légèrement la tête. « Je ne peux pas vous promettre de faire cela. »`, nonVerbalReaction: "refus prudent" };
  }
  return isWaitress
    ? { text: "La serveuse marque une pause, attentive, sans prétendre avoir compris davantage.", nonVerbalReaction: "pause attentive" }
    : { text: `${subject} te prête attention, sans prétendre avoir compris davantage.`, nonVerbalReaction: "attention maintenue" };
}

function normalizedVariant(value: number, count: number): number {
  return Number.isFinite(value)
    ? ((Math.trunc(value) % count) + count) % count
    : 0;
}
