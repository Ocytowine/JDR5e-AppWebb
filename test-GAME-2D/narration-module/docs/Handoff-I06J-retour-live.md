# Handoff I-06J — retour live OpenAI et maintien du cap

Date : 2026-07-07

Statut : `PREUVE_HISTORIQUE` — retour des premiers tests live, non contractuel
et non utilisable comme feuille de route.

Documents reliés :

- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md), version `narrative-ai-resolution/1`
- [`Contrat-resolution-narrative.md`](Contrat-resolution-narrative.md), version `narrative-resolution/1`
- [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md), version `scene-social-ui/1`
- [`Matrice-preuves-I06J.md`](Matrice-preuves-I06J.md)
- [`Plan-implementation-narration.md`](Plan-implementation-narration.md)

## 1. Objet

Ce document consigne le retour des premiers essais avec la bascule OpenAI active dans la surface narration.

Il sert à garder le cap entre plusieurs conversations Codex : la capacité OpenAI fonctionne techniquement, mais elle révèle une limite qualitative du prototype actuel. La correction ne doit pas ouvrir prématurément un MJ complet, ni affaiblir les frontières déjà figées.

## 2. Cap produit à préserver

Le module narration vise toujours :

- une saisie libre du joueur, sans menus de choix rigides;
- une IA utilisée comme moteur de mise en scène et de création contrôlée, pas comme simple habillage de quêtes pré-écrites;
- des PNJ et situations non robotiques, mais soumis à leur perspective, leurs connaissances et les faits établis;
- un logiciel garant de la vérité, des règles, des commits, du temps, des domaines propriétaires et de la mémoire;
- une mémoire structurée et sourcée, pas une recherche par mots-clés ni une conversation brute utilisée comme base de données;
- des paquets de contexte bornés, sélectionnés et traçables;
- une séparation stricte entre proposition IA, validation, commit et prose visible.

La règle centrale reste inchangée :

```text
L'IA peut proposer et mettre en scène.
Le logiciel valide, applique et persiste.
```

## 3. État réel après I-06J

I-06J a prouvé :

- la surface narration peut choisir `Locale` ou `OpenAI`;
- le navigateur n'expose pas la clé;
- la route `/api/narration/enhance-openai` fonctionne en opt-in;
- OpenAI peut produire des sorties structurées acceptées;
- le fallback local reste disponible si la route ou la sortie échoue;
- les rôles ouverts restent bornés à `player_expression_adapter` et `scene_writer`.

Ce résultat est un prototype vertical d'enrichissement visible. Ce n'est pas encore le MJ complet.

Les rôles suivants restent fermés :

- `mj_planner`;
- `npc_performer`;
- `rules_adjudicator`;
- `coherence_critic` comme correction automatique;
- `intent_interpreter` IA;
- création persistante automatique;
- intrigue dynamique committable.

## 4. Retours de test live

Entrées testées :

```text
quelle temps fait il ?
ok, peut tu me dire ou je me situe ?
```

Comportement observé :

- le moteur produit correctement une réponse sans commit métier;
- aucune action n'est exécutée;
- le temps ne progresse pas;
- OpenAI ajoute ensuite une narration MJ atmosphérique générique.

Exemple de dérive visible :

```text
L'atmosphère est chargée d'une tension palpable...
```

Analyse :

- il n'y a pas de dérive d'autorité : l'IA ne modifie pas l'état;
- il y a une dérive d'utilité : la prose est hors sujet pour une question méta ou informative;
- le `scene_writer` respecte le contrat minimal d'absence de mutation, mais il parle alors qu'il devrait parfois se taire ou produire une réponse factuelle;
- le prototype n'a pas encore de vrai snapshot de lieu, météo et scène, donc l'IA ne peut pas répondre utilement à ces questions.

## 5. Écart à corriger avant d'ouvrir un lot plus large

Le prochain micro-lot recommandé est une calibration de rendu post-I-06J.

Objectif :

- empêcher la narration atmosphérique générique sur `NO_COMMIT_RESPONSE` sans contenu fictionnel;
- répondre sobrement aux demandes méta ou informatives;
- appeler `scene_writer` uniquement lorsqu'un bloc narratif apporte une valeur réelle.

Règle proposée :

```text
Si le résultat est NO_COMMIT_RESPONSE et qu'aucun fait fictionnel autorisé n'est disponible,
ne pas appeler scene_writer.
Afficher seulement la notification ou une réponse factuelle déterministe.
```

Variantes acceptables :

- ne pas enrichir du tout le paquet;
- produire un `SYSTEM_NOTICE` court;
- utiliser un futur rôle factuel distinct si un vrai snapshot répond à la question.

Variantes à éviter :

- demander au `scene_writer` de meubler;
- transformer une question méta en ambiance;
- inventer météo, lieu, tension, présence ou possibilité faute de contexte;
- répondre comme si le personnage observait le monde si la demande est hors narration.

## 6. Critères de décision pour appeler `scene_writer`

`scene_writer` peut être appelé lorsque l'un des éléments suivants existe :

- commit confirmé;
- expression PJ validée;
- handoff tactique, repos, inventaire, monde ou règles;
- clarification narrative utile;
- transition de scène;
- résultat perceptible validé;
- texture sensorielle explicitement autorisée par le `RenderPlan`.

`scene_writer` ne devrait pas être appelé lorsque :

- la réponse est purement méta;
- la demande porte sur une information système non branchée;
- le resolver n'a produit aucun fait fictionnel à restituer;
- le seul contenu disponible est une notification `NO_COMMIT_RESPONSE`;
- la réponse attendue est factuelle et dépend d'un domaine non encore connecté.

## 7. Résultats attendus sur les tests observés

Pour :

```text
quelle temps fait il ?
```

Tant que météo/snapshot monde ne sont pas branchés :

```text
Système — Notification
La météo de scène n'est pas encore disponible dans ce prototype. Aucune action n'a été exécutée.
```

Quand le snapshot monde sera branché :

```text
MJ — Narration
Le ciel au-dessus de votre position est bas et couvert; une pluie fine menace sans encore tomber.
```

Pour :

```text
ok, peut tu me dire ou je me situe ?
```

Tant que localisation/snapshot de campagne ne sont pas branchés :

```text
Système — Notification
La localisation de campagne n'est pas encore reliée à cette surface prototype. Aucune action n'a été exécutée.
```

Quand la scène réelle sera branchée :

```text
MJ — Narration
Vous vous trouvez dans la cour intérieure de Valmorin, près de la porte est, à portée de voix des gardes.
```

La seconde forme est narrative uniquement parce qu'elle repose sur un fait de localisation autoritaire.

## 8. Prochaines capacités à apporter

### Priorité 1 — Calibration du rendu I-06J

Petite correction ciblée.

À prouver :

- méta sans `scene_writer` atmosphérique;
- possibilité sans action et sans ambiance inventée;
- question de localisation sans snapshot réel => réponse sobre;
- handoff ou commit réel => narration MJ encore possible;
- fallback OpenAI conservé.

### Priorité 2 — Snapshot réel de scène

Sans vrai snapshot, OpenAI ne peut pas répondre utilement.

À brancher progressivement :

- lieu courant;
- météo ou état local du monde;
- personnages présents;
- statut de scène;
- faits récemment établis;
- perception et capacités du PJ;
- sources lore pertinentes.

### Priorité 3 — Persistance des projections et incidents

Statut : `TRAITÉ PAR I-06K` pour l'enregistrement durable du rendu final et des incidents expurgés. `TRAITÉ PAR I-06L` pour la reconstruction du fil visible depuis ces projections.

Réalisé :

- opération secondaire `narrative.render.projection`;
- stockage du `DisplayPacketV1` final;
- incidents IA expurgés conservés;
- aucun commit métier, aucun temps de jeu, aucune modification de l'opération source.

Réalisé ensuite par I-06L :

- lecture bornée des opérations de rendu;
- reconstruction du fil visible sans rappeler OpenAI;
- restauration au montage de la surface narration;
- usage IndexedDB dans le prototype navigateur quand disponible.

Reste à préparer :

- lecteur UX d'historique complet;
- consultation UX détaillée des incidents;
- statut du choix OpenAI comme préférence non autoritaire si utile;
- pagination, compactage et politique de rétention des rendus.

### Priorité 4 — I-07 tactique/repos

À ouvrir seulement après audit dédié.

Objectif :

- handoff tactique sauvegardable;
- retour de résultat tactique intégré une seule fois;
- repos court/long comme processus;
- interruptions et reprises;
- signaux UI début/fin de repos issus d'événements committés.

### Priorité 5 — Rôles IA plus puissants

À ouvrir après snapshot, persistance et handoffs solides.

Ordre prudent :

1. `mj_planner` pour proposer scènes, événements et complications;
2. `npc_performer` pour faire parler les PNJ selon leur perspective;
3. `rules_adjudicator` pour les cas ouverts;
4. `coherence_critic` pour les intrigues, secrets et contradictions subtiles;
5. promotions de créations dynamiques vers PNJ, lieux, événements et intrigues.

Ouvrir ces rôles trop tôt recréerait les erreurs des essais précédents : prose séduisante, mais sans assez de contexte, de mémoire et de validation.

## 9. Nettoyage documentaire à prévoir

Quelques documents globaux peuvent encore refléter un état antérieur au prototype I-06J.

À réaligner sans changer les contrats :

- `README.md` racine si nécessaire;
- `narration-module/README.md`;
- `docs/README.md`;
- `Audit-final.md` statut global;
- `Plan-implementation-narration.md`;
- `TASKS.md`.

Le wording attendu :

```text
La surface narration prototype existe et peut appeler OpenAI en opt-in pour l'enrichissement visible.
Le runtime narratif complet de campagne reste non livré.
```

Cette distinction évite deux erreurs :

- croire que rien n'est branché;
- croire que le MJ complet est déjà ouvert.

## 10. Recommandation de reprise

Prochaine étape concrète recommandée :

```text
Ouvrir un micro-lot post-I-06J de calibration du rendu sans commit :
ne pas appeler scene_writer sur NO_COMMIT_RESPONSE purement méta/informatif,
ajouter les tests "météo" et "localisation",
puis seulement choisir entre persistance des projections/incidents ou audit I-07.
```

Ce micro-lot doit rester limité. Il ne doit pas introduire `mj_planner`, snapshot complet, mémoire réelle, tactique ou repos.
