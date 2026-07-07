# Audit final du module narration

Statut : `RETENU` — audit initial terminé; addenda progressifs jusqu'à I-06A, avec I-05B fermé le 2026-07-07 et I-06A autorisé contractuellement.

## Objectif

Déterminer si les contrats sont cohérents, suffisamment précis et correctement ordonnés pour autoriser un premier lot d'implémentation sans reconstruire le module sur des hypothèses implicites.

## Échelle de gravité

- `BLOQUANT_GLOBAL` : interdit tout début d'implémentation du nouveau runtime;
- `BLOQUANT_LOT` : interdit uniquement le lot technique concerné;
- `CORRECTION_DOCUMENTAIRE` : incohérence sans nouveau choix produit;
- `REPORT_MESURE` : valeur volontairement calibrée pendant un benchmark;
- `HORS_MVP` : extension connue sans comportement financé maintenant.

## Lot 1 — Contradictions et obsolescences documentaires

### Corrections appliquées

| ID | Constat | Gravité | Résolution |
|---|---|---|---|
| AF-001 | `Integration-domaines`, `Snapshot-et-contextes` et `Temps-et-monde-vivant` restaient `EN_CONCEPTION` malgré leurs ateliers bouclés | `CORRECTION_DOCUMENTAIRE` | statuts alignés sur le plan et limites techniques conservées |
| AF-002 | plusieurs statuts du dossier principal annonçaient encore des travaux réalisés par les ateliers 2 à 12 | `CORRECTION_DOCUMENTAIRE` | annotations remplacées par l'état courant et les vrais reports |
| AF-003 | les invariants 21 à 24 du modèle persistant étaient dupliqués après l'invariant 35 | `CORRECTION_DOCUMENTAIRE` | renumérotation en 36 à 39 sans changement sémantique |
| AF-004 | `scene_writer` était déclaré obligatoire pour toute narration alors qu'un rendu déterministe post-commit est prévu en cas de panne | `CORRECTION_DOCUMENTAIRE` | obligation limitée au parcours IA nominal; exception de sécurité explicitée |
| AF-005 | `withhold` pouvait être lu comme transportant le texte du secret vers le rédacteur visible | `CORRECTION_DOCUMENTAIRE` | champ limité à un identifiant opaque sans vérité cachée brute |
| AF-006 | le modèle persistant disait la technologie de stockage indécise alors que NAR-052 retient IndexedDB pour le prototype | `CORRECTION_DOCUMENTAIRE` | distinction entre adaptateur retenu et schéma physique encore ouvert |
| AF-007 | mémoire et persistance reportaient encore la rétention des traces, définie depuis l'atelier 10 | `CORRECTION_DOCUMENTAIRE` | renvoi vers la politique normative de résilience |
| AF-008 | le fil transversal des intrigues conservait trois cases ouvertes malgré la clôture des ateliers 6, 7 et 9 | `CORRECTION_DOCUMENTAIRE` | couverture projection, pipeline et chronologie alignée sur les contrats existants |
| AF-009 | le modèle ancien plaçait transcript et messages post-commit dans le commit métier | `CORRECTION_DOCUMENTAIRE` | `InteractionLog` défini comme projection reconstructible des opérations, résultats et actes de parole committés |

### Écarts de code existant, sans contradiction de cible

- `/api/narration` existe encore pour le résumé tactique et renvoie des erreurs sous forme de contenu; le futur adaptateur exige des enveloppes HTTP distinctes.
- le serveur courant autorise CORS `*`; cette dette ne devient pas la politique de sécurité du futur orchestrateur.
- le runtime narratif historique est retiré et les commandes npm narration sont des marqueurs, conformément à `TASKS.md`.

Ces écarts décrivent l'existant à isoler ou remplacer. Ils ne doivent pas être « corrigés » avant le lot d'intégration qui en possède le périmètre.

## Points ouverts après le lot 1

| ID | Point | Classe préliminaire | Condition de résolution |
|---|---|---|---|
| AF-O01 | schémas JSON, signatures TypeScript et validateurs exécutables absents | `BLOQUANT_LOT` | requis avant chaque lot qui implémente le contrat correspondant |
| AF-O02 | stratégie exacte de remplacement ou adaptation de `/api/narration` | `BLOQUANT_LOT` | requise avant l'intégration tactique, pas avant le noyau persistant |
| AF-O03 | profil financier `balanced` et calibrage par fournisseur | `REPORT_MESURE` | benchmark obligatoire avant validation finale du pipeline fournisseur |
| AF-O04 | rythme automatique des dialogues et détails d'interface | `REPORT_MESURE` | valeurs configurables puis tests UX, invariants d'attribution déjà fixés |
| AF-O05 | schéma normalisé d'ingestion du wiki | `BLOQUANT_LOT` | requis avant la recherche lore et la construction de contextes réels |
| AF-O06 | toutes les décisions et contrats restent `RETENU` | `BLOQUANT_GLOBAL` pour le runtime | le lot 3 de l'audit doit identifier et passer à `FIGE` le sous-ensemble nécessaire au premier lot autorisé |

## Conclusion provisoire du lot 1

Aucune contradiction produit non résolue n'a été trouvée entre autorité de l'IA, domaines, chronologie, mémoire, tactique, repos et persistance. Les contradictions relevées étaient documentaires et ont été alignées sur des décisions déjà validées.

Le runtime complet n'est pas encore autorisé : les contrats du premier lot ne sont pas `FIGE` et leurs schémas exécutables restent à produire. Le lot 2 doit maintenant classer précisément les reports et questions par étape d'implémentation.

## Lot 2 — Registre des reports et blocages

### Règle de classification

Un report n'autorise jamais une valeur implicite choisie pendant le codage. Il appartient à l'une des classes suivantes :

- `AVANT_PREMIER_CODE` : choix normatif à figer avant toute implémentation du nouveau runtime;
- `AVANT_CAPACITE` : requis avant le lot qui introduit la capacité concernée;
- `AVANT_CERTIFICATION` : implémentation possible avec fixture ou configuration provisoire, livraison non validable sans mesure;
- `CONDITIONNEL` : déclenché uniquement si un seuil ou changement d'architecture survient;
- `HORS_MVP` : aucun comportement complet attendu dans le scénario vertical.

### Verrou global restant

| ID | Livrable | Classe | Bloque | Ne bloque pas |
|---|---|---|---|---|
| AF-R01 | sous-ensemble de contrats du premier lot marqué `FIGE` | `AVANT_PREMIER_CODE` | tout nouveau code de runtime narratif | audit et documentation |
| AF-R02 | frontières normatives du premier lot : identités, versions, événements, opérations, erreurs et repository | `AVANT_PREMIER_CODE` | création de types ou stores qui deviendraient de fait le contrat | préparation de la feuille de route |

Le lot 3 doit résoudre AF-R01 et AF-R02. Les représentations JSON Schema et TypeScript seront ensuite les implémentations testables de ce contrat figé, pas une occasion de le redéfinir silencieusement.

### Blocages par capacité

| ID | Capacité | Élément à produire ou décider | Échéance | Preuve attendue |
|---|---|---|---|---|
| AF-R03 | persistance | stores IndexedDB, index, transaction atomique, migrations et port `CampaignRepository` | avant repository réel | tests de commit, idempotence, reprise et migration |
| AF-R04 | contenu versionné | manifeste, empreintes, épinglage et migration des paquets de contenu | avant matérialisation du lore dans une campagne | import déterministe et conservation des sources |
| AF-R05 | ingestion wiki | clés normalisées, schéma, diagnostics et projection de fragments sourcés | avant recherche lore réelle | corpus valide/invalide et scénario des Archives |
| AF-R06 | import personnage | schéma normalisé de fiche source, recalculs et projection narrative/tactique | avant création de campagne depuis l'éditeur | fixture de fiche prête à jouer et rejets ciblés |
| AF-R07 | règles maison | inventaire MVP du `RuleRegistry`, versions, priorités et schéma d'`AdjudicationRecord` | avant toute résolution mécanique narrative | NAR-ACC-008 et 021 |
| AF-R08 | mémoire | schémas des unités, ports d'index, quotas par canal, pagination et cache | avant rappel long terme réel | NAR-ACC-004 à 006 et seuils de rappel |
| AF-R09 | snapshot et contextes | schémas de `TurnSnapshot`, `RoleContextPack`, dépendances et traces de sélection | avant premier appel IA réel | exemples parseables validés par schéma |
| AF-R10 | pipeline IA | schéma de chaque rôle, adaptateur fournisseur, erreurs HTTP et validateurs | avant branchement d'un fournisseur | contrats invalides, retries et NAR-ACC-014/019 |
| AF-R11 | créations dynamiques | schémas par type, densité, similarité, budgets de correction et réconciliation | avant promotion automatique d'une création IA | NAR-ACC-003, 006 et 016 |
| AF-R12 | temps et monde | signatures de propositions, batches et adaptateur `map-module` | avant première avance mondiale intégrée | exemple causal et NAR-ACC-007/010/020 |
| AF-R13 | tactique | décision d'adapter ou remplacer `/api/narration`, schémas de handoff et outcome | avant intégration tactique | NAR-ACC-011 et absence de double commit |
| AF-R14 | repos | schémas du processus, checkpoints et événements UI | avant repos jouable | NAR-ACC-012 et frontière temporelle |
| AF-R15 | diagnostic | schéma physique d'`IncidentRecord`, stockage expurgé et export | avant activation du pipeline distant | NAR-ACC-014, 018 et 019 |
| AF-R16 | présentation | composants typés, attribution accessible et réglages de rythme | avant validation UX du flux complet | NAR-ACC-002 et 017 |

Chaque ligne bloque uniquement sa capacité. Elle n'autorise pas une implémentation factice de la capacité dans un lot antérieur.

### Mesures différées avant certification

| ID | Mesure | Classe | Valeur provisoire | Condition de clôture |
|---|---|---|---|---|
| AF-M01 | prix moyen, p95 et plafond du profil `balanced` | `AVANT_CERTIFICATION` | mécanisme de plafond défini, montant ouvert | benchmark sur modèles et tarifs retenus |
| AF-M02 | enveloppes par rôle et taux de sorties invalides | `AVANT_CERTIFICATION` | budgets et seuils initiaux de l'atelier 11 | corpus réel avec modèle certifié |
| AF-M03 | quotas mémoire, index textuel/sémantique et latence | `AVANT_CERTIFICATION` | interfaces et objectifs de rappel définis | benchmark au volume NFR-ACC-001 |
| AF-M04 | seuils de densité et similarité des créations | `AVANT_CERTIFICATION` | politiques conceptuelles définies | corpus de doublons et créations variées |
| AF-M05 | rythme des dialogues automatiques | `AVANT_CERTIFICATION` | paramètre développeur obligatoire | essais UX multi-PNJ |
| AF-M06 | capacité IndexedDB et seuil de bascule | `AVANT_CERTIFICATION` | cible 500 Mo, avertissement à 70 % | NFR-ACC-001 sur navigateurs retenus |

Ces mesures ne bloquent pas les ports, fixtures et moteurs déterministes. Elles bloquent la déclaration de la capacité correspondante comme certifiée.

### Décisions conditionnelles

| ID | Décision | Déclencheur | Comportement avant déclenchement |
|---|---|---|---|
| AF-C01 | adaptateur SQLite | échec durable du benchmark IndexedDB ou autorité déplacée hors navigateur | IndexedDB reste canonique pour le prototype |
| AF-C02 | modèle ou fournisseur de secours | certification pour rôle, contrat, permissions et qualité | aucun fallback non certifié; suspension du rôle critique |
| AF-C03 | cache ou index spécialisé externe | objectifs mémoire non atteints par l'adaptateur local | port abstrait et reconstruction depuis les sources |

### Hors MVP confirmé

- coopération, multijoueur et synchronisation réseau;
- voix et reconnaissance vocale;
- bastion complet;
- progression et multiclassage complets;
- économie avancée au-delà des transactions nécessaires;
- relations romantiques approfondies;
- génération mondiale sans limite;
- interface lourde d'édition narrative;
- exploitation serveur de plusieurs campagnes concurrentes.

Ces sujets ne peuvent ni ajouter une exigence cachée au premier runtime ni justifier une architecture distribuée prématurée. Les identifiants, versions et ports évitent seulement de les rendre impossibles.

## Conclusion du lot 2

Aucune question produit non classée ne bloque la définition du premier lot. Le runtime reste bloqué par AF-R01 et AF-R02 jusqu'au lot 3. Tous les autres points possèdent désormais une capacité propriétaire, une échéance et une preuve de clôture.

Le prochain travail consiste à choisir la frontière minimale du premier lot, identifier ses documents normatifs et les faire passer de `RETENU` à `FIGE` sans figer prématurément le pipeline IA complet.

## Lot 3 — Frontière et contrat du premier lot

### Lot d'implémentation candidat

Le premier lot est un noyau transactionnel sans comportement narratif : contrats, opérations, agrégats opaques, commandes acceptées, événements, horloge minimale, outbox, port repository, adaptateur mémoire et tests communs.

Il exclut explicitement IndexedDB, wiki, personnage, règles, mémoire, IA, UI, carte, tactique et repos. Cette exclusion empêche la fondation de devenir un monolithe anticipant tous les domaines.

### Contrat figé

[`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md), version `campaign-core/1`, fixe :

- types JSON, identifiants opaques et versions;
- `CampaignRecord`, agrégats et horloge monotone;
- cycle et transitions d'`OperationRecord`;
- commandes acceptées, événements ordonnés et visibilité;
- commit atomique, révisions et idempotence;
- writer lease et fencing token;
- outbox post-commit;
- taxonomie d'erreurs et résultat explicite;
- opérations du port `CampaignRepository`;
- suite contractuelle obligatoire pour tout adaptateur.

### Résolution des verrous

- AF-R01 : `RÉSOLU` — le contrat du premier lot est `FIGE`.
- AF-R02 : `RÉSOLU` — identités, versions, événements, opérations, erreurs et repository sont normatifs.
- AF-R03 : `RÉSOLU` le 2026-07-03 par [`Contrat-persistance-indexeddb.md`](Contrat-persistance-indexeddb.md), version `campaign-storage/1`; I-01 peut être ouvert sans changer `campaign-core/1`.

### Décision de lot

Le lot est suffisamment spécifié pour être transformé en feuille de route technique, mais son démarrage reste suspendu jusqu'à la revalidation verticale et la décision finale des lots 4 et 5 de l'audit.

## Lot 4 — Revalidation verticale et audit des autorités

### Passage de bout en bout

| Étape de NAR-ACC-002 | Entrée dans le noyau | Autorité métier | Sortie persistante | Contrôle principal |
|---|---|---|---|---|
| création de campagne | bootstrap `CampaignRecord` et horloge zéro | noyau pour identité/version; `WorldDomain` pour l'horloge après bootstrap | campagne révision 0 et agrégat `world.clock` | aucune IA, aucun temps implicite |
| import du personnage | opération puis commande d'import validée | `CharacterDomain` | agrégat personnage et événement d'import | fiche source distincte, valeurs dérivées recalculées |
| entrée aux Archives | commandes de position et scène | `WorldDomain`, `SceneDomain`, `ContentDomain` pour le canon | agrégats monde/scène et événements sourcés | contenu épinglé, identité du lieu stable |
| saisie libre ou méta | `OperationRecord.requestPayload` | joueur pour l'entrée; orchestrateur pour l'interprétation sans autorité métier | opération sans commit ou suspendue | aucune action depuis une question, temps nul |
| création d'un PNJ | proposition hors vérité puis commande acceptée | `NarrativeActorDomain` | agrégat acteur et événement de promotion | doublon, provenance et perspective validés |
| dialogue et résolution sociale | commandes et actes de parole validés | `SocialKnowledgeDomain`, acteur et règles | relations, connaissances, événements et parole durable | le texte ne devient pas vérité objective |
| intrigue dynamique | proposition puis engagement accepté | domaine narratif de campagne | agrégat de fil, vérité privée et événements | solvabilité, fausse piste et visibilité |
| déplacement et temps | proposition de durée validée | `WorldDomain` | horloge monotone, position et batches temporels | ordre causal et interruption exacte |
| transition tactique | agrégat de processus et handoff | `TacticalDomain` pendant la session | checkpoints puis outcome intégré par les propriétaires | intégration unique, aucun rejeu du combat |
| repos | agrégat de processus et commandes segmentées | `RestDomain`, personnage et monde | checkpoints, temps et effets validés | bénéfices seulement atteints, signaux UI dérivés |
| commit et narration | commit métier puis complétion de l'opération | domaines pour le résultat; aucune autorité métier pour la prose | événements/agrégats puis `resultPayload` filtré | panne de rédaction sans rejeu métier |
| transcript et mémoire | opérations complètes, événements et outbox | sources métier; projections sans autorité | `InteractionLog` reconstructible et index mémoire | perte d'index sans perte de vérité |
| sauvegarde, ellipse et retour | lectures paginées, nouveaux commits temporels | propriétaires inchangés | dernière révision cohérente et nouvelles perceptions | aucune branche, aucun secret révélé |

### Classes de données persistantes

| Classe | Propriétaire | Représentation noyau | Mutation autorisée |
|---|---|---|---|
| identité, statut et révision de campagne | noyau de campagne | `CampaignRecord` | bootstrap, commit pour révision, verrou technique fermé |
| état métier d'un domaine | domaine déclaré dans `Matrice-autorite.md` | `AggregateRecord.payload` | commande validée puis commit |
| horloge fictionnelle | `WorldDomain` | agrégat `world.clock` | commit avec monotonie vérifiée |
| commande acceptée | domaine cible | `AcceptedCommandRecord` | créée uniquement dans le commit réussi |
| fait historique | domaine de l'événement | `EventRecord` | ajout immuable dans le commit |
| entrée et résultat visible | joueur puis pipeline de présentation | `OperationRecord` non autoritaire | réception, transitions et complétion technique |
| tâche de projection | noyau technique, consommateur sans autorité source | `OutboxTaskRecord` | machine d'état technique idempotente |
| transcript, index et contexte | projection | reconstruction depuis opérations et événements | jamais de mutation de la source |
| proposition ou texte IA non validé | aucune | temporaire ou diagnostic expurgé | aucune mutation métier |

Le noyau stocke les payloads des domaines sans acquérir leur autorité. Il garantit enveloppes, atomicité, ordre et versions; il ne décide ni règle, ni contenu, ni résultat tactique.

### Écart découvert et résolu

L'ancien modèle plaçait transcript et messages visibles dans le commit du tour alors que `scene_writer` intervient après le commit. La résolution retenue est :

- entrée brute durable dans l'opération dès réception;
- actes de parole durables et résultats métier dans le commit;
- prose finale filtrée dans le résultat technique de l'opération;
- `InteractionLog` comme projection reconstructible de ces sources.

Cette séparation permet une question méta sans commit, une reprise avant commit et un fallback post-commit sans seconde mutation métier.

### Résultat du lot 4

- chaque donnée persistante possède une autorité unique ou un statut explicite de projection;
- les treize étapes du parcours vertical traversent le noyau sans lui transférer une décision métier;
- exigences, décisions, contrats et scénarios restent reliés par la matrice de traçabilité;
- aucun nouveau blocage global n'est apparu;
- le lot 5 peut produire la feuille de route et la décision finale d'autorisation.

## Lot 5 — Feuille de route et décision finale

### Vérification non fonctionnelle

- coût fournisseur : mécanisme et budgets techniques définis; montant `balanced` correctement classé avant certification I-08;
- latence : cibles p95 et limites fixées; I-00 ne possède aucun appel distant;
- sécurité : payloads bornés, résultats filtrés, erreurs structurées et secrets exclus du noyau;
- reprise : opération durable, idempotencyKey, issue inconnue, fencing et tests obligatoires;
- migration : versionnement figé, copie obligatoire; adaptateur IndexedDB reporté à I-01;
- capacité : pagination imposée dès I-00, benchmark complet planifié en I-08.

Aucun report de mesure n'est utilisé pour prétendre qu'une capacité non mesurée est validée.

### Feuille de route

[`Plan-implementation-narration.md`](Plan-implementation-narration.md) définit neuf lots :

1. I-00 noyau et repository mémoire;
2. I-01 IndexedDB et migrations;
3. I-02 bootstrap contenu/personnage/règles;
4. I-03 temps, monde et processus;
5. I-04 mémoire, snapshot et contextes;
6. I-05 pipeline IA et créations;
7. I-06 scène, social et UI;
8. I-07 tactique et repos;
9. I-08 certification verticale et non fonctionnelle.

À la clôture de l'audit initial du 2026-07-02, chaque lot possède prérequis, scénarios et gate et seul I-00 est ouvert. L'addendum en fin de document porte l'autorisation courante.

### Décision initiale du 2026-07-02

**AUTORISÉ — lot I-00 uniquement.**

L'autorisation couvre types, schémas, validateurs, `CampaignRepository`, `MemoryCampaignRepository`, utilitaires purs et suite contractuelle de `campaign-core/1`.

Elle n'autorise pas IndexedDB, fournisseur IA, prompt, wiki, personnage, règle métier, UI, carte, tactique, repos ou modification de l'ancienne route `/api/narration`.

### Justification

- ateliers 1 à 12 bouclés;
- contradictions documentaires corrigées;
- questions et reports classés;
- contrat du premier lot `FIGE`;
- autorités et parcours vertical revalidés;
- scénarios et conditions de sortie disponibles;
- aucune question produit globale non résolue.

Le cahier des charges est bouclé au niveau requis pour commencer I-00. Les contrats des capacités suivantes seront figés à leur gate, sans rouvrir les principes déjà retenus.

## Addendum I-01 — Audit AF-R03

L'audit de persistance fixe stores, index, enveloppes physiques, frontières transactionnelles, contrôle multi-onglets, migration par générations, politique de quota et preuves navigateur.

Décision : **AUTORISÉ — lot I-01 uniquement**, après réussite d'I-00. I-02 à I-08 restent fermés.

Les seuils de capacité définitifs restent classés AF-M06 avant certification. Ils ne bloquent pas l'adaptateur, car I-01 doit déjà mesurer, avertir et annuler atomiquement toute écriture non durable.

### Résultat d'I-01

I-01 est livré le 2026-07-03 : les 19 contrats communs et 15 cas IndexedDB passent dans Chrome réel, ainsi que le build global. Cette réussite ne vaut pas ouverture implicite d'I-02; AF-R04 à AF-R07 restent ses prérequis.

## Addendum I-02 — Audit AF-R04 à AF-R07

L'audit du 2026-07-03 confronte les contrats au wiki, au parseur du `map-module`, aux catalogues JSON, à l'éditeur de personnage et au plateau tactique. Il constate un corpus de 26 entités wiki structurées et un document brut, une fiche riche mais non versionnée, des valeurs dérivées calculées à plusieurs endroits et des règles dispersées sans manifeste global.

[`Contrat-bootstrap-campagne.md`](Contrat-bootstrap-campagne.md) fige initialement `campaign-bootstrap/1` : paquet immuable avec empreintes, ingestion wiki stricte et sourcée, import personnage avec recalcul unique et projections, inventaire du `RuleRegistry` MVP, arbitrage ponctuel et intention de transaction atomique.

Décision : **AUTORISÉ — lot I-02 uniquement**. AF-R04 à AF-R07 sont résolus au niveau contractuel. Leur implémentation, la conversion ou l'exclusion explicite de `wiki/lore/gouvernances/primauté`, les fixtures invalides et les preuves NAR-ACC-008/009/021 constituent la gate de fermeture d'I-02. I-03 à I-08 restent fermés.

## Addendum I-02.1 — Atomicité et lore étendu

La revue du 2026-07-06 découvre que `campaign-bootstrap/1` exige un unique commit complet alors que `createCampaign` de `campaign-core/1` autorise uniquement la campagne et son horloge. Une séquence `createCampaign`, puis `commit` rendrait un état partiel observable et contredirait la gate d'I-02.

`campaign-bootstrap/2` corrige la frontière sans modifier `campaign-core/1` : `CampaignBootstrapRepository` crée campagne, opération, agrégats, commit, événements et outbox dans une transaction spécialisée commune aux adaptateurs mémoire et IndexedDB. La campagne finale commence à la révision `1`; aucun état intermédiaire à la révision `0` n'est publié.

La même revue constate que les besoins connus en espèces, cultures, PNJ et histoire doivent être intégrés avant les schémas exécutables. [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md) fige `lore-authoring/1`, sépare catalogues mécaniques, lore initial et état de campagne, et définit des fragments par niveau de connaissance. Les templates quittent la racine `wiki/lore/`.

Décision : **AUTORISÉ — lot I-02 uniquement**, désormais selon `campaign-bootstrap/2` et `lore-authoring/1`. `campaign-bootstrap/1` est remplacé avant implémentation. I-03 à I-08 restent fermés.

## Addendum I-03A — Audit AF-R12

La revue du 2026-07-06 clôt I-02 pour son périmètre narratif avec la réserve documentée de parité directe avec le plateau tactique. Cette réserve reste différée et ne transfère aucune autorité au module narration.

L'audit d'I-03 confirme que `world.clock.elapsedGameSeconds` existe déjà comme horloge atomique du noyau, tandis que `map-module/world-simulation` expose un runtime mutable où `runWorldHours` avance des ticks horaires. Ces ticks ne peuvent pas devenir une seconde horloge de campagne. [`Contrat-temps-processus.md`](Contrat-temps-processus.md) fige donc `temporal-kernel/1`, le curseur dérivé `worldSimulatedThrough`, l'ordre causal et quatre sous-lots séparés.

Décision : **AUTORISÉ — sous-lot I-03A uniquement**. Il couvre types, validateurs et ordonnanceur temporel purs, sans persistance d'échéance et sans appel au `map-module`. I-03B doit figer les agrégats d'échéancier et de processus avant leur première écriture. I-03C doit figer l'adaptateur avant toute avance mondiale intégrée.

## Addendum I-03B — Persistance temporelle

Les agrégats `world.schedule`, `world.simulation-cursor` et `process.state` sont figés par `temporal-kernel/1`. Leur préparation réutilise exclusivement `CampaignRepository.commit`; aucun store ou mécanisme transactionnel parallèle n'est ajouté.

Les contrats mémoire et Chromium vérifient commit conjoint de l'horloge, de l'échéancier et du checkpoint, rejeu idempotent, fermeture/réouverture, panne après événements sans état partiel, empreinte de checkpoint, arithmétique du curseur et cycles d'échéances.

Décision : **I-03B LIVRÉ; I-03C AUTORISÉ** dans la limite de l'adaptateur monde décrit par [`Contrat-temps-processus.md`](Contrat-temps-processus.md). L'adaptateur doit travailler sur une copie, recevoir uniquement un nombre entier positif d'heures dues et retourner des sorties structurées avant tout commit.

## Addendum I-03C — Adaptateur monde

`WorldSimulationPortV1` et `MapModuleWorldSimulationAdapterV1` isolent le runtime carte derrière des snapshots et empreintes. Le moteur réel est exécuté sur une copie; ses sorties restent techniques. Le préparateur temporel recalcule les empreintes et refuse tout résultat qui ne correspond pas au curseur, à la durée ou à la tâche committée.

Les preuves exécutent le scénario réel du moteur pour 1 h et 6 h, comparent deux exécutions, vérifient l'absence de mutation, puis publient état monde, tick, curseur, événement et horloge dans une transaction mémoire et IndexedDB.

Décision : **I-03C LIVRÉ; I-03D AUTORISÉ** pour le processus de voyage et les scénarios NAR-ACC-007/010/020. Cette autorisation ne couvre ni UI, ni tactique, ni création IA de rencontre.

## Addendum I-03D — Voyage segmenté et rencontre déterministe

La revue du 2026-07-07 vérifie le dernier sous-lot I-03 contre NAR-ACC-007, NAR-ACC-010 et NAR-ACC-020. [`Matrice-preuves-I03.md`](Matrice-preuves-I03.md) consigne les preuves exécutables.

Le socle livré ajoute `TravelProcessV1`, `TravelPlanV1`, `TravelSegmentV1`, `TravelCheckpointV1`, une graine de rencontre stable, une pression calculée, une sélection déterministe de candidat structuré et une projection vers `process.state`. Le candidat peut référencer un signal monde, une entité lore ou un archétype autorisé; il ne crée ni PNJ complet, ni scène IA, ni prose.

`prepareTemporalSegmentCommitV1` accepte désormais des écritures d'agrégats additionnelles contrôlées afin que le voyage écrive `world.position` dans la même transaction que l'horloge, le checkpoint, le schedule et l'événement. Les suites mémoire et Chromium vérifient qu'un segment committé puis rejoué retourne le même commit et ne crée pas de seconde rencontre ou second événement.

Décision : **I-03 LIVRÉ dans son périmètre**. Cette fermeture couvre temps, échéances, monde sur copie, processus, voyage et rencontre structurée. Elle n'autorise pas UI, mémoire longue, snapshot, fournisseur IA, création dynamique, repos jouable, tactique ou prose de rencontre.

I-04 reste fermé comme implémentation. Le prochain travail autorisé est l'audit contractuel AF-R08/AF-R09 pour mémoire, snapshot et contextes.

## Addendum I-04 — Audit AF-R08/AF-R09

L'audit du 2026-07-07 confronte [`Memoire-et-rappel.md`](Memoire-et-rappel.md), [`Snapshot-et-contextes.md`](Snapshot-et-contextes.md), les scénarios NAR-ACC-004/005/015 et la partie perspective de NAR-ACC-006 aux capacités déjà livrées par I-00 à I-03.

Le risque principal est de créer une deuxième vérité sous forme de résumé, d'index ou de contexte IA. [`Contrat-memoire-snapshot.md`](Contrat-memoire-snapshot.md) fige donc `memory-context/1` : sources autoritaires référencées, `MemoryUnitV1`, index reconstruisibles, requête de rappel, capsule sourcée, `TurnSnapshotV1`, `RoleContextPackV1`, budget, trace et obsolescence.

Décision : **AUTORISÉ — lot I-04 uniquement**. L'autorisation couvre types, validateurs, ports mémoire/snapshot/contexte, fixtures déterministes et tests de rappel/budget/secret/obsolescence. Elle n'autorise pas fournisseur IA réel, UI narrative, embeddings distants obligatoires, création dynamique, tactique ou repos.

Fermeture : **I-04 LIVRÉ** le 2026-07-07. [`Matrice-preuves-I04.md`](Matrice-preuves-I04.md) couvre mémoire sourcée, index reconstruisible, rappel NAR-ACC-004/005, secret NAR-ACC-006, snapshot, paquet de contexte, budget NAR-ACC-015, obsolescence, régressions I-00 à I-03, IndexedDB et build global. I-05 reste fermé jusqu'à audit pipeline IA/créations.

## Addendum I-05 — Audit AF-R10/AF-R11/AF-R15/AF-C02

L'audit du 2026-07-07 confronte [`Pipeline-et-contrats-IA.md`](Pipeline-et-contrats-IA.md), [`Creations-dynamiques.md`](Creations-dynamiques.md), [`Resilience-securite-diagnostic.md`](Resilience-securite-diagnostic.md), [`Coherence-intrigues.md`](Coherence-intrigues.md) et les scénarios NAR-ACC-001/003/006/014/016/019 au socle I-00 à I-04.

Le risque principal est de brancher trop tôt un fournisseur réel et de confondre sortie IA, proposition, validation, commit et texte visible. [`Contrat-pipeline-ia-creations.md`](Contrat-pipeline-ia-creations.md) fige donc `ai-pipeline/1` : routes de rôle, faux fournisseur contractuel, enveloppes strictes, payloads par rôle, propositions de création, retry, incidents expurgés et preuves avant certification fournisseur.

Décision : **AUTORISÉ — sous-lot I-05A uniquement**. L'autorisation couvre types, validateurs, ports, faux fournisseur déterministe, fixtures et tests du pipeline IA sans fournisseur réel. Elle n'autorise pas clé fournisseur, UI conversationnelle, génération distante, création d'intrigue jouable complète, tactique, repos ou certification qualitative finale.

Fermeture : **I-05A LIVRÉ** le 2026-07-07. [`Matrice-preuves-I05.md`](Matrice-preuves-I05.md) couvre enveloppes strictes, faux fournisseur, correction bornée, incident expurgé, circuit breaker par rôle, NAR-ACC-001, NAR-ACC-003, NAR-ACC-014, NAR-ACC-016, NAR-ACC-019 et perspective NAR-ACC-006 au niveau contractuel. I-05B fournisseur réel reste fermé jusqu'à certification dédiée.

## Addendum I-05B — Audit fournisseur OpenAI

L'audit du 2026-07-07 confronte I-05A, [`Resilience-securite-diagnostic.md`](Resilience-securite-diagnostic.md), [`Exigences-non-fonctionnelles.md`](Exigences-non-fonctionnelles.md), l'état actuel de `server.js` et la documentation officielle OpenAI Responses/Structured Outputs.

Le risque principal est de réutiliser les routes historiques `/api/narration` ou `/api/enemy-ai` comme socle du module narration alors qu'elles utilisent Chat Completions, CORS permissif, JSON object non strict et un comportement de fallback conçu pour le tactique historique. [`Contrat-fournisseur-ia-openai.md`](Contrat-fournisseur-ia-openai.md) fige donc `ai-provider-openai/1` : fournisseur OpenAI côté serveur, Responses API, schéma strict, opt-in live, métriques, incidents expurgés, absence de clé côté navigateur et tests réseau simulés.

Décision : **AUTORISÉ — sous-lot I-05B uniquement**. L'autorisation couvre adaptateur serveur OpenAI, loader de clé sécurisé, schémas stricts, transport simulable, tests sans réseau et smoke test live optionnel. Elle n'autorise pas UI narrative, streaming, outils OpenAI, web search, stockage de prompts bruts, fallback multi-fournisseur ou certification qualitative finale.

Fermeture : **I-05B LIVRÉ** le 2026-07-07. [`Matrice-preuves-I05B.md`](Matrice-preuves-I05B.md) couvre clé serveur, `.env` ignoré, Responses API, schéma strict, HTTP simulé, expurgation, métriques, sortie valide/invalide, smoke live opt-in et régressions. I-06 scène/social/UI reste fermé jusqu'à contrat dédié.

## Addendum I-06A — Audit scène, social et interface conversationnelle

L'audit du 2026-07-07 confronte [`Dossier-de-conception.md`](Dossier-de-conception.md), [`Modele-persistant.md`](Modele-persistant.md), [`Pipeline-et-contrats-IA.md`](Pipeline-et-contrats-IA.md), [`Integration-domaines.md`](Integration-domaines.md) et les scénarios NAR-ACC-002 checkpoint B, NAR-ACC-009 et NAR-ACC-017.

Le risque principal est de laisser l'UI devenir une vérité implicite : une prose séduisante, un transcript cache ou une bulle de dialogue mal attribuée pourrait faire croire à un fait, une parole ou une connaissance non validés. [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md) fige donc `scene-social-ui/1` : scène, connaissances sociales, actes de parole, `RenderPlan`, `DisplayPacket`, `InteractionLog` reconstructible, attribution accessible, clarification et rythme configurable.

Décision : **AUTORISÉ — sous-lot I-06A uniquement**. L'autorisation couvre types, validateurs, projections déterministes, politiques de rythme, fixtures et tests. Elle n'autorise pas intégration React complète, streaming fournisseur, routage UI vers OpenAI, tactique, repos ou certification UX finale.

Fermeture : **I-06A LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06A.md`](Matrice-preuves-I06A.md) couvre types, validateurs, blocs exacts, attribution accessible, reconstruction d'`InteractionLog`, clarification sans temps, rythme configurable, NAR-ACC-017, NAR-ACC-009 et rendu dégradé. I-06B UI narrative complète reste fermé jusqu'à audit dédié.

## Addendum I-06B — Audit interface narrative React

L'audit du 2026-07-07 confronte I-06A, l'état actuel de `GameBoard.tsx`, `src/narrationClient.ts`, `src/narrationTypes.ts` et les routes historiques `/api/narration`, `/api/enemy-ai`, `/api/enemy-speech`.

Le constat est que `GameBoard.tsx` et l'UI narration existante appartiennent au tactique historique : panneau de récapitulatif de round, bulles ennemies et appels aux routes Chat Completions. Ils ne peuvent pas devenir la surface du runtime narratif de campagne. La narration doit disposer d'un point d'entrée applicatif dédié et communiquer avec le tactique uniquement par handoff contractuel ultérieur.

[`Contrat-interface-narrative-react.md`](Contrat-interface-narrative-react.md) fige donc `narrative-react-ui/1` : composants React purs, affichage de `DisplayPacketV1`, saisie libre remontée par callback, `clientRequestId`, labels accessibles et interdiction d'appel fournisseur ou stockage local dans le composant.

Décision : **AUTORISÉ — sous-lot I-06B uniquement**. L'autorisation couvre composants UI purs, rendu statique, soumission callback et tests anti-réseau. Elle n'autorise pas branchement dans `GameBoard.tsx`, appel OpenAI, utilisation de `/api/narration` historique, persistance du transcript en `localStorage`, tactique, repos ou orchestrateur serveur complet.

Fermeture : **I-06B LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06B.md`](Matrice-preuves-I06B.md) couvre composant React pur, rendu multi-locuteurs accessible, saisie libre callback, `clientRequestId`, absence d'appel réseau, absence de stockage local et absence de réutilisation des routes tactiques historiques. I-06C branchement applicatif reste fermé jusqu'à audit dédié.

## Addendum I-06C — Audit surface narration applicative

L'audit du 2026-07-07 acte la séparation demandée : `GameBoard.tsx` contient la partie tactique et ne doit pas recevoir le runtime narration.

[`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md) fige donc `narrative-app-surface/1` : un shell React distingue surface narration et surface tactique, `GameBoard.tsx` reste monté seulement côté tactique, et la surface narration affiche des `DisplayPacketV1` sans réseau, stockage local ou route IA historique.

Décision : **AUTORISÉ — sous-lot I-06C uniquement**. L'autorisation couvre `App.tsx`, une surface narration dédiée, un contrôleur UI local de prototype et des tests statiques de séparation. Elle n'autorise pas orchestrateur narratif réel, appel fournisseur, handoff tactique, persistance transcript ou mutation de campagne.

Fermeture : **I-06C LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06C.md`](Matrice-preuves-I06C.md) couvre shell applicatif, surface narration dédiée, séparation de `GameBoard.tsx`, absence d'appel réseau et absence de stockage local dans la surface narration. I-06D orchestrateur narratif applicatif reste fermé jusqu'à audit dédié.

## Addendum I-06D — Audit contrôleur de tour narratif applicatif

L'audit du 2026-07-07 limite volontairement le premier contrôleur applicatif à une preuve de chaîne sûre. [`Contrat-controleur-tour-narratif.md`](Contrat-controleur-tour-narratif.md) fige `narrative-turn-controller/1` : saisie libre, opération durable, complétion `NO_COMMIT_RESPONSE`, `DisplayPacketV1`, idempotence et horloge inchangée.

Décision : **AUTORISÉ — sous-lot I-06D uniquement**. L'autorisation couvre contrôleur TypeScript pur, campagne prototype en mémoire, réception idempotente, affichage de réception et intégration à la surface narration. Elle n'autorise pas appel IA, interprétation d'intention, commit métier, temps, tactique, repos, IndexedDB ou route HTTP.

Fermeture : **I-06D LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06D.md`](Matrice-preuves-I06D.md) couvre opération durable, `NO_COMMIT_RESPONSE`, `DisplayPacketV1`, idempotence, conflit d'idempotence et horloge inchangée. I-06E interprétation et clarification réelles reste fermé jusqu'à audit dédié.

## Addendum I-06E — Audit interprétation et clarification

L'audit du 2026-07-07 reprend les risques des ateliers de saisie libre : une question de possibilité ne doit jamais devenir une action, une question méta ne doit pas faire avancer le temps, et une ambiguïté d'engagement doit suspendre l'intention sans mutation.

[`Contrat-interpretation-clarification.md`](Contrat-interpretation-clarification.md) fige `intent-clarification/1` : interprétation conservatrice, méta, question de possibilité, ambiguïté, clarification suspendue et reprise liée à l'intention initiale.

Décision : **AUTORISÉ — sous-lot I-06E uniquement**. L'autorisation couvre types d'intention, interprète déterministe, clarification, reprise contrôlée et intégration au contrôleur prototype. Elle n'autorise pas appel IA, résolution métier, commit, temps, création dynamique, tactique ou reformulation théâtrale complète.

Fermeture : **I-06E LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06E.md`](Matrice-preuves-I06E.md) couvre méta sans temps, possibilité sans action, ambiguïté avec clarification, suspension, reprise et action détectée non résolue. I-06F résolution narrative réelle reste fermé jusqu'à audit dédié.

## Addendum I-06F — Audit résolution narrative bornée

L'audit du 2026-07-07 traite la première frontière où une intention joueur peut produire autre chose qu'une réception ou une clarification. Le risque principal est de réintroduire exactement les erreurs des essais précédents : texte visible pris comme vérité, IA qui décide une action non demandée, reformulation qui change l'intention, création persistante non validée ou résultat mécanique inventé dans la prose.

[`Contrat-resolution-narrative.md`](Contrat-resolution-narrative.md) fige `narrative-resolution/1` : ordre strict du tour, reformulation fidèle du PJ, séparation entre proposition, validation, commit et rendu, limites de création IA, temps nul pour méta/possibilité/clarification et handoffs obligatoires vers tactique, repos, règles, inventaire, monde ou promotion de création.

Décision : **AUTORISÉ — sous-lot I-06F uniquement**. L'autorisation couvre la résolution narrative bornée et ses tests de frontière. Elle n'autorise pas MJ complet, streaming fournisseur, tactique jouable, repos jouable, progression de personnage, économie complète, création persistante automatique, intrigue dynamique committable ou certification UX finale.

Fermeture : **I-06F LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06F.md`](Matrice-preuves-I06F.md) couvre sortie structurée, possibilité sans action, handoff inventaire, handoff tactique, parole committée avant rendu, reformulation fidèle, idempotence, conflit d'idempotence et horloge inchangée. I-07 tactique/repos reste fermé jusqu'à audit dédié.

## Addendum I-06G — Audit résolution IA bornée

L'audit du 2026-07-07 constate qu'I-06F sécurise la résolution, mais que le rendu reste encore trop mécanique. Le besoin produit est d'obtenir une narration plus belle sans ouvrir les domaines tactique, repos, inventaire ou création persistante.

[`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md) fige `narrative-ai-resolution/1` : les rôles `player_expression_adapter` et `scene_writer` peuvent enrichir le `DisplayPacketV1` après résolution, sans modifier `resultKind`, `commitId`, handoff, événements, agrégats ou horloge.

Décision : **AUTORISÉ — sous-lot I-06G uniquement**. L'autorisation couvre l'embellissement IA, le rejet de sorties dangereuses, le fallback déterministe et les incidents expurgés. Elle n'autorise pas MJ planner, NPC performer, rules adjudicator, streaming, branchement OpenAI UI, tactique, repos ou création persistante.

Fermeture : **I-06G LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06G.md`](Matrice-preuves-I06G.md) couvre expression PJ enrichie, rejet d'ajout de sens, narration MJ ancrée, handoff tactique vivant sans combat simulé et fallback déterministe.

## Addendum I-06H — Branchement UI et OpenAI controle

Le sous-lot I-06H applique la demande de brancher les deux axes sans les confondre : l'UI prototype recoit l'enrichissement IA via le faux fournisseur contractuel, tandis que l'adaptateur OpenAI devient compatible avec le port `ContractAiProviderV1` cote serveur/tests.

Décision : **AUTORISÉ ET LIVRÉ — sous-lot I-06H uniquement**. L'autorisation couvre le branchement UI prototype et le wrapper OpenAI contrôlé. Elle n'autorise pas appel OpenAI live depuis le navigateur, route HTTP narrative de production, streaming, choix dynamique de modèle, benchmark qualité/coût ou certification finale.

Fermeture : **I-06H LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06H.md`](Matrice-preuves-I06H.md) couvre UI enrichie, absence d'OpenAI navigateur, compatibilité OpenAI avec le port IA, Structured Outputs stricts, clé absente sans réseau et build global.

## Addendum I-06I — Route serveur OpenAI narrative opt-in

Le sous-lot I-06I ajoute la route serveur qui manquait pour utiliser OpenAI réellement sans exposer la cle au navigateur. La route est volontairement limitée aux deux rôles d'enrichissement I-06G et reste désactivée tant que `NARRATION_OPENAI_LIVE=1` n'est pas fourni.

Décision : **AUTORISÉ ET LIVRÉ — sous-lot I-06I uniquement**. L'autorisation couvre `POST /api/narration/enhance-openai`, validation des rôles, Structured Outputs stricts, absence d'appel sans opt-in ou clé, et tests réseau simulés. Elle n'autorise pas streaming, activation UI automatique, persistance incidents/projections, benchmark qualité/coût ou certification finale.

Fermeture : **I-06I LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06I.md`](Matrice-preuves-I06I.md) couvre route serveur, opt-in, clé absente sans réseau, rôles bornés, `text.format` `json_schema` strict, `store=false`, corrélation stricte et UI toujours séparée.

## Addendum I-06J — Bascule UI OpenAI opt-in

Le sous-lot I-06J ajoute le contrôle utilisateur qui rend la capacité compréhensible dans l'interface : le joueur ou développeur peut choisir entre enrichissement local et OpenAI. La bascule ne donne aucune clé au navigateur et n'appelle jamais OpenAI directement.

Décision : **AUTORISÉ ET LIVRÉ — sous-lot I-06J uniquement**. L'autorisation couvre le sélecteur UI, le client vers `/api/narration/enhance-openai`, le fallback local et les tests source. Elle n'autorise pas streaming, persistance du choix, affichage détaillé des incidents, benchmark qualité/coût ou rôles IA plus puissants.

Fermeture : **I-06J LIVRÉ** le 2026-07-07. [`Matrice-preuves-I06J.md`](Matrice-preuves-I06J.md) couvre UI Locale/OpenAI, appel serveur dédié, absence d'OpenAI navigateur, fallback local et route serveur toujours protégée.
