# Matrice d'autorité de l'intention — I-06ZR

Date : 2026-07-17  
Politique : rejet avant commande, sans correction silencieuse

| Information | Source canonique | Champs legacy tolérés | Politique de contradiction |
|---|---|---|---|
| famille de sens | `semanticIntent.kind` | `intentType` | rejet |
| objectif joueur | `semanticIntent.playerGoal` | `coreMeaning` | `coreMeaning` ignoré par les décisions; divergence de prose tolérée |
| engagement | `semanticIntent.commitment` | `commitment` | rejet |
| cible proposée | `semanticIntent.target` | `target` | rejet si références différentes |
| cible validée | `referentResolution.resolvedTarget` | aucune | rejet si différente de la cible sémantique; clarification si absente/ambiguë |
| domaine suggéré | `runtimeHandling` | aucune | suggestion seulement, divergence tracée |
| domaine exécutable | `runtimeDecision` local | aucun | rejet si différent du recalcul local |
| commande | `domainCommand` locale | `action`, proposition MJ | aucune commande construite en cas de contradiction |
| commit et temps | propriétaire de domaine + `runtimeDecision` | texte IA | texte sans autorité, rejet des résultats anticipés |

## Frontières de contrôle

1. `validation.ts` refuse les sorties IA dont famille, engagement, cible ou action contredisent `semanticIntent`.
2. `validateCanonicalIntentAuthorityV1` recalcule la cohérence canonique, y compris `runtimeDecision`.
3. `buildNarrativeDomainCommandV1` retourne `null` si cette validation échoue.
4. `resolveNarrativeTurnV1` retourne `narrative.intent-authority.contradiction` avant toute préparation d'effet.

## Clarification de référent

Une action engagée dont la cible est absente ou incompatible conserve son sens et son engagement sémantiques. `requiresClarification=true` suspend la résolution; elle ne réécrit plus artificiellement l'action en `unclear_commitment`. Ainsi, la question manquante porte sur la cible sans perdre ce que le joueur voulait faire.

## Legacy conservé et condition de retrait

- `upgradeLegacyNarrativeIntentInterpretationV1` reste nécessaire pour relire les opérations persistées avant I-06ZL. Retrait après migration/version minimale de sauvegarde.
- `buildCompatibleSemanticIntentV1` reste utilisé uniquement par cet adaptateur et quelques fixtures historiques. Retrait lorsque ces fixtures auront été réécrites et la migration legacy supprimée.
- `interpretNarrativeInputV1` reste l'interpréteur local historique lorsque la configuration IA est explicitement absente. Retrait lorsque le mode local utilisera exclusivement un fournisseur contractuel sémantique.
- `intentType`, `action`, `target` et `coreMeaning` restent transportés pour compatibilité de contrat, diagnostic et rendu de la scène de référence. Ils ne sont plus des replis de commande, de cible, de mémoire ou de mutation.
