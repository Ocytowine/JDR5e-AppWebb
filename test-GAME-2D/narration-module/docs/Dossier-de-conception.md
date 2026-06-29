# Dossier de conception du module narration

Version de travail : `0.1`

Dernière mise à jour : `2026-06-29`

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

Statut : `RETENU`, frontières exactes à confirmer avec les contrats existants.

| Domaine | Autorité prévue | Usage par la narration |
|---|---|---|
| Canon initial du monde | Wiki et données de lore | Lecture et sélection de faits sourcés |
| Temps, géographie, factions, tensions | `map-module` | Projection locale et demandes d'évolution |
| Fiche, apparence, aptitudes, progression | Domaine personnage | Lecture et commandes validées par ce domaine |
| Combat et résolution tactique | Moteur tactique | Déclenchement encadré et consommation des résultats |
| Scène, fils narratifs, connaissances et relations | État de campagne narratif | Lecture, proposition et persistance contrôlée |
| Présentation conversationnelle | Interface narration | Affichage seulement, jamais source de vérité |

Il ne doit exister qu'une seule horloge de jeu faisant autorité. La narration peut demander une avance du temps et réagir au résultat; elle ne maintient pas une horloge parallèle.

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

La simple présence d'un nom dans une phrase ne suffira pas nécessairement : cette heuristique devra distinguer un détail décoratif d'une entité appelée à vivre.

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

## 6. Snapshot et dossier de scène

Statut : `RETENU`.

Le contexte d'un tour ne peut pas être un simple résumé des derniers échanges. Il doit être une projection structurée de la vérité au commencement du tour.

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

Le snapshot d'entrée porte une version. Toute proposition s'applique à cette version. Si l'état autoritaire change avant la validation, le tour doit être revalidé ou relancé; il ne doit pas écraser silencieusement une modification plus récente.

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

### Couches de vérité

La vérité effective est construite à partir de :

1. l'état local autoritaire de la scène;
2. les changements persistants de la campagne;
3. le canon initial lorsqu'il n'est pas remplacé.

Un changement de campagne ne détruit pas le canon initial : il le surplombe avec une provenance, une date de jeu et une cause.

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

Statut : `PROPOSITION`.

Le contrat détaillé n'est pas encore défini. Il devra toutefois séparer :

- interprétation de l'intention;
- ambiguïtés réellement bloquantes;
- propositions de commandes mécaniques;
- propositions de créations ou mutations persistantes;
- messages destinés au joueur;
- références aux faits et souvenirs utilisés;
- continuités possibles pour le tour suivant;
- incertitudes et éléments que l'IA refuse d'inventer.

Le texte joueur ne doit jamais être analysé pour retrouver après coup les mutations à appliquer. Toute mutation proposée doit exister sous forme structurée avant son enregistrement.

## 12. Présentation conversationnelle

Statut : `RETENU`.

L'interface principale est un flux proche d'une conversation. Elle distingue au minimum :

- narration du MJ;
- dialogue attribué à un personnage;
- action ou parole du joueur;
- résultat système discret;
- clarification;
- notification hors rôleplay.

La saisie libre est le mode principal. Des suggestions peuvent rendre les possibilités visibles, mais elles ne constituent pas une liste exhaustive d'actions autorisées.

## 13. Résilience minimale

Statut : `PROPOSITION`.

- Une réponse invalide de l'IA ne doit produire aucune mutation partielle.
- Rejouer une requête avec le même identifiant ne doit pas doubler une récompense, un événement ou un PNJ.
- Une indisponibilité de l'IA doit conserver l'état et permettre de reprendre le tour.
- Chaque mutation doit être reliée au tour, à la proposition et au résultat qui l'ont causée.
- Les traces détaillées sont disponibles en mode diagnostic, mais masquées dans l'expérience normale.

## 14. Premier scénario vertical

Statut : `PROPOSITION`.

Le MVP documentaire puis technique couvrira un seul scénario :

1. Le personnage entre dans un lieu connu du lore.
2. L'IA met en scène le lieu à partir de l'état réel.
3. Le joueur observe librement.
4. L'IA crée un figurant puis, si l'interaction le justifie, propose sa persistance comme PNJ.
5. Le joueur discute et tente une action nécessitant une résolution.
6. Une mission ou intrigue contextuelle est créée sans modèle de quête préécrit.
7. Le joueur accepte, refuse ou ignore cette possibilité.
8. Le temps et le monde évoluent par leurs systèmes propriétaires.
9. La campagne est sauvegardée et rechargée.
10. Après une longue avance temporelle simulée, le joueur revient sur place ou évoque le souvenir; les faits utiles sont rappelés sans charger toute la campagne.

### Critères d'acceptation initiaux

- Aucun fait mécanique n'est inventé par la prose.
- Le PNJ persistant conserve identité, connaissances et relation.
- L'événement créé possède une cause, des ancres et une provenance.
- Le retour tardif rappelle les changements durables et les souvenirs pertinents.
- Un secret non connu du PNJ ou du joueur n'est pas révélé.
- Le paquet IA reste dans son budget et explique ses sélections en diagnostic.

## 15. Questions ouvertes prioritaires

1. Quel format de persistance adopter pour les faits, snapshots et événements de campagne ?
2. Quelle frontière exacte sépare scène narrative, événement de campagne et événement du `map-module` ?
3. Quand une création éphémère doit-elle être automatiquement proposée à la persistance, et quand demander une décision supplémentaire à l'IA ?
4. Un seul modèle IA peut-il interpréter, créer et rédiger avec une qualité suffisante, ou faut-il séparer les rôles ?
5. Quels budgets de contexte, coût et latence sont acceptables par tour ?
6. Comment modéliser les connaissances et croyances propres aux PNJ sans exploser le volume de données ?
7. Quelle politique de correction appliquer lorsqu'une proposition créative contredit partiellement le contexte ?
8. Comment nommer et faire évoluer l'actuelle route tactique `/api/narration` ?
