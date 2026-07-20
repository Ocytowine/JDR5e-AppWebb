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

## Amendement post-I-06ZR — frontière d'autorité du rendu

Le rôle `coherence_critic` est désormais ouvert dans un usage strictement non autoritaire : il compare une prose candidate à une `NarrativeRenderAuthorityV1`, puis retourne seulement `PASS`, `REVISE` ou `REJECT`. Il ne réécrit pas la prose, ne décide aucun résultat et ne déclenche aucune correction automatique. Un verdict absent, invalide, `REVISE`, `REJECT` ou comportant un finding `BLOCKING` conserve le rendu déterministe.

Une sortie structurée exploitable du critique conserve toujours l'enveloppe `status=OK`, y compris quand `payload.verdict=REJECT`. Le statut d'enveloppe décrit la validité technique de la réponse; le verdict décrit l'acceptabilité de la narration candidate.

La frontière remise aux adaptateurs de texte et au critique distingue cinq modes :

- `PLAYER_EXPRESSION_FIDELITY` : la reformulation conserve but, cible, intensité et engagement; elle ne peut ajouter ni étape, ni méthode, ni résultat, ni connaissance;
- `OBSERVATION_RESULT` : signes publics directement perceptibles autorisés; faits cachés, motivations et certitudes mentales interdits;
- `ACTION_STAGING_ONLY` : seul le geste engagé est confirmé; succès, mutation de la cible, révélation et réaction de PNJ restent non confirmés;
- `CONFIRMED_OUTCOME` : seuls les effets réellement confirmés par la résolution peuvent être narrés comme acquis;
- `NPC_REACTION` : la réaction structurée du PNJ constitue le rendu; elle ne doit pas être doublée par une narration MJ générique.

Ce contrôle est sémantique. Le code applicatif ne tente pas de reconnaître une liste de formulations interdites dans la prose. Il valide les références et la discipline factuelle structurée, puis confie la comparaison de sens au critique borné.

## Ordre obligatoire

1. recevoir une `NarrativeResolutionResultV1` deja produite;
2. construire un appel `player_expression_adapter` si une expression PJ existe;
3. valider que `addedMeaning` est vide et `safeToUse=true`, puis faire contrôler indépendamment la reformulation par `coherence_critic` en mode `PLAYER_EXPRESSION_FIDELITY` lorsque la route IA est active;
4. construire un appel `scene_writer` pour un bloc MJ optionnel uniquement si le resultat contient une matiere fictionnelle autorisee;
5. valider que chaque bloc est ancre dans des references autorisees;
6. comparer tout bloc candidat à la frontière d'autorité avec `coherence_critic` lorsque la route IA est active;
7. appliquer les ameliorations uniquement au `DisplayPacketV1`;
8. conserver le resultat I-06F intact;
9. consigner les incidents expurges en cas de rejet.

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

Le `scene_writer` ne doit pas etre appele pour meubler une reponse `NO_COMMIT_RESPONSE` purement meta ou informative. Si aucun fait fictionnel autorise n'est disponible, le systeme conserve la notification deterministe ou une reponse factuelle sobre.

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
- absence de narration atmospherique sur question meta ou informative sans snapshot reel;
- handoff tactique rendu plus vivant sans resolution de combat;
- fallback deterministe si sortie invalide;
- aucun changement de `resolution.resultKind`, `commitId`, `handoff` ou horloge.

## Hors perimetre

I-06G ne branche pas encore OpenAI dans l'UI. Le fournisseur reel reste utilisable seulement via l'adaptateur serveur certifie, et son branchement produit demandera une decision explicite.
