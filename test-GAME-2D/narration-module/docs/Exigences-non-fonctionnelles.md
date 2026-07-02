# Exigences non fonctionnelles du module narration

Statut : `RETENU` — atelier 11 bouclé; valeurs provisoires à confirmer par benchmark avant implémentation finale.

## Objectif

Rendre performance, coût, qualité et capacité vérifiables sans affaiblir les garanties d'autorité, de cohérence ou de sécurité.

Les valeurs initiales sont des cibles de conception. Un benchmark sur les modèles et machines réellement retenus devra les confirmer ou documenter leur révision avant de figer le contrat d'implémentation.

## Mesure d'un tour

La latence d'un tour n'est pas une durée unique. Les horodatages suivants sont distingués :

- `acceptedAt` : entrée acceptée par l'interface;
- `acknowledgedAt` : accusé visuel;
- `preparedAt` : intention, recherches et snapshot prêts;
- `committedAt` : décision métier committée, lorsqu'une mutation existe;
- `renderedAt` : sortie finale validée et affichable.

Les métriques séparent au minimum préparation déterministe, appels IA par rôle, validations, attente fournisseur, commit et rendu. Moyenne seule interdite : médiane, p95, maximum et taux de dépassement sont conservés.

## Cibles initiales de latence

| Classe | Cible p95 | Limite de l'opération |
|---|---:|---:|
| Accusé visuel | 300 ms | 1 s |
| Opération locale déterministe | 1 s | 3 s |
| Tour narratif standard | 40 s | 90 s |
| Tour complexe avec plusieurs rôles | 75 s | 120 s |
| Clarification bloquante | 20 s | 60 s |

La classe d'un tour est déterminée avant mesure à partir du pipeline réellement déclenché. Elle ne peut pas être requalifiée après coup pour masquer un dépassement.

Atteindre la cible p95 est un objectif de service. La dépasser déclenche un retour d'attente et une métrique, pas l'abandon automatique. La limite maximale déclenche la politique de timeout, suspension ou fallback définie par le rôle.

## Expérience pendant l'attente

L'interface accuse immédiatement la demande puis expose uniquement une étape compréhensible, par exemple analyse de l'intention, recherche de souvenirs, résolution des conséquences ou mise en scène.

Elle n'affiche ni raisonnement interne, ni prompt, ni narration non validée. Une progression indéterminée est préférée à un pourcentage inventé lorsque le nombre ou la durée des étapes ne sont pas connus.

## Intégrité et optimisation

Les objectifs de latence ne permettent jamais de :

- retirer une contrainte ou une validation;
- envoyer un contexte obligatoire incomplet;
- afficher une sortie avant contrôle des révélations;
- transformer un timeout en succès;
- rejouer une mutation déjà committée.

Les appels réellement indépendants peuvent être parallélisés. Leur résultat reste rattaché au même snapshot et devient obsolète si une dépendance change.

Une annulation utilisateur est possible avant commit selon l'état de l'opération. Après commit, l'action demeure acquise; une panne de rédaction produit le rendu déterministe sécurisé et ne relance pas le métier.

## Enveloppes initiales de contexte

Ces valeurs constituent un profil de départ pour un modèle offrant au moins 32 000 tokens de contexte. Elles sont configurables par modèle et devront être équilibrées par benchmark.

| Rôle | Entrée maximale | Sortie maximale |
|---|---:|---:|
| `intent_interpreter` | 6 000 | 800 |
| `mj_planner` | 18 000 | 2 200 |
| `player_expression_adapter` | 6 000 | 700 |
| `npc_performer` | 10 000 | 1 200 |
| `coherence_critic` | 16 000 | 1 200 |
| `rules_adjudicator` | 12 000 | 1 200 |
| `scene_writer` | 14 000 | 1 800 |

Le plafond cumulé d'un tour standard est de 60 000 tokens d'entrée et 8 000 de sortie. Celui d'un tour complexe est de 120 000 tokens d'entrée et 16 000 de sortie. Corrections, retries et multiplicité des PNJ consomment la même enveloppe; ils ne créent pas un budget implicite supplémentaire.

Ces maxima ne sont pas des objectifs de consommation. Sélection ciblée, projections, déduplication, appels conditionnels et réutilisation sûre doivent réduire la consommation réelle.

## Réduction et dépassement

Chaque appel réserve sa sortie et une marge technique avant de constituer son entrée. En cas de pression, l'orchestrateur retire d'abord décoration, souvenirs secondaires et répétitions selon l'ordre contractuel du rôle.

Règles, invariants, faits obligatoires, engagements applicables et protections de secrets ne sont jamais tronqués. Si ce socle dépasse l'enveloppe, l'opération échoue explicitement, découpe une tâche autorisée ou sollicite une clarification.

Consommations estimée et réelle sont conservées par opération, rôle, tentative et modèle. La classe standard ou complexe est fixée avant exécution comme pour la latence.

## Contrôle financier

Le système estime le coût avant chaque appel, enregistre le coût réel après réponse et applique des plafonds configurables par tour et par session. Un avertissement précède le plafond de session; son dépassement suspend les nouveaux appels payants sans transformer une opération incomplète en succès.

Les montants du profil `balanced` restent volontairement ouverts jusqu'au choix des fournisseurs, modèles et hypothèses de session. Ce report est accepté pour la conception, mais devient une condition bloquante avant implémentation finale : un benchmark représentatif doit fixer coût moyen, p95 et plafond dur.

## Qualité et corpus de mesure

Les métriques de qualité s'appliquent à un corpus stable, annoté et versionné. Chaque résultat conserve versions de modèles, règles, contrats, corpus et paramètres. Une moyenne ne peut pas masquer une violation d'autorité ou de sécurité.

Le critique IA peut produire un signal complémentaire, mais il n'est jamais l'unique évaluateur de la chaîne qui l'emploie. Les critères combinent validateurs déterministes, assertions sur l'état, annotations attendues et revue humaine.

### Violations à tolérance zéro

Sur le corpus d'acceptation, un seul cas invalide l'exécution concernée :

- fuite d'un secret;
- mutation sans autorité;
- altération de l'intention ou de l'agence du joueur;
- exécution d'une action alors que le joueur posait une question hypothétique;
- contradiction committée avec un fait autoritaire;
- omission d'un souvenir critique marqué obligatoire;
- injection d'une information inconnue de la perspective active.

Ces résultats ne deviennent pas acceptables avec l'augmentation du nombre de tests.

### Fiabilité des sorties structurées

| Mesure | Seuil initial |
|---|---:|
| Sortie conforme dès le premier appel | au moins 97 % |
| Sortie valide après correction bornée | au moins 99,5 % |
| Opération abandonnée pour sortie invalide | moins de 0,5 % |
| Échec visible par le joueur, toutes causes IA | moins de 1 % des tours |

Les taux distinguent erreur de schéma, référence invalide, contradiction sémantique, sécurité et indisponibilité fournisseur.

### Qualité du rappel

| Mesure sur requêtes annotées | Seuil initial |
|---|---:|
| Fait explicitement demandé et accessible | 100 % |
| Rappel des éléments pertinents dans la sélection | au moins 90 % |
| Précision des éléments injectés dans le contexte | au moins 80 % |
| Mémoire obsolète présentée comme actuelle | 0 |
| Information interdite à la perspective | 0 |

Un fait critique absent est une violation, même si le taux global de rappel reste supérieur à 90 %.

### Intention et reformulation

| Mesure | Seuil initial |
|---|---:|
| Classification action, question ou méta | au moins 98 % |
| Ambiguïté à risque correctement suspendue | 100 % |
| Reformulation jugée fidèle | au moins 95 % |
| Ajout de consentement, objectif ou risque | 0 |

### Évaluation narrative

Une revue humaine note cohérence, pertinence, voix des personnages et lisibilité sur cinq : moyenne minimale 4/5 et aucune dimension sous 3/5.

Moins de 5 % des tours peuvent être signalés pour répétition gênante. Une répétition quasi identique sur deux tours consécutifs n'est jamais acceptée. Les détecteurs automatiques signalent les candidats; la décision qualitative reste traçable et revue sur le corpus.

## Capacité minimale d'une campagne

Le benchmark de référence construit au minimum :

- 10 000 tours joueur;
- 2 000 scènes;
- 2 000 PNJ narratifs persistants;
- 1 000 lieux connus ou créés;
- 200 000 événements métier;
- 50 000 unités de mémoire;
- 500 Mo de données hors médias.

Ces volumes éprouvent stockage et recherche. Ils ne deviennent jamais le contenu d'un paquet IA unique.

À ce volume, l'ouverture de campagne vise un p95 inférieur à 3 secondes, la recherche structurée ou textuelle 500 ms, la recherche sémantique locale 2 secondes et la construction du snapshot 2 secondes.

Aucune opération courante ne parcourt l'historique complet. Les textes anciens restent archivables et consultables à la demande. Index, résumés et projections peuvent être reconstruits sans supprimer les faits ou événements autoritaires.

## Stockage local et seuil de changement

IndexedDB reste la cible du prototype si le benchmark précédent passe. L'application demande le stockage persistant lorsque disponible, suit quota et consommation, avertit à 70 % et refuse proprement une écriture dont la durabilité ne peut plus être garantie.

Des exports de sauvegarde sont proposés régulièrement. SQLite devient la cible lorsque le benchmark échoue durablement, qu'un runtime local devient l'autorité persistante ou qu'un besoin incompatible avec le stockage navigateur est accepté. Le changement n'est pas déclenché par préférence technique seule.

## Compatibilité et migrations

Chaque version publiée du schéma possède un chemin documenté vers la version courante, direct ou par étapes. Une migration :

1. valide la source;
2. opère sur une copie;
3. applique des étapes versionnées et idempotentes;
4. valide invariants, références et checksums;
5. bascule le pointeur actif seulement après succès;
6. conserve l'ancienne copie jusqu'à confirmation.

Cette restauration technique protège contre une migration défectueuse; elle ne constitue pas un retour narratif accessible au joueur.

Une sauvegarde issue d'une version future n'est jamais rétrogradée silencieusement. Elle est refusée avec diagnostic ou ouverte en consultation si son enveloppe permet une lecture sûre.

## Export de campagne

L'archive exportée contient manifeste, version de schéma, état, événements, checkpoints, versions de règles, références de contenu et checksums. Elle exclut clés fournisseur, secrets techniques, caches reconstructibles inutiles et traces détaillées non explicitement demandées.

Import et migration sont transactionnels du point de vue de la campagne active : une archive partielle, corrompue ou incompatible ne remplace jamais l'état courant.

## Benchmark de clôture

Le test non fonctionnel construit la campagne synthétique cible, mesure recherches et tours, interrompt brutalement l'application, reprend les opérations, exporte, importe puis migre une version antérieure. Il vérifie absence de perte, duplication, parcours global sur le chemin critique et fuite dans l'archive.

## Points restant à fixer

- équilibrage final des enveloppes et plafonds financiers du profil `balanced`;
- calibration des seuils de qualité sur le corpus réel;
- confirmation des valeurs provisoires par benchmark sur l'environnement retenu;
- protocole de benchmark et seuils de validation.
