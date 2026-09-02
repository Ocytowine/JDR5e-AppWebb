# Plan de rationalisation du contexte narratif par rôle J10-K

Statut : `EN EXÉCUTION — J10-K0 À J10-K3 FERMÉS, J10-K4 OUVERT`

Date d'ouverture : 2026-09-01

Autorité : ce document ouvre le chantier transversal J10-K après le diagnostic
du tour « pouvez-vous me dire qui gouverne le pays ? ». Il complète la feuille
de route globale sans remplacer les contrats d'autorité des modules.

## Motif d'ouverture

Depuis les Archives de Lysenthe, `player_intent_interpreter` disposait déjà du
garde actif, de la scène publique et d'un catalogue sémantique contenant
Astryade, Ylsséa, Lysenthe et la relation
`Archives de Lysenthe → territoire → Astryade`. Il a pourtant déclaré le pays
ambigu, laissé `informationNeed=null` et arrêté le tour avant le résolveur
factuel.

Le diagnostic ne montre ni panne fournisseur, ni troncature de sortie, ni perte
du focus social. Il révèle en revanche :

- 22 710 caractères de contexte applicatif pour une question très courte ;
- 6 228 caractères de schéma Structured Outputs ;
- 8 900 tokens d'entrée réellement rapportés pour un budget déclaré de 2 000 ;
- la scène et ses acteurs projetés à la fois dans `roleContextPack` et dans
  `task.embodiedContext` ;
- un catalogue d'information de 7 726 caractères, utile mais noyé dans un
  paquet dont plusieurs sections se recouvrent.

J10-K ne doit donc pas ajouter une nouvelle copie de la hiérarchie géographique.
Il doit rendre le contexte existant plus utile, plus lisible et mesurable pour
chaque rôle.

## Décision d'architecture

Le contexte narratif n'est pas un nouveau registre persistant ni une seconde
source de vérité. Il est un produit de lecture éphémère, construit pour un
appel précis depuis les propriétaires existants.

```text
états propriétaires à une révision donnée
    ├─ campagne, temps et processus
    ├─ scène jouable et référents visibles
    ├─ focus et continuité sociale
    ├─ personnage, compagnons et inventaire publics
    ├─ lore et faits de campagne autorisés
    ├─ intrigues, missions et relations projetées
    └─ capacités runtime publiées
            ↓ projecteurs publics existants
      manifeste de contexte du tour
            ↓ projection minimale par rôle
      paquet IA unique, borné et traçable
```

Le manifeste référence les projections et leur provenance à une même révision.
Il ne recopie pas leurs données dans un stockage durable. Chaque paquet de rôle
est ensuite construit directement depuis ce manifeste et ne contient qu'une
représentation de chaque information nécessaire.

## Invariants

- une donnée possède un seul propriétaire et une seule projection faisant foi
  dans un paquet de rôle ;
- la prose affichée au joueur n'est jamais réinjectée comme substitut de l'état
  structuré qui l'a produite ;
- une information absente du paquet d'un rôle ne peut pas être devinée depuis
  une autre projection, un identifiant privé ou le transcript complet ;
- OpenAI reste l'unique interpréteur de la formulation joueur ; aucun mot,
  synonyme, motif ou expression régulière locale ne résout « pays », « ville »,
  « région » ou une autre désignation ;
- les références du contexte restent non autoritaires : elles n'accordent ni
  succès, accès, connaissance PNJ, divulgation, commit ou temps ;
- les modules intrigue, mission, relation, compagnon, inventaire, voyage,
  repos, monde et tactique conservent leurs propriétaires et leurs validations ;
- chaque paquet est associé au snapshot, à la révision, au rôle et à une
  empreinte reproductible ;
- confidentialité et minimisation sont vérifiées avant l'appel, pas seulement
  après sa réponse ;
- un budget déclaré doit correspondre à une vérification réelle du paquet
  sérialisé et ne peut plus être une simple métadonnée.

## Unité de composition

J10-K doit introduire un contrat versionné de manifeste, par exemple
`narrative-context-manifest/1`, sans y déplacer les états propriétaires. Il
décrit au minimum :

- le snapshot et la révision de campagne ;
- les projections disponibles et leur version de contrat ;
- leur classification `PUBLIC`, `ROLE_PRIVATE` ou `FORBIDDEN_FOR_AI` ;
- leur propriétaire et leur provenance ;
- les rôles autorisés à les consommer ;
- leur coût sérialisé avant sélection ;
- les dépendances de cohérence, par exemple scène et focus issus de la même
  révision.

Un projecteur de rôle sélectionne ensuite les sections nécessaires. Il peut
compacter leur forme de transport, mais ne change ni leur sens ni leur
autorité.

## Besoins minimaux par rôle

| Rôle | Doit recevoir | Ne doit pas recevoir par défaut |
|---|---|---|
| `player_intent_interpreter` | saisie brute, identité publique utile, scène et référents visibles uniques, interlocuteur/focus, intentions sémantiques récentes, références nommables utiles, sujets/propriétés/relations publics sélectionnables, capacités adressables | transcript complet, prose de scène dupliquée, valeurs factuelles du catalogue de sélection, secrets, commandes propriétaires |
| `npc_performer` | acte de dialogue résolu, cible validée, profil conversationnel de cet acteur, faits connus et divulgables, état visible nécessaire, contraintes de réponse | saisie brute, catalogue global, capacités sans rapport, faits retenus ou privés, état complet des autres modules |
| `scene_writer` | résultat déjà arbitré, changements visibles, référents concernés, influences de lore autorisées et contraintes de style | intention à réinterpréter, secrets non révélés, catalogues complets, autorité de commit |
| `scene_creator` | demande de destination comprise, ancres et influences lore autorisées, frontières de création, connexions nécessaires | historique conversationnel, inventaire détaillé, focus social sans rapport, vérités privées |
| `coherence_critic` | sortie candidate, faits et invariants exacts nécessaires à sa vérification | contexte créatif intégral, données sans rapport, autorité de réécriture ou de commit |
| rôle de création factuelle | propriété déclarée manquante, sujet, politique de création, contraintes et sources publiques | autres propriétés, secrets, transcript, décision de persistance |

Tout rôle futur doit déclarer ses besoins et exclusions avant d'être raccordé.
« Envoyer tout le contexte par prudence » n'est pas une politique valide.

## Règles de non-duplication

Pour V8, `task.embodiedContext` doit devenir la seule projection incarnée du
tour. `roleContextPack` ne peut plus transporter une seconde copie de la scène
ou des acteurs. S'il reste nécessaire au protocole commun, il se limite aux
métadonnées de corrélation ou à une référence vers la projection retenue.

Dans un même paquet :

- un acteur visible possède une seule fiche de transport ;
- l'interlocuteur et le focus pointent vers sa référence sans recopier sa fiche ;
- la scène possède une seule identité et une seule liste de référents ;
- les intentions récentes sont sémantiques et bornées, jamais doublées par le
  transcript narratif ;
- le catalogue d'information publie chaque sujet, propriété et relation une
  fois ; les portées actives les référencent sans recopier leurs libellés ;
- les capacités runtime sont présentes uniquement pour les rôles qui doivent
  proposer une correspondance.

Une gate structurelle doit détecter les références ou objets dupliqués entre
sections avant tout appel fournisseur.

## Budgets et observabilité

Le coût d'entrée doit distinguer :

1. instructions du rôle ;
2. tâche et contexte applicatif ;
3. schéma Structured Outputs ;
4. éventuelle surcharge fournisseur.

Avant l'appel, le serveur calcule la taille sérialisée de chaque section et une
estimation de tokens avec une marge documentée. Le paquet est refusé ou réduit
par une politique déterministe s'il dépasse son plafond. Aucune donnée
autoritaire ne doit être tronquée silencieusement.

Après l'appel, la télémétrie compare estimation, budget et usage fournisseur.
Elle distingue dépassement, anomalie de mesure et évolution du schéma. Le terme
`inputTokenBudget` ne peut être conservé que s'il est effectivement contrôlé ;
sinon il doit être renommé jusqu'à la livraison de cette garantie.

La réduction suit un ordre déclaré par rôle. Pour l'interpréteur, supprimer un
doublon ou une information non pertinente précède toujours la réduction du
focus actif, des référents visibles ou du catalogue nécessaire à la question.

## Plan d'exécution

### J10-K0 — Baseline mesurée et carte des doublons

- capturer le paquet exact de la séquence des Archives sans secret ;
- mesurer chaque section, les instructions, le schéma et l'usage fournisseur ;
- dresser la matrice source → projection → rôle → duplication ;
- figer les cas « le pays », « la ville », « la région », interlocuteur actif
  et vraie ambiguïté sans modifier le prompt ni le runtime.

Sortie : rapport reproductible, fixture anonymisée et seuils de départ.

État : `FERMÉ`. La gate reproduit la scène publique des Archives, mesure un
corps fournisseur anonymisé de 33 704 caractères, soit environ 8 426 tokens,
et détecte la scène ainsi que trois acteurs dupliqués. Le checkpoint est dans
[`Checkpoint-baseline-contexte-J10K0.md`](Checkpoint-baseline-contexte-J10K0.md).

### J10-K1 — Contrat du manifeste et matrice d'autorité

- versionner le manifeste éphémère ;
- déclarer propriétaires, classifications, consommateurs et exclusions ;
- fixer les règles de cohérence de snapshot et de provenance ;
- documenter l'extension obligatoire pour tout nouveau rôle ou module.

Sortie : contrat et validateurs passifs, sans changement de comportement.

État : `FERMÉ`. `narrative-context-manifest/1` décrit sans payload les
propriétaires, contrats, sources, classifications, rôles, cohérences, coûts et
dépendances. Sept profils de rôle fixent les besoins et interdictions. Le
runtime ne le consomme pas encore. Voir
[`Contrat-manifeste-contexte-narratif-J10K1.md`](Contrat-manifeste-contexte-narratif-J10K1.md)
et [`Checkpoint-manifeste-contexte-J10K1.md`](Checkpoint-manifeste-contexte-J10K1.md).

### J10-K2 — Projection unique de l'interpréteur

- supprimer la duplication V8 entre `roleContextPack` et `embodiedContext` ;
- conserver une seule représentation de la scène et des acteurs ;
- transformer focus, interlocuteur et portées en références vers cette
  représentation ;
- compacter le catalogue sémantique sans perdre sujets, relations, propriétés,
  niveaux, politiques ou références exactes ;
- renforcer la règle générale de résolution vers l'unique référent public
  compatible, sans règle lexicale locale.

Sortie : même autorité et même couverture, paquet plus petit, « le pays »
résolu vers Astryade dans le contexte non ambigu.

État : `FERMÉ`. Le manifeste réel reste local, `roleContextPack` ne contient
plus ni scène ni acteur, et le catalogue tabulaire est réversible sans perte.
L'entrée applicative passe de 18 050 à 12 553 caractères et le corps fournisseur
de 33 704 à 28 164. La gate simulée conserve l'interlocuteur et transporte « le
pays » vers Astryade avec un besoin structuré. Voir
[`Checkpoint-projection-interpreteur-J10K2.md`](Checkpoint-projection-interpreteur-J10K2.md).

### J10-K3 — Projections minimales des autres rôles

- migrer performer, writer, creator, critic et création factuelle ;
- supprimer catalogues, historiques et états non consommés ;
- garantir que le performer ne reçoit que les faits connus et divulgables ;
- conserver les limites d'appels et les fallbacks existants.

Sortie : chaque rôle possède une projection documentée et testée.

État : `FERMÉ`. Performer, writer, creator, création factuelle et critic
construisent désormais un manifeste local validé et une projection unique. La
saisie brute est retirée du performer, du writer et de ses critiques ; la
présence visible est consommée depuis le sens structuré fourni par
l'interpréteur, sans reprise lexicale. Les créations de lieu, de fait et
d'intrigue conservent leurs validations propriétaires. Voir
[`Checkpoint-projections-roles-J10K3.md`](Checkpoint-projections-roles-J10K3.md).

### J10-K4 — Budgets réellement applicables

- mesurer avant envoi toutes les composantes de l'entrée ;
- appliquer les plafonds et politiques de réduction par rôle ;
- exposer estimation, taille par section, usage réel et écart ;
- produire un incident explicite plutôt qu'un dépassement silencieux.

Sortie : budget déclaré vérifiable et télémétrie non trompeuse.

### J10-K5 — Intégration transverse

- vérifier intrigue, mission, relation, compagnon, inventaire, voyage, repos,
  monde et handoff tactique ;
- prouver qu'aucune autorité ni donnée privée n'a migré dans le manifeste ;
- vérifier reload, rejeu, concurrence et changement de scène ;
- conserver le diagnostic technique hors du fil fictionnel.

Sortie : matrice transverse et gates de non-régression.

### J10-K6 — Certification

- corpus local et Chromium sur formulations ouvertes ;
- comparaison avant/après des tailles, tokens, latences et clarifications ;
- build global et gates propriétaires ;
- recette OpenAI live uniquement après accord explicite.

Sortie : checkpoint de fermeture avec mesures et limites résiduelles.

## Corpus minimal de certification

- aux Archives, « qui gouverne le pays ? » sélectionne Astryade ;
- « qui dirige la ville ? » sélectionne Lysenthe ;
- « qui gouverne la région ? » sélectionne Ylsséa si les propriétés demandées
  sont publiées, ou conserve une absence factuelle sans ambiguïté artificielle ;
- un pays étranger explicitement nommé ne bascule pas vers Astryade ;
- deux territoires également plausibles imposent une clarification ;
- « pouvez-vous me dire… » reste adressé à l'interlocuteur actif après reload ;
- une question factuelle atteint le résolveur avec `informationNeed` structuré ;
- une question non factuelle ne crée pas de faux besoin d'information ;
- aucun test métier ne dépend des mots précis de ces formulations.

## Impacts sur les modules

| Module | Impact autorisé | Invariant conservé |
|---|---|---|
| intrigue et mission | projection publique minimale si utile au rôle | aucune vérité cachée ni promotion par l'IA |
| relations sociales | interlocuteur, focus et faits divulgués référencés une fois | valeurs privées et décisions restent propriétaires |
| inventaire | références nommables ou état public strictement nécessaire | aucune possession, mutation ou accès déduit par l'IA |
| compagnons | présence publique et cible de dialogue | autonomie par défaut et décisions propriétaires |
| voyage et monde | processus actif et état perceptible utile | routes, temps, interruptions et simulation restent propriétaires |
| repos | état public seulement lorsqu'une intention le concerne | coût, durée et validation restent propriétaires |
| tactique | handoff public uniquement lorsqu'il existe | carte, placement et contrôle restent différés et propriétaires |

## Conditions d'arrêt

- si une réduction exige de relire localement les mots du joueur, arrêter ;
- si deux projections prétendent faire foi pour la même donnée dans un paquet,
  choisir le propriétaire avant de poursuivre ;
- si un rôle ne peut pas justifier la consommation d'une section, l'exclure ;
- si un plafond ne peut pas être tenu sans retirer une donnée indispensable,
  revoir le contrat ou séparer l'appel, sans troncature silencieuse ;
- si une migration modifie une autorité métier, ouvrir un lot distinct ;
- si la confidentialité ne peut pas être prouvée avant appel, ne pas appeler le
  fournisseur.

## Définition de terminé

J10-K est fermé lorsque chaque rôle actif possède une projection unique,
documentée et bornée ; que le paquet V8 ne duplique plus la scène ; que les
budgets sont réellement vérifiés ; que le corpus contextuel ne produit plus la
fausse ambiguïté observée ; et que les gates transverses, Chromium, IndexedDB et
le build global restent verts.

J10-J4 reprend ensuite sur ce contexte stabilisé. J10-J5 dépend à la fois de la
fermeture de J10-J4 et de J10-K6.
