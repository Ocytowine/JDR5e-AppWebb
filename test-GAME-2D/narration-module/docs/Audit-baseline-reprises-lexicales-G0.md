# Audit G0 — baseline et reprises lexicales

Date : 2026-08-25

Statut : `FERME`

## Objet

G0 photographie l'état avant migration vers le chemin de jeu exclusivement
OpenAI. Il ne certifie pas la qualité de compréhension actuelle et ne corrige
aucune dette. Il sépare :

- les lectures lexicales qui interprètent ou modifient le sens joueur ;
- les validations déterministes légitimes ;
- les usages d'affichage ou de traçabilité ;
- les fixtures locales qui devront être isolées du produit.

## Baseline fonctionnelle

Toutes les commandes ont été exécutées depuis `test-GAME-2D/`, sans variable
live et sans appel OpenAI distant.

| Gate | Résultat G0 |
|---|---|
| `narration-module:test:openai-intent-lexical-debt` | vert, 16 fichiers suivis |
| `narration-module:test:ai-intent-interpretation` | vert |
| `narration-module:test:interpreter-character-context` | vert |
| `narration-module:test:semantic-invariance` | vert, 105 cas |
| `narration-module:test:intent-authority` | vert, 6 contradictions contrôlées |
| `narration-module:test:semantic-intent-v2` à `v5` | vert |
| `narration-module:test:semantic-v5-realistic-gate` | vert |
| `narration-module:test:narrative-openai-route` | vert, fournisseur simulé |
| `narration-module:test:inventory-access` | vert |
| `narration-module:test:mission-dialogue-j4` | vert |
| `narration-module:test:access-control` | vert |
| `narration-module:test:j10b-travel` | vert |
| `narration-module:test:j10c-companions` | vert |
| `narration-module:test:j10f-immersive-ui` | vert, Chromium |
| `npm run build` | vert |
| `narration-module:test:complete-conversations` | rouge, défaut antérieur connu |

Le défaut connu est l'assertion « le plus ancien échange est évincé à la limite
de mémoire » dans `verify-complete-npc-conversations-nar132.ts:98`. Il précède
G1 et ne devra pas être attribué au nouveau contrat.

## Matrice des reprises lexicales

Priorités : `P0` bloque le chemin OpenAI-only, `P1` peut encore modifier ou
spécialiser le sens après interprétation, `P2` concerne la présentation ou une
compatibilité à retirer ensuite.

| Zone | Constat | Classe | Traitement prévu |
|---|---|---|---|
| `aiIntentInterpretation.ts` — fournisseur local V1 | déduit intention, cible, domaine, voyage, perception, dialogue et compagnon depuis des expressions | fixture lexicale actuellement utilisée par défaut en mode local | `P0 / G1` : retirer du chemin de jeu ; conserver seulement par instanciation explicite dans les tests |
| `intentClarification.ts` — interpréteur historique | reclasse question, tentative et parole depuis `rawInput` | interprétation legacy | `P0 / G1-G3` : ne plus l'appeler pour une saisie réelle ; conserver seulement le stockage/rejeu d'une clarification structurée |
| garde d'ambiguïté personnage | relit les alias employés et peut remplacer une sortie IA par une clarification | garde de sécurité sémantique locale | `P1 / G3-G4` : remplacer par ambiguïté déclarée par OpenAI et validation des références proposées |
| `playerPublicContext.ts` | choisit `LOCATION`, `PRESENT_ACTORS` ou `KNOWN_FACTS` par expressions dans texte brut + sens interprété | spécialisation post-interprétation | `P1 / G3-G4` : transporter le sujet de question dans le nouveau cadre sémantique |
| `activeSceneNarrative.ts` | détecte une question sur la population visible depuis les mots joueur | enrichissement post-interprétation | `P1 / G3` : consommer le sujet/perception structuré |
| `accessControl.ts` et runtimes d'accès | `inferDomain` et plusieurs `canHandle` reçoivent la saisie brute comme `actionHint` | second routeur lexical | `P0 / G5` : router uniquement depuis la proposition sémantique et vérifier les préconditions du propriétaire |
| `playableCampaignAccessCatalog.ts` | reconnaît épée, mandat, demande à l'archiviste, crochetage ou force par vocabulaire installé | exécution/domaines hardcodés | `P0 / G4-G5` : résoudre objets, méthodes et destinataires depuis références/composantes structurées |
| `catalogInventoryTransactionRuntime.ts` | parse l'action, la cible et le contenant depuis la phrase | second interpréteur inventaire | `P0 / G5` : recevoir une composante sémantique et laisser l'autorité vérifier état/possession |
| `catalogPlotCreationRuntime.ts` | détecte hypothèse et conclusion depuis des formulations françaises | second interpréteur intrigue | `P0 / G5` : recevoir acte épistémique et contenu compris |
| `playableCampaignMissionCatalog.ts` | décide refus, condition et correspondance de mission depuis les mots joueur | second interpréteur social/mission | `P0 / G5` : politique fondée sur demande structurée, acteur et état public |
| `playableScene.ts` et `referenceScene.ts` | cherchent cible, sujet, météo, lieu, méta ou possibilité dans le texte | résolution de scène historique | `P1 / G3-G5` : utiliser références, sujet, domaine et cadre sémantique |
| `narrativeResolution.ts` | extrait certaines paroles et normalise la surface depuis `rawInput` | présentation, avec risque de reformulation du sens | `P2 / G3` : conserver le texte brut ou utiliser l'adaptateur d'expression après intention validée |
| route serveur `normalizeProviderEnvelope` | recanonicalise depuis les champs structurés V3-V7, sans relire `rawInput` | non lexical, mais structure fermée | `G2-G3` : remplacer par cadre ouvert ; aucune dette lexicale directe |
| prompt serveur V7 | nombreuses consignes et exemples spécialisés | guidage potentiellement trop étroit, non hardcode runtime | `G2` : prompt centré sur résultat, contexte et autorité ; schéma porté par Structured Outputs |

## Usages légitimes de la saisie brute

Ces usages restent permis tant qu'ils ne déduisent aucun sens :

- vérifier type, présence et longueur maximale de l'entrée ;
- recopier `rawInputEcho` et vérifier sa corrélation ;
- conserver la saisie originale dans la trace et le bloc joueur ;
- fournir la phrase à OpenAI comme donnée utilisateur ;
- transmettre la parole brute à un rôle de fidélité ou de rendu après que le
  sens et l'autorité ont été fixés ;
- classifier une erreur technique d'interface à partir de son code/message, et
  non du texte joueur ;
- valider qu'une référence proposée appartient au contexte public transmis.

Une validation peut refuser une référence absente, une condition perdue ou une
autorité interdite. Elle ne peut pas inventer une autre intention.

## Garde statique G0

`scripts/verify-openai-intent-lexical-debt.mjs` analyse les fichiers TypeScript
du noyau applicatif et de l'UI narration. Il compte les fonctions qui combinent
un accès au texte joueur avec des opérations lexicales. La baseline suit 16
fichiers.

La commande échoue si :

- un nouveau fichier consommateur apparaît ;
- le nombre de fonctions suspectes augmente dans un fichier suivi ;
- le nombre d'opérations lexicales augmente.

Une diminution est autorisée afin que G1 à G5 puissent rembourser la dette. La
garde est volontairement conservatrice : elle inclut quelques usages de
présentation et ne prouve pas l'absence absolue d'interprétation lexicale. La
matrice ci-dessus reste l'autorité de migration.

Commande :

```powershell
npm run narration-module:test:openai-intent-lexical-debt
```

## Conclusion G0

Le contrat OpenAI V7 n'est pas lui-même remplacé par une détection mot à mot,
mais le chemin de jeu contient encore plusieurs seconds interpréteurs après sa
sortie. La migration ne doit donc pas se limiter à `aiIntentInterpretation.ts` :
elle doit atteindre le routage et les politiques de domaine.

G1 peut commencer sur une frontière claire : OpenAI seul interprète ; panne ou
sortie refusée donne une clarification sans commit ; la fixture locale n'est
plus une valeur par défaut du produit.
