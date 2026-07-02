# Temps et monde vivant

Statut : `EN_CONCEPTION` — horloge unique et contrat d'avance retenus; ordonnancement, événements et retours tardifs restent à détailler.

## Objectif

Garantir qu'activités narratives, processus longs, simulation mondiale et conséquences différées partagent une chronologie linéaire, causale et reproductible.

## Horloge autoritaire

Le `WorldDomain` possède un unique `CampaignClock`. Sa coordonnée canonique est un entier monotone :

```text
CampaignInstant
  elapsedGameSeconds
  calendarId
```

`elapsedGameSeconds` mesure la durée depuis l'origine choisie par la campagne. La seconde est une unité technique d'ordonnancement, pas une règle imposant la durée des actions.

Le calendrier, les jours, saisons et libellés d'heure sont des projections calculées selon `calendarId`. Une API de date civile ou `Date` JavaScript ne constitue jamais la vérité temporelle du monde fictif.

## Temps technique et temps diégétique

Chaque enregistrement peut porter :

- `recordedAt` : temps technique utile au diagnostic;
- `effectiveAt` : instant diégétique auquel l'événement prend effet.

Latence IA, attente réelle, application fermée, sauvegarde, nouvelle tentative et consultation UI ne modifient jamais `CampaignClock`.

## Demande d'avance

Aucun domaine consommateur ne fixe directement l'horloge. Il soumet un `TimeAdvanceProposal` contenant :

- cause et domaine demandeur;
- durée recommandée et plage plausible si estimée;
- règle, calcul ou arbitrage source;
- activité ou segments concernés;
- caractère interruptible;
- dépendances et versions;
- identifiants des intentions et résultats causaux.

Les catégories de durée sont :

- `FIXED_RULE` : durée imposée par le ruleset;
- `DETERMINISTIC_CALCULATION` : résultat calculé depuis des paramètres connus;
- `OPEN_ESTIMATE` : estimation IA bornée et validée;
- `PROCESS_SEGMENT` : durée portée par une étape de voyage, tactique ou repos;
- `NO_GAME_TIME` : opération explicitement hors temps diégétique.

Le `WorldDomain` vérifie source, bornes, préconditions et calendrier, puis produit une `ValidatedTimeAdvance` avec une durée exacte.

## Activités temporelles et hors temps

Dialogue vécu, commerce, observation active, manipulation, déplacement, voyage, tactique et repos consomment la durée réellement exécutée.

Question méta, clarification avant engagement, rappel d'une connaissance, consultation d'interface, attente réelle et reprise technique utilisent `NO_GAME_TIME`.

Une question adressée à un PNJ reste un dialogue vécu et consomme du temps. La forme interrogative ne la transforme pas en question méta.

## Avance segmentée

Une avance longue ne modifie jamais directement l'horloge jusqu'à sa destination finale :

```text
instant courant
  -> prochaine échéance causale
  -> avance jusqu'à cette échéance
  -> résolution et détection d'interruption
  -> commit du segment
  -> échéance suivante si le processus continue
```

Les échéances incluent effets différés, segments de processus, rencontres, frontières de simulation, événements planifiés et décisions significatives appartenant au joueur.

Une interruption conserve uniquement la durée des étapes effectivement exécutées. Les durées prévues mais non commencées ou annulées ne sont pas committées.

## Raccord avec la simulation mondiale

Le `map-module` conserve sa convention interne : un `microTick` représente une heure et un `macroTick` regroupe six heures.

Ces compteurs deviennent des curseurs de traitement dérivés. Lorsque `CampaignClock` franchit une ou plusieurs frontières horaires non simulées, l'orchestrateur demande à la simulation de rattraper les heures dues dans leur ordre.

Le monde simulé ne possède donc pas une autre heure courante. Il possède `worldSimulatedThrough`, qui indique jusqu'à quel instant de l'horloge autoritaire ses effets ont été calculés.

## Ordre à instant identique

Chaque événement porte `effectiveAt`, `commitSequence` et `eventSequenceInCommit`. Deux événements à la même seconde restent ordonnés sans inventer de millisecondes fictives.

Les règles de priorité entre échéances simultanées seront définies dans le lot suivant; aucun module ne peut les résoudre selon son ordre d'exécution accidentel.

## Échéancier causal

Tout effet futur accepté devient un `ScheduledEffect` portant :

- identifiant, type et domaine propriétaire;
- `dueAt` et éventuelle règle de répétition;
- événement cause et autres dépendances;
- référence de règle ou proposition validée;
- payload conforme au domaine;
- `boundaryPolicy`;
- préconditions et conditions d'annulation;
- visibilité et portée géographique;
- état : planifié, exigible, résolu, annulé ou expiré.

L'IA peut proposer une échéance, mais seul le domaine propriétaire la valide et l'inscrit. Une phrase au futur dans la narration ne crée aucune échéance.

### Boucle d'avance

Pour chaque fenêtre temporelle demandée :

1. trouver la prochaine échéance entre l'instant courant et la cible;
2. avancer exactement jusqu'à cet instant;
3. collecter toutes les tâches exigibles;
4. ajouter les frontières de simulation et de processus dues;
5. ordonner les dépendances;
6. résoudre un `TemporalBatch` idempotent;
7. committer les événements et le nouvel instant;
8. arrêter si une décision significative revient au joueur, sinon continuer.

Une échéance créée pendant le batch pour le même instant rejoint la file courante après sa cause. Une échéance créée dans le passé est rejetée.

### Dépendances et simultanéité

Les relations `dependsOn[]` et `causedBy[]` forment un graphe acyclique. Une cause précède toujours ses effets, même à la même seconde.

Deux événements réellement indépendants peuvent partager l'instant. Un ordre technique stable assure la reproductibilité, mais cet ordre ne doit pas changer leurs résultats.

Lorsque l'ordre possède une conséquence métier, le ruleset ou l'échéance déclare :

- `BEFORE_ACTIVITY_COMPLETION`;
- `AFTER_ACTIVITY_COMPLETION`;
- `SIMULTANEOUS` avec résolution coordonnée.

Une ambiguïté non couverte provoque un arbitrage explicite et un `AdjudicationRecord`; l'ordre d'itération d'un tableau ou d'un domaine ne tranche jamais le cas.

### Interruption et composition immédiate

Si un batch crée une décision significative, l'horloge s'arrête à son instant. Tous les événements simultanés perceptibles sont fournis ensemble à la future scène. Les événements futurs restent planifiés.

Un événement invisible peut être résolu et committé sans message joueur. Il n'est narré que si un canal de perception ou de connaissance le rend accessible plus tard.

### Annulation et expiration

Une échéance annulée ou expirée reste au journal avec sa cause. Son effet métier n'est pas appliqué.

Les conditions d'annulation sont validées par le propriétaire : cible morte, objet détruit, promesse accomplie, lieu quitté ou règle remplacée. Une modification de ruleset ne réinterprète pas silencieusement les échéances historiques.

### Sécurité des cascades

- un cycle de dépendances bloque le batch avant mutation;
- une limite de profondeur et de quantité détecte les cascades infinies au même instant;
- un batch réessayé conserve identifiants, tirages et clé d'idempotence;
- un échec multidomaine ne produit aucune application partielle;
- le diagnostic conserve ordre choisi, règles de frontière et causes d'annulation.

## Origine des événements

Tout événement committé déclare une origine parmi :

- `PLAYER_ACTION`;
- `DOMAIN_RULE`;
- `WORLD_SIMULATION`;
- `AI_CREATIVE_PROPOSAL`;
- `PROCESS_OUTCOME`;
- `SCHEDULED_EFFECT`.

L'origine décrit la chaîne de production, pas la vérité ou l'importance. Après validation et commit, l'autorité vient du domaine propriétaire et des événements résultants.

L'enveloppe commune porte au minimum événement, type, origine, domaine, instant, séquences, causes, entités, lieu, payload versionné, politique de visibilité et références de proposition, règle, simulation ou processus.

## Événement créatif proposé par l'IA

L'IA peut proposer incident, arrivée, opportunité, phénomène, complication, évolution d'intrigue ou événement futur. Son `EventProposal` contient :

- cause et justification;
- participants et ancres;
- lieu et instant ou fenêtre;
- préconditions et expirations;
- effets et domaines concernés;
- portée de visibilité;
- engagements narratifs;
- profondeur de persistance demandée.

Une proposition immédiate est validée dans le tour. Une proposition future devient un `ScheduledEffect` après validation. Aucune proposition ne peut être insérée rétroactivement dans un passé déjà committé.

## Événement produit par la simulation

Le `map-module` produit des `WorldEvent` et deltas autoritaires après commit du `WorldDomain`. Ils sont ensuite classés selon leur relation au personnage : observation directe, signal perceptible, rumeur diffusable, opportunité ou événement encore inconnu.

La simulation n'écrit pas la scène. L'IA n'a pas besoin de recréer l'événement pour pouvoir le mettre en scène.

## Déduplication inter-origines

Avant validation, le système compare temps, lieu, acteurs, causes, type et effets avec les événements et candidats existants.

Une proposition décrivant un phénomène déjà simulé peut référencer l'événement existant, enrichir sa présentation sans mutation, proposer une conséquence distincte causée par lui ou être rejetée comme doublon.

Elle ne crée pas une seconde entité ou un second événement pour donner une forme narrative à une vérité existante.

## `SceneEventBundle`

La composition narrative groupe sans fusionner les événements autoritaires. Un bundle porte :

- fenêtre temporelle et lieu;
- événements et ordre causal;
- perceptions et changements visibles;
- conséquences privées exclues de la sortie;
- éléments obligatoires, résumables ou différables;
- droits de révélation et sources;
- décision éventuelle qui rend la main au joueur;
- contraintes de rythme et continuité.

Le planificateur organise les mouvements de scène et le rédacteur les exprime. Les identifiants d'événements restent attachés aux blocs produits.

### Sélection des événements à présenter

La sélection prend en compte présence, perception, interruption, décision nécessaire, importance d'intrigue, conséquence durable, nouveauté et politique de rythme.

Un événement réel mais invisible est committé sans narration immédiate. Il peut devenir connaissable plus tard par trace, témoin, rumeur ou conséquence. Ne pas le montrer ne l'annule pas.

### Exemple de composition

Une arrivée du joueur au marché, une fermeture causée par une faction et le début d'un orage restent trois événements. Ils peuvent produire une seule scène, mais ni la fermeture ni l'orage ne deviennent de simples détails inventés par le rédacteur.

## Évolution hors écran

Le monde évolue uniquement lorsque `CampaignClock` avance. Une absence du personnage dans une région peut couvrir des mois de jeu; une fermeture réelle de l'application ne produit aucune évolution.

La simulation utilise trois niveaux de détail :

- `ACTIVE` : zone du joueur, processus et événements imminents;
- `SUMMARY` : lieux, acteurs et fils pertinents sans interaction immédiate;
- `ABSTRACT` : régions éloignées sans engagement exigeant un suivi fin.

Le niveau change le coût et la granularité du calcul, pas l'autorité des résultats. Chaque transition de niveau est tracée et les états produits restent des deltas et événements committés.

Un engagement d'intrigue, une échéance critique, un acteur lié au joueur ou une conséquence susceptible de l'atteindre ne peut pas passer en `ABSTRACT` si cette réduction perdrait une condition, un indice, une position ou une causalité nécessaire.

Une zone réactivée repart de son état committé. L'IA ne reconstruit pas après coup des mois d'histoire supposée pour justifier son état courant.

## Conséquences différées

Une conséquence future est un `ScheduledEffect` spécialisé portant :

- instant, fenêtre ou condition de déclenchement;
- événement cause et domaine propriétaire;
- cible et effet structuré;
- préconditions et règles d'annulation ou replanification;
- visibilité et canaux de diffusion;
- importance pour intrigue, mémoire et simulation;
- version du ruleset ayant créé l'échéance.

Dette, départ d'un PNJ, évolution d'une blessure, promesse non tenue, action de faction ou progression d'intrigue peuvent ainsi survenir hors écran sans attendre le retour du joueur.

Si la cible ou les conditions changent, le propriétaire applique la politique déclarée : résoudre, annuler, expirer ou créer une nouvelle échéance causée. Il ne modifie pas silencieusement le payload historique.

## Retour dans un lieu

Le retour utilise deux références distinctes :

- l'état autoritaire du lieu lors de la dernière visite;
- la dernière perception et les connaissances réellement acquises par le personnage.

Le `LocationReentryContext` combine :

- instant de dernière présence et dernière perception;
- souvenirs liés au lieu, acteurs et engagements;
- événements committés pendant l'absence;
- état courant et causes de ses changements;
- acteurs présents, absents, arrivés ou disparus;
- fils narratifs et échéances concernés;
- différences visibles, déductibles, apprenables et secrètes;
- éléments obligatoires et budget de présentation.

La comparaison joueur utilise sa perception antérieure, pas les secrets système de l'époque. Le texte ne dit pas qu'une chose « a changé » si le personnage ignorait son ancien état.

### Catégories de restitution

- `IMMEDIATELY_VISIBLE` : apparence, occupants ou fonctionnement observables;
- `INFERABLE` : conclusion plausible depuis des signes, sans certitude automatique;
- `KNOWN_THROUGH_CHANNEL` : rumeur, lettre, témoin ou connaissance acquise;
- `REMEMBERED` : souvenir utile à la compréhension du retour;
- `HIDDEN` : changement réel non révélable;
- `DEFERRED` : changement pertinent mais inutile dans la scène immédiate.

Le planificateur sélectionne les changements nécessaires et le rédacteur les met en scène. Il ne récite pas la chronologie exhaustive et ne transforme pas une inférence en vérité.

### Acteurs et relations pendant l'absence

Position, activité, objectifs, connaissances et relations d'un PNJ évoluent seulement par événements, règles, actions mondiales ou conséquences différées. Le simple passage du temps n'invente pas une réconciliation, une rancune ou un souvenir.

Lors du retour, chaque PNJ reçoit sa mémoire et ses connaissances propres. Il peut rappeler une dette ou une promesse sans connaître les causes secrètes des changements du lieu.

### Exemple

Si une auberge change de propriétaire, subit une montée d'influence politique et cache l'effondrement d'un passage secret, le personnage peut voir la nouvelle tenancière, l'enseigne abîmée et les signes de faction. Mort de l'ancien propriétaire, cause politique et passage effondré restent soumis à leurs canaux de découverte.

## Scénarios temporels d'acceptation

Le contrat devra couvrir au minimum :

1. question méta et clarification sans avance;
2. dialogue dont la durée ouverte est arbitrée et validée;
3. action composée interrompue avant sa durée prévue;
4. événements indépendants à la même seconde;
5. effet explicitement avant, après ou simultané à une fin d'activité;
6. plusieurs échéances horaires mondiales rattrapées dans l'ordre;
7. échéance annulée parce que sa cible ou sa précondition disparaît;
8. cascade causale finie au même instant;
9. cycle causal et cascade infinie rejetés avant mutation;
10. proposition IA dédupliquée avec un événement simulé;
11. fermeture réelle prolongée sans avance diégétique;
12. retour après plusieurs mois vécus dans la campagne;
13. changement visible dont la cause reste secrète;
14. acteur absent, déplacé ou mort lors du retour;
15. engagement d'intrigue empêchant une abstraction destructive;
16. nouvelle tentative d'un batch déjà committé sans second effet.

## Exemple causal parseable

[`Exemple-chronologie-causale.json`](Exemple-chronologie-causale.json) montre un repos prévu de 05:58 à 06:02, interrompu à 06:00 par l'arrivée planifiée d'une patrouille lors d'une frontière horaire du monde.

L'exemple vérifie :

- arrêt exact de l'horloge à l'interruption;
- exécution unique du microtick mondial;
- conservation des consommations déjà committées;
- non-application du bénéfice de fin de segment;
- annulation sourcée de l'échéance de fin;
- exclusion d'un événement mondial simultané mais invisible;
- composition des seuls événements perceptibles;
- idempotence d'une nouvelle tentative.

## Audit de l'atelier

- autorité temporelle unique : couverte;
- demandes de durée fixes, calculées, estimées et segmentées : couvertes;
- échéances, simultanéité et interruptions : couvertes;
- événements IA, règles, processus et simulation : distingués;
- composition de scène sans fusion de vérité : couverte;
- évolution hors écran et granularité : couvertes;
- conséquences différées et annulations : couvertes;
- retour tardif fondé sur perception et mémoire : couvert;
- persistance, reprise et idempotence : couvertes;
- scénarios limites et exemple parseable : fournis.

## Invariants initiaux

1. `elapsedGameSeconds` ne diminue jamais.
2. Une campagne possède une seule horloge diégétique autoritaire.
3. Les ticks monde sont dérivés de l'horloge, pas concurrents.
4. Toute avance possède une cause et une durée validées.
5. Le temps réel et les reprises techniques ont une durée diégétique nulle.
6. Une action interrompue ne consomme que ses segments exécutés.
7. Tout événement est localisable et ordonnable sur la chronologie.

## Points à traiter

- priorités et ordonnancement des échéances simultanées : traités;
- distinction entre événements IA, règles et simulation : traitée;
- fusion de plusieurs événements dans une scène : traitée par composition sans fusion de vérité;
- évolution hors écran : traitée;
- échéances, conséquences différées et annulations : traitées;
- retour tardif et sélection des changements à présenter : traités;
- exemple parseable et audit : fournis.
