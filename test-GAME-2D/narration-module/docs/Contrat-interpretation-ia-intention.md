# Contrat interprétation IA de l'intention joueur

Statut : `PROPOSITION_CADREE`

Version cible : `ai-intent-interpretation/1`

Lot : I-06X

Date : 2026-07-08

## Objectif

I-06X remplace la dépendance aux formulations exactes par une interprétation IA structurée de la saisie libre du joueur.

Le but n'est pas de donner plus d'autorité à l'IA. Le but est de mieux comprendre l'intention naturelle du joueur avant de la soumettre aux validateurs et domaines propriétaires.

La sortie IA devient une proposition structurée. Elle n'est jamais un commit, un résultat mécanique, une vérité de campagne ou un texte visible directement.

## Problème traité

Le prototype I-06E `intent-clarification/1` est volontairement déterministe et conservateur. Il a sécurisé les premiers lots, mais il dépend trop de motifs lexicaux.

Défaut confirmé :

```text
Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.
```

est classé actuellement :

```text
unclear_commitment
```

alors que des variantes proches sont reconnues comme `speech`.

I-06X doit corriger ce problème au niveau architectural : l'interprétation doit reconnaître des familles de sens équivalentes, pas seulement des mots-clés.

## Autorité

Le rôle IA d'I-06X peut proposer :

- une ou plusieurs intentions structurées;
- un niveau d'engagement;
- une cible probable;
- une action ou parole normalisée;
- un sujet;
- les ambiguïtés réelles;
- une question de clarification candidate;
- des signaux de risque pour les validateurs.

Il ne peut pas :

- committer une opération;
- faire avancer le temps;
- modifier un agrégat;
- écrire un événement;
- créer un objet, PNJ, lieu, secret ou lore durable;
- résoudre une action;
- résoudre un combat;
- accorder un succès social;
- choisir un handoff définitif;
- afficher directement son texte au joueur.

Le code applicatif reste seul responsable de :

- la validation de schéma;
- la validation des références;
- la classification finale autorisée;
- la décision de clarification;
- les handoffs;
- les commits;
- les effets temporels;
- la persistance.

## Position dans le pipeline

Pipeline cible limité :

```text
texte joueur brut
-> paquet de contexte borné
-> player_intent_interpreter
-> validation locale stricte
-> interprétation normalisée acceptée ou rejetée
-> contrôleur / résolution bornée existants
```

En cas de panne IA, sortie invalide ou confiance insuffisante, le système doit dégrader vers :

- l'interpréteur déterministe conservateur existant;
- ou une clarification contrôlée si le risque est trop élevé.

Cette dégradation ne doit jamais inventer une intention plus engagée que le texte joueur.

## Rôle IA

Nom cible :

```text
player_intent_interpreter
```

Relation avec les rôles existants :

- il précède `player_expression_adapter`;
- il précède `scene_writer`;
- il ne remplace pas `mj_planner`;
- il ne remplace pas `rules_adjudicator`;
- il ne remplace pas `npc_performer`;
- il ne remplace pas `coherence_critic`.

## Entrée minimale

Le paquet envoyé au rôle contient uniquement :

- texte joueur brut;
- identifiant d'opération;
- scène courante minimale;
- acteurs visibles nommés;
- points d'intérêt visibles;
- dernière clarification suspendue si elle existe;
- politique d'autorité;
- liste des intentions et handoffs autorisés par le lot;
- exemples de sorties attendues si utile.

Le paquet ne doit pas contenir :

- secrets MJ;
- fragments wiki `MJ_SECRET`;
- prompt système brut d'autres rôles;
- clés ou diagnostics fournisseur;
- état tactique non autorisé;
- données inventaire non nécessaires;
- contenu privé d'un PNJ non révélé.

## Sortie cible

La sortie contient une enveloppe stricte et un tableau d'intentions.

Exemple :

```json
{
  "schemaVersion": 1,
  "contractVersion": "ai-intent-interpretation/1",
  "role": "player_intent_interpreter",
  "status": "OK",
  "payload": {
    "rawInputEcho": "Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.",
    "intents": [
      {
        "intentId": "intent:1",
        "order": 1,
        "intentType": "speech",
        "commitment": "committed",
        "target": {
          "kind": "npc",
          "ref": "npc:garde",
          "label": "garde"
        },
        "action": "ask",
        "topic": "ce qu'il a vu d'étrange",
        "coreMeaning": "Le personnage va vers le garde et lui demande s'il a vu quelque chose d'étrange.",
        "playerImposedDetails": [
          "s'approcher du garde",
          "poser une question au garde",
          "sujet: chose étrange vue"
        ],
        "openDetails": [],
        "forbiddenInterpretations": [
          "le garde révèle un secret",
          "le garde accepte une demande",
          "un succès social est acquis"
        ],
        "requiresClarification": false,
        "clarificationQuestion": null,
        "riskFlags": [],
        "expectedTimeEffect": "DOMAIN_TO_DECIDE",
        "confidence": "high"
      }
    ]
  },
  "diagnostics": []
}
```

## Types d'intention autorisés en I-06X

I-06X peut proposer uniquement les types déjà compatibles avec I-06 :

```text
meta_question
possibility_query
memory_recall
speech
action
mixed
unclear_commitment
```

Il peut ajouter des champs structurants autour de ces types, mais ne doit pas ouvrir de nouvelles familles métier sans contrat dédié.

## Engagement

Valeurs autorisées :

```text
none
hypothetical
conditional
committed
unclear
```

Règles :

- une question méta a `none`;
- une question de possibilité a `hypothetical`;
- une action déclarée au présent ou futur proche a généralement `committed`;
- une formulation elliptique sans verbe ni cible claire peut être `unclear`;
- une intention conditionnelle reste conditionnelle tant que la condition n'est pas résolue.

L'IA ne doit pas augmenter l'engagement du joueur.

Exemple interdit :

```text
Puis-je voler la bourse du garde ?
```

ne peut pas devenir :

```text
commitment: committed
```

## Clarification

Une clarification est nécessaire seulement si l'ambiguïté empêche une résolution sûre.

Clarification légitime :

```text
Lui voler quelque chose ?
```

Motif : cible, engagement et action réelle insuffisamment clairs.

Clarification illégitime :

```text
Je m’approche du garde et je lui demande ce qu’il a vu.
```

Motif : variation grammaticale, mais intention de parole claire.

## Validation locale

La sortie IA est rejetée si :

- le JSON est invalide;
- le contrat ou le rôle ne correspond pas;
- un champ inconnu apparaît;
- une cible référencée n'est pas visible ou autorisée;
- le type d'intention n'est pas autorisé;
- l'engagement contredit le texte joueur;
- une question de possibilité devient action committée;
- une sortie contient un résultat, succès, échec ou secret;
- une clarification est proposée alors que la sortie contient aussi une intention engagée contradictoire;
- la confiance est absente ou hors enum;
- le texte contient une instruction destinée au joueur au lieu d'une structure.

Le rejet doit produire un incident expurgé et une dégradation contrôlée.

## Matrice de robustesse linguistique

I-06X doit tester des familles de formulations équivalentes.

### Famille A — parole adressée à un PNJ

Toutes doivent produire `speech`, cible `garde`, `committed`, sans clarification :

```text
Je demande au garde ce qu’il a vu.
Je lui demande ce qu’il a vu.
Je m’approche du garde et je lui demande ce qu’il a vu.
Je vais vers le garde pour lui demander ce qu’il a vu.
Je questionne le garde sur ce qu’il a vu.
Je demande au garde s’il a remarqué quelque chose.
```

### Famille B — question de possibilité sociale

Toutes doivent produire `possibility_query`, sans parole exécutée :

```text
Est-ce que je peux parler au garde ?
Puis-je interroger le garde ?
Ai-je le droit de poser une question au garde ?
Ce serait possible de discuter avec lui ?
```

### Famille C — action risquée hypothétique

Toutes doivent rester sans commit :

```text
Est-ce que je peux voler la bourse du garde ?
Puis-je ouvrir la porte sans attirer l'attention ?
Est-ce possible d'entrer dans l'arrière-salle discrètement ?
```

### Famille D — action explicite

Toutes doivent produire `action`, `committed`, avec handoff ou résolution bornée selon domaine :

```text
J'ouvre la porte.
Je tente d'ouvrir la porte.
Je force la serrure.
Je m'avance vers l'arrière-salle.
```

### Famille E — méta / règles

Toutes doivent produire `meta_question`, sans fiction :

```text
Comment fonctionne cette scène côté règles ?
Pause, quel jet faudrait-il normalement ?
Est-ce que l'interface sauvegarde automatiquement ?
```

### Famille F — ambiguïté réelle

Toutes doivent produire `unclear_commitment` ou clarification :

```text
Lui voler quelque chose ?
Et si j'entrais ?
Le garde ?
Je pourrais peut-être...
```

## Critères de sortie I-06X

I-06X pourra être considéré clos si :

- le contrat `ai-intent-interpretation/1` est figé;
- un faux fournisseur déterministe couvre les sorties acceptées et rejetées;
- la route OpenAI reste côté serveur si elle est utilisée;
- aucune clé ni appel OpenAI direct n'apparaît dans React;
- la matrice de robustesse linguistique passe;
- le cas `je lui demande` ne déclenche plus de clarification inutile;
- les questions de possibilité restent non committées;
- les ambiguïtés réelles restent clarifiées;
- le contrôleur ne donne aucune autorité de commit à l'IA;
- les tests existants I-06 et map pertinents restent verts.

## Commandes de vérification prévues

Commandes minimales attendues après implémentation :

```powershell
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:vertical-quality
npm run narration-module:test:narrative-app-surface
npm run narration-module:build
npm run map-module:test:regression
```

La première commande n'existe pas encore au moment du cadrage. Elle devra être ajoutée par l'implémentation I-06X.

## Hors périmètre

I-06X ne livre pas :

- MJ complet;
- planification de scène;
- PNJ autonomes;
- résolution sociale mécanique;
- tactique jouable;
- repos jouable;
- intrigue dynamique;
- création durable;
- mémoire sociale générique;
- lecteur d'historique complet;
- certification qualité live obligatoire.

## Décision

I-06X doit traiter la compréhension de l'intention comme une capacité IA structurée et validée, pas comme une extension de l'heuristique déterministe.

Le contrat `intent-clarification/1` reste disponible comme fallback conservateur. Il ne doit plus être la cible de généralisation principale pour la compréhension naturelle du joueur.
