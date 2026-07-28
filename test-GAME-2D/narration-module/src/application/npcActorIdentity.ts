export function normalizeNpcActorIdV1(actorId: string): string {
  return actorId.trim().replace(/^npc:/u, "");
}

export function npcSpeakerIdForActorV1(actorId: string): string | null {
  const normalizedActorId = normalizeNpcActorIdV1(actorId).replace(/^npc-/u, "");
  const suffix = normalizedActorId
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
  return suffix ? `speaker-${suffix}` : null;
}
