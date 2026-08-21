# Contrat du profil conversationnel éphémère des PNJ

Date : 2026-07-30

Statut : `IMPLEMENTE_ET_VALIDE`

## Objectif

Toute présence ciblable doit pouvoir soutenir un échange incarné sans être
promue au préalable en acteur social durable. Sa perspective conversationnelle
est amorcée dans le même appel que sa première réplique, mémorisée à court
terme, puis réinjectée si le même `actorId` reparaît.

Cette capacité doit réduire les réponses administratives ou interchangeables
sans ajouter un rôle IA, un appel distant ou une nouvelle autorité métier.

## Profil

Le `npc_performer` produit avec chaque réaction acceptée un instantané
`conversationProfile` contenant :

- une perspective subjective résumée ;
- jusqu'à trois préoccupations immédiates privées ;
- jusqu'à quatre opinions subjectives par sujet ;
- des amorces de conversation possibles ;
- des limites que le PNJ évite ou reconnaît ;
- des indications de voix et de rythme ;
- un ton relationnel non mécanique ;
- une révision de continuité.

Le premier instantané porte `INITIALIZED`. Les suivants portent `CONTINUED`,
reprennent le même `profileId` et incrémentent exactement la révision.

## Cycle de vie et persistance

Le profil est enregistré uniquement dans la sortie d'une opération narrative
dont la performance PNJ a passé le schéma, les validations locales et, lorsque
requis, le critique. Aucun second commit n'est ajouté.

Avant un nouvel échange, le runtime relit les opérations terminées, sélectionne
le dernier profil accepté du même `actorId` et le fournit au performer. Cette
mémoire :

- survit à un rechargement et à une sortie-retour de scène ;
- reste isolée par acteur ;
- n'est ni un agrégat `social.actor-registry`, ni une vérité de campagne ;
- n'est pas créée lorsqu'une performance est rejetée ;
- ne promeut jamais l'acteur automatiquement.

Un acteur récurrent conserve ainsi sa continuité tant que son identité canonique
reste la même. Une future promotion pourra relire ces instantanés comme
matériau attribué, mais le domaine social devra sélectionner et valider
explicitement tout élément durable.

## Autorité

Les champs `perspectiveSummary`, `currentConcerns` et `subjectiveOpinions`
décrivent la subjectivité privée du PNJ. Ils peuvent guider sa parole, mais ne
prouvent ni biographie, ni fait du monde, ni secret, ni relation mécanique.

Une opinion exprimée devient une parole attribuée au PNJ. Elle ne devient pas
un fait objectif. Les connaissances factuelles restent limitées aux
`allowedSourceRefs` déjà fournis au performer.

Le profil impose :

- `lifecycle=EPHEMERAL_DIALOGUE` ;
- `durable=false` ;
- identité, source de continuité et révision attendues par le runtime ;
- aucune promesse, réussite sociale, mutation, avance du temps ou révélation.

## Incarnation attendue

Le performer peut :

- donner un avis subjectif compatible avec son rôle et sa situation ;
- manifester curiosité, réserve, lassitude, humour ou compassion ;
- poser occasionnellement une question en retour ;
- ouvrir un sujet adjacent puis revenir au but du joueur ;
- reconnaître une limite de connaissance de manière incarnée.

Il ne doit pas transformer chaque réponse en interrogatoire, réciter le profil,
inventer une biographie ou produire une formule générique lorsqu'une opinion
subjective bornée suffit.

## Preuves attendues

- premier échange : profil révision 1 produit sans appel supplémentaire ;
- deuxième échange : même profil injecté, révision 2 et évolution cohérente ;
- autre acteur : aucune contamination ;
- sortie-retour ou nouveau contrôleur : dernier profil restauré ;
- sortie rejetée : aucun profil mémorisable ;
- `durable=false` et aucun agrégat social créé ;
- schémas TypeScript et serveur OpenAI stricts concordants ;
- conversations longues, route serveur et build global validés.

## Validation du 2026-07-30

- `narration-module:test:complete-conversations` couvre 13 tours, deux acteurs,
  l'amorçage, les révisions, l'isolation et la reprise ;
- la gate dédiée rejette `durable=true`, puis prouve que la révision rejetée
  n'est pas mémorisée ;
- `narration-module:test:npc-return-ui` conserve identité, formulations et
  mémoire après une sortie-retour puis un rechargement réel ;
- les schémas TypeScript et serveur imposent le même profil strict ;
- `narration-module:test:ai-intent-interpretation`,
  `verify-narrative-render-projection.ts`, les contrats campagne et le build
  global passent.
