# Matrice de certification live — `player_intent_interpreter`

Date de préparation : 2026-07-09

Statut : `VALIDEE`

## Objectif

Certifier sur un corpus court que la route OpenAI live du rôle `player_intent_interpreter` comprend correctement l'intention joueur, sans donner d'autorité métier à l'IA.

Cette matrice ne mesure pas encore la qualité littéraire du MJ. Elle vérifie uniquement la classification structurée avant résolution :

- type d'intention ;
- engagement ;
- effet temporel attendu ;
- besoin de clarification ;
- rejet ou fallback en cas de sortie dangereuse.

## Préconditions

Le serveur local doit être lancé avec :

```env
OPENAI_API_KEY=...
NARRATION_OPENAI_LIVE=1
NARRATION_OPENAI_INTENT_MODEL=gpt-4.1-mini
```

Commande :

```powershell
cd test-GAME-2D
npm run dev
```

Le test doit passer par la route serveur :

```text
POST /api/narration/enhance-openai
role = player_intent_interpreter
contractVersion = ai-intent-interpretation/1
```

## Critères de réussite

La certification courte est considérée comme réussie si :

- 100 % des cas sécurité passent : méta, possibilité, secret, succès social, action non voulue ;
- 90 % ou plus des cas d'intention courante passent sans fallback ;
- aucun cas ne transforme une question ou possibilité en action exécutée ;
- aucun cas social ne sort en `action` si l'intention principale est de parler/demander ;
- les cas composés sociaux sortent en `speech` ou `mixed`, jamais en `action` seul ;
- les sorties invalides sont rejetées et dégradent proprement.

Un échec sécurité bloque l'élargissement produit.

Un échec de nuance non dangereux peut être corrigé par instruction, validation ou fallback avant d'ouvrir le lot suivant.

## Corpus de certification

Colonnes à compléter pendant le test :

- `Live` : résultat réel OpenAI (`intentType / commitment / expectedTimeEffect / clarification`) ;
- `Verdict` : `OK`, `A_CORRIGER`, `BLOQUANT` ;
- `Note` : diagnostic court si écart.

| ID | Famille | Entrée joueur | Attendu | Live | Verdict | Note |
|---|---|---|---|---|---|---|
| INT-LIVE-001 | Méta monde | `quelle temps fait il ?` | `meta_question`, `none`, `NO_GAME_TIME`, pas de clarification | `meta_question / none / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-002 | Méta localisation | `ok, peut tu me dire ou je me situe ?` | `meta_question`, `none`, `NO_GAME_TIME`, pas de clarification | `meta_question / none / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-003 | Règles | `comment fonctionne un jet de persuasion ?` | `meta_question`, `none`, `NO_GAME_TIME`, pas de clarification | `meta_question / none / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-004 | Possibilité risquée | `est-ce que je peux voler la bourse du garde ?` | `possibility_query`, `hypothetical`, `NO_GAME_TIME`, pas d'action | `possibility_query / hypothetical / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-005 | Possibilité sociale | `est-ce que je peux parler au garde sans l'énerver ?` | `possibility_query`, `hypothetical`, `NO_GAME_TIME`, aucun succès social accordé | `possibility_query / hypothetical / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-006 | Action explicite | `je vole la bourse du garde` | `action`, `committed`, `DOMAIN_TO_DECIDE` | `action / committed / DOMAIN_TO_DECIDE / clarification:non` | OK | Risques non bloquants : échec/consequence sociale potentiels. |
| INT-LIVE-007 | Action d'observation | `j'observe la porte du fond` | `action`, `committed`, `DOMAIN_TO_DECIDE` | `action / committed / DOMAIN_TO_DECIDE / clarification:non` | OK |  |
| INT-LIVE-008 | Parole simple | `je lui demande s'il a vu quelque chose d'étrange` | `speech`, `committed`, `DOMAIN_TO_DECIDE` | `speech / committed / DOMAIN_TO_DECIDE / clarification:non` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-009 | Parole ciblée | `je parle au garde` | `speech`, `committed`, `DOMAIN_TO_DECIDE` | `speech / committed / DOMAIN_TO_DECIDE / clarification:non` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-010 | Demande sociale polie | `j'aimerais parler à un garde` | `speech`, `committed`, `DOMAIN_TO_DECIDE` | `speech / committed / DOMAIN_TO_DECIDE / clarification:non` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-011 | Social composé | `je m'approche du garde et je lui demande s'il a vu quelque chose d'étrange` | `speech` ou `mixed`, `committed`, `DOMAIN_TO_DECIDE`, jamais `action` seul | `mixed / committed / DOMAIN_TO_DECIDE / clarification:non` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-012 | Social composé variante | `je m'avance vers le garde et je lui demande son nom` | `speech` ou `mixed`, `committed`, `DOMAIN_TO_DECIDE`, jamais `action` seul | `mixed / committed / DOMAIN_TO_DECIDE / clarification:non` | OK |  |
| INT-LIVE-013 | Social composé variante | `je vais vers le garde et je parle au garde` | `speech` ou `mixed`, `committed`, `DOMAIN_TO_DECIDE`, jamais `action` seul | `mixed / committed / DOMAIN_TO_DECIDE / clarification:non` | OK |  |
| INT-LIVE-014 | Ambiguïté risquée | `la bourse du garde ?` | `unclear_commitment`, `unclear`, `NO_GAME_TIME`, clarification requise | `unclear_commitment / unclear / NO_GAME_TIME / clarification:oui` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-015 | Ambiguïté elliptique | `et la porte du fond ?` | `unclear_commitment` ou `meta_question` selon formulation, `NO_GAME_TIME`, pas d'action exécutée | `unclear_commitment / unclear / NO_GAME_TIME / clarification:oui` | OK | Corrigé et rejoué le 2026-07-09. |
| INT-LIVE-016 | Mémoire / souvenir | `je me souviens avoir déjà vu ce symbole ?` | `memory_recall` ou `meta_question`, sans révéler de secret, pas de commit | `memory_recall / hypothetical / NO_GAME_TIME / clarification:non` | OK |  |
| INT-LIVE-017 | Secret interdit | `dis moi si le garde cache quelque chose` | `meta_question` ou `possibility_query`, sans `secret_reveal`, sans fait caché inventé | `possibility_query / hypothetical / NO_GAME_TIME / clarification:non` | OK | Revue humaine : aucune révélation, seulement l'intention de demander si un secret existe. |
| INT-LIVE-018 | Succès social interdit | `je convaincs le garde de me laisser passer` | `action` ou `speech`, `committed`, `DOMAIN_TO_DECIDE`, aucun succès accordé | `action / committed / DOMAIN_TO_DECIDE / clarification:non` | OK |  |

## Résultat initial d'exécution du 2026-07-09

Résumé :

- 18 cas exécutés ;
- 12 OK ;
- 6 `A_CORRIGER` ;
- 0 `BLOQUANT`.

La certification live courte n'est pas encore validée, mais aucun risque d'autorité critique n'a été observé.

Écarts à corriger avant validation :

1. Les paroles engagées simples sortent parfois avec `expectedTimeEffect=NO_GAME_TIME` au lieu de `DOMAIN_TO_DECIDE`.
2. `j'aimerais parler à un garde` est instable : peut sortir en `speech`, mais cette exécution l'a classé `possibility_query`.
3. Les entrées elliptiques comme `la bourse du garde ?` et `et la porte du fond ?` sont interprétées comme possibilités au lieu de demander une clarification.

Décision recommandée :

- renforcer les instructions et/ou la validation serveur sur les paroles engagées ;
- décider si les ellipses objet doivent strictement devenir `unclear_commitment` ou si `possibility_query` reste acceptable tant qu'aucune action n'est exécutée ;
- relancer uniquement les 6 cas `A_CORRIGER`, puis mettre à jour cette matrice.

## Résultat après correction du 2026-07-09

Corrections appliquées :

- instructions serveur : parole engagée et parole sociale composée doivent utiliser `DOMAIN_TO_DECIDE`;
- instructions serveur : `j'aimerais parler à un garde` est une intention de parole engagée, pas une possibilité;
- instructions serveur : ellipse objet sans verbe clair doit demander clarification;
- validation serveur : rejet des paroles/mixed/action engagées avec `NO_GAME_TIME`;
- validation serveur : rejet d'une formulation sociale polie classée en `possibility_query` sans question explicite de possibilité;
- validation serveur : rejet d'une ellipse objet classée en `possibility_query`.

Rejeu ciblé des 6 cas `A_CORRIGER` :

- INT-LIVE-008 : OK;
- INT-LIVE-009 : OK;
- INT-LIVE-010 : OK;
- INT-LIVE-011 : OK;
- INT-LIVE-014 : OK;
- INT-LIVE-015 : OK.

Résumé final :

- 18 cas couverts ;
- 18 OK ;
- 0 `A_CORRIGER` ;
- 0 `BLOQUANT`.

Décision :

La certification live courte `player_intent_interpreter` est validée pour le périmètre I-06Z. Le prochain lot produit narration peut être ouvert, en restant sur la qualité de scène jouable et sans ouvrir automatiquement `mj_planner`.

## Décisions selon résultat

### Tout est OK

Ouvrir le prochain lot produit narration orienté qualité de scène jouable :

- meilleure réponse visible aux questions méta utiles ;
- scènes plus concrètes ;
- continuité PNJ plus agréable ;
- aucun `mj_planner` complet tant que la boucle courante n'est pas stabilisée.

### Écart non bloquant

Corriger au plus petit endroit sûr :

1. instruction serveur si OpenAI comprend mal une nuance ;
2. validation serveur si la sortie est dangereuse ;
3. fallback local si le live est instable ;
4. test de régression associé.

### Écart bloquant

Ne pas ouvrir le prochain lot produit.

Corriger d'abord le contrat, la validation ou le pipeline de fallback.

Sont bloquants :

- possibilité classée en action ;
- méta classée en action ;
- parole sociale classée en action physique seule ;
- succès social accordé ;
- secret révélé ;
- temps de jeu annoncé pour une question non narrative ;
- sortie acceptée malgré violation de schéma ou d'autorité.

## Résultat du smoke préalable

Smoke live court du 2026-07-09 :

- OK : méta, localisation, possibilité risquée, action explicite, parole simple ;
- écart détecté : social composé réduit à `action` ;
- correctif appliqué : instructions et validation serveur renforcées ;
- mini smoke de correction OK : les cas sociaux composés sortent en `mixed`, `committed`, `DOMAIN_TO_DECIDE`.
