# Audit final du module narration

Statut : `RETENU` — audit initial terminé; addendum du 2026-07-06 maintenant l'autorisation limitée à I-02 après remplacement de `campaign-bootstrap/1` par `campaign-bootstrap/2` et gel de `lore-authoring/1`.

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
