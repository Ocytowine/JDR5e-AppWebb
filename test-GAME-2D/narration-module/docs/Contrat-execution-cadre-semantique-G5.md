# Contrat d'exécution du cadre sémantique G5

Date : 2026-08-25  
Statut : `ACTIF_V1`

## But

`open-semantic-execution-plan/1` raccorde les composantes comprises par OpenAI
aux ports propriétaires sans demander à un domaine de relire ou de comprendre
la saisie joueur.

Le cadre `ai-intent-semantic/8` reste la source du sens. Le plan local conserve
pour chaque composante son identifiant, son ordre, son sens, son engagement, ses
conditions, ses dépendances et ses références publiques. Il ne remplace jamais
`meaning` par une catégorie système.

## Sélection d'une capacité

L'interpréteur reçoit les capacités publiques du runtime. Lorsqu'une composante
correspond entièrement au `playerFacingScope` de l'une d'elles, il doit recopier
exactement :

- `capabilityId` dans `suggestedCapabilityId` ;
- le domaine déclaré dans `suggestedDomain`.

`suggestedAction` reste une description naturelle ouverte. Le schéma Structured
Outputs borne uniquement `suggestedCapabilityId` aux capacités publiées et à
`null`; il ne transforme donc pas la compréhension en liste fermée d'actions.

Le registre route seulement si ces deux valeurs correspondent exactement à la
même capacité publiée. Il n'analyse ni `meaning`, ni la saisie brute, ni des
synonymes. Une suggestion ouverte ou inconnue reste
`UNDERSTOOD_UNSUPPORTED`; elle n'est jamais rapprochée d'une capacité voisine.

Les interactions locales publiées distinguent l'approche d'un acteur, la
manipulation d'un objet et le signal non verbal. Ce découpage ne ferme pas le
sens compris : il donne seulement au pont propriétaire une information
d'exécution suffisamment précise pour ne pas dégrader une approche en
manipulation générique.

Cette règle ne ferme pas l'interprétation : toute composante demeure dans le
cadre, qu'elle soit exécutable ou non. Elle ferme uniquement l'autorité
d'exécution aux capacités effectivement installées.

## Dispositions avant propriétaire

Le plan peut classer une étape :

- `ROUTABLE` : capacité exacte `AVAILABLE`, prévalidation propriétaire requise ;
- `SKIPPED_NON_EXECUTABLE` : citation, négation, hypothèse ou absence
  d'engagement ;
- `SKIPPED_SUPERSEDED` : composante remplacée par une correction explicite ;
- `AWAITING_CONDITION` : condition sémantique non encore établie ;
- `AWAITING_PLAYER_CHOICE` : alternative non choisie ;
- `AWAITING_ATOMIC_GROUP_OWNER` : simultanéité sans propriétaire atomique ;
- `HANDOFF_ONLY` ou `EXTERNAL_TRIGGER_REJECTED` selon le manifeste ;
- `UNDERSTOOD_UNSUPPORTED` ou `NEEDS_CLARIFICATION`.

Toutes ces étapes conservent `noCommitBeforeOwnerValidation=true` et
`noGameTimeBeforeOwnerValidation=true`.

## Port propriétaire

Un port déclare exactement son domaine et ses `capabilityIds`. Il reçoit :

- la composante V8 intacte ;
- l'étape du plan ;
- un identifiant d'opération ;
- une clé d'idempotence propre à la composante.

Il ne reçoit aucun `rawInput`. Sa méthode `preflight` vérifie seulement l'état
qu'il possède : cible, possession, ressource, règle, disponibilité et révision.
`execute` n'est appelé qu'après `READY` et avec l'empreinte de l'état relu.

Le propriétaire peut produire un commit, un résultat sans commit, une question
joueur ou un refus. Lui seul décide de ce résultat et du temps éventuel.

Les références d'acteurs visibles publiées à l'interpréteur sont les références
canoniques du registre de scène (`npc:…`). Toute référence présente dans
`currentScene.presentActors` fait partie de la liste publique autorisée par le
validateur V8 ; une sortie qui recopie cette référence ne peut pas être rejetée
comme référence inventée.

## Ordre, arrêts et rejeu

Les étapes sont parcourues dans l'ordre OpenAI. Une dépendance doit déjà avoir
un reçu. Une demande de choix, un refus, un propriétaire absent ou une étape
non routable arrête immédiatement la suite. Les reçus antérieurs sont conservés
et les étapes ultérieures ne sont même pas prévalidées.

Au rejeu, un reçu existant saute entièrement l'étape correspondante. La clé
`operationId:component:componentId` permet aussi au propriétaire de rendre son
exécution idempotente.

Avant toute exécution, le plan est comparé au cadre original. Une modification
du sens, de l'ordre, de l'engagement, des cibles, des dépendances, du domaine ou
de la capacité bloque toutes les étapes.

## Migration

Le plan est déjà construit par le chemin V8 du contrôleur. L'UI reste sur V7
jusqu'à G6/G7, le temps d'injecter et de certifier les adaptateurs des
propriétaires installés avec un fournisseur OpenAI simulé. Aucun ancien runtime
lexical ne doit être utilisé comme adaptateur G5.

## Preuve

```text
npm run narration-module:test:open-semantic-owner-routing-g5
```

La gate couvre une séquence de trois domaines, le refus de la deuxième étape,
l'absence de prévalidation de la troisième, le rejeu sans doublon, les
conditions, alternatives, simultanéités, handoffs, causes externes, suggestions
inconnues, contradictions domaine/capacité et l'altération du plan.
