# Intégration entre narration et domaines

Statut : `EN_CONCEPTION` — protocole commun et modes d'intégration retenus; contrats propres à chaque domaine à détailler.

## Objectif

Relier la narration, les règles et les moteurs existants dans une campagne cohérente sans dupliquer leurs autorités ni réduire les interactions à des textes impossibles à valider.

## État actuel constaté

Le dépôt contient des fondations, pas encore les domaines de campagne visés :

- le plateau tactique produit déjà des événements et appelle des routes de résumé et de parole, mais ces contrats restent locaux au combat et essentiellement textuels;
- la simulation mondiale sait valider et injecter des propositions candidates, avancer son horloge et produire des deltas;
- le repos runtime sait restaurer des ressources selon un type, sans orchestrer une session narrative complète;
- personnage, ressources et inventaire sont encore largement intégrés à `GameBoard.tsx` et à des fiches conservées dans `localStorage`;
- aucun `CampaignStore` ne coordonne encore ces états dans une transaction de campagne.

Les futurs contrats peuvent réutiliser ces briques par des adaptateurs. Ils ne doivent pas considérer leur forme actuelle comme l'architecture finale.

## Principe d'autorité

La narration formule une intention, une proposition ou une demande d'arbitrage. Le domaine propriétaire valide, prépare puis applique les changements. La narration reçoit ensuite une projection des résultats; elle ne lit ni ne modifie directement l'état interne complet du domaine.

## Deux modes d'intégration

### Transaction courte

Utilisée lorsqu'une interaction peut être validée et committée dans le même tour : test social simple, achat, consommation d'objet, déplacement local ou modification de ressource.

```text
DomainCommandRequest
  -> DomainValidation
  -> DomainPreparedResult
  -> transaction coordonnée
  -> DomainCommitResult
  -> projections narratives
```

### `ProcessHandoff`

Utilisé lorsqu'un moteur prend temporairement en charge une séquence interactive, sauvegardable et potentiellement longue : rencontre tactique, repos complexe, voyage détaillé ou autre processus futur.

```text
HandoffProposal
  -> validation du déclenchement
  -> ProcessSeed versionné
  -> suspension de la scène narrative
  -> processus propriétaire et checkpoints
  -> ProcessOutcome
  -> validation multidomaine et commit
  -> nouveau TurnSnapshot
  -> scène de continuation
```

Un handoff ne crée pas une branche chronologique. Il suspend un processus, conserve son état dans la même campagne linéaire et reprend sur une version ultérieure.

## Enveloppe commune d'une commande courte

Chaque requête porte au minimum :

- `operationId`, `requestId`, campagne et tour sources;
- domaine et type de commande;
- version de campagne et versions des agrégats lus;
- intention ou événement causal;
- acteur demandeur et autorité de proposition;
- payload conforme au schéma propre à la commande;
- politique d'arbitrage si des paramètres restent ouverts;
- clé d'idempotence et exigences d'atomicité.

L'enveloppe est commune; le payload ne l'est pas. Un achat, un déplacement et un repos utilisent des schémas différents. Un `Record<string, unknown>` générique ne constitue pas un contrat acceptable.

## Validation et préparation

Le domaine retourne l'un des états suivants :

- `ACCEPTED` : la commande peut être préparée;
- `REJECTED` : une règle ou précondition l'interdit;
- `NEEDS_ADJUDICATION` : un jugement ouvert doit fournir un paramètre borné;
- `NEEDS_PLAYER_INPUT` : une décision légitime manque au joueur;
- `STALE` : une dépendance a changé;
- `UNAVAILABLE` : le moteur ne peut pas traiter la demande actuellement.

Un `DomainPreparedResult` décrit sans mutation :

- changements proposés, agrégats et propriétés concernés;
- événements qui seraient produits;
- temps ou arbitrages demandés;
- préconditions et versions relues au commit;
- effets perceptibles et effets privés;
- candidats mémoire et notifications UI;
- besoin éventuel d'un autre domaine;
- comportement d'échec et compensations interdites.

Il ne contient pas de prose destinée au joueur et ne devient jamais une source de vérité persistante.

## Transaction multidomaine

Le coordinateur collecte les résultats préparés de tous les propriétaires concernés. Il vérifie leurs préconditions et versions, puis committe l'ensemble ou rien.

Exemple d'un achat : monnaie du joueur, inventaire du joueur, possession ou stock du vendeur, relation éventuelle et temps écoulé appartiennent à plusieurs propriétés. Aucun débit ne peut survivre si le transfert de l'objet échoue.

Dans le monolithe modulaire visé, cette coordination utilise une transaction du `CampaignStore`; elle ne nécessite pas un protocole distribué entre services réseau.

## Résultat committé et projections

Le résultat d'un domaine contient les événements autoritaires et des projections séparées :

- `narrativeProjection` : résultats perceptibles utilisables par le MJ;
- `playerProjection` : informations et changements accessibles au joueur;
- `privateProjection` : effets réservés à l'orchestrateur et aux domaines autorisés;
- `memoryCandidates` : événements ou faits susceptibles d'être indexés;
- `uiNotifications` : changements mécaniques explicites;
- `continuationHints` : contraintes de continuité, jamais choix suggérés au joueur.

La projection ne devient pas une seconde copie autoritaire de l'état. Elle référence les événements et versions sources.

## Handoff tactique

La narration propose un handoff lorsqu'un conflit exige une séquence tactique : il ne peut plus être résolu par un seul arbitrage narratif ou les acteurs l'ont engagé dans le combat.

Le déclenchement est validé avant création d'un `TacticalEncounterSeed`. Celui-ci devra projeter notamment lieu, participants, camps, objectifs, motivations, caractéristiques, ressources, équipement, états, positionnement, surprise, visibilité, connaissances, enjeux, sorties possibles et version de campagne.

La scène narrative passe dans un état suspendu. La session tactique devient un `ActiveProcess` sauvegardable et produit ses propres checkpoints sans autoriser le joueur à remonter la chronologie.

La narration tactique décrit des événements déjà résolus. Une parole causant reddition, trêve, fuite ou changement d'objectif constitue une action tactique validée, pas un ornement ajouté après coup.

Le `TacticalOutcome` devra restituer au minimum :

- morts, blessures, états et positions finales;
- ressources, sorts, munitions et objets consommés;
- fuite, reddition, capture, séparation et objectifs atteints;
- butin et changements de possession;
- temps écoulé et événements importants ordonnés;
- témoins, connaissances acquises et paroles engageantes;
- dommages persistants au lieu;
- candidats de conséquences sociales, mondiales et narratives.

Après validation et commit de ces conséquences par leurs propriétaires, la narration construit un nouveau snapshot. Elle ne réutilise jamais celui d'avant combat.

## Monde et carte macroscopique

Le `map-module` et sa simulation représentent le monde vivant au-delà de la scène immédiate. Ils portent géographie, positions, déplacements, pressions, tensions, actions de factions, objectifs et événements macroscopiques.

```text
avance du temps validée
  -> simulation mondiale
  -> deltas et événements committés
  -> projection locale pertinente
  -> mémoire et narration
```

La narration peut proposer événements, objectifs, acteurs ou changements mondiaux; la simulation vérifie leur compatibilité. Inversement, un événement du monde devient une matière narrative seulement après filtrage de sa portée, de sa visibilité et de sa pertinence locale.

Le monde macroscopique, la carte tactique et la scène narrative partagent des identifiants de lieux et d'acteurs, mais n'ont pas la même granularité ni la même autorité.

## Personnage et progression

Le `CharacterDomain` de campagne distingue quatre couches :

- identité importée : nom, apparence, histoire et provenance de la fiche source;
- profil mécanique : caractéristiques, compétences, langues, capacités et choix de progression;
- état courant : PV, ressources, conditions, fatigue et effets temporaires;
- profil expressif : registre, traits, valeurs, limites et indications utilisées pour la reformulation théâtrale.

La fiche de l'éditeur reste une source d'import. Toutes les conséquences et progressions modifient uniquement l'instance de campagne.

### Projection vers la narration

La narration reçoit une `CharacterNarrativeProjection` versionnée et limitée à la tâche. Elle peut contenir identité perceptible, traits expressifs pertinents, capacités utiles, langues, états perceptibles et contraintes mécaniques nécessaires.

Elle n'expose pas par défaut l'intégralité de la fiche, les calculs dérivés sans rapport ni les données techniques internes. Le `player_expression_adapter` utilise le profil expressif sans pouvoir le modifier.

### Requêtes et commandes

Le domaine doit accepter des contrats spécialisés pour :

- vérifier ou employer une capacité;
- consommer ou restaurer une ressource;
- appliquer, modifier ou retirer une condition;
- enregistrer blessure, récupération ou mort;
- appliquer une récompense de progression validée;
- ouvrir puis résoudre un choix de progression;
- proposer, accepter ou rejeter une évolution narrative du profil expressif.

Une situation libre peut demander au `rules_adjudicator` de relier l'action décrite aux capacités pertinentes. Le domaine conserve le calcul, le jet éventuel, les coûts et l'application du résultat.

### Progression

Le mode exact — expérience, jalons ou politique hybride — reste configurable. L'IA peut proposer qu'un accomplissement constitue un jalon ou mérite une récompense; elle ne peut pas accorder directement niveau, caractéristique, don, sort ou capacité.

Le domaine vérifie la politique de campagne et produit, lorsque nécessaire, un `ProgressionChoiceRequest` destiné au joueur. Aucun choix n'est complété par l'IA en son nom. La progression committée produit des événements structurés puis une nouvelle projection narrative.

### Évolution narrative du personnage

Les comportements et événements peuvent créer une `CharacterArcObservation` sourcée. Une ou plusieurs observations peuvent conduire l'IA à proposer un `NarrativeTraitCandidate` : peur, attachement, habitude, conviction ou cicatrice psychologique.

Trois niveaux restent distincts :

1. réaction contextuelle justifiée par l'état et la scène;
2. candidat d'évolution conservé pour discussion ou rappel;
3. trait durable accepté explicitement par le joueur.

Une réaction ou observation ne réécrit jamais silencieusement la personnalité. Une condition imposée par une règle — peur magique, charme, épuisement — appartient à l'état courant et peut contraindre temporairement le comportement sans devenir un choix identitaire.

### Résultats et événements

Le résultat distingue valeurs mécaniques privées, changements explicitement affichables et éléments utilisables dans la narration. Les événements attendus incluent notamment :

- `player_resource_changed` et `player_condition_changed`;
- `player_capability_used`;
- `progression_award_granted` et `progression_choice_required`;
- `player_level_changed` ou événement spécialisé équivalent;
- `character_arc_observed`;
- `narrative_trait_proposed`, `narrative_trait_accepted` ou `narrative_trait_rejected`.

### Échecs

- Une capacité inexistante ou indisponible produit un rejet structuré, pas une correction narrative du fait.
- Une ressource insuffisante empêche toute consommation et tout effet dépendant.
- Un choix de progression incomplet suspend uniquement la progression concernée.
- Une proposition d'évolution narrative refusée reste historique dans le diagnostic, mais n'influence plus les projections futures comme trait du personnage.
- Une version obsolète de la fiche de campagne impose une nouvelle projection avant validation.

### Import de la fiche prête à jouer

La fiche produite par l'éditeur est un contrat d'import, pas l'état runtime directement partagé entre tous les moteurs.

L'import :

1. valide la version et les champs sources;
2. résout les références vers races, classes, capacités, sorts et objets;
3. transforme les emplacements matériels en références d'instances;
4. normalise les contenants et placements;
5. réconcilie les représentations monétaires;
6. recalcule les valeurs dérivées depuis les choix et règles épinglés;
7. compare les caches fournis et produit erreurs ou avertissements;
8. conserve la fiche brute, son empreinte et le rapport d'import comme provenance.

`combatStats`, `derived`, `spellcastingState` et autres caches ne deviennent autoritaires qu'après recalcul. Une contradiction critique bloque l'import; une donnée legacy traduisible produit une migration tracée.

### Compatibilité tactique

Un adaptateur construit une `TacticalCharacterProjection` compatible avec les besoins actuels du plateau : statistiques de combat recalculées, actions, réactions, ressources, sorts, équipement accessible, conditions et apparence du token.

Le tactique ne reçoit pas l'agrégat complet et ne le retourne pas pour remplacement. Son résultat contient événements et deltas que les domaines de campagne appliquent. Cette frontière permet de faire évoluer le modèle de campagne sans casser immédiatement le plateau existant.

## Inventaire, équipement et économie

Le système existant possède déjà des instances, des emplacements corporels, des contenants pondérés et des pièces physiques. Le contrat de campagne conserve cette intention tout en normalisant les références.

### Définitions et instances

- `ItemDefinition` appartient au catalogue et décrit propriétés communes, poids, valeur, catégories et capacités;
- `ItemInstance` appartient à la campagne et porte `instanceId`, définition, quantité autorisée, provenance et état propre;
- un objet non empilable possède toujours une quantité de un;
- les propriétés spécifiques, dommages, harmonisation et apparence personnalisée vivent sur l'instance sans réécrire la définition.

### Placement canonique

Chaque instance possède exactement un placement :

- `WORN` dans un emplacement corporel;
- `HELD` dans une main ou posture active;
- `CARRIED` directement par son propriétaire;
- `STORED` dans une autre instance de contenant;
- `GROUND` ou autre emplacement mondial autoritaire;
- `TRANSFER_PENDING` uniquement dans une transaction non committée.

Les emplacements et contenants référencent toujours des `instanceId`. `storedIn` ne peut plus désigner alternativement un emplacement, un identifiant de définition ou une instance.

Le contenu d'un sac est dérivé des placements `STORED`; il n'est pas maintenu comme une seconde liste autoritaire. Les règles empêchent auto-contenance, cycles, dépassement de capacité et profondeur interdite.

### Monnaie

Les pièces présentes dans les contenants constituent la source de vérité de la monnaie physique. Le champ legacy `argent` est comparé à ces piles pendant l'import, puis devient une projection calculée ou une donnée historique non autoritaire.

Les avoirs non physiques futurs — crédit, dette, dépôt ou lettre de change — utilisent des actifs économiques distincts et ne sont pas simulés comme des pièces dans un sac.

### Équipement visible et accessibilité

Porté, tenu, transporté et rangé sont distincts. Un objet peut être possédé sans être visible ni immédiatement accessible.

La projection vers une scène tient compte de :

- emplacement et couches de vêtements ou d'armure;
- contenant fermé ou ouvert;
- taille, couverture et dissimulation;
- lumière, distance et perception de l'observateur;
- action explicite de montrer, cacher, fouiller ou dégainer.

Le contenu d'un sac n'est jamais envoyé comme apparence visible. L'accessibilité influence également la durée et la possibilité d'une action narrative ou tactique.

### État physique et présentation

Une instance peut porter qualité, état matériel, propreté, humidité, traces de sang, odeur et description visuelle spécifique. Le personnage possède en parallèle un état corporel de présentation : hygiène, soin général, odeur et traces visibles.

Une `VisiblePresentationProjection` combine uniquement les éléments perceptibles : corps, vêtements réellement portés, armes, bijoux, symboles, contenants extérieurs et conditions de scène.

Ces données ne modifient pas le Charisme de base. Le `SocialKnowledgeDomain`, assisté si nécessaire par un arbitrage IA, produit un facteur contextuel borné selon observateur, culture, lieu et objectif social.

Exemples : une tenue raffinée peut favoriser l'accueil à une réception, signaler une proie dans un quartier pauvre ou susciter la méfiance dans un groupe hostile aux élites. Une armure sanglante peut intimider un brigand tout en fermant la porte d'un établissement respectable.

### Commerce

Une transaction commerciale sépare offre, négociation et acceptation :

```text
offre ou prix proposé
  -> vérification du stock, de la visibilité et de l'autorité du vendeur
  -> arbitrage économique éventuel
  -> consentement explicite des parties nécessaires
  -> préparation monnaie, objet, possession et temps
  -> commit atomique
  -> projections narrative et UI
```

L'IA peut jouer le marchand, négocier, proposer un prix contextuel ou produire un candidat d'objet. Elle ne peut ni créer de monnaie, ni vendre un objet absent, ni considérer une négociation comme acceptée, ni modifier silencieusement une propriété mécanique cataloguée.

### Échecs et migrations

- Un emplacement référençant plusieurs instances compatibles bloque la normalisation tant que l'ambiguïté n'est pas résolue.
- Une divergence entre `argent` et pièces physiques suit une politique de migration explicite et apparaît dans le rapport d'import.
- Un contenant inconnu ou un cycle invalide bloque le transfert concerné sans perdre les objets.
- Une transaction commerciale partiellement valide ne produit aucun débit, transfert ou changement de stock.
- Une définition disparue reste représentée par une instance orpheline diagnostiquée; elle n'est pas supprimée silencieusement.

## Invariants communs

1. Aucun domaine ne reçoit de prose à interpréter comme commande métier.
2. Aucun résultat préparé n'est visible ou persistant comme vérité.
3. Une opération multidomaine est atomique.
4. Un handoff suspend la scène sans créer de chronologie parallèle.
5. Chaque processus long peut être repris après interruption technique.
6. Une projection narrative référence des événements committés.
7. Le retour d'un processus construit toujours un nouveau snapshot.
8. Un moteur ne modifie pas directement l'état appartenant à un autre domaine.

## Points à traiter

- personnage et progression : traités;
- inventaire et économie : traités;
- déplacement, carte et monde;
- résolution sociale;
- tactique détaillée;
- repos;
- persistance, coordination et reprise.
