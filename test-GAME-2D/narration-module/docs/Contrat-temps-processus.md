# Contrat temps et processus

Statut : `LIVRÉ POUR I-03` — noyau, persistance, adaptateur `map-module`, voyage segmenté et rencontres déterministes structurées sont implémentés et vérifiés.

Version : `temporal-kernel/1`

## 1. Autorité

`world.clock.elapsedGameSeconds` est l'unique horloge de campagne. Elle est monotone, entière et committée par `CampaignRepository`. Le calendrier est une projection.

Le `map-module` conserve ses compteurs `tick`, `microTick` et `macroTick` uniquement comme curseurs dérivés. Leur correspondance V1 est fixe :

- une frontière de simulation toutes les 3 600 secondes de campagne;
- un `microTick` par frontière horaire;
- un `macroTick` toutes les six frontières;
- `worldSimulatedThrough` indique la dernière frontière effectivement intégrée.

Ni `Date`, ni le temps réel, ni l'ouverture de l'application ne font avancer le monde. `runWorldHours` ne reçoit jamais zéro, une fraction ou une durée directement issue de l'UI.

## 2. Sous-lots

### I-03A — Noyau temporel pur

- enveloppes `TimeAdvanceProposalV1`, `ScheduledEffectV1` et `TemporalTaskV1`;
- validation des catégories de durée;
- sélection de la prochaine seconde exigible;
- ordre causal stable des tâches simultanées;
- empreinte déterministe du batch;
- calcul de la prochaine frontière horaire sans appeler la simulation.

Gate : mêmes entrées dans un ordre différent, même batch et même empreinte; cycle, dépendance absente, tâche passée et durée invalide sont refusés avant mutation.

### I-03B — Échéancier et processus persistants

- agrégats `world.schedule`, `world.simulation-cursor` et `process.state`;
- états et checkpoints communs des processus longs;
- préparation d'un commit segmenté avec horloge, échéances et événements;
- idempotence et reprise par identités originales.

Gate : fermeture/réouverture IndexedDB, panne à chaque frontière et reprise sans double effet.

Implémentation :

- `world.schedule` conserve les `ScheduledEffectV1`, y compris leurs statuts terminaux et leur graphe causal;
- `world.simulation-cursor` conserve `worldSimulatedThrough`, les trois compteurs dérivés et la granularité 3 600 secondes / 6 microticks;
- `process.state` conserve identité, propriétaire, statut, révision de checkpoint, dernière cause, état minimal et empreinte;
- `prepareTemporalSegmentCommitV1` produit une seule `CommitRequest` contenant horloge, échéancier, checkpoint, commande et événements;
- le service refuse une frontière `WORLD_SIMULATION_BOUNDARY` tant qu'I-03C ne fournit pas un résultat de simulation validé.

Les payloads sont validés et normalisés avant préparation. Une empreinte de checkpoint divergente, un curseur arithmétiquement incohérent, un cycle d'échéances ou une insertion rétroactive bloque toute écriture.

### I-03C — Adaptateur `map-module`

- port recevant un snapshot du monde et un nombre entier d'heures dues;
- copie de travail du `WorldState` avant simulation;
- conversion de `TickOutput` en événements et deltas proposés au `WorldDomain`;
- publication atomique du nouvel état, du curseur et de l'horloge;
- aucune écriture directe du module narration dans les structures internes de la carte.

Gate : 1 h produit un microtick, 6 h un macrotick, rejeu identique sans second tick et panne sans état partiel.

Implémentation :

- `WorldSimulationPortV1` reçoit un snapshot JSON empreinté, un curseur validé et un nombre entier positif d'heures;
- `MapModuleWorldSimulationAdapterV1` clone le snapshot, vérifie la parité des compteurs, appelle `runWorldHours` et normalise `WorldState` et `TickOutput`;
- résultat, prochain état et curseur portent des empreintes recalculées avant préparation du commit;
- `prepareTemporalSegmentCommitV1` vérifie à nouveau ces empreintes puis écrit `world.state`, `world.simulation-cursor` et `world.clock` avec l'événement `WORLD_SIMULATION`;
- zéro heure, durée fractionnaire, snapshot altéré, compteur divergent ou résultat sans tâche correspondante sont refusés avant mutation.

Le moteur carte reste inchangé. Son état d'entrée n'est jamais muté et aucune donnée narrative n'est injectée dans son tick.

### I-03D — Voyage et acceptation

- processus de voyage segmenté et sauvegardable;
- interruptions et rencontres contextuelles à graine stable;
- NAR-ACC-007, NAR-ACC-010 et NAR-ACC-020;
- exemple causal couvrant plusieurs échéances à la même seconde.

Gate : ordre stable, arrêt à la première décision joueur et reprise au dernier checkpoint committé.

Contrat de départ :

- un voyage est un processus `travel.process` dont l'état contient plan, segment courant, progression, checkpoint et éventuelle décision joueur;
- une étape méta ou de clarification utilise `NO_GAME_TIME` et ne modifie ni progression, ni rencontre, ni horloge;
- un segment de voyage validé utilise `PROCESS_SEGMENT` avec durée exacte et cause versionnée;
- la prochaine avancée s'arrête à la première frontière entre fin du segment, frontière monde, interruption externe, rencontre déclenchée ou arrivée;
- la rencontre est une décision structurée déterministe issue d'une graine stable; elle ne produit pas encore de prose, PNJ complet ou scène IA;
- un segment déjà committé ne doit jamais être recalculé avec une nouvelle graine;
- une rencontre déclenchée suspend le processus avec `pendingDecision`, afin de laisser observation, évitement ou approche libre au joueur;
- le checkpoint porte une empreinte canonique et doit être identique après fermeture/réouverture.

Implémentation en cours :

- `TravelProcessV1` et `prepareTravelSegmentV1` produisent un segment pur, une proposition de temps, une pression de rencontre et un prochain checkpoint;
- `createTravelProcessStatePayloadV1` projette ce checkpoint dans `process.state`;
- `prepareTemporalSegmentCommitV1` accepte des écritures additionnelles contrôlées afin d'écrire `world.position` dans le même commit que l'horloge, le checkpoint, le schedule et l'événement;
- les suites mémoire et Chromium vérifient qu'un segment de voyage committé puis rejoué ne crée pas de second événement;
- la décision de rencontre peut sélectionner un candidat structuré depuis des signaux monde, entités lore ou archétypes autorisés; ce candidat reste une référence, pas une création narrative.

I-03 est fermé par [`Matrice-preuves-I03.md`](Matrice-preuves-I03.md). Les limites restantes relèvent des lots suivants, sans création IA ni scène narrative dans le domaine temporel.

## 3. Propositions d'avance

Une proposition contient une identité stable, la campagne, le domaine demandeur, la seconde observée, une catégorie, une durée recommandée et ses bornes, une source versionnée, une cause, un processus éventuel et les versions d'agrégats lues.

Règles V1 :

- `NO_GAME_TIME` impose trois durées nulles;
- `FIXED_RULE`, `DETERMINISTIC_CALCULATION` et `PROCESS_SEGMENT` imposent une durée positive exacte;
- `OPEN_ESTIMATE` impose `minimum <= recommended <= maximum` et une borne minimale positive;
- une durée reste un entier de secondes;
- valider une proposition ne modifie rien.

## 4. Échéances et batches

Une échéance acceptée possède un domaine propriétaire, un type, une seconde d'exigibilité, des causes, des dépendances, une règle de frontière et un payload JSON versionné. Une narration au futur ne constitue jamais une échéance.

Le prochain batch sélectionne uniquement la première seconde exigible comprise entre l'instant courant et la cible. À cette seconde :

1. les dépendances causales priment;
2. à dépendances égales, `BEFORE_ACTIVITY_COMPLETION` précède `SIMULTANEOUS`, qui précède `AFTER_ACTIVITY_COMPLETION`;
3. l'identifiant stable départage uniquement les tâches indépendantes;
4. un cycle ou une dépendance non résolue bloque le batch;
5. l'ordre d'énumération des entrées n'a aucun effet;
6. une nouvelle tâche créée pour la même seconde rejoint un batch suivant après sa cause, sous une limite de cascade future.

L'ordre technique des tâches `SIMULTANEOUS` ne leur donne aucune priorité métier. Leur résolution doit rester coordonnée ou indépendante de cet ordre.

## 5. Frontière avec le noyau

I-03A ne persiste rien et ne modifie pas `campaign-core/1`. I-03B utilise les écritures d'agrégats et événements déjà atomiques. Un segment réussi écrit ensemble :

- la nouvelle valeur de `world.clock`;
- les échéances résolues ou créées;
- les checkpoints de processus concernés;
- le curseur de simulation s'il a avancé;
- les événements et deltas validés.

Une préparation échouée, une simulation en erreur ou un batch invalide n'écrit aucun de ces éléments.

## 6. Hors périmètre d'I-03

- appel IA;
- mutation de `WorldState`;
- rencontre, voyage ou repos jouable;
- calendrier civil complet;
- UI;
- intégration tactique.
