# Contrat interprétation IA de l'intention joueur

Statut : `ACTIF_I06ZL_PROPAGATION_SEMANTIQUE`

Version cible : `ai-intent-interpretation/1`

Lot : I-06X, revision I-06ZF

Date : 2026-07-08

Derniere revision : 2026-07-17

## Objectif

I-06X remplace la dépendance aux formulations exactes par une interprétation IA structurée de la saisie libre du joueur.

La revision I-06ZF conserve une seule version active du contrat, `ai-intent-interpretation/1`, mais deplace son centre de gravite : l'interpretation ne doit plus etre reduite a `intentType + action`. Elle doit porter une intention semantique libre, puis indiquer separement si le runtime courant sait la traiter.

Le but n'est pas de donner plus d'autorité à l'IA. Le but est de mieux comprendre l'intention naturelle du joueur avant de la soumettre aux validateurs et domaines propriétaires.

La sortie IA devient une proposition structurée. Elle n'est jamais un commit, un résultat mécanique, une vérité de campagne ou un texte visible directement.

En mode test, l'absence d'IA exploitable ne doit pas etre masquee par un fallback narratif. Une panne, une sortie invalide ou une sortie rejetee produit un diagnostic explicite, sans commit ni temps de jeu.

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

Defaut post-I-06ZE confirme :

```text
Je mets la main sur la poignee et pivote le mecanisme.
```

dans un contexte ou le personnage est devant une porte visible ne doit pas echouer faute de mot `ouvrir`. Le systeme doit comprendre l'intention semantique probable, puis valider seulement ce qu'il a autorite a traiter.

## Autorité

Le rôle IA d'I-06X peut proposer :

- une ou plusieurs intentions structurées;
- un niveau d'engagement;
- une cible probable;
- une intention semantique libre;
- un statut d'exploitabilite par le runtime courant;
- une action canonique uniquement comme detail d'exploitation non central;
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
- la validation des autorites et domaines ouverts;
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

En cas de panne IA, sortie invalide ou confiance insuffisante, le systeme produit un diagnostic d'echec d'interpretation :

- aucun commit;
- aucun temps de jeu;
- aucune narration de secours;
- recapitulatif des issues pour le developpeur/testeur;
- possibilite de relancer la meme entree apres correction technique ou fournisseur.

Le fallback local peut rester un outil de test contractuel isole. Il ne doit pas etre le comportement produit du tour narratif.

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
- au plus cinq intentions sémantiques récemment acceptées, limitées à leur objectif, sujet, cible publique, engagement et provenance;
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

Chaque intention doit porter `semanticIntent`. Les anciens champs `intentType`, `commitment`, `target`, `action`, `topic` et `coreMeaning` peuvent rester pour compatibilite pendant la migration, mais le sens principal appartient a `semanticIntent`.

Depuis I-06ZL, cette règle s'applique aussi au contrat applicatif `NarrativeIntentInterpretationV1` : `semanticIntent` y est obligatoire et doit être copié sans perte depuis la sortie IA acceptée. `coreMeaning` reste une projection legacy lisible, pas une source de vérité concurrente.

Les anciennes opérations persistées sans `semanticIntent` sont adaptées uniquement à la frontière de relecture. L'adaptateur construit une projection compatible depuis les champs legacy, puis le reste du pipeline utilise la forme canonique enrichie. Une nouvelle opération ne peut pas être produite sans `semanticIntent`.

Depuis I-06ZM, `runtimeHandling` est explicitement une suggestion de l'interpréteur, pas une décision d'autorité. Le contrat applicatif ajoute `runtimeDecision`, calculé localement depuis l'intention validée et le registre des capacités ouvertes. Le planner et le resolver doivent lire `runtimeDecision` pour le statut, le domaine disponible et la politique de commit. Toute divergence avec la suggestion IA est conservée dans `aiSuggestionMatched` et exposée au diagnostic.

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
        "semanticIntent": {
          "schemaVersion": 1,
          "kind": "address_visible_actor",
          "playerGoal": "demander au garde s'il a vu quelque chose d'etrange",
          "target": {
            "kind": "npc",
            "ref": "npc:garde",
            "label": "garde"
          },
          "commitment": "committed",
          "evidenceFromInput": [
            "je lui demande",
            "s'il a vu quelque chose d'etrange"
          ],
          "uncertainties": [],
          "forbiddenInterpretations": [
            "le garde revele un secret",
            "le garde accepte une demande",
            "un succes social est acquis"
          ],
          "confidence": "high"
        },
        "runtimeHandling": {
          "schemaVersion": 1,
          "status": "SUPPORTED_BY_CURRENT_RUNTIME",
          "reason": "Parole joueur bornee vers un PNJ visible; aucun resultat social automatique.",
          "requiredDomain": "scene_resolution",
          "canonicalActionHint": "ask",
          "noCommit": false,
          "noGameTime": true
        },
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

Exemple I-06ZF sans verbe canonique :

```json
{
  "intentType": "action",
  "commitment": "committed",
  "target": {
    "kind": "object",
    "ref": "poi:back-room-door",
    "label": "porte du fond"
  },
  "action": "open",
  "topic": "manipulation du mecanisme de la porte",
  "coreMeaning": "Le personnage manipule la poignee et le mecanisme de la porte visible, probablement pour tenter de l'ouvrir.",
  "semanticIntent": {
    "schemaVersion": 1,
    "kind": "manipulate_visible_object",
    "playerGoal": "actionner le passage visible ou tenter de l'ouvrir",
    "target": {
      "kind": "object",
      "ref": "poi:back-room-door",
      "label": "porte du fond"
    },
    "commitment": "committed",
    "evidenceFromInput": [
      "mets la main sur la poignee",
      "pivote le mecanisme"
    ],
    "uncertainties": [],
    "forbiddenInterpretations": [
      "la porte s'ouvre forcement",
      "le personnage entre dans la piece",
      "ce qui se trouve derriere est revele"
    ],
    "confidence": "high"
  },
  "runtimeHandling": {
    "schemaVersion": 1,
    "status": "SUPPORTED_BY_CURRENT_RUNTIME",
    "reason": "La cible est visible et le runtime peut enregistrer une action locale bornee sans resultat cache.",
    "requiredDomain": "scene_resolution",
    "canonicalActionHint": "open",
    "noCommit": false,
    "noGameTime": true
  }
}
```

## Champs semantiques obligatoires I-06ZF

`semanticIntent` est obligatoire pour chaque intention acceptee.

Champs :

- `schemaVersion`: `1`;
- `kind`: famille semantique large, par exemple `address_visible_actor`, `manipulate_visible_object`, `observe_environment`, `nonverbal_signal`, `hypothetical_action`, `unclear_intent`;
- `playerGoal`: objectif apparent formule en langage naturel structure;
- `target`: cible probable ou `null`;
- `commitment`: meme enum que l'intention principale;
- `evidenceFromInput[]`: fragments courts du texte joueur qui justifient l'interpretation;
- `uncertainties[]`: incertitudes reelles, pas des precautions generiques;
- `forbiddenInterpretations[]`: resultats, secrets, engagements ou deductions a ne pas ajouter;
- `confidence`: `low`, `medium` ou `high`.
- `perception`: demande perceptive structurée obligatoire pour `observe_environment`, sinon `null`; elle porte `depth=GLANCE|FOCUSED|SEARCH`, un `focus` sémantique et une information recherchée optionnelle.

La profondeur perceptive est proposée par l'IA depuis le sens complet de la demande. Le runtime valide l'enum et la cohérence avec `observe_environment`, mais ne tente pas de reconnaître localement des formulations comme « attentivement » ou « fouiller du regard ».

`runtimeHandling` est obligatoire pour chaque intention acceptee.

Champs :

- `schemaVersion`: `1`;
- `status`: `SUPPORTED_BY_CURRENT_RUNTIME`, `UNSUPPORTED_DOMAIN`, `NEEDS_CLARIFICATION`, `AI_INTERPRETATION_FAILED` ou equivalent a figer;
- `reason`: raison exploitable par developpeur/testeur;
- `requiredDomain`: domaine requis ou `null`;
- `canonicalActionHint`: aide d'exploitation ou `null`;
- `noCommit`: booleen;
- `noGameTime`: booleen.

`canonicalActionHint` ne porte pas le sens. Si ce champ est absent ou `null`, l'intention semantique reste valide tant qu'elle est claire et non dangereuse.

`action` et `runtimeHandling.canonicalActionHint` sont deux aides legacy non autoritaires. Chacune doit respecter son enum et ne doit pas contredire `semanticIntent`, mais une différence entre elles ne suffit pas à rejeter une intention sémantique cohérente. Le runtime ne les utilise ni pour choisir le domaine, ni pour construire la commande, ni pour décider du commit.

Le contexte `recentSemanticTurns` permet à l'IA de comprendre une continuité discursive sans analyse lexicale locale. Il ne devient jamais une autorité : toute cible proposée depuis ce contexte est canonicalisée et revalidée par `scene-referent-registry/1` avant résolution.

## Types d'intention autorisés en I-06X

Le contrat conserve les types compatibles avec I-06 :

```text
meta_question
possibility_query
memory_recall
speech
action
mixed
unclear_commitment
```

Ces types servent au routage large. Ils ne doivent pas remplacer `semanticIntent.kind` et `semanticIntent.playerGoal`.

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

Clarification illegitime I-06ZF :

```text
Je mets la main sur la poignee et pivote le mecanisme.
```

Motif : si la porte visible est le seul referent compatible dans le contexte, la formulation est inhabituelle mais l'intention semantique est suffisamment claire. Le runtime peut ensuite limiter ou refuser la resolution selon ses autorites, sans nier la comprehension.

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
- `semanticIntent` est absent, incoherent ou reduit a une action canonique sans preuves;
- `runtimeHandling` est absent ou pretend supporter un domaine ferme;
- `canonicalActionHint` contredit `semanticIntent.playerGoal`;
- la sortie demande un fallback narratif apres echec.

Le rejet doit produire un incident expurgé et un diagnostic d'echec d'interpretation. Il ne doit pas produire de fallback fictionnel.

## Diagnostic d'echec d'interpretation

Si `player_intent_interpreter` est indisponible, invalide ou rejete, le tour retourne un diagnostic structure, par exemple :

```json
{
  "schemaVersion": 1,
  "stage": "PLAYER_INTENT_INTERPRETATION",
  "role": "player_intent_interpreter",
  "status": "FAILED",
  "category": "AI_OUTPUT_INVALID",
  "rawInput": "Je mets la main sur la poignee et pivote le mecanisme.",
  "issues": [
    "payload.intents[0].semanticIntent is missing"
  ],
  "noCommit": true,
  "noGameTime": true,
  "developerSummary": "L'interpretation IA a ete rejetee; aucune resolution narrative n'a ete tentee."
}
```

Les categories exactes seront figees par l'implementation. Le comportement ne varie pas : aucune reponse fictionnelle ne simule une interpretation reussie.

## Matrices de verification

I-06X doit tester des familles de formulations équivalentes.

I-06ZF ajoute une matrice de cas naturels sans verbe canonique : [`Matrice-cas-I06ZF-interpretation-semantique.md`](Matrice-cas-I06ZF-interpretation-semantique.md).

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

## Criteres de sortie I-06ZF

I-06ZF pourra etre considere pret pour implementation si :

- `semanticIntent` et `runtimeHandling` sont figes dans ce contrat;
- `action` est explicitement declassé en aide d'exploitation non centrale;
- le format de diagnostic d'echec est figé;
- les tests selectionnes depuis la matrice I-06ZF couvrent au moins actions implicites, gestes sociaux, observation, hypothese, domaine non supporte et ambiguite reelle;
- le flux produit ne continue pas avec un fallback narratif quand l'IA d'interpretation echoue;
- les validations locales restent des validations d'autorite et non des dictionnaires lexicaux.

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

I-06ZF precise que cette capacite IA est la seule interpretation active du tour en mode test. Le contrat `intent-clarification/1` et les fournisseurs locaux peuvent rester utiles aux tests techniques isoles, mais ils ne doivent pas masquer une panne de l'IA d'interpretation par une clarification ou une narration de facade.
