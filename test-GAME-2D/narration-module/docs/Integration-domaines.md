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

La narration propose un handoff lorsqu'un conflit exige réellement initiative, positions, déplacement, portée, visibilité, actions répétées, réactions, terrain ou gestion détaillée des ressources. Le simple fait qu'un conflit dure plusieurs échanges ne suffit pas.

Une violence brève et sans incertitude peut rester narrative si le ruleset le permet. À l'inverse, une embuscade peut déclencher le tactique sans accord préalable du joueur lorsque la situation et les règles l'établissent.

### Déclenchement et seed

```text
ConflictEscalationProposal
  -> validation du besoin tactique
  -> TacticalEncounterSeed
  -> chargement ou génération de carte
  -> validation tactique
  -> suspension de la scène
  -> ActiveProcess tactique
```

Le `TacticalEncounterSeed` projette :

- campagne, scène, lieu, temps, versions et graine;
- cause, enjeux, objectifs et engagements du conflit;
- participants, camps, alliances et hostilités;
- projections tactiques des personnages et créatures;
- états, ressources, équipement accessible et capacités;
- positionnement établi, surprise, visibilité et connaissances;
- lumière, météo, terrain, obstacles et éléments persistants;
- zones d'entrée, sorties, possibilités de fuite et renforts;
- conditions de fin autorisées et restrictions narratives.

Le seed ne contient pas l'intégralité des agrégats de campagne. Chaque projection indique son propriétaire et sa version.

### Carte tactique

Une carte existante est chargée lorsque le lieu en possède une. Sinon, un candidat est généré depuis la hiérarchie du lieu, son profil, les éléments déjà établis et les conditions actuelles.

Avant activation, le `TacticalDomain` vérifie :

- connectivité et accessibilité;
- emplacements d'entrée valides et non létaux par défaut;
- sorties cohérentes avec la scène;
- objectifs atteignables;
- dimensions compatibles avec les participants;
- conservation des éléments persistants déjà connus;
- absence de porte, abri ou avantage décisif inventé sans autorisation.

La génération utilise une graine stable. Une reprise technique ne permet pas de demander une carte plus favorable. Un détail généré reste tactique ou éphémère tant qu'il n'est pas promu par le domaine approprié.

### Session et checkpoints

La scène narrative passe à `SUSPENDED_FOR_TACTICAL`. La session tactique devient un `ActiveProcess` sauvegardable. Chaque action committée ou transition significative produit un événement typé et un checkpoint suffisant pour reprendre sans rejouer les actions antérieures.

Le runtime tactique possède l'état transitoire de la rencontre. Il ne modifie pas directement les agrégats de personnage, inventaire, monde ou relation. Les consommations et conséquences sont enregistrées dans le journal tactique puis réconciliées dans le résultat final.

Le joueur ne peut pas sélectionner un ancien checkpoint. Ceux-ci servent uniquement à la reprise technique de la chronologie linéaire.

### Narration et paroles en combat

La narration tactique contextualise des événements déjà résolus. Elle peut être regroupée par action, phase ou round selon la politique de rythme, mais elle ne modifie jamais réussite, dégâts, position, ressource, état ou visibilité.

Une parole décorative respecte la perspective de l'acteur. Une parole causant reddition, trêve, fuite, ordre, révélation ou changement d'objectif constitue une action tactique ou sociale validée et rejoint le journal d'événements.

Les résumés textuels actuels deviennent des projections ou fallbacks. Les futurs événements tactiques typés et leur payload validé sont les sources autoritaires.

### Conditions de fin

La rencontre peut se terminer par victoire, fuite, reddition, capture, négociation, objectif atteint, retrait mutuel, interruption extérieure, mort ou incapacité selon le ruleset. Éliminer tous les adversaires n'est pas la seule condition valide.

Le moteur vérifie la condition, ferme les actions en cours et produit exactement un `TacticalOutcome` pour l'opération.

### Résultat tactique

Le `TacticalOutcome` restitue au minimum :

- journal ordonné et événements significatifs;
- état final et position de chaque participant;
- morts, blessures, états et incapacités;
- ressources, sorts, munitions et objets consommés;
- fuite, reddition, capture, séparation et objectifs atteints;
- temps exact écoulé;
- dommages persistants au lieu et éléments tactiques à promouvoir;
- paroles engageantes, témoins et connaissances acquises;
- butin disponible et possession actuelle, sans transfert automatique;
- candidats de conséquences sociales, mondiales et narratives;
- empreinte de l'état final et références de checkpoints.

Les propriétaires valident leurs deltas, puis le coordinateur committe atomiquement les conséquences. L'intégration possède la même clé d'idempotence que le résultat tactique.

Si l'intégration échoue après la fin du combat, le processus passe à `COMPLETED_PENDING_INTEGRATION`. La rencontre ne peut ni reprendre ni être rejouée; seule l'intégration est réessayée.

Après commit, la narration construit un nouveau snapshot et une scène de continuation adaptée au résultat. Elle ne réutilise jamais celui d'avant combat.

### Adaptation du runtime actuel

La projection `Personnage` utilisée par le plateau reste fournie par l'adaptateur de campagne. Les routes actuelles de résumé et de parole ennemie sont des prototypes à remplacer par les rôles et contrats du pipeline, sans faire de leur texte une source d'événements.

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

### Horloge précise et simulation horaire

La campagne possède une horloge précise dans le `WorldDomain`. Les pas horaires du `map-module` sont des échéances de simulation dérivées, jamais une seconde horloge autoritaire.

Les dialogues, fouilles et micro-déplacements accumulent secondes ou minutes. Lorsque l'horloge franchit une ou plusieurs échéances mondiales, l'orchestrateur demande à la simulation d'avancer jusqu'au temps de campagne courant. Le détail du rattrapage et des événements simultanés relève de l'atelier sur le temps.

### Échelles de déplacement du joueur

Le contrat distingue :

1. micro-déplacement dans la scène, sans changement d'ancre mondiale;
2. transition locale entre sous-lieu, bâtiment ou quartier;
3. voyage entre ancres mondiales, géré par un `TravelProcess`;
4. déplacement hors écran des acteurs simulés.

La position du joueur reste hiérarchique : région, ville, quartier, lieu et sous-emplacement. Sur une route, elle porte origine, destination, direction et progression. Les algorithmes de mobilité peuvent être partagés avec les acteurs mobiles, mais le joueur n'est pas réduit à un `MobileActor` générique.

### Plan et processus de voyage

Une intention de voyage produit un `TravelPlan` validé contenant :

- origine, destination et itinéraire;
- mode de transport, allure et discrétion;
- compagnons et capacités pertinentes;
- segments, durée estimée et ressources;
- risques connus du personnage;
- points d'interruption et conditions d'arrivée;
- versions des routes et ancres utilisées.

L'IA interprète une formulation ouverte comme « le chemin le plus discret ». Le monde valide topologie et existence des routes. Une route absente exige une proposition de création ou un arbitrage de voyage hors route; elle n'apparaît pas dans la prose.

Le voyage progresse segment par segment. Chaque progression avance l'horloge, déclenche les échéances de simulation nécessaires et vérifie les intersections avec événements, signaux, acteurs mobiles et dangers. Une interruption suspend le voyage ou le transforme en scène ou handoff; elle ne fait pas disparaître les segments déjà committés.

### Rencontre de voyage

Un moteur dédié évalue les rencontres à des points significatifs du trajet :

```text
contexte du segment
  -> pression de rencontre
  -> tirage reproductible
  -> catégorie compatible
  -> candidat systémique ou création IA contrainte
  -> validation et commit
  -> perception et restitution de la main
```

La pression dépend notamment de durée, distance, danger, trafic, sécurité, biome, météo, heure, factions, mobiles, tensions, faune, population, allure, discrétion, taille du groupe, intrigues actives et rencontres récentes.

Elle augmente au cours du voyage et diminue après une rencontre significative. Des délais et budgets empêchent répétitions et saturation. L'absence de rencontre reste un résultat normal.

Le hasard utilise une graine dérivée de la campagne, du voyage et du segment. Une reprise technique ou une nouvelle tentative ne relance pas le tirage pour obtenir un autre résultat.

Les catégories initiales couvrent voyageurs, habitants, groupes marchands ou de faction, animaux et créatures, phénomènes étranges, découvertes, dangers environnementaux, conséquences mondiales, rencontres d'intrigue et vignettes d'ambiance.

Le danger influence surtout hostilité, surprise et gravité; il ne transforme pas toute rencontre en combat. Trafic, écologie, population, phénomènes locaux et objectifs du monde influencent leurs propres catégories.

### Création et persistance d'une rencontre

Le moteur décide occurrence et catégorie. Si aucun acteur ou événement systémique existant ne convient, l'IA produit un `TravelEncounterCandidate` dans un profil génératif borné : lieu et fenêtre temporelle, participants, provenance culturelle, destination, activité, disposition, signaux perceptibles, risques et profondeur de persistance initiale.

Le candidat est contrôlé contre géographie, population, factions, écologie, ton et niveau d'étrangeté local. Une étrangeté possède un budget contextuel; elle ne justifie pas une incohérence arbitraire.

Une rencontre non engagée peut rester éphémère et poursuivre son trajet. Une interaction, un engagement, une conséquence ou une réutilisation promeut les acteurs et faits nécessaires selon les règles des créations dynamiques.

### Agence et perception

La rencontre est présentée par des signes accessibles au personnage. Le système rend la main sans menu d'actions : observer, parler, suivre, éviter, attaquer ou ignorer restent des saisies libres.

Un événement imperceptible ne bloque pas le joueur. Une embuscade ou un danger inévitable suit les règles de perception, surprise et résolution applicables au lieu d'offrir artificiellement une décision préalable.

Une rencontre aléatoire ne devient jamais rétroactivement une solution indispensable d'intrigue. Tout indice, secret ou engagement majeur qu'elle porte est validé et committé avant sa présentation.

### Visibilité des événements mondiaux

Un `WorldEvent` est une vérité système, pas une connaissance automatique. Une observation directe produit une perception; une conséquence perceptible produit un signal; une transmission validée produit une connaissance; une diffusion indirecte produit une rumeur avec provenance et crédibilité.

Les événements distants restent privés tant qu'aucun canal de connaissance ne les relie au personnage.

### Lieux de campagne

Un lieu généré reçoit un identifiant stable, une ancre géographique compatible, un profil hérité et une existence dans le registre effectif de campagne. Il complète la carte sans réécrire silencieusement le layout édité d'origine.

Les coordonnées macroscopiques contraignent une future génération locale ou tactique; elles ne sont pas considérées comme un plan détaillé du lieu.

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

## Résolution sociale

Le `SocialKnowledgeDomain` possède relations, réputations, dettes, connaissances et croyances. Le `NarrativeActorDomain` possède personnalité, motivations, valeurs, objectifs et état d'acteur. La résolution sociale construit une vue cohérente de ces autorités sans les fusionner.

### Situation sociale

Un `SocialSituationSnapshot` est créé pour chaque acteur significatif. Il contient uniquement ce qui est pertinent depuis sa perspective :

- relation durable et historique causal;
- disposition et émotion temporaires;
- motivations, valeurs, limites, craintes et objectifs;
- connaissances, croyances, secrets et engagements;
- rapport de pouvoir et témoins présents;
- demande, argument, preuve ou levier employés;
- réputation et présentation visibles pertinentes;
- règles sociales et capacités applicables.

Deux PNJ présents dans la même conversation peuvent recevoir des snapshots et produire des réactions différentes.

### Décision ou résolution mécanique

Le système classe la situation :

- décision évidente sans enjeu incertain;
- impossibilité cohérente pour cet acteur;
- incertitude nécessitant une résolution mécanique;
- effet régi par une capacité ou une magie spécifique;
- cas ouvert nécessitant un arbitrage borné.

Un jet n'est pas demandé pour chaque dialogue. Une réussite n'oblige jamais un PNJ à agir contre une impossibilité, une valeur fondamentale ou une contrainte qu'aucun effet de règle ne permet de dépasser.

### Pipeline

```text
intention et expression validées
  -> faisabilité selon l'acteur
  -> facteurs contextuels proposés
  -> validation du ruleset
  -> décision, jet ou arbitrage
  -> PreparedSocialResult
  -> performance exacte du PNJ
  -> validation des connaissances et engagements
  -> commit coordonné
```

Le résultat provisoire précède la réplique afin que le PNJ puisse réagir à l'issue réelle. La réplique ne peut ensuite ajouter une concession, un secret ou une conséquence absents du résultat préparé.

### Compétence du joueur et du personnage

Le système évalue l'approche choisie, les arguments et preuves disponibles, puis les capacités du personnage. Il n'évalue ni l'orthographe, ni l'aisance littéraire du joueur.

Le `player_expression_adapter` peut développer une entrée succincte selon le profil du personnage. Il conserve strictement l'idée choisie. Un personnage peu charismatique peut présenter maladroitement un bon argument; un personnage éloquent peut mieux formuler une intention simple sans inventer un levier ou un mensonge.

Une limitation de langue, de connaissance ou de capacité suit les règles applicables. Elle n'est pas déduite arbitrairement du style d'écriture réel du joueur.

### Facteurs contextuels

Preuves, rapport de force, réputation, dette, public, culture, présentation visible, timing et approche peuvent modifier la faisabilité, la difficulté ou la disposition.

L'IA propose leur lecture sémantique avec références. Le domaine social applique uniquement les effets bornés par le ruleset. Un vêtement raffiné, une arme sanglante ou un insigne n'accordent donc jamais un bonus universel.

### Relations et disposition

La disposition temporaire est séparée de la relation durable. Une humeur irritée peut disparaître sans réduire une confiance établie; une trahison committée peut modifier durablement plusieurs axes.

Le modèle initial distingue au moins : confiance, respect, peur, affection, hostilité et obligation. Ces axes sont optionnels selon la relation et leur échelle exacte appartient au ruleset. Chaque variation durable reste petite, bornée, sourcée et accompagnée d'une cause.

Un score unique d'affinité ne peut pas remplacer ces axes : une personne peut respecter, craindre et détester simultanément le personnage.

### Connaissances et actes de parole

Une affirmation entendue peut produire :

- connaissance de l'existence de la déclaration;
- croyance dans son contenu avec confiance et source;
- connaissance objective seulement si un canal de preuve valide l'établit.

Mensonge, doute, secret, promesse, menace, dette, ordre et refus restent des actes distincts. Un test de tromperie réussi modifie la croyance de la cible; il ne transforme pas le mensonge en vérité.

Les témoins reçoivent seulement ce qu'ils peuvent percevoir. Leurs réactions et éventuelles conséquences de réputation sont calculées depuis leurs propres perspectives.

### Conséquences

Un résultat social peut produire information transmise, croyance modifiée, promesse, dette, menace, changement relationnel, réputation, prix négocié, condition commerciale, conflit apaisé ou escaladé et temps écoulé.

Commerce, inventaire, monde et tactique appliquent eux-mêmes les conséquences qui leur appartiennent dans la transaction coordonnée.

### Garde-fous

- Aucun jet social ordinaire ne contrôle directement les choix intérieurs du personnage joueur.
- Un PNJ n'acquiert pas une connaissance seulement parce que le MJ ou un autre PNJ la possède.
- Un échec ne justifie pas automatiquement hostilité ou combat; ces escalades doivent découler de la situation et être validées.
- Difficultés, jets secrets et croyances privées ne sont révélés que si la politique de jeu les rend perceptibles.
- Une relation ne change pas à partir de la seule prose finale.

## Repos narratif et moteur de règles

Le repos est un `ProcessHandoff` lorsque son déroulement implique choix, activités, consommation, progression temporelle ou risque d'interruption. Les types, durées, bénéfices et conditions proviennent exclusivement du ruleset maison actif.

### Déclenchement

Une intention explicite produit un `RestProposal`. Une pause, une position assise, une question méta ou une attente hors jeu ne déclenchent pas automatiquement un repos mécanique.

Le `RestDomain` valide type demandé, lieu, sécurité, participants, disponibilité temporelle, ressources et conditions avant de créer le processus.

### Seed et plan

Le `RestSeed` projette :

- type et règle de repos;
- lieu, heure, durée et niveau de sécurité;
- participants, PV, fatigue, conditions et ressources;
- nourriture, eau, matériel et objets utilisables;
- capacités susceptibles de se recharger;
- activités et choix accessibles;
- risques et sources d'interruption;
- événements mondiaux proches et versions sources.

Les questions nécessaires sont dérivées des règles et de l'état : ressources de récupération, garde, activité, soins, préparation, consommation ou arbitrage entre bénéfices incompatibles.

L'IA formule ces questions dans le flux conversationnel. Elle ne crée ni option ni bénéfice mécanique absent. Répondre à une question de préparation ne fait pas avancer le temps; l'activité committée le fait.

### Progression

```text
RestProposal
  -> validation et questions
  -> RestPlan
  -> segments de repos
  -> événements et interruptions éventuels
  -> RestOutcome
  -> intégration multidomaine
  -> nouveau snapshot
```

Chaque segment peut avancer l'horloge, déclencher le rattrapage mondial, consommer les ressources prévues, résoudre une activité et évaluer une interruption avec une graine stable.

Les événements possibles ne sont pas uniquement hostiles : conversation, soin, étude, découverte, changement de météo ou évolution mondiale peuvent être mis en scène selon le contexte et les règles.

### Interruption et reprise

Une interruption conserve temps, consommations et phases déjà committés. Le domaine détermine les bénéfices acquis, perdus ou encore accessibles et indique si le repos peut reprendre.

Un handoff tactique suspend le repos. Après son intégration, un nouveau snapshot et le ruleset décident si la suite reste valide. Le système ne suppose jamais qu'un repos interrompu échoue ou réussit intégralement.

### Résultat

Le `RestOutcome` peut porter :

- PV, ressources, fatigue et conditions modifiés;
- objets, nourriture et eau consommés;
- sorts, capacités ou choix préparés;
- activités accomplies;
- hygiène et présentation modifiées;
- temps exact écoulé;
- conversations, connaissances et événements vécus;
- conséquences du monde pendant la période;
- statut complet, partiel ou interrompu et règles appliquées.

Chaque propriétaire valide ses deltas avant le commit coordonné. Le helper existant de restauration des ressources reste un calcul élémentaire, pas le contrat complet du futur domaine.

### Signal d'interface

L'interface affiche un signal bref lorsque la phase de repos commence et lorsqu'elle se termine. Ce signal est déclenché uniquement par les événements committés :

- `rest_started` après création effective du processus;
- `rest_completed` après intégration réussie;
- `rest_interrupted` ou `rest_failed` avec un libellé distinct lorsque le repos ne se termine pas normalement.

Le popup ne contient aucun choix mécanique et ne remplace pas la narration. Il indique au minimum le type de phase et son statut avec texte et repère visuel, la couleur ne pouvant être le seul signal. Son affichage ne fait pas avancer le temps et son contenu reste inscrit dans le fil ou le journal d'interface pour ne pas dépendre d'une animation éphémère.

## Persistance, coordination et reprise

Chaque opération possède un enregistrement durable indépendant de la prose :

```text
RECEIVED
  -> PREPARING
  -> PREPARED
  -> COMMITTED_PENDING_RENDER
  -> RENDERED
```

Les états `SUSPENDED`, `COMPLETED_PENDING_INTEGRATION` et `FAILED_WITHOUT_COMMIT` couvrent respectivement une attente légitime, un processus terminé à intégrer et un échec sans mutation.

### Réception et commit

Dès la soumission, l'entrée brute, `operationId`, campagne et version observée sont enregistrés. Les sorties IA et résultats préparés restent remplaçables jusqu'au commit.

Le coordinateur :

1. collecte les préparations de tous les domaines;
2. vérifie leurs préconditions et versions sur une même base;
3. relit les dépendances juste avant écriture;
4. écrit atomiquement agrégats, événements, horloge, processus actif, résultat et clés d'idempotence;
5. passe l'opération à `COMMITTED_PENDING_RENDER`;
6. produit, valide, enregistre puis affiche la rédaction sans rejouer le métier.

Une transaction peut aussi enregistrer candidats mémoire et notifications UI. Les index et projections reconstruisibles sont mis à jour après le commit depuis les événements; leur panne ne retire pas la validité du commit.

### Reprise par état

| État retrouvé | Reprise |
|---|---|
| `RECEIVED` | reconstruire snapshot et pipeline |
| `PREPARING` ou `PREPARED` | abandonner les valeurs provisoires et revalider depuis l'état courant |
| `COMMITTED_PENDING_RENDER` | reprendre uniquement rédaction et validation d'affichage |
| `RENDERED` | restituer le résultat existant sans nouvelle exécution |
| `SUSPENDED` | reprendre le processus depuis son checkpoint courant |
| `COMPLETED_PENDING_INTEGRATION` | intégrer le résultat final existant avec sa clé d'idempotence |
| `FAILED_WITHOUT_COMMIT` | permettre une nouvelle tentative de la même intention sans conséquence préalable |

### Checkpoints

Voyage, tactique et repos écrivent leurs checkpoints dans le `CampaignStore`. Un checkpoint contient l'état minimal autoritaire du processus, le dernier événement appliqué, la version attendue et une empreinte.

Il n'est jamais exposé comme une sauvegarde sélectionnable. Une reprise continue depuis le dernier état committé et ne permet pas de rejouer une décision.

### Contrat de stockage

Le code métier dépend d'un port `CampaignRepository`, pas d'une API navigateur particulière. Trois adaptateurs sont prévus :

- `MemoryCampaignRepository` pour tests unitaires et scénarios rapides;
- `IndexedDbCampaignRepository` pour le prototype et le MVP local dans le navigateur;
- éventuel `SqliteCampaignRepository` si le serveur local devient ensuite l'autorité durable.

`localStorage` reste réservé aux préférences, au pointeur de campagne active et à l'import legacy. Il peut servir à un spike jetable, mais pas de stockage canonique du journal, des agrégats et checkpoints.

IndexedDB est préféré localement parce qu'il fournit transactions, écritures asynchrones, capacité supérieure et collections séparées. Les magasins conceptuels couvrent au minimum en-têtes de campagnes, agrégats, journal d'événements, opérations, processus/checkpoints, transcript et tâches de projection.

Le contrat doit préserver ordre des événements, contrôle optimiste des versions, unicité des opérations et transaction atomique indépendamment de l'adaptateur.

### Frontières du commit et de l'affichage

Le commit métier et le message visible sont séparés. Une panne entre les deux laisse un résultat valide à narrer, pas une action à résoudre de nouveau.

Le transcript visible est append-only. Un rendu de secours déjà affiché n'est pas remplacé silencieusement. Les diagnostics et candidats rejetés restent dans des journaux techniques distincts.

L'exemple [`Exemple-integration-domaines.json`](Exemple-integration-domaines.json) illustre une transaction commerciale multidomaine et sa reprise possible.

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
- déplacement, carte et monde : traités;
- résolution sociale : traitée;
- tactique détaillée : traitée;
- repos : traité;
- persistance, coordination et reprise : traitées.
