import assert from "node:assert/strict";
import {
  buildNarrativeDomainCommandV1,
  evaluateNarrativeRuntimeDecisionV1,
  validateCanonicalIntentAuthorityV1,
  type NarrativeIntentInterpretationV1
} from "../../src/application";

function main(): void {
  const canonical = speechInterpretation();
  assert.equal(validateCanonicalIntentAuthorityV1(canonical).ok, true, "fixture canonique valide");
  assert.equal(buildNarrativeDomainCommandV1(canonical)?.commandType, "SCENE_SPEECH_REQUEST");

  const contradictions: Array<{ name: string; value: NarrativeIntentInterpretationV1 }> = [
    {
      name: "action legacy force contre parole sémantique",
      value: { ...canonical, action: "force" }
    },
    {
      name: "cible legacy différente de la cible sémantique",
      value: { ...canonical, target: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" } }
    },
    {
      name: "cible résolue différente de la cible sémantique",
      value: {
        ...canonical,
        referentResolution: {
          ...canonical.referentResolution!,
          resolvedTarget: { kind: "npc", ref: "npc:npc-serveuse-nerveuse", label: "Serveuse nerveuse" }
        }
      }
    },
    {
      name: "engagement legacy hypothétique contre engagement sémantique",
      value: { ...canonical, commitment: "hypothetical" }
    },
    {
      name: "intentType action contre famille sémantique parole",
      value: { ...canonical, intentType: "action" }
    },
    {
      name: "décision runtime falsifiée",
      value: {
        ...canonical,
        runtimeDecision: { ...canonical.runtimeDecision, status: "UNSUPPORTED_DOMAIN", requiredDomain: "inventory", noCommit: true }
      }
    }
  ];

  for (const contradiction of contradictions) {
    const validation = validateCanonicalIntentAuthorityV1(contradiction.value);
    assert.equal(validation.ok, false, `${contradiction.name}: contradiction rejetée`);
    assert.equal(buildNarrativeDomainCommandV1(contradiction.value), null, `${contradiction.name}: aucune commande donc aucun commit possible`);
  }

  const misleadingLegacyText: NarrativeIntentInterpretationV1 = {
    ...canonical,
    coreMeaning: "Legacy trompeur : forcer la porte de la serveuse et ouvrir son inventaire."
  };
  assert.equal(validateCanonicalIntentAuthorityV1(misleadingLegacyText).ok, true, "coreMeaning n'a aucune autorité structurelle");
  const command = buildNarrativeDomainCommandV1(misleadingLegacyText);
  assert.equal(command?.semanticKind, "address_visible_actor");
  assert.equal(command?.semanticGoal, canonical.semanticIntent.playerGoal);
  assert.equal(command?.targetRefs[0], "npc:npc-garde-blesse");
  assert.equal(command?.domain, "social");

  console.log(`intent-authority/i06zr: OK (${contradictions.length} contradictions contrôlées)`);
}

function speechInterpretation(): NarrativeIntentInterpretationV1 {
  const target = { kind: "npc" as const, ref: "npc:npc-garde-blesse", label: "Garde blessé" };
  const semanticIntent = {
    schemaVersion: 1 as const,
    kind: "address_visible_actor" as const,
    playerGoal: "demander au garde ce qu'il a observé",
    target,
    commitment: "committed" as const,
    evidenceFromInput: ["Je lui demande ce qu'il a vu."],
    uncertainties: [],
    forbiddenInterpretations: ["social_success", "secret_reveal"],
    confidence: "high" as const,
    perception: null
  };
  const runtimeHandling = {
    schemaVersion: 1 as const,
    status: "SUPPORTED_BY_CURRENT_RUNTIME" as const,
    reason: "parole visible",
    requiredDomain: "social" as const,
    canonicalActionHint: "ask",
    noCommit: false,
    noGameTime: true
  };
  return {
    schemaVersion: 1,
    contractVersion: "intent-clarification/1",
    intentId: "intent-authority-speech",
    intentType: "speech",
    commitment: "committed",
    target,
    action: "ask",
    semanticIntent,
    runtimeHandling,
    runtimeDecision: evaluateNarrativeRuntimeDecisionV1({ semanticIntent, runtimeSuggestion: runtimeHandling, requiresClarification: false }),
    referentResolution: { schemaVersion: 1, usedPreviousContext: true, source: "recent_visible_focus", resolvedTarget: target, evidence: ["lui"], ambiguity: "none", confidence: "high" },
    coreMeaning: "Le personnage questionne le garde.",
    requiresClarification: false,
    clarificationQuestion: null,
    expectedTimeEffect: "DOMAIN_TO_DECIDE",
    safetyNotes: []
  };
}

main();
