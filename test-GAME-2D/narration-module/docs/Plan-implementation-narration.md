# Plan d'implémentation du module narration

Statut : `EN_EXECUTION` — I-00 à I-02 livrés; I-02 conserve une réserve tactique différée; I-03A est ouvert par `temporal-kernel/1`; I-03B à I-08 restent fermés jusqu'à leurs gates.

## Principes d'exécution

- Un seul lot est ouvert à la fois.
- Chaque lot commence par résoudre ses lignes `AF-R` dans [`Audit-final.md`](Audit-final.md).
- Une capacité n'entre pas au lot précédent sous forme de stub devenu implicitement contractuel.
- Chaque mutation reste derrière le domaine propriétaire et `CampaignRepository`.
- Les tests déterministes précèdent le branchement d'un fournisseur IA.
- Un lot ne passe au suivant qu'après ses commandes de vérification, scénarios associés, revue du diff et mise à jour de `TASKS.md`.

## I-00 — Noyau `campaign-core/1`

Statut : `TERMINE` le 2026-07-02.

### Objectif

Implémenter exactement [`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md) sans comportement narratif.

### Périmètre prévu

```text
narration-module/
  src/core/
    contracts/
    validation/
    repository/
    canonical-json/
  tests/contracts/
  tsconfig.json
```

Le détail final des fichiers peut suivre les conventions TypeScript, mais les responsabilités ne doivent pas rejoindre `GameBoard.tsx`, `server.js` ou l'UI.

### Choix techniques autorisés

- TypeScript strict;
- AJV déjà présent pour les schémas JSON stricts;
- schémas associés à des types via `JSONSchemaType<T>` ou contrôle équivalent compilé;
- `node:assert/strict` dans un script TypeScript lancé avec la convention `tsx` existante;
- horloge technique, générateur d'identifiants et injection de panne remplaçables dans les tests.

Aucune nouvelle dépendance n'est nécessaire sans preuve d'un manque d'AJV ou des outils présents.

### Scripts à rendre réels

- `narration-module:build` : vérification TypeScript du module;
- `narration-module:test:contracts` : suite commune contre `MemoryCampaignRepository`;
- `narration-module:test:unit` : seulement si des tests unitaires distincts deviennent utiles;
- le `build` global doit inclure le contrôle du nouveau noyau avant de considérer le lot terminé.

### Gate de sortie

- 19 tests contractuels du contrat figé;
- schémas stricts refusant champs inconnus et dépassements de taille;
- aucune dépendance à React, OpenAI, IndexedDB ou aux moteurs;
- aucune modification de l'ancienne route tactique;
- `npm run narration-module:build`, `npm run narration-module:test:contracts` et `npm run build` passent.

### Preuves de livraison

- types stricts, schémas AJV et 31 contrôles compilés de parité structurelle;
- `CampaignRepository` et `MemoryCampaignRepository` sans dépendance applicative;
- 19/19 scénarios contractuels réussis;
- build TypeScript du module et build global réussis;
- revue de périmètre sans React, OpenAI, IndexedDB, carte, tactique ou ancienne route narrative.

## I-01 — Persistance navigateur et migrations

Statut : `TERMINE` le 2026-07-03.

### Objectif

Implémenter `IndexedDbCampaignRepository` derrière la même suite contractuelle, sans changer le contrat métier.

### Prérequis

AF-R03 résolu par [`Contrat-persistance-indexeddb.md`](Contrat-persistance-indexeddb.md) : schéma physique des stores, transactions, générations, migrations, quota et tests navigateur figés.

### Scénarios

NAR-ACC-013, NAR-ACC-018 et parties persistance de NFR-ACC-001.

### Gate

La suite contractuelle passe sans variante spécifique permissive; fermeture, issue inconnue, migration et lecture seule sont vérifiées dans un navigateur cible.

### Preuves de livraison

- `IndexedDbCampaignRepository` derrière le port I-00 et IndexedDB natif;
- 12 stores, index de lecture et de copie bornée, transactions courtes et contrôle multi-connexion;
- migration par générations avec lease renouvelable, empreinte, vérification post-activation, rollback et sauvegarde confirmable;
- 19/19 contrats communs dans Chrome et 15/15 scénarios IndexedDB spécifiques;
- fermeture, issue inconnue, version future, `versionchange`, quota, ancienne connexion et lecture seule vérifiés;
- `npm run narration-module:build`, `npm run narration-module:test:contracts`, `npm run narration-module:test:indexeddb` et `npm run build` réussis.

## I-02 — Bootstrap de campagne, contenu, personnage et règles

Statut : `EN VERIFICATION` le 2026-07-06; contrats lore, import, règles, persistance atomique et orchestration implémentés. La matrice de preuves couvre 13 exigences sur 14; la parité directe avec le plateau reste explicitement différée avec sa jonction.

### Objectif

Créer une campagne réelle depuis le wiki épinglé, une fiche importée et un ruleset maison versionné.

### Prérequis

Résolus par [`Contrat-bootstrap-campagne.md`](Contrat-bootstrap-campagne.md) et [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md) : AF-R04 à AF-R07, soit écriture atomique spécialisée, paquets de contenu, schéma wiki, import personnage et `RuleRegistry` MVP.

### Scénarios

Checkpoint A de NAR-ACC-002, NAR-ACC-008, NAR-ACC-009 et NAR-ACC-021.

### Gate

Les Archives de Lysenthe et la fiche prête à jouer sont importées sans lecture directe des caches UI; toute donnée dérivée est recalculée et toute règle cite sa version.

## I-03 — Temps, monde et processus

Statut : `EN COURS` le 2026-07-06; I-03A, I-03B et I-03C implémentés, I-03D prochain sous-lot. Le découpage est figé dans [`Contrat-temps-processus.md`](Contrat-temps-processus.md) et la reprise détaillée dans [`Handoff-I03D.md`](Handoff-I03D.md).

### Objectif

Connecter horloge précise, échéancier causal, voyage et processus sauvegardables au `map-module` sans seconde horloge.

### Prérequis

AF-R12 et contrats de processus communs nécessaires à AF-R14.

### Scénarios

NAR-ACC-007, NAR-ACC-010, NAR-ACC-020 et exemple de chronologie causale.

### Gate

Ordre simultané, interruption, rattrapage et rejeu d'un batch produisent les mêmes événements sans double effet.

## I-04 — Mémoire, snapshot et contextes

### Objectif

Construire rappel hybride, `TurnSnapshot` et `RoleContextPack` sans fournisseur IA réel.

### Prérequis

AF-R08, AF-R09 et choix locaux initiaux de AF-M03.

### Scénarios

NAR-ACC-004, NAR-ACC-005, NAR-ACC-015 et partie perspective de NAR-ACC-006.

### Gate

Rappel paraphrasé, secret, provenance, budget et obsolescence passent sur fixtures; index supprimé puis reconstruit sans perte de vérité.

## I-05 — Pipeline IA et créations dynamiques

### Objectif

Implémenter les rôles avec un faux fournisseur contractuel, puis brancher un adaptateur réel certifiable.

### Prérequis

AF-R10, AF-R11, AF-R15 et décisions AF-C02; aucune clé dans le navigateur.

### Scénarios

NAR-ACC-001, NAR-ACC-003, NAR-ACC-006, NAR-ACC-014, NAR-ACC-016 et NAR-ACC-019.

### Gate

Les tests déterministes passent avec faux fournisseur; sorties invalides, retries, secrets, circuit et fallback passent avant toute certification qualitative réelle.

## I-06 — Scène, social et interface conversationnelle

### Objectif

Assembler opérations, actes de parole, prose finale et `InteractionLog` dans une UI accessible à plusieurs locuteurs.

### Prérequis

AF-R16 et schémas de `SceneDomain`/`SocialKnowledgeDomain` propres au lot.

### Scénarios

Checkpoint B de NAR-ACC-002, NAR-ACC-009 et NAR-ACC-017.

### Gate

Entrée brute, expression du PJ, PNJ et narration restent distincts; aucune couleur n'est l'unique repère; la perte du cache de transcript est reconstructible.

## I-07 — Tactique et repos

### Objectif

Réaliser les handoffs sauvegardables et intégrer leurs résultats une seule fois.

### Prérequis

AF-R13, AF-R14 et décision explicite sur l'ancienne route `/api/narration`.

### Scénarios

NAR-ACC-011, NAR-ACC-012 et checkpoints C/D de NAR-ACC-002.

### Gate

Combat terminé non rejouable, conséquences atomiques, repos segmenté et signaux UI issus uniquement des événements committés.

## I-08 — Certification verticale et non fonctionnelle

### Objectif

Exécuter le corpus intégré, le benchmark long et les évaluations fournisseur/UX.

### Prérequis

AF-M01 à AF-M06 résolus ou écart explicitement refusé. NFR-ACC-001 exécutable.

### Scénarios

NAR-ACC-001 à 021, NFR-ACC-001 et parcours complet NAR-ACC-002.

### Gate

Seuils de latence, qualité, coût, mémoire, stockage et sécurité mesurés; aucune tolérance zéro violée; rapport de certification conservé.

## Ordre de dépendance

```text
I-00 -> I-01 -> I-02
                  |-> I-03 -|
                  |-> I-04 -|-> I-05 -> I-06 -> I-07 -> I-08
```

I-03 et I-04 peuvent être préparés indépendamment après I-02, mais aucune intégration concurrente dans la même branche n'est requise. Le passage au lot suivant reste séquentiel dans `TASKS.md`.

## Autorisation actuelle

I-00 à I-02 sont terminés dans leur périmètre déclaré. I-03A à I-03C sont livrés; I-03D est autorisé. I-04 à I-08 restent fermés jusqu'à leurs contrats et gates.
