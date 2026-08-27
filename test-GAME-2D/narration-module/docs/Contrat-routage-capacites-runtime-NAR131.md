# Contrat de routage des capacités runtime — NAR-131

Date : 2026-07-21

Statut : `IMPLEMENTE_DANS_PERIMETRE`

## Objectif

NAR-131 sélectionne une capacité runtime depuis l'intention sémantique structurée, sans transformer `canonicalActionHint`, `action`, `coreMeaning` ou le texte joueur en langage de routage concurrent.

```text
semanticIntent + domaine suggéré
→ registre local de capacités
→ HANDLE | HANDOFF | CLARIFY
→ famille de commande typée
→ domaine propriétaire ou arrêt explicite
```

Le routage ne résout aucune conséquence et ne donne aucune autorité de commit à l'IA ou au planner.

## Contrat actif

Le registre `narrative-runtime-capability-registry/1` déclare un identifiant stable, les familles `semanticIntent.kind`, le domaine propriétaire, la famille de commande et les politiques de commit et de temps.

`NarrativeRuntimeRouteV1` expose `routeId`, `capabilityId`, `disposition`, `requiredDomain`, `commandFamily`, `commitPolicy` et une raison diagnostique.

| Capacité | Intentions | Domaine | Commande | Commit |
|---|---|---|---|---|
| `scene.visible-actor-approach` | approche près d'un acteur visible | `scene_resolution` | `SCENE_INTERACTION` | validation du domaine |
| `scene.visible-actor-orientation` | orientation de l'attention ou du corps vers un acteur visible | `scene_resolution` | `SCENE_INTERACTION` | validation du domaine |
| `scene.visible-object-interaction` | manipulation d'un objet visible | `scene_resolution` | `SCENE_INTERACTION` | validation du domaine |
| `scene.visible-nonverbal-signal` | signal non verbal à un acteur visible | `scene_resolution` | `SCENE_INTERACTION` | validation du domaine |
| `scene.visible-dialogue` | adresse à un acteur visible | `social` | `SPEECH` | validation du domaine |
| `scene.visible-perception` | observation | `perception` | `PERCEPTION` | interdit |
| `scene.context-response` | contexte, méta, hypothèse | `scene_resolution` | aucune commande engagée | interdit |

Le registre V1 garde `inventory`, `tactical`, `rest` et `world` fermés. Le
registre actif V2 ouvre uniquement `rest.process` lorsqu'un propriétaire de
repos effectif est injecté. Les transitions monde et la création dynamique
restent exécutées par leurs runtimes dédiés après validation de l'intention.
`inventory` et le combat tactique générique restent des handoffs non exécutés.
Une intention qui requiert un domaine fermé conserve son sens et n'est jamais
rabattue sur `scene_resolution`.

Le manifeste distingue toutefois deux adaptateurs spécialisés déjà
propriétaires : `inventory.access-credential` pour présenter un exemplaire à un
contrôle actif et `tactical.access-conflict` pour amorcer le handoff d'un seuil
contrôlé. Leur disponibilité suit l'injection effective de ces runtimes. Elle
n'ouvre ni `inventory.mutation`, ni `tactical.generic-handoff`, qui restent
toujours `HANDOFF_ONLY`. Progression et ordres de bastion ne sont pas annoncés
comme commandes texte libre tant que leurs options publiques typées manquent.
La matrice complète est figée dans
[`Contrat-commandes-joueur-domaines-proprietaires.md`](Contrat-commandes-joueur-domaines-proprietaires.md).

## Vue fournie à l'interpréteur

`interpreter-runtime-context/1` est un manifeste public d'aide à
l'interprétation. Il distingue :

- `AVAILABLE` : raccord applicatif présent, autorisation métier encore requise ;
- `HANDOFF_ONLY` : domaine compris mais non exécutable depuis le tour libre ;
- `EXTERNAL_TRIGGER_ONLY` : fonctionnalité réveillée par une cause ou commande
  propriétaire.

Le manifeste ne remplace pas le registre. Une disponibilité proposée ou
interprétée par l'IA n'ouvre aucune capacité : `routeNarrativeSemanticIntentV2`
reçoit séparément les propriétaires réellement injectés et reste autoritaire.

## Sources et autorité

- `semanticIntent.kind` sélectionne une capacité déclarée.
- `runtimeHandling.requiredDomain` reste une suggestion IA validée par le registre.
- `canonicalActionHint` n'intervient jamais dans le choix de la route.
- les cibles restent validées séparément par `scene-referent-registry/1`.
- `runtimeDecision` reste la projection autoritaire consommée par le planner et le resolver.
- `NarrativeDomainCommandV1.payload` conserve la route et la capacité pour le diagnostic.

Une intention incertaine ou sans capacité correspondante produit `CLARIFY`. Le registre ne doit pas employer `scene_resolution` comme défaut pour faire progresser artificiellement le tour. Ajouter une capacité exige une entrée déclarative, un domaine propriétaire, une famille de commande et des tests; ajouter des mots-clés au routeur est interdit.

Les trois capacités locales sont volontairement distinctes dans le manifeste
fourni à OpenAI. Cette précision concerne uniquement l'exécution : le cadre V8
conserve toujours le sens naturel ouvert dans `meaning`, même si aucune
capacité ne convient. Elle évite que l'adaptateur propriétaire transforme une
approche d'acteur en manipulation d'objet sans réintroduire un interpréteur
lexical local.

La compatibilité des domaines potentiellement concurrents est structurelle. Une manipulation d'objet peut légitimement demander `inventory`; une interaction visant un PNJ peut demander `tactical`; une entrée ou transition peut demander `world`. En revanche, une suggestion `world` ne détourne pas une manipulation locale dont `forbiddenInterpretations` interdit explicitement `scene_transition`. Cette matrice consulte uniquement les champs structurés de `semanticIntent`, le type canonique de cible et le domaine proposé.

## Preuves

- manipulation de scène routée sans `canonicalActionHint` ;
- modification du hint sans changement de route ;
- intention d'inventaire transformée en handoff sans commit ;
- dialogue et perception dirigés vers leurs capacités propres ;
- intention indéterminée clarifiée ;
- matrices d'autorité et d'invariance conservées.

Commande ciblée : `npm run narration-module:test:runtime-routing`.

## Portée de la livraison

NAR-131 n'ouvre aucune nouvelle mécanique. La gate qui lui a succédé a éprouvé
NAR-129 à NAR-131 sur des conversations PNJ longues et des scènes complètes.
Cette séquence est livrée et n'ordonne pas les travaux futurs.
