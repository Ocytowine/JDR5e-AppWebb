# Contrat de l'état social durable et de l'initiative locale

Statut : `LIVRE`
Sous-lot : `6C`
Contrats : `social-actor-registry/1`, `social-local-initiative/1`,
`social-initiative-performance/1`

## Objectif

Donner à chaque acteur une perspective persistante et permettre à un PNJ
présent d'agir depuis une cause qui lui appartient, sans attendre une saisie du
joueur.

La structure `SocialKnowledgeStateV1` de `scene-social-ui/1` reste une
projection de lecture. Elle ne devient pas l'autorité persistante.

## Autorité sociale

L'agrégat `social.actor-registry` possède, par acteur :

- faits connus référencés ;
- croyances distinctes des faits et éventuellement fausses ;
- relations orientées selon `trust`, `affinity`, `fear` et `debt` ;
- réputations contextualisées ;
- dettes et promesses ;
- préoccupations actives pouvant motiver une initiative ;
- dernier instant d'initiative locale.

Une mutation exige une commande versionnée et des sources. Son événement reste
`ACTOR_SCOPED` et ne recopie ni croyance privée ni objectif secret dans un
payload visible.

La parole d'un PNJ, une sortie IA ou une impression du joueur ne modifie pas cet
état sans résultat validé par l'autorité sociale.

## Préoccupation et initiative

Une préoccupation active porte :

- sa cause et ses sources ;
- un objectif privé ;
- un indice d'action public utilisable pour la mise en scène ;
- un type d'acte ;
- une urgence ;
- une fenêtre temporelle ;
- des cibles explicites ;
- un délai minimal entre deux initiatives.

La présence du personnage ne crée jamais automatiquement une cible.

À une frontière de scène, le sélecteur :

1. ne considère que les acteurs présents ;
2. filtre les préoccupations actives, exigibles et non expirées ;
3. refuse une cible acteur absente ;
4. applique le délai propre à l'acteur ;
5. ordonne urgence, ancienneté, acteur, préoccupation et cible ;
6. retourne une initiative, ou `CALM` si aucune cause ne convient.

`CALM` est un résultat valide : aucun commit ni texte de remplissage n'est
requis.

## Commit d'initiative

Une initiative retenue crée atomiquement :

- une commande `social.local-initiative.execute` ;
- une mise à jour du dernier instant et du compteur de la préoccupation ;
- un événement `social.local-initiative.executed` visible dans la scène ;
- un signal public borné pour la future performance PNJ.

Le commit ne change ni temps, ni position, ni relation, ni intrigue. Une
conséquence supplémentaire appartient à son domaine propriétaire.

## Performance et rendu bornés

Le performer reçoit uniquement :

- le signal public committé ;
- l'identité publique de l'acteur présent ;
- la désignation publique de sa cible présente.

Il ne reçoit ni objectif privé, ni croyance privée, ni contrainte de visibilité
interne. Sa sortie est validée, attribuée au bon acteur, puis persistée comme
projection de présentation reconstruisible.

Le performer local initial transforme l'indice d'action public en une phrase de
MJ. Une future variante IA devra respecter la même entrée bornée et le même
validateur. Une parole directe n'est autorisée que pour un acte `SPEAK`.

## Frontière sans saisie joueur

Le contrôleur doit exposer une entrée dédiée de frontière de scène. Elle ne
fabrique pas une fausse entrée joueur et n'appelle pas l'interpréteur
d'intention.

Les frontières autorisées en 6C sont :

- entrée de scène ;
- fin d'un événement local ;
- fin d'un tour narratif ayant réellement progressé ;
- échéance temporelle locale.

L'attente réelle devant l'écran reste exclue.

## Oracles du premier vertical

- état de deux acteurs persisté et relu séparément ;
- connaissance privée absente de l'événement public ;
- relation orientée : `A -> B` ne modifie pas `B -> A` ;
- rejeu idempotent d'une mutation ;
- PNJ présent initiateur avec cible PNJ présente ;
- personnage non ciblé lorsque la cause ne le désigne pas ;
- acteur ou cible absente filtrée ;
- scène sans préoccupation éligible retournée `CALM` ;
- ordre stable entre plusieurs initiatives ;
- rejeu sans double compteur ni double événement ;
- aucun appel à l'interpréteur joueur pour une frontière autonome.

## Hors périmètre 6C

- progression hors écran d'une intrigue ;
- ingestion complète de `world-simulation` ;
- génération IA libre de préoccupations durables ;
- application automatique des conséquences d'une initiative ;
- boucle autonome illimitée entre plusieurs PNJ.

Ces éléments rejoignent 6D et la gate 6V.

## État d'implémentation

Sous-lot livré :

- agrégat et mutation sociale idempotente ;
- projection compatible avec `SocialKnowledgeStateV1` ;
- relations orientées et bornées ;
- croyances et préoccupations privées absentes des événements visibles ;
- sélection stable, cible présente obligatoire et résultat `CALM` ;
- commit d'initiative avec compteur rejouable ;
- entrée `processLocalSocialBoundary` du contrôleur, sans interprétation d'une
  fausse saisie joueur ;
- entrée automatique `processActiveSceneEntrySocialBoundary`, avec personnage
  résolu depuis l'agrégat autoritaire `world.position` ;
- performer local borné, paquet narratif sans fausse entrée joueur et
  projection persistée ;
- restauration dédupliquée à l'ouverture et activation après une transition ;
- test de contrat `narration-module:test:social-actor-authority` ;
- recette navigateur `narration-module:test:social-initiative-ui`, qui prouve
  l'initiative visible avant toute interaction et son absence de duplication
  après rechargement.

Le contenu de production n'est pas artificiellement amorcé : en l'absence de
préoccupation sociale autoritaire, l'entrée de scène retourne `CALM` et
n'ajoute aucun texte.
