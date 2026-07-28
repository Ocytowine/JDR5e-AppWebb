# Contrat interprétation et clarification

Statut : `FIGE` pour le sous-lot I-06E, avec addendum sémantique V5 du
2026-07-28.

Version : `intent-clarification/1`.

Date : 2026-07-07.

## Objectif

Ce contrat fixe le premier niveau d'interprétation d'une saisie libre.

I-06E doit distinguer les entrées qui ne doivent pas muter le monde des entrées potentiellement diégétiques. Il doit aussi produire une clarification lorsque l'engagement du joueur est ambigu.

## Périmètre autorisé I-06E

I-06E peut produire :

- types d'intention applicatifs;
- interprète déterministe conservateur;
- création d'une clarification suspendue;
- reprise d'une réponse à clarification;
- `DisplayPacketV1` de méta, possibilité ou clarification;
- intégration au contrôleur I-06D.

I-06E n'autorise pas :

- appel IA;
- résolution métier;
- commit de domaine;
- avance temporelle;
- reformulation théâtrale complète du PJ;
- création dynamique;
- handoff tactique.

## Types d'intention

Une entrée interprétée possède :

```ts
type IntentType =
  | "meta_question"
  | "possibility_query"
  | "memory_recall"
  | "speech"
  | "action"
  | "mixed"
  | "unclear_commitment";
```

Le sous-lot I-06E traite complètement :

- `meta_question`;
- `possibility_query`;
- `unclear_commitment`;
- réponse à clarification.

Il détecte `speech`, `action` et `mixed`, mais ne les résout pas encore. Ces cas retournent une notification contrôlée indiquant que la résolution réelle appartient au sous-lot suivant.

## Règles de sécurité

Une question de possibilité ne déclenche jamais l'action évoquée.

Exemple :

```text
je peux lui voler quelque chose ?
```

doit produire soit :

- `possibility_query`, sans mutation;
- ou `unclear_commitment`, clarification explicite.

Elle ne peut pas devenir un vol tenté.

Une question méta ne fait pas avancer le temps et ne crée aucune réaction fictionnelle.

Une clarification suspend une intention sans mutation. La réponse du joueur complète l'intention suspendue mais ne crée pas encore un fait externe.

## Clarification suspendue

Une clarification I-06E conserve :

- `suspendedIntentId`;
- `operationId`;
- `rawInput`;
- `knownInterpretation`;
- `missingField`;
- `question`;
- `noGameTime: true`;
- `createdAt`;

Elle ne conserve ni ancien paquet IA, ni raisonnement interne.

## Heuristique déterministe I-06E

Le premier interprète est volontairement conservateur :

- présence d'un point d'interrogation ou forme interrogative + verbe d'action risquée => `possibility_query` ou `unclear_commitment`;
- mots de règles ou interface (`règle`, `comment`, `possible`, `peux`, `MJ`) => `meta_question` ou `possibility_query`;
- formulation explicite de tentative (`je tente`, `j'essaie`, `je fais`, `je vole`) => `action`;
- guillemets ou déclaration de parole directe => `speech`;
- mélange de connecteurs avec action + parole => `mixed`.

En cas de doute significatif sur l'engagement, l'interprète choisit `unclear_commitment`.

## Résultat visible

Le contrôleur retourne toujours un `DisplayPacketV1`.

Pour `meta_question` et `possibility_query`, le paquet contient :

- `RAW_INPUT`;
- `SYSTEM_NOTICE` ou `CLARIFICATION`;
- `noCommit: true`;
- `noGameTime: true`.

Pour `speech`, `action` et `mixed`, I-06E retourne une notification de limite contrôlée, sans résolution.

## Preuves minimales de sortie I-06E

La fermeture exige :

- méta sans temps;
- question de possibilité sans action;
- cas ambigu produisant une clarification;
- réponse à clarification liée à l'intention suspendue;
- action explicite détectée mais non résolue;
- contrôleur intégré sans commit métier;
- build global réussi.

## Décision

`intent-clarification/1` autorise uniquement l'interprétation conservatrice et la clarification. Le prochain sous-lot devra auditer la résolution réelle et l'usage éventuel du rôle IA `intent_interpreter`.

## Addendum V5 — incertitude structurée et focus récent

Une sortie IA structurellement valide n'est pas transformée en panne globale
uniquement parce que sa confiance est faible. Le mapper conserve le sens proposé,
force `requiresClarification`, interdit commit et temps, puis affiche la question
de clarification disponible.

Pour une cible dont `contextLink` vaut `RECENT_FOCUS` :

- le focus appartient au contrôleur local ;
- `proposedRef` doit correspondre à un focus local encore valide ;
- un éloignement `REPOSITION_AWAY` libère ce focus ;
- l'IA ne peut pas le recréer en renvoyant directement l'identifiant de l'ancien
  acteur ;
- une cible explicitement nommée reste résoluble depuis le registre visible.

Cette règle ne lit aucun mot de l'entrée joueur. Elle repose sur la confiance
structurée, le type de lien contextuel, les composantes V5 et le registre local.
