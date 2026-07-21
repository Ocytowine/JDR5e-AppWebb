import type { AiStructuredSemanticIntentV1 } from "../ai/types";

export type NpcDialogueActKindV1 = NonNullable<AiStructuredSemanticIntentV1["dialogueAct"]>["act"];

export interface NpcDialogueFallbackV1 {
  text: string;
  nonVerbalReaction: string;
}

export function buildNpcDialogueFallbackV1(actorId: string, dialogueAct: NpcDialogueActKindV1): NpcDialogueFallbackV1 {
  const isWaitress = actorId === "npc:npc-serveuse-nerveuse" || actorId === "npc-serveuse-nerveuse";
  if (dialogueAct === "INITIATE_CONVERSATION") {
    return isWaitress
      ? { text: "La serveuse suspend son geste et relève brièvement les yeux vers toi. « Bonjour. » Son attention revient ensuite vers la porte du fond.", nonVerbalReaction: "geste suspendu, regard bref vers l'interlocuteur" }
      : { text: "Le garde tourne son attention vers toi et incline légèrement la tête. « Bonjour. »", nonVerbalReaction: "attention tournée vers l'interlocuteur" };
  }
  if (dialogueAct === "ASK_QUESTION") {
    return isWaitress
      ? { text: "La serveuse écoute jusqu'au bout. « Je comprends votre question, mais je ne peux rien confirmer à ce sujet ici. »", nonVerbalReaction: "écoute prudente" }
      : { text: "Le garde écoute jusqu'au bout. « Je comprends votre question, mais je ne peux rien confirmer à ce sujet ici. »", nonVerbalReaction: "attention maintenue" };
  }
  if (dialogueAct === "MAKE_STATEMENT") {
    return isWaitress
      ? { text: "La serveuse relève les yeux et accuse réception de tes paroles. « Je vous ai entendu. »", nonVerbalReaction: "regard relevé brièvement" }
      : { text: "Le garde incline légèrement la tête. « Je vous ai entendu. »", nonVerbalReaction: "léger signe de tête" };
  }
  if (dialogueAct === "REQUEST_ACTION") {
    return isWaitress
      ? { text: "La serveuse hésite. « Je ne peux pas vous promettre de faire cela. »", nonVerbalReaction: "hésitation visible" }
      : { text: "Le garde secoue légèrement la tête. « Je ne peux pas vous promettre de faire cela. »", nonVerbalReaction: "refus prudent" };
  }
  return isWaitress
    ? { text: "La serveuse marque une pause, attentive, sans prétendre avoir compris davantage.", nonVerbalReaction: "pause attentive" }
    : { text: "Le garde te prête attention, sans prétendre avoir compris davantage.", nonVerbalReaction: "attention maintenue" };
}
