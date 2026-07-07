# Contrat resolution IA bornee

Statut : `FIGE`

Version : `narrative-ai-resolution/1`

Lot : I-06G

Date : 2026-07-07

## Objectif

I-06G ajoute une couche IA de qualite narrative au-dessus de `narrative-resolution/1`.

Cette couche peut rendre le flux plus vivant :

- reformulation RP plus naturelle du personnage joueur;
- narration MJ d'ambiance;
- transition lisible vers un handoff;
- rendu degrade plus elegant.

Elle ne gagne aucune autorite metier. Le resolver I-06F reste la frontiere de securite.

## Autorite

L'IA I-06G peut modifier uniquement des blocs visibles non autoritaires avant affichage.

Elle ne peut pas modifier :

- `resultKind`;
- `commitId`;
- `preparedEffects`;
- `handoff.target`;
- `handoff.reason` au sens metier;
- l'horloge;
- les evenements;
- les agregats;
- les commandes acceptees;
- les propositions de creation.

Si une sortie IA contredit le resultat I-06F, elle est rejetee et le rendu deterministe est conserve.

## Roles IA autorises

I-06G autorise seulement deux roles deja definis par `ai-pipeline/1` :

- `player_expression_adapter`;
- `scene_writer`.

Les roles suivants restent fermes :

- `mj_planner`;
- `npc_performer`;
- `rules_adjudicator`;
- `intent_interpreter`;
- `coherence_critic` comme correction automatique;
- creation dynamique committable.

## Ordre obligatoire

1. recevoir une `NarrativeResolutionResultV1` deja produite;
2. construire un appel `player_expression_adapter` si une expression PJ existe;
3. valider que `addedMeaning` est vide et `safeToUse=true`;
4. construire un appel `scene_writer` pour un bloc MJ optionnel;
5. valider que chaque bloc est ancre dans des references autorisees;
6. appliquer les ameliorations uniquement au `DisplayPacketV1`;
7. conserver le resultat I-06F intact;
8. consigner les incidents expurges en cas de rejet.

## Sorties autorisees

I-06G produit :

- `AiNarrativeEnhancementResultV1`;
- un `DisplayPacketV1` enrichi;
- une liste d'incidents IA expurges;
- une indication de fallback.

La sortie ne contient pas de prompt brut ni de reponse fournisseur brute.

## Regles de belle narration

La narration MJ peut :

- ajouter texture sensorielle locale;
- expliciter une tension;
- rendre une parole ou un handoff plus lisible;
- souligner qu'une action n'a pas encore ete resolue.

Elle ne peut pas :

- annoncer un succes ou un echec non commite;
- faire parler un PNJ a la place d'un role non ouvert;
- reveler un secret;
- inventer un objet utile;
- inventer un PNJ persistant;
- changer l'intention du joueur;
- simuler un combat, un repos ou une transaction.

## Fallback

Si l'IA echoue, le systeme conserve le rendu deterministe I-06F.

Un echec IA post-commit ne rejoue jamais le commit. Le fallback est une degradation de presentation, pas une reprise metier.

## Tests obligatoires

I-06G doit prouver :

- amelioration d'une expression PJ sans ajout de sens;
- rejet d'une reformulation qui ajoute un engagement;
- ajout d'une narration MJ ancree;
- handoff tactique rendu plus vivant sans resolution de combat;
- fallback deterministe si sortie invalide;
- aucun changement de `resolution.resultKind`, `commitId`, `handoff` ou horloge.

## Hors perimetre

I-06G ne branche pas encore OpenAI dans l'UI. Le fournisseur reel reste utilisable seulement via l'adaptateur serveur certifie, et son branchement produit demandera une decision explicite.
