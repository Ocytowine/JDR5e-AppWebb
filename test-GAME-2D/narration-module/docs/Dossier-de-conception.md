# Dossier de conception du module narration

Version de travail : `0.1`

Dernière mise à jour : `2026-06-30`

Statut global : `RETENU` — socle en cours de consolidation, aucun contrat d'implémentation encore figé.

## 1. Finalité du module

Le module narration est le cœur du jeu de rôle solo. Il doit permettre au joueur d'agir librement dans un monde cohérent, sans réduire l'expérience à des quêtes préécrites ou à des PNJ limités à des arbres de dialogue.

L'IA tient le rôle d'auteur de la mise en scène et de maître du jeu : elle crée les scènes, dialogues, PNJ, événements, intrigues, motivations et complications utiles à l'aventure.

Le logiciel fournit le cadre de confiance : il expose la vérité utile, applique les règles, contrôle les droits de modification, persiste les conséquences et empêche les contradictions non autorisées.

### Résultat recherché

- Une saisie libre du joueur produit une réponse adaptée à la situation réelle.
- Le monde et les personnages semblent vivants, sans contenu intégralement préparé à l'avance.
- Une information établie peut être retrouvée plusieurs mois de temps de jeu plus tard.
- La créativité de l'IA reste forte sans lui permettre de falsifier une résolution mécanique ou un fait persistant.
- Le passage narration, tactique, monde et retour narration conserve une causalité traçable.

### Anti-objectifs

- Construire un moteur de quêtes rigide que l'IA se contente d'habiller.
- Utiliser la conversation brute comme base de données ou comme unique mémoire.
- Envoyer toute la campagne à l'IA à chaque tour.
- Déduire la vérité depuis des mots-clés, une similarité textuelle ou un résumé généré.
- Laisser l'IA modifier directement un état persistant sans validation.
- Dupliquer dans le module narration l'horloge, la simulation ou les règles appartenant à un autre module.

## 2. Partage des responsabilités

Statut : `RETENU`.

### L'IA crée et met en scène

L'IA peut notamment :

- rédiger descriptions et dialogues;
- interpréter une saisie libre et signaler ses ambiguïtés;
- proposer des actions, événements, PNJ, objets narratifs et fils d'intrigue;
- choisir un ton, un rythme et un angle de mise en scène;
- exploiter les connaissances et motivations propres à chaque acteur;
- proposer les conséquences narratives compatibles avec les résultats validés.

### Le logiciel dirige et garantit

Le logiciel doit :

- construire le contexte de scène à partir de sources autorisées;
- vérifier les identifiants, la provenance et la compatibilité des informations;
- valider ou refuser les créations et commandes proposées;
- déléguer les résolutions aux moteurs propriétaires;
- enregistrer atomiquement les événements et mutations acceptés;
- gérer sauvegarde, reprise, versionnement et diagnostic;
- limiter et mesurer le contexte transmis à l'IA.

### Règle fondamentale

L'IA peut proposer qu'un fait devienne vrai. Un fait persistant ne devient vrai qu'après validation et enregistrement par le logiciel ou par le module qui en est propriétaire.

Cette règle ne réduit pas l'IA à un générateur de texte : elle conserve l'initiative créative, tandis que le logiciel conserve l'autorité transactionnelle.

## 3. Autorité des données

Statut : `RETENU`; première matrice validée, flux de mutation et propriétaires secondaires encore à compléter.

| Données | Autorité prévue | Usage par la narration |
|---|---|---|
| Canon initial du monde | Wiki et données de lore | Lecture et sélection de faits sourcés; aucune mutation de campagne dans le wiki |
| Overrides et créations propres à une partie | État de campagne | Projection de la vérité effective et propositions validées |
| Temps, géographie, factions, tensions | `map-module` | Projection locale et demandes d'évolution |
| Création et choix de progression du PJ | Domaine personnage | Production ou évolution contrôlée de la fiche source |
| Instance du PJ dans une campagne | Domaine personnage de campagne | Lecture des capacités et demandes de mutations validées |
| Identité, personnalité, connaissances et relations d'un PNJ | État de campagne narratif | Création, dialogue et évolution contrôlée |
| Position et activité mondiale d'un PNJ | `map-module` | Projection locale et événements de déplacement ou d'activité |
| État temporaire d'une rencontre tactique | Moteur tactique | Déclenchement encadré et consommation des résultats |
| Phases et résultats mécaniques d'un repos | Moteur de repos | Questions mises en scène et consommation des résultats |
| Scène, fils narratifs et connaissances de campagne | État de campagne narratif | Lecture, proposition et persistance contrôlée |
| Présentation conversationnelle | Interface narration | Affichage seulement, jamais source de vérité |

Il ne doit exister qu'une seule horloge de jeu faisant autorité. La narration peut demander une avance du temps et réagir au résultat; elle ne maintient pas une horloge parallèle.

### Autorité par propriété et projections

Une entité peut avoir plusieurs projections sans posséder plusieurs autorités concurrentes. L'autorité est attribuée à une propriété ou à un agrégat cohérent, pas nécessairement à tout l'objet représenté dans l'interface.

Par exemple, un même PNJ peut posséder :

- un profil narratif persistant dans la campagne;
- une position et une activité dans le monde;
- une projection temporaire de combattant dans le moteur tactique;
- une représentation visuelle consommée par l'interface.

Chaque projection référence l'identité stable du PNJ. Le moteur tactique ne devient pas propriétaire du personnage : il restitue blessures, mort, dépenses et autres résultats aux domaines persistants compétents.

### Cycle de la fiche joueur

L'éditeur existant produit la fiche initiale et les choix de progression autorisés. Lors de la création d'une campagne, cette fiche est importée comme état initial de l'instance jouée.

À partir de cet instant :

- l'instance de campagne est la source de vérité du personnage en jeu;
- PV, ressources, inventaire et conséquences ne sont pas rechargés depuis une ancienne copie de l'éditeur;
- les valeurs dérivées sont recalculables depuis leurs sources;
- une progression future passe par le domaine personnage puis met à jour l'instance de campagne selon un contrat explicite;
- le stockage local actuel de l'éditeur est un moyen de conservation et de sélection, pas l'autorité de la campagne.

### Rôle de l'orchestrateur

L'orchestrateur narratif coordonne les lectures, projections, validations et demandes adressées aux domaines. Il peut conserver la causalité d'un tour et son journal d'événements, mais ne possède pas une copie concurrente de la fiche, du monde, du repos ou du combat.

L'IA propose; l'orchestrateur contrôle le protocole; chaque domaine propriétaire valide et applique ses mutations.

### Protocole de mutation inter-domaines

Statut : `RETENU`; schémas techniques à définir ultérieurement.

Toute modification issue d'un tour narratif suit les phases suivantes :

1. proposition structurée de l'IA;
2. contrôle de contrat par l'orchestrateur;
3. validation par chaque domaine propriétaire concerné;
4. préparation d'un ensemble cohérent de mutations;
5. exécution et enregistrement atomiques;
6. émission des événements et nouvelles versions d'état;
7. génération de la narration depuis les résultats confirmés.

#### Proposition

Une proposition référence l'intention, les commandes candidates, leurs cibles, les créations éventuelles, les hypothèses utilisées et les effets narratifs recherchés. Elle ne déclare jamais comme acquis le résultat d'une résolution mécanique.

Le texte narratif n'est pas une commande et ne sera jamais analysé après coup pour découvrir des mutations à appliquer.

#### Validation

Chaque domaine propriétaire peut répondre conceptuellement :

- `accepted` : commande valide et directement exécutable;
- `rejected` : commande interdite ou incompatible;
- `clarification_required` : information indispensable manquante;
- `resolution_required` : issue à déterminer par un moteur de règles;
- `correctable` : proposition proche d'un contrat valide et pouvant être corrigée sans changer l'intention.

Les noms exacts restent provisoires. Une validation refusée ne produit aucune prose affirmant que l'effet a eu lieu.

#### Exécution atomique

L'orchestrateur prépare un ensemble de changements puis les enregistre comme une unité cohérente. Si une étape indispensable échoue, aucune mutation partielle du groupe n'est conservée. Pour le MVP local, cette garantie peut être assurée dans le processus applicatif sans infrastructure distribuée.

Une séquence déjà clôturée puis interrompue par une nouvelle réaction relève de plusieurs tours ou groupes de mutations successifs; l'atomicité ne fusionne pas artificiellement toute une scène.

#### État, événements et vues

Après exécution, chaque domaine concerné produit :

- son nouvel état courant ou sa nouvelle version;
- des événements immuables expliquant les changements;
- une projection publique utilisable pour la narration;
- les données privées éventuellement réservées au MJ ou au diagnostic.

L'état répond à ce qui est vrai maintenant. L'événement conserve pourquoi et comment cet état a changé. La narration finale est une vue de ces résultats confirmés et ne peut pas les étendre par sa prose.

### Forme d'architecture retenue

Statut : `RETENU`.

Le MVP vise un monolithe modulaire : un seul processus applicatif et une seule sauvegarde de campagne, avec des frontières logiques explicites entre domaines. Ces frontières doivent être testables, mais ne deviennent ni des microservices ni des bases de données séparées sans besoin démontré.

Cette forme apporte :

- transactions locales simples;
- déploiement et diagnostic adaptés au projet actuel;
- séparation suffisante pour éviter un module narration omnipotent;
- possibilité d'extraire ultérieurement un domaine sans en faire une contrainte prématurée.

### Persistance et autorité métier

Le futur `CampaignStore` conserve les versions, snapshots, agrégats mutables et événements d'une campagne. Il garantit lecture, écriture atomique, migration et reprise. Il ne décide pas si une action est autorisée : cette décision appartient au domaine métier concerné.

La chronologie et la politique de sauvegarde sont détaillées dans [`Modele-persistant.md`](Modele-persistant.md).

Les domaines logiques du MVP sont :

- `ContentDomain` : lecture du wiki et des catalogues immuables;
- `CharacterDomain` : instance du PJ, caractéristiques, capacités, ressources et inventaire du PJ;
- `CampaignFactDomain` : faits objectifs et overrides persistants propres à la partie, avec provenance;
- `NarrativeActorDomain` : identité narrative, personnalité et possessions établies des PNJ persistants;
- `SocialKnowledgeDomain` : relations, réputation, dettes, faits connus, croyances et secrets par acteur;
- `SceneDomain` : continuité locale, mise en scène établie et fils narratifs;
- `WorldDomain` : horloge, géographie, factions, tensions, météo et activité mondiale;
- `TacticalDomain` : état et résolution temporaires d'une rencontre;
- `RestDomain` : phases et résultats mécaniques d'un repos;
- `InventoryRules` : validation commune des transferts d'objets entre agrégats propriétaires;
- `NarrativeOrchestrator` : coordination des propositions, validations et résultats;
- `NarrativeUI` : présentation et saisie, sans autorité métier.

Ces noms expriment les responsabilités conceptuelles. Ils ne prescrivent pas encore les noms de dossiers ou de classes.

La matrice normative détaillée se trouve dans [`Matrice-autorite.md`](Matrice-autorite.md).

### Inventaire et économie du MVP

- Les définitions d'objets restent dans les catalogues de contenu.
- Les instances et quantités du PJ appartiennent à son état de campagne.
- Les possessions établies d'un PNJ appartiennent à son profil persistant.
- Les transferts utilisent les mêmes règles d'inventaire et une transaction coordonnée.
- Les prix, disponibilités et offres locales sont des faits du monde ou de campagne validés.
- Aucun domaine économique complet n'est créé pour le MVP.
- L'IA peut proposer un objet ou une offre; elle ne peut pas attribuer l'objet, déplacer la monnaie ou fixer une valeur autoritaire par sa prose.

### Relations, réputation et connaissances

Les relations et connaissances sont des sous-domaines persistants de la campagne. Ils restent séparés conceptuellement afin de ne pas confondre :

- ce qu'un acteur ressent ou doit à un autre;
- ce qu'un acteur sait, croit ou ignore;
- ce qui est objectivement vrai dans le monde.

L'IA peut proposer une évolution sociale ou l'acquisition d'un savoir. Les règles correspondantes valident l'amplitude, la provenance et les droits de révélation.

### Résolution des conflits de vérité

La vérité ne repose pas sur une accumulation de couches concurrentes. Pour une propriété donnée :

1. l'état courant du domaine propriétaire est autoritaire;
2. si aucune instance de campagne n'existe encore, la valeur initiale provient du canon ou de la fiche importée;
3. une création ou modification IA ne devient autoritaire qu'après validation et enregistrement dans ce domaine;
4. le contexte de scène est une projection et ne possède aucun droit d'override.

Un override de campagne est donc une modification enregistrée de l'état courant, avec provenance; ce n'est pas une seconde base indépendante placée arbitrairement au-dessus du domaine propriétaire.

Si deux domaines prétendent posséder simultanément la même propriété, le système doit signaler une erreur d'architecture ou de contrat. Il ne doit pas masquer le conflit par une règle de priorité implicite.

### Lacunes actuelles identifiées

Le code actuel ne fournit pas encore :

- de sauvegarde de campagne unifiée;
- de registre persistant des PNJ narratifs;
- de stockage structuré des relations, connaissances et croyances;
- de domaine de scène persistant;
- de moteur de repos correspondant à la cible;
- de protocole transactionnel entre narration, monde, personnage et tactique;
- de projection narrative versionnée de la fiche personnage;
- de validation normalisée du wiki pour la narration.

Ces lacunes définissent les futurs contrats et lots d'implémentation. Elles ne justifient pas de coder ces systèmes avant la fin du cahier des charges.

## 4. Niveaux de liberté créative

Statut : `RETENU`.

### Création éphémère

L'IA peut créer sans persistance immédiate :

- détails sensoriels sans conséquence durable;
- figurants anonymes;
- attitudes, gestes et répliques;
- éléments d'ambiance;
- micro-incidents compatibles avec l'état fourni.

Une création éphémère ne doit ni contredire un fait établi ni produire seule une conséquence mécanique.

### Création candidate

L'IA peut proposer, sous une forme structurée :

- un PNJ destiné à réapparaître;
- un événement local ou mondial;
- une mission, une intrigue ou une nouvelle étape;
- un changement relationnel;
- une information nouvelle;
- un objet, une récompense ou une modification durable de lieu.

La proposition est validée, enrichie d'un identifiant et enregistrée avant de devenir une vérité persistante.

### Promotion vers la persistance

Une création doit devenir candidate à la persistance lorsqu'au moins une condition est remplie :

- elle reçoit une identité propre ou un nom utile;
- le joueur interagit avec elle de manière significative;
- elle est liée à une règle, une ressource, un objectif ou une conséquence;
- elle doit pouvoir réapparaître;
- elle est importante pour la continuité vécue par le joueur.

Elle devient également persistante immédiatement lorsqu'elle constitue un engagement causal, probatoire ou préparatoire pour une intrigue, même si le joueur ne l'a pas remarquée.

La persistance possède deux profondeurs :

- `référence légère` : identité minimale, première apparition, lieu et faits déjà établis;
- `entité complète` : personnalité, motivations, relations, connaissances et évolution.

Un nom ou une interaction brève peut justifier une référence légère sans imposer un profil complet. L'importance vécue ou causale déclenche l'enrichissement approprié.

Les règles détaillées sont décrites dans [`Creations-dynamiques.md`](Creations-dynamiques.md); les contraintes spécifiques aux intrigues se trouvent dans [`Coherence-intrigues.md`](Coherence-intrigues.md).

### Limites non contournables

Sans résolution ou autorisation du domaine propriétaire, l'IA ne peut pas imposer :

- réussite ou échec d'une action incertaine;
- blessure, mort, dépense ou gain de ressource;
- possession ou perte d'un objet;
- déplacement impossible;
- progression de personnage;
- changement politique majeur;
- contradiction d'un fait canonique ou d'un fait de campagne actif.

## 5. Cycle conceptuel d'un tour

Statut : `RETENU`; nombre d'appels IA et contrats exacts encore ouverts.

1. Recevoir l'entrée libre du joueur avec un identifiant de tour.
2. Capturer un snapshot versionné et immuable de la situation au début du tour.
3. Construire un dossier de scène à partir des sources autorisées.
4. Rechercher et projeter uniquement les souvenirs et faits utiles.
5. Faire interpréter l'intention et produire des propositions structurées.
6. Valider les propositions et résoudre les commandes auprès des domaines propriétaires.
7. Enregistrer les mutations acceptées et les événements produits comme une seule unité cohérente.
8. Construire le résultat réel du tour et le nouveau contexte narratif.
9. Faire produire par l'IA les messages destinés au joueur à partir des résultats validés.
10. Afficher les messages et conserver une trace de diagnostic non visible en jeu.

Le système doit pouvoir court-circuiter un appel IA lorsqu'une opération est purement déterministe. Inversement, il peut utiliser plusieurs passages IA lorsqu'une création complexe l'exige. Ce choix devra être mesuré en qualité, coût et latence plutôt que figé arbitrairement.

### 5.1 Unité de tour et points d'arrêt

Statut : `RETENU`.

Un tour narratif commence par une entrée du joueur et se termine soit par un résultat enregistré suivi d'une restitution, soit par une demande de clarification sans mutation.

Une entrée peut contenir plusieurs étapes. L'IA les décompose et peut proposer l'exécution, dans le même tour, des étapes ordinaires qui ne requièrent ni nouveau choix significatif ni hypothèse risquée. Le pipeline s'arrête dès que continuer supposerait une nouvelle intention du joueur, qu'un résultat important modifie les options ou qu'une transition vers un autre système doit commencer.

L'IA peut compléter les gestes implicites ordinaires, gratuits et sans risque — se rapprocher d'un interlocuteur accessible, orienter son attention ou accomplir une manipulation évidente. Elle ne peut pas inventer une parole déterminante, une prise de risque, une dépense, une intention morale ou une décision stratégique absente de l'entrée.

#### Décision de rendre la main

L'IA reçoit les critères de décision et choisit narrativement si elle poursuit, demande une précision ou rend la main. L'orchestrateur ne remplace pas ce jugement créatif par un arbre de dialogue. Il conserve toutefois un contrôle technique pour refuser une demande de clarification invalide, répétitive, non bloquante ou fondée sur une option qui n'existe pas dans l'état autoritaire.

Les causes de suspension sont distinguées :

- `clarification` : une information indispensable manque avant toute exécution fiable;
- `player_decision` : la situation a évolué et une nouvelle décision significative appartient au joueur;
- `system_handoff` : un autre moteur, par exemple tactique, doit prendre la main;
- `completed` : l'intention a été traitée jusqu'à son point d'arrêt naturel.

#### Clarification

Lorsqu'une clarification indispensable est validée :

- aucune mutation du tour suspendu n'est enregistrée;
- l'intention originale, le champ manquant, les options connues et la version du snapshot sont conservés dans une intention en attente;
- la réponse du joueur complète cette intention au lieu d'être traitée comme une action isolée;
- le contexte est reconstruit depuis les sources autoritaires avant de reprendre le pipeline;
- si la version d'état n'est plus compatible, l'intention est réévaluée plutôt que poursuivie sur un contexte périmé.

Si un préfixe d'action a déjà produit un changement réel avant qu'une nouvelle réponse soit nécessaire, ce préfixe constitue un tour terminé et enregistré. La demande suivante relève alors de `player_decision`, pas d'une clarification maintenant artificiellement une transaction ouverte.

Une précision du joueur complète son intention ou désigne une cible; elle n'établit pas à elle seule un fait externe. Toute affirmation sur le monde, comme une parenté non enregistrée, reste soumise aux règles de vérité et de création de campagne.

#### Atomicité

Les mutations validées d'un tour terminé sont enregistrées comme une unité cohérente. Une réponse visible peut contenir plusieurs blocs de narration et de dialogue, mais aucune partie de la prose ne peut ajouter après coup une mutation absente du résultat enregistré.

### 5.2 Saisie naturelle et interprétation du personnage

Statut : `RETENU`.

L'interface utilise un champ de saisie libre unique. Aucun bouton ou guillemet obligatoire ne sépare action, parole et échange avec le MJ. Une entrée peut exprimer une action, une parole, une intention, une question hors jeu ou une combinaison de ces éléments.

#### Nature de l'entrée et engagement

Avant toute proposition d'exécution, l'IA distingue conceptuellement :

- `meta_question` : question sur une règle ou le fonctionnement;
- `recall_request` : demande de rappel d'une information déjà acquise;
- `possibility_question` : question sur une action possible;
- `character_speech` : parole destinée à être prononcée en jeu;
- `committed_action` : action que le joueur veut réellement tenter;
- `mixed` : combinaison ordonnée de plusieurs natures;
- `unclear_commitment` : engagement insuffisamment certain.

Une question de possibilité ne déclenche jamais l'action évoquée. Une demande de rappel portant sur une connaissance déjà acquise n'avance pas le temps. Chercher une information nouvelle peut en revanche constituer une action de jeu. En cas d'incertitude significative sur l'engagement, l'IA choisit de ne pas exécuter et demande une clarification.

Ces catégories décrivent un contrat fonctionnel; leurs noms et leur schéma technique restent à concevoir dans l'atelier consacré aux contrats IA.

#### Interprétation théâtrale du personnage

L'IA met en scène l'action ou la parole du joueur pour l'intégrer naturellement à la scène. Elle peut adapter vocabulaire, niveau de langage, aisance, rythme, posture, hésitations et qualité apparente de l'argumentation selon le personnage.

Cette adaptation doit préserver les invariants de l'entrée :

- sens central;
- cible;
- objectif;
- position morale;
- information affirmée;
- promesse, menace ou engagement;
- niveau de risque accepté.

L'IA ne peut pas transformer une idée sommaire en nouvelle information, intention ou stratégie absente de l'entrée. Le joueur peut verrouiller naturellement une formulation en indiquant qu'il prononce exactement certains mots; aucun mode d'interface particulier n'est requis.

#### Influence des capacités

Les caractéristiques, compétences et traits du personnage influencent la forme de la prestation et son efficacité. Une faible capacité peut rendre la formulation hésitante, maladroite ou socialement inefficace, sans empêcher le joueur d'exprimer son idée.

Une expression peut être bloquée ou altérée seulement lorsqu'une capacité concrète manque, par exemple :

- langue inconnue;
- connaissance absente;
- état empêchant de communiquer;
- concept inaccessible au personnage;
- affirmation incompatible avec les faits qu'il peut mobiliser.

La reformulation narrative ne remplace pas une résolution sociale lorsque l'issue est incertaine.

#### Possibilités suggérées par la scène

Le jeu normal ne présente pas de liste ou de boutons d'actions suggérées. Le MJ rend certaines possibilités perceptibles par des détails intégrés à la mise en scène, sans les présenter comme des solutions garanties ou exhaustives.

Un détail ainsi introduit doit être compatible avec la vérité et les droits de création du tour. S'il établit durablement une porte, un acteur, un objet ou une autre propriété du monde, il suit les règles de persistance progressive.

### 5.3 Scènes et transitions

Statut : `RETENU`.

Une scène est une unité de continuité narrative, pas une unité de mémoire ou une simple coordonnée. Elle regroupe :

- une situation active;
- un espace narrativement cohérent;
- une période continue;
- les acteurs présents ou immédiatement impliqués;
- la mise en scène déjà établie;
- les enjeux et fils actuellement mobilisés;
- l'état de connaissance utile à cet instant.

Un déplacement mineur à l'intérieur d'un même espace narratif ne crée pas automatiquement une scène. Une transition devient pertinente lorsqu'un changement de lieu, de temps, d'acteurs, de perceptions ou d'enjeux impose de reconstruire significativement le contexte.

Une ellipse, un voyage résumé, une attente transformatrice ou un repos produit normalement une transition. Quelques minutes continues d'observation ou de dialogue restent dans la même scène.

L'IA propose la transition et en assure le rythme narratif. L'orchestrateur valide son identité et peut l'imposer lorsqu'un changement autoritaire de lieu, de temps ou de moteur le nécessite. L'IA ne peut pas déclarer seule un déplacement ou une avance temporelle qui n'a pas été validé.

#### Passage tactique et continuation

Lorsqu'une scène déclenche un combat :

1. la scène narrative est suspendue avec un état de sortie;
2. la séquence tactique est liée à cette scène;
3. le moteur tactique produit ses résultats et événements;
4. une scène narrative de continuation est créée à partir de l'état réel après combat.

La continuation peut hériter du lieu et des acteurs encore valides, mais sa mise en scène est reconstruite. Elle ne reprend pas l'ancien contexte comme si le combat n'avait rien changé.

### 5.4 Repos comme sous-couche de règles

Statut : `RETENU`; règles détaillées reportées à l'atelier d'intégration des moteurs.

Le repos court ou long possède un moteur spécialisé chargé des règles de jeu. Ce moteur doit notamment pouvoir gérer éligibilité, phases, activités, consommation ou restauration de ressources, avance du temps, vérifications et interruptions.

Le module narration :

- met en scène la demande de repos;
- présente naturellement les questions et choix requis;
- transmet les décisions du joueur au moteur de repos;
- raconte les étapes, interactions et résultats validés;
- intègre les événements et conséquences dans la mémoire de campagne.

Côté joueur, le repos reste dans le même flux conversationnel que le reste de l'aventure. Il ne nécessite pas un mode narratif ou un panneau principal séparé. Des données structurées peuvent circuler sous l'interface, mais elles sont présentées et vécues par la narration.

Le repos constitue une transition ou une séquence de scènes selon sa durée, ses activités et ses interruptions. Le moteur de repos ne rédige pas l'histoire; la narration ne décide pas seule de ses effets mécaniques.

### 5.5 Flux conversationnel, locuteurs et rythme

Statut : `RETENU`; paramètres exacts à définir pendant la conception UX et le contrat de sortie.

Une réponse de tour est une séquence ordonnée de messages typés. Elle peut combiner :

- réalisation mise en scène de l'action ou de la parole du personnage joueur;
- narration du MJ;
- dialogue ou réaction d'un PNJ identifié;
- dialogue ou réaction d'autres PNJ;
- résultat système discret;
- clarification ou restitution de la main.

L'IA choisit l'ordre narrativement naturel. L'orchestrateur vérifie les identités de locuteurs, leurs droits de connaissance et la compatibilité des résultats exprimés.

#### Présentation du personnage joueur

L'entrée brute est conservée pour audit, correction et consultation. Pendant le traitement, elle peut être affichée comme demande en attente. Après validation, la réalisation mise en scène devient la représentation principale dans le fil.

L'interface doit signaler clairement qu'il s'agit d'une interprétation fidèle de la demande par le MJ et permettre de consulter l'entrée originale sans encombrer la lecture normale. La reformulation ne doit jamais masquer une divergence de sens.

#### Identification des locuteurs

Chaque locuteur dispose d'un identifiant stable dans les données et d'une présentation visuelle distincte. L'interface affiche au minimum son nom connu ou sa désignation actuelle et un marqueur de rôle.

La couleur peut aider à distinguer les interlocuteurs, mais ne doit jamais être le seul signal : nom, position, forme, icône ou autre repère accessible doit maintenir la compréhension. Un PNJ dont l'identité est inconnue conserve une désignation stable, par exemple « garde de la porte », jusqu'à ce que son nom soit effectivement révélé.

Le MJ, le personnage joueur, les PNJ et les notifications système possèdent des traitements visuels reconnaissables et non interchangeables.

#### Dialogues multiples

Plusieurs PNJ peuvent parler, agir, réagir entre eux ou interrompre une séquence sans demander une validation du joueur entre chaque réplique. La séquence s'arrête lorsqu'une nouvelle décision significative appartient au joueur.

L'IA ne peut pas interpréter le silence du joueur comme une autorisation illimitée de faire avancer la scène ou de décider de l'inaction prolongée de son personnage.

#### Politique de rythme configurable

Le développement doit disposer d'une politique de rythme ajustable sans modifier les faits ni les règles. Elle pourra notamment contrôler :

- budget d'échanges automatiques entre PNJ;
- longueur ou nombre de mouvements narratifs avant restitution de la main;
- tendance à interrompre tôt ou à laisser vivre une séquence;
- restitution immédiate lorsqu'un PNJ s'adresse directement au personnage;
- tolérance aux séquences où le personnage reste simple observateur;
- niveau de détail des descriptions et dialogues.

Ces paramètres règlent la présentation et le rythme, jamais l'issue mécanique, la connaissance des acteurs ou les événements produits. Le mode diagnostic doit indiquer quel seuil a provoqué la restitution de la main afin de pouvoir régler l'équilibre pendant le développement.

#### Interruption d'une action composée

Entre deux étapes d'une action composée, une réaction du monde ou d'un acteur peut interrompre la suite prévue. Les étapes déjà validées restent enregistrées; les étapes non exécutées sont annulées ou replanifiées. Le joueur récupère la main dès que l'interruption crée une nouvelle décision significative.

## 6. Snapshot de tour et paquets contextuels

Statut : `RETENU`.

Le contexte d'un tour ne peut pas être un simple résumé des derniers échanges. Le système distingue le `CampaignSnapshot` persistant, le `TurnSnapshot` immuable au début du tour, les `RoleContextPack` spécialisés et le `CommittedTurnResult` post-validation.

Les règles détaillées se trouvent dans [`Snapshot-et-contextes.md`](Snapshot-et-contextes.md).

### Contenu minimal prévu

- identifiants de campagne, scène, tour et version d'état;
- position exacte, hiérarchie géographique, heure et conditions locales;
- mise en scène déjà établie et éléments perceptibles;
- acteurs présents, apparence observable et disposition actuelle;
- connaissances, objectifs, motivations et état émotionnel utiles de chaque acteur;
- relations pertinentes et faits qui les expliquent;
- fils narratifs, événements, opportunités et risques actifs;
- faits récemment établis dans la scène;
- capacités pertinentes du personnage et contraintes mécaniques;
- souvenirs rappelés pour ce tour, avec provenance;
- fragments de lore sélectionnés, avec identifiants et portée;
- entrée brute du joueur;
- libertés créatives et interdictions applicables au tour.

### Immutabilité pendant le tour

Le `TurnSnapshot` porte une version. Toute proposition s'applique à cette version. Si l'état autoritaire change avant la validation, le tour doit être revalidé ou relancé; il ne doit pas écraser silencieusement une modification plus récente.

### Perspectives séparées

Le dossier doit distinguer :

- la vérité système;
- ce que le personnage joueur sait ou croit;
- ce que chaque PNJ sait ou croit;
- ce qui est actuellement perceptible;
- les secrets exploitables par le MJ mais non révélables directement.

Cette séparation évite qu'un PNJ parle d'un fait qu'il ignore ou que la narration révèle involontairement un secret.

## 7. Mémoire longue durée

Statut : `RETENU`; modèle de stockage à concevoir.

### Principe

La mémoire complète et le contexte envoyé à l'IA sont deux objets différents.

- La mémoire complète conserve les faits nécessaires à la continuité et à l'audit.
- La mémoire projetée est un paquet temporaire, borné et construit pour un tour précis.
- Un résumé narratif facilite la lecture, mais ne remplace jamais les faits structurés.

### Construction de la vérité effective

La vérité effective est construite à partir de :

1. l'état courant du domaine propriétaire, incluant les changements validés de campagne;
2. le canon épinglé ou la fiche importée uniquement lorsqu'aucune valeur de campagne ne les remplace.

La scène et la mémoire projetée ne sont jamais des autorités supplémentaires. Un changement de campagne ne détruit pas le canon initial : il le remplace dans l'état courant avec une provenance, une date de jeu et une cause.

### Unité conceptuelle de mémoire

Le schéma exact reste ouvert, mais une information durable devra pouvoir porter au minimum :

- un identifiant stable;
- son type et sa portée;
- les entités concernées;
- le fait structuré et, si utile, sa formulation lisible;
- sa provenance et l'événement qui l'a établi;
- sa date dans le jeu et sa date d'enregistrement;
- ses périodes de validité éventuelles;
- son niveau de vérité et les perspectives qui la connaissent;
- son importance narrative et son importance systémique;
- son état de cycle de vie;
- ses liens avec lieux, acteurs, factions, événements et fils narratifs.

Les règles détaillées de conservation et de rappel se trouvent dans [`Memoire-et-rappel.md`](Memoire-et-rappel.md).

### Cycle de vie

- `active` : nécessaire à la situation immédiate.
- `relevant` : susceptible de revenir selon le contexte.
- `dormant` : conservée, mais rarement projetée spontanément.
- `archived` : retirée du contexte ordinaire, encore interrogeable et auditable.

Archiver signifie diminuer la probabilité de projection, pas supprimer. Un fait ancien structurel — mort, changement politique, dette majeure, transformation d'un lieu — peut rester systématiquement applicable sans occuper le texte envoyé à l'IA.

## 8. Rappel et « déterrement » des souvenirs

Statut : `RETENU`.

Le rappel ne doit dépendre ni d'un unique résumé récent ni d'une recherche par mots-clés.

### Déclencheurs forts

- retour dans un lieu déjà visité;
- réapparition d'un acteur ou d'une faction;
- poursuite d'un fil narratif;
- conséquence d'un événement antérieur;
- mention explicite d'un souvenir, d'une personne, d'un objet ou d'un fait par le joueur;
- ressemblance contextuelle jugée utile, à confirmer par les données structurées.

### Pipeline de rappel prévu

1. Extraire les ancres certaines du tour : lieu, acteurs, objets, fils et identifiants connus.
2. Interroger les relations structurées et l'historique associé à ces ancres.
3. Détecter une demande explicite ou implicite de souvenir dans l'entrée du joueur.
4. Utiliser, si nécessaire, une recherche textuelle ou sémantique pour trouver des candidats supplémentaires.
5. Vérifier chaque candidat contre sa provenance, sa validité et ses droits de révélation.
6. Classer les candidats selon pertinence, récence, importance, continuité et diversité.
7. Dédupliquer et condenser sans perdre les faits ni leurs identifiants.
8. Insérer uniquement les éléments retenus dans le paquet de contexte.
9. Tracer pourquoi chaque souvenir important a été inclus ou exclu.

Une recherche sémantique peut découvrir un candidat malgré une formulation différente. Elle ne peut ni transformer ce candidat en vérité ni décider seule qu'il est pertinent.

## 9. Budget du contexte IA

Statut : `RETENU`; budgets chiffrés encore ouverts.

Chaque paquet doit respecter un budget global et des sous-budgets par catégorie. L'ordre de priorité initial est :

1. règles et contraintes non négociables;
2. vérité locale et résultats mécaniques;
3. acteurs présents et perspectives;
4. continuité active de la scène;
5. souvenirs explicitement sollicités;
6. fils narratifs et relations pertinents;
7. lore d'appui;
8. détails d'ambiance facultatifs.

En cas de dépassement :

- supprimer les doublons;
- remplacer les longues formulations par des faits structurés;
- condenser les éléments secondaires;
- retirer les candidats les moins pertinents;
- ne jamais tronquer silencieusement une règle, un résultat ou une interdiction.

Le système devra mesurer au minimum la taille de chaque section, les éléments écartés, le coût, la latence et les rappels finalement utilisés dans la réponse.

## 10. Recherche du lore

Statut : `RETENU`.

La sélection du lore combine :

- navigation déterministe depuis les ancres de scène;
- relations géographiques, politiques, historiques et sociales;
- état courant de la campagne;
- recherche textuelle ou sémantique comme mécanisme de découverte;
- validation finale par identifiant, portée et provenance.

La source la plus similaire n'est pas nécessairement la plus vraie. Le paquet doit expliciter si un élément est canonique, modifié par la campagne, connu d'un acteur ou seulement candidat.

## 11. Sorties conceptuelles de l'IA

Statut : `RETENU`.

Le contrat détaillé est défini dans [`Pipeline-et-contrats-IA.md`](Pipeline-et-contrats-IA.md). Il sépare :

- interprétation de l'intention;
- ambiguïtés réellement bloquantes;
- propositions de commandes mécaniques;
- propositions de créations ou mutations persistantes;
- messages destinés au joueur;
- références aux faits et souvenirs utilisés;
- continuités possibles pour le tour suivant;
- incertitudes et éléments que l'IA refuse d'inventer.

Le texte joueur ne doit jamais être analysé pour retrouver après coup les mutations à appliquer. Toute mutation proposée doit exister sous forme structurée avant son enregistrement.

Les règles calculables restent exécutées par leurs domaines. Pour les situations ouvertes, une IA d'arbitrage peut interpréter les règles pertinentes, estimer une durée ou proposer une décision ad hoc. Cette proposition, sourcée et bornée, ne devient autoritaire qu'après validation et commit par le domaine propriétaire.

## 12. Présentation conversationnelle

Statut : `RETENU`.

L'interface principale est un flux proche d'une conversation. Elle distingue au minimum :

- narration du MJ;
- dialogue attribué à un personnage;
- action ou parole du joueur;
- résultat système discret;
- clarification;
- notification hors rôleplay.

La saisie libre est le mode principal. Les possibilités sont suggérées par la mise en scène et les éléments perceptibles, sans liste directe d'actions supposées exhaustives.

## 13. Résilience minimale

Statut : `RETENU`.

- Une réponse invalide de l'IA ne doit produire aucune mutation partielle.
- Rejouer une requête avec le même identifiant ne doit pas doubler une récompense, un événement ou un PNJ.
- Une indisponibilité de l'IA doit conserver l'état et permettre de reprendre le tour.
- Chaque mutation doit être reliée au tour, à la proposition et au résultat qui l'ont causée.
- Les traces détaillées sont disponibles en mode diagnostic, mais masquées dans l'expérience normale.

## 14. Premier scénario vertical

Statut : `RETENU`; contrats et scénarios d'acceptation détaillés à produire dans les ateliers suivants.

Le MVP documentaire puis technique valide une boucle verticale, pas une quête préécrite. L'IA conserve la création du contenu concret à l'intérieur d'un périmètre maîtrisé.

### Périmètre fonctionnel

- campagne solo avec un personnage joueur créé par l'éditeur existant;
- lieu principal issu du wiki et environnement immédiat;
- plusieurs PNJ créés ou enrichis par l'IA;
- situation mondiale locale structurée;
- intrigue contextuelle créée dynamiquement;
- observation, déplacement narratif et recherche d'information;
- dialogues multiples et relation élémentaire avec un PNJ;
- une résolution sociale réelle;
- création, promotion et persistance d'un PNJ;
- création et évolution d'un événement;
- avance de l'horloge mondiale;
- passage vers un combat tactique et retour;
- version minimale d'un repos court ou long;
- sauvegarde, rechargement, ellipse et rappel d'une mémoire ancienne.

### Déroulement de référence

1. Une fiche existante est sélectionnée pour commencer ou reprendre une campagne.
2. Le personnage entre dans un lieu connu du lore.
3. L'IA met en scène le lieu à partir de l'état réel.
4. Le joueur observe, interroge le MJ et agit librement.
5. L'IA crée un figurant puis, si l'interaction le justifie, propose sa persistance comme PNJ.
6. Le joueur discute et tente une action nécessitant une résolution sociale.
7. Une mission ou intrigue contextuelle est créée sans modèle de quête préécrit.
8. Le joueur accepte, refuse ou ignore cette possibilité.
9. Une conséquence justifiée déclenche un passage tactique, puis une scène narrative de continuation.
10. Un repos minimal mobilise sa sous-couche de règles dans le flux conversationnel.
11. Le temps et le monde évoluent par leurs systèmes propriétaires.
12. La campagne est sauvegardée et rechargée.
13. Après une longue avance temporelle simulée, le joueur revient sur place ou évoque le souvenir; les faits utiles sont rappelés sans charger toute la campagne.

### Hors périmètre initial

- coopération, multijoueur et synchronisation réseau;
- voix et reconnaissance vocale;
- bastion complet;
- progression et multiclassage complets;
- économie avancée;
- relations romantiques approfondies;
- génération mondiale sans limite géographique;
- interface lourde d'édition narrative;
- exploitation serveur de plusieurs campagnes concurrentes.

Les contrats doivent éviter de fermer ces extensions, mais le MVP ne finance pas leur comportement.

### Actifs existants et adaptations nécessaires

Le wiki contient déjà des lieux, bâtiments, factions et profils locaux avec identifiants et relations en front matter. Cette base est exploitable pour le scénario, mais elle n'est pas encore un contrat narratif : les clés ne sont pas entièrement normalisées, le parseur actuel n'applique pas de schéma et la sélection devra produire des fragments sourcés plutôt qu'envoyer les fichiers bruts.

L'éditeur de personnage produit déjà une sauvegarde riche : identité, caractéristiques, compétences, langues, apparence, inventaire, progression et capacités dérivées. Le module narration devra consommer une projection narrative versionnée de cette fiche, pas lire tout le cache UI ni considérer les champs dérivés comme plusieurs sources de vérité.

Ces adaptations relèvent des ateliers d'autorité, de modèle persistant, de contexte et d'intégration; elles ne nécessitent pas de recréer le wiki ou l'éditeur dans le MVP.

### Critères d'acceptation initiaux

- Aucun fait mécanique n'est inventé par la prose.
- Le PNJ persistant conserve identité, connaissances et relation.
- L'événement créé possède une cause, des ancres et une provenance.
- Le retour tardif rappelle les changements durables et les souvenirs pertinents.
- Un secret non connu du PNJ ou du joueur n'est pas révélé.
- Le paquet IA reste dans son budget et explique ses sélections en diagnostic.
- La fiche du personnage influence l'interprétation sans être modifiée directement par la narration.
- Le passage tactique et le repos réinjectent leurs résultats validés dans le fil.

### Critère principal de réussite

Après sauvegarde et ellipse, le joueur revient dans le lieu initial. Le système retrouve les PNJ pertinents, respecte relations et connaissances, applique les changements du monde, rappelle les souvenirs utiles et crée une nouvelle scène cohérente sans dépendre du texte complet des anciennes conversations.

## 15. Questions restantes pour les ateliers suivants

1. Quelle technologie de persistance implémentera les agrégats, snapshots et événements déjà modélisés ?
2. Quels contrats exacts relient scène narrative, domaines applicatifs et `map-module` ?
3. Quels budgets mesurés de contexte, coût et latence retenir par rôle et modèle ?
4. Comment remplacer ou faire évoluer l'actuelle route tactique `/api/narration` lors de l'intégration ?
