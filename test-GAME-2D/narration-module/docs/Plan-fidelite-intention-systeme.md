# Plan de fidélité entre intention joueur et système

Date : 2026-07-17

Statut : `RETENU_A_IMPLEMENTER`

## Objet

Ce document est la source de vérité du chantier qui doit garantir qu'une intention correctement comprise par l'IA reste fidèle lorsqu'elle traverse le contrôleur, le `mj_planner`, le routeur de domaines, la résolution et le rendu.

Le problème n'est pas seulement la qualité de compréhension du modèle. Le flux actuel produit une structure riche `semanticIntent`, puis la réduit vers l'ancien contrat `NarrativeIntentInterpretationV1`. Les étapes suivantes repartent surtout de `intentType`, `action`, `coreMeaning`, `runtimeHandling` et, dans certains cas, du texte brut ou de règles lexicales. Une compréhension correcte peut donc être perdue, corrigée de manière spécifique à une scène ou transformée en une commande système différente.

Ce plan détaille les sept chantiers nécessaires. Il sert de todo list technique; chaque chantier ne passe à `TERMINE` qu'après satisfaction de ses critères de sortie et mise à jour des preuves associées.

## État observé au 2026-07-17

Le flux effectif est proche de :

```text
texte joueur
-> player_intent_interpreter
-> AiStructuredPlayerIntentV1 avec semanticIntent
-> mapping vers NarrativeIntentInterpretationV1 sans semanticIntent
-> mj_planner / résolution depuis intentType + action + coreMeaning
-> correctifs lexicaux ou références de la scène prototype
-> effet, handoff ou no-commit
```

La cible est :

```text
texte joueur + contexte de scène borné
-> proposition sémantique IA validée
-> intention normalisée conservée sans perte
-> décision runtime locale et déterministe
-> commande de domaine typée
-> résolution par le propriétaire du domaine
-> projection et rendu traçables jusqu'à l'intention source
```

Les invariants déjà acquis restent obligatoires :

- aucune sortie IA ne committe directement;
- aucune sortie IA ne fait avancer directement le temps;
- aucune sortie IA ne crée de vérité durable, secret, succès social ou résultat mécanique;
- une panne ou une sortie invalide reste diagnostiquée sans narration de façade;
- les domaines propriétaires restent seuls responsables de leurs effets;
- la saisie brute est conservée pour diagnostic, mais le code applicatif ne doit pas la réinterpréter comme un second modèle de langage.

## Ordre de réalisation

| Ordre | Chantier | Résultat attendu | Dépend de |
|---|---|---|---|
| 1 | Propagation sémantique | une intention interne unique et sans perte | aucun |
| 2 | Consommation par planner et routeur | les étapes aval lisent la structure sémantique | 1 |
| 3 | Commandes de domaine typées | séparation entre sens compris et action exécutable | 1, 2 |
| 4 | Retrait de la réinterprétation lexicale | le code valide sans recomprendre le français | 1 à 3 |
| 5 | Registre de scène générique | résolution des références indépendante de la fixture | 1, 3 |
| 6 | Tests d'invariance sémantique | preuve que les reformulations convergent | 1 à 5 |
| 7 | Tests d'autorité et retrait legacy | preuve de la source de vérité et suppression contrôlée | 1 à 6 |

Les chantiers peuvent être préparés en parallèle dans la documentation et les fixtures, mais le runtime doit suivre cet ordre. Les heuristiques lexicales ne doivent pas être retirées avant que la nouvelle chaîne typée couvre leurs responsabilités de sécurité.

## 1. Propager réellement `semanticIntent`

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-17. Preuves : [`Matrice-preuves-I06ZL.md`](Matrice-preuves-I06ZL.md).

### Problème

`AiStructuredPlayerIntentV1` contient `semanticIntent`, mais le mapping vers `NarrativeIntentInterpretationV1` le réduit principalement à `coreMeaning`. Les preuves, incertitudes, interdictions, cible sémantique et confiance ne sont plus disponibles comme données structurées pour les étapes suivantes.

### Décision cible

Introduire dans le contrat applicatif une intention normalisée qui transporte explicitement :

- famille et objectif sémantiques;
- cible et engagement;
- preuves issues de l'entrée;
- incertitudes et interprétations interdites;
- confiance sémantique;
- résolution de référent validée séparément;
- provenance et diagnostics de validation.

`coreMeaning` peut rester temporairement comme projection lisible de compatibilité. Il ne doit plus être la seule représentation du sens ni être reconstruit indépendamment par les consommateurs.

Le nom et la version du contrat doivent être décidés avant le code. Deux options restent acceptables : étendre `NarrativeIntentInterpretationV1` avec migration explicite, ou introduire un nouveau contrat applicatif versionné. Il est interdit de maintenir durablement deux sources concurrentes de vérité.

### Todo

- [x] Inventorier tous les producteurs et consommateurs de `NarrativeIntentInterpretationV1`.
- [x] Choisir la stratégie de version et documenter la compatibilité.
- [x] Définir le type applicatif canonique et ses guards immédiats.
- [x] Propager l'intention sémantique dans le contrôleur, les sorties persistées et les diagnostics.
- [x] Préserver les interdictions et incertitudes jusqu'à la résolution et au rendu.
- [x] Réserver les contradictions contrôlées complètes à I-06ZR sans conserver deux sources actives.
- [x] Ajouter un adaptateur explicite pour les anciennes opérations persistées.

### Critères de sortie

- aucune étape active ne dépend de `coreMeaning` faute d'accès à la structure sémantique;
- une trace de tour permet de retrouver sans perte l'intention acceptée à l'entrée;
- les opérations déjà persistées restent lisibles ou échouent avec un diagnostic de version explicite;
- TypeScript et les validateurs rejettent une intention applicative privée de ses champs sémantiques obligatoires.

## 2. Faire consommer l'intention sémantique par le planner et le routeur

Statut : `TERMINE_DANS_PERIMETRE` le 2026-07-17. Preuves : [`Matrice-preuves-I06ZM.md`](Matrice-preuves-I06ZM.md).

### Problème

Le `mj_planner` nomme `semanticGoal` une valeur issue de `coreMeaning`. Le resolver s'appuie encore sur `intentType`, `action`, `runtimeHandling` et parfois sur le texte. La structure riche n'est donc pas la base réelle de la planification ni de l'aiguillage.

### Décision cible

Le planner reçoit l'intention sémantique validée complète ou une vue bornée dérivée mécaniquement de celle-ci. Il peut proposer une orchestration, mais ne décide ni du domaine réellement disponible ni d'un commit.

Le routeur runtime lit l'intention, l'engagement, la cible validée, les incertitudes et les capacités déclarées des domaines ouverts. Il produit localement une décision d'exploitation. `runtimeHandling` émis par l'IA devient au mieux une suggestion ou un diagnostic comparatif; il ne doit pas être la décision finale du runtime.

### Todo

- [x] Définir la vue sémantique minimale envoyée au `mj_planner`.
- [x] Remplacer `semanticGoal: coreMeaning` par `semanticIntent.playerGoal`.
- [x] Définir un registre local des capacités runtime ouvertes.
- [x] Implémenter une décision locale : supporté, clarification, handoff ou rejet technique.
- [x] Comparer la suggestion IA de domaine avec la décision locale sans lui donner autorité.
- [x] Tracer les divergences `suggestion IA / décision runtime` pour diagnostic.
- [x] Interdire au planner et au resolver de relire le texte brut pour décider de la disponibilité d'un domaine.

### Critères de sortie

- le planner conserve le même objectif lorsque `coreMeaning` est absent ou volontairement différent;
- la disponibilité d'un domaine est déterminée depuis la configuration locale;
- une intention comprise mais non supportée produit un handoff ou diagnostic fidèle, sans être reclassée;
- le contrôleur expose la décision runtime et sa justification séparément de la proposition IA.

## 3. Introduire des commandes de domaine typées

### Problème

`action` sert aujourd'hui à la fois de résumé du sens, d'indice runtime et de quasi-commande. Les catégories `ask`, `open`, `force`, `observe` et `act` sont trop pauvres pour représenter librement l'intention et trop ambiguës pour constituer une interface de domaine durable.

### Décision cible

Séparer trois objets :

1. l'intention sémantique : ce que le joueur cherche à faire;
2. la décision de routage : quel propriétaire peut traiter la demande;
3. la commande de domaine : données strictes acceptées par ce propriétaire.

Une commande n'est créée qu'après validation de l'intention, de l'engagement, du référent et de l'autorité. Elle ne contient pas de résultat anticipé.

### Todo

- [ ] Établir l'inventaire des domaines et de leurs propriétaires.
- [ ] Définir une enveloppe commune de commande avec corrélation et provenance.
- [ ] Définir le premier sous-ensemble de commandes réellement supportées.
- [ ] Définir les validateurs de chaque commande avant leurs exécutants.
- [ ] Interdire résultat, succès, secret, temps ou création durable dans une commande de proposition.
- [ ] Relier chaque commande à une politique explicite de commit et de temps.
- [ ] Définir le comportement pour une intention valide sans commande disponible.

### Critères de sortie

- `action` n'est plus utilisée comme commande implicite;
- toute résolution committable cite une commande validée et son intention source;
- une commande invalide ne dégrade pas silencieusement vers une autre action;
- les handoffs inventaire, tactique, repos et monde utilisent la même logique d'enveloppe sans ouvrir automatiquement ces domaines.

## 4. Retirer progressivement la réinterprétation lexicale

### Problème

Le runtime contient encore des regex et dictionnaires pour reconnaître une approche, une question de possibilité, une ouverture, une contrainte ou une cible. Ces règles stabilisent certains cas, mais constituent un second interprète concurrent et fragile.

### Décision cible

Le code local peut valider un schéma, une référence, une visibilité, une compatibilité, l'engagement et les autorités. Il peut détecter une contradiction structurelle, clarifier ou router. Il ne doit pas déduire le sens d'une nouvelle formulation française.

Les règles lexicales ne restent autorisées que pour des contrôles techniques clairement bornés. Toute exception doit être documentée avec sa justification de sécurité.

### Todo

- [ ] Inventorier toutes les lectures de `rawInput`, `coreMeaning`, regex et listes de synonymes dans le flux actif.
- [ ] Classer chaque occurrence : sécurité, compatibilité, interprétation ou rendu.
- [ ] Remplacer les occurrences d'interprétation par des champs structurés.
- [ ] Conserver temporairement les garde-fous nécessaires derrière des métriques de compatibilité.
- [ ] Ajouter une condition de retrait à chaque fallback restant.
- [ ] Supprimer les corrections spécifiques à une formulation dès que leurs tests passent par la chaîne sémantique.
- [ ] Empêcher l'ajout de nouveaux dictionnaires métier par une règle de revue documentée.

### Critères de sortie

- aucune décision de domaine ou de commit ne dépend d'un verbe présent dans le texte joueur;
- une formulation inhabituelle mais correctement interprétée suit le même chemin qu'une formulation témoin;
- les rares lectures de texte restantes sont inventoriées et justifiées;
- les tests échouent si une nouvelle heuristique lexicale devient nécessaire pour un cas sémantiquement équivalent.

## 5. Remplacer les références de fixture par un registre de scène générique

### Problème

La résolution actuelle connaît directement certains identifiants et descripteurs de l'auberge de référence. Elle fonctionne bien pour cette fixture, mais ne garantit pas le même comportement avec une autre scène ou des acteurs nouvellement chargés.

### Décision cible

Chaque tour reçoit un registre de scène borné construit depuis `PlayableSceneStateV1` et l'état courant. Ce registre expose uniquement les références que le rôle ou le domaine peut connaître : identifiant canonique, type, nom et alias publics, propriétés visibles utiles, présence, visibilité, capacités d'interaction, provenance et version de scène.

L'IA propose une référence issue de ce registre. Le code canonicalise par consultation du registre, jamais par table spéciale d'identifiants. Une cible absente, invisible, ambiguë ou incompatible provoque une clarification ou un rejet explicite.

### Todo

- [ ] Définir le contrat `SceneReferentRegistry` et son constructeur.
- [ ] Définir les vues par rôle afin de ne pas exposer les secrets.
- [ ] Remplacer les listes d'identifiants visibles codées en dur.
- [ ] Remplacer la canonicalisation spéciale garde/serveuse par une recherche générique.
- [ ] Définir les règles de résolution des pronoms et du référent récent.
- [ ] Définir l'expiration et la persistance de la mémoire courte de référents.
- [ ] Ajouter au moins une troisième scène de test avec des identifiants et rôles différents.

### Critères de sortie

- aucun identifiant de la scène de référence n'apparaît dans le code générique d'interprétation ou de résolution;
- le même pipeline fonctionne sur au moins trois scènes distinctes;
- les descripteurs publics ambigus demandent une clarification;
- un référent récent n'est réutilisé que s'il demeure visible et compatible;
- les secrets et entités non visibles ne sont jamais présents dans la vue de l'interpréteur.

## 6. Ajouter des tests d'invariance sémantique

### Problème

Les tests actuels couvrent de nombreux correctifs, mais prouvent surtout des formulations et des références prévues. Ils ne démontrent pas encore que plusieurs formulations sémantiquement équivalentes convergent vers la même décision et la même commande.

### Décision cible

Construire des familles d'entrées dont l'oracle ne porte pas sur les mots employés, mais sur une empreinte commune : famille sémantique, objectif, engagement, cible canonique, décision runtime, commande ou handoff, politique de commit et de temps, résultats interdits.

Les différences stylistiques de formulation, de preuves ou de rendu peuvent être tolérées tant qu'elles ne modifient pas l'action système.

### Todo

- [ ] Définir le format d'une famille d'invariance et son oracle.
- [ ] Couvrir parole, approche, manipulation implicite, observation, possibilité, clarification et domaine fermé.
- [ ] Ajouter des formulations sans verbe canonique et avec ordre des propositions différent.
- [ ] Ajouter des variantes avec pronoms et référents récents.
- [ ] Exécuter les familles sur plusieurs scènes.
- [ ] Séparer les tests déterministes des certifications live statistiques.
- [ ] Définir un seuil et une procédure de revue pour les essais OpenAI live.

### Critères de sortie

- chaque famille possède au moins cinq formulations réellement différentes;
- toutes les formulations acceptées d'une famille produisent la même empreinte système;
- une ambiguïté réelle forme une famille distincte et ne doit pas être forcée vers l'oracle engagé;
- les tests ne vérifient pas la présence d'un mot-clé comme preuve principale de compréhension;
- les écarts live sont classés comme divergence de sens, de cible, de routage ou de rendu.

## 7. Prouver l'autorité de la source sémantique et retirer le legacy

### Problème

Tant que les anciens champs sont cohérents avec `semanticIntent`, les tests ne permettent pas de savoir quelle représentation dirige réellement le runtime. Les chemins legacy peuvent continuer à masquer une perte de données.

### Décision cible

Ajouter des tests de contradiction contrôlée, puis supprimer les chemins qui ne respectent pas la règle d'autorité. Ces contradictions sont des fixtures techniques et ne doivent jamais être produites en fonctionnement normal.

Exemples : `semanticIntent` décrit une parole mais `action` indique `force`; les cibles sémantique et legacy diffèrent; l'engagement sémantique est hypothétique mais le legacy est engagé; le domaine suggéré par l'IA contredit le registre runtime; `coreMeaning` est trompeur alors que la structure canonique est correcte.

La politique doit être explicite : rejet de contradiction lors de la validation, ou priorité unique au contrat canonique avec diagnostic. Une correction silencieuse est interdite.

### Todo

- [ ] Définir la matrice d'autorité champ par champ.
- [ ] Ajouter les fixtures de contradiction contrôlée.
- [ ] Vérifier que planner, routeur, resolver, mémoire de référent et rendu suivent la même source.
- [ ] Inventorier les fonctions et sorties legacy encore appelées.
- [ ] Déprécier les adaptateurs avec une condition de suppression vérifiable.
- [ ] Supprimer les chemins devenus sans consommateurs.
- [ ] Mettre à jour contrats, exemples JSON, documentation et journal des décisions.

### Critères de sortie

- une contradiction ne peut jamais produire un commit;
- tous les consommateurs actifs utilisent la source canonique documentée;
- aucun fallback legacy ne transforme une panne d'interprétation en tour apparemment réussi;
- le code supprimé est couvert par une recherche de consommateurs et les régressions pertinentes;
- le statut final du chantier est consigné dans `TASKS.md` et une matrice de preuves dédiée.

## Stratégie de lots recommandée

Le chantier est nommé provisoirement `I-06ZL` à `I-06ZR` afin de poursuivre la série actuelle sans ouvrir une nouvelle capacité produit.

| Lot | Contenu | Gate principale |
|---|---|---|
| I-06ZL | contrat canonique et propagation de `semanticIntent` | aucune perte dans le contrôleur |
| I-06ZM | planner et décision runtime locale | plus de faux `semanticGoal` issu du legacy |
| I-06ZN | enveloppes et commandes de domaine typées | aucune commande implicite via `action` |
| I-06ZO | retrait des interprétations lexicales | décisions indépendantes des mots-clés |
| I-06ZP | registre générique de référents de scène | aucune référence de fixture dans le code générique |
| I-06ZQ | matrices d'invariance multi-scènes | formulations équivalentes, empreinte identique |
| I-06ZR | tests d'autorité et nettoyage legacy | source unique prouvée, legacy retiré |

Chaque lot doit commencer par une courte révision contractuelle et se terminer par une matrice de preuves, les tests ciblés, `narration-module:build`, les régressions antérieures et la mise à jour de ce plan, du suivi narration, du journal des décisions et de `TASKS.md`.

## Vérifications minimales du chantier

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-resolution
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:ai-pipeline
npm run narration-module:test:narrative-openai-route
npm run narration-module:test:vertical-quality
npm run narration-module:build
npm run build
```

Les tests live restent opt-in et ne remplacent jamais les tests contractuels déterministes.

## Hors périmètre

Ce chantier ne doit pas ouvrir par lui-même un moteur social mécanique, une intrigue dynamique, une création durable automatique, un domaine inventaire jouable, un handoff tactique ou repos réellement branché, une mémoire sociale longue, une autonomie PNJ multi-tours ou une autorité IA de commit et de temps.

## Première étape concrète

Ouvrir `I-06ZL` uniquement après validation de ce plan. La première modification de code devra être précédée d'un inventaire des producteurs, consommateurs, persistances et validateurs de `NarrativeIntentInterpretationV1`, puis d'une décision de version du contrat canonique.
