# Mémoire et rappel

Dernière mise à jour : `2026-06-30`

Statut : `RETENU` — modèle conceptuel complet et seuils de qualité initiaux fixés; index, quotas fins et schémas techniques restent à calibrer.

## Objectif

Conserver la continuité d'une campagne longue tout en construisant pour chaque tour un contexte court, pertinent, vérifiable et respectueux des perspectives.

## Trois objets distincts

### Mémoire complète du système

Ensemble durable des états, faits, événements, acteurs, relations, connaissances, engagements, scènes et interactions nécessaires à la continuité et à l'audit.

### Mémoire vécue par un acteur

Ce qu'un personnage sait, croit, se rappelle, oublie ou peut restituer. Cette mémoire peut être incomplète ou fausse sans modifier la vérité système.

### Mémoire projetée pour un tour

Sous-ensemble temporaire construit pour un rôle et une scène précis. Il respecte un budget, une provenance et des droits de révélation. Il ne devient jamais une nouvelle source de vérité.

## Conservation intégrale

Ne sont jamais supprimés automatiquement :

- faits autoritaires et leurs remplacements;
- événements confirmés;
- engagements d'intrigue;
- changements politiques et territoriaux;
- morts, transformations et destructions durables;
- relations structurantes, dettes et serments;
- créations persistantes et leurs identités;
- causes nécessaires à la compréhension d'un état courant;
- versions et migrations de campagne.

Le transcript complet reste conservé dans l'`InteractionLog`, séparé de la vérité métier et archivable physiquement.

## Données condensables ou dérivées

Peuvent être condensés, recalculés ou supprimés comme cache :

- résumés narratifs;
- index de recherche;
- scores de pertinence;
- embeddings éventuels;
- extraits de contexte déjà envoyés;
- diagnostics temporaires selon la politique de rétention;
- formulations redondantes d'un même fait structuré.

Une donnée dérivée conserve les références ayant permis sa production. Sa suppression ne doit jamais faire perdre la vérité ou la causalité d'origine.

## Axes indépendants

### Validité

Indique si une information est actuellement vraie, passée, remplacée, invalidée ou subjective.

### Cycle de rappel

Indique la probabilité qu'elle soit recherchée et injectée dans un contexte ordinaire.

### Importance systémique

Mesure son impact durable sur les règles, états, accès, relations ou structures du monde.

### Importance narrative

Mesure son importance dramatique, émotionnelle, causale ou préparatoire.

### Pertinence courante

Valeur dynamique calculée pour un tour selon ses lieux, acteurs, fils, intention et besoins.

Ces axes ne sont pas fusionnés en un score opaque unique. Un fait archivé peut rester vrai et mécaniquement appliqué; un souvenir très actif peut être une croyance fausse.

## Cycle de rappel système

### `active`

Nécessaire à la scène, au processus ou à une conséquence immédiate. Il remonte facilement dans les projections autorisées.

### `relevant`

Toujours utile mais non systématique. Il remonte lorsqu'un lieu, acteur, objet, fil, relation ou sujet le justifie.

### `dormant`

Conservé et indexé, mais rarement projeté sans déclencheur fort ou demande explicite.

### `archived`

Retiré du contexte ordinaire. Il reste accessible par recherche explicite, lien causal, audit, retour tardif ou réactivation structurée.

Archiver ne signifie ni supprimer, ni invalider, ni faire oublier à tous les acteurs.

## Transitions de cycle

Une information peut descendre lorsque :

- son enjeu immédiat est résolu;
- les acteurs et lieux concernés ne sont plus actifs;
- aucune conséquence prochaine ne la référence;
- elle a été remplacée pour l'état courant;
- sa formulation détaillée est devenue redondante avec un fait structuré.

Elle remonte lorsque :

- un acteur, lieu, objet ou fil lié réapparaît;
- une conséquence la cite comme cause;
- le joueur évoque explicitement le souvenir;
- une intrigue en a besoin comme engagement ou preuve;
- un événement nouveau réactive sa portée;
- une consultation ou un audit la demande.

Les transitions sont tracées et peuvent être corrigées. Aucune formule de décroissance ne peut archiver seule un élément à forte importance systémique ou un engagement d'intrigue encore ouvert.

## Oubli et mémoire des personnages

L'oubli vécu est une mutation du `SocialKnowledgeDomain`, pas une suppression système.

Un acteur peut :

- connaître précisément un fait;
- n'en garder qu'un souvenir partiel;
- ne plus pouvoir le rappeler spontanément;
- l'avoir oublié;
- conserver une croyance déformée;
- le retrouver grâce à un lieu, une personne, un objet ou une note.

Le système conserve la connaissance d'origine, ses changements et leurs causes. Une information oubliée n'est pas projetée comme connaissance active de l'acteur, mais reste disponible pour expliquer un rappel ou vérifier la cohérence historique.

Les notes et hypothèses du joueur restent subjectives. Elles ne contaminent ni la vérité ni les souvenirs d'un PNJ.

## Engagements d'intrigue

Un engagement narratif peut devenir moins présent dans les scènes ordinaires, mais il conserve :

- ses liens causaux;
- sa vérité ou nature subjective;
- ses droits de révélation;
- ses indices et voies de progression;
- son rattachement au fil actif ou archivé.

Tant qu'une intrigue reste ouverte, aucun engagement nécessaire à sa cohérence ou solvabilité ne peut devenir introuvable par le pipeline de rappel.

## Unités indexées

Le rappel travaille sur des références vers les unités autoritaires suivantes :

- faits et assertions remplacées;
- événements;
- acteurs et profils persistants;
- relations et dettes;
- connaissances, croyances et secrets;
- lieux et objets;
- fils narratifs et engagements;
- scènes et tours;
- messages du transcript uniquement pour consultation ou preuve de formulation.

Une entrée d'index contient au minimum la référence cible, ses types d'ancres, sa période de jeu, son cycle de rappel, son importance et ses restrictions de visibilité. Elle ne recopie pas le contenu complet comme nouvelle vérité.

## Index dérivés

Le système maintient des index reconstruisibles par :

- acteur;
- lieu et hiérarchie géographique;
- objet et historique de possession;
- faction;
- fil narratif;
- fait et propriété concernée;
- événement et chaîne causale;
- relation sociale;
- période de jeu;
- alias et désignations connus par le joueur.

La perte d'un index dégrade les performances de recherche, pas la mémoire autoritaire. Tout index doit pouvoir être régénéré depuis les agrégats et journaux persistants.

## Déclencheurs de rappel

### Déclencheurs forts

Ils imposent une recherche ciblée :

- retour dans un lieu déjà visité;
- réapparition d'un acteur ou d'une faction;
- reprise d'un fil narratif;
- conséquence citant un événement ancien;
- objet déjà rencontré;
- mention explicite du joueur;
- question de rappel;
- engagement nécessaire à une intrigue;
- règle ou état courant dépendant d'une cause ancienne.

### Déclencheurs secondaires

Ils proposent des candidats sans imposer leur injection :

- faction ou relation indirectement liée;
- situation ressemblante;
- thème commun;
- proximité temporelle ou géographique;
- motif narratif comparable;
- similarité textuelle ou sémantique.

Un déclencheur secondaire ne peut ni établir une identité ni contourner les droits de révélation.

## Retour dans un lieu

Lors d'un retour, le rappel reconstruit dans cet ordre :

1. état actuel autoritaire du lieu;
2. changements depuis la dernière visite du personnage;
3. souvenirs qu'il peut effectivement rappeler;
4. PNJ connus encore pertinents et leur état actuel;
5. fils non résolus ou conséquences arrivées à maturité;
6. engagements d'intrigue liés;
7. différences utiles entre l'ancien état connu et l'état présent.

Les événements sans signal accessible et les secrets inconnus restent hors de la projection joueur. Ils peuvent être présents dans une projection MJ privée uniquement s'ils sont nécessaires à la scène.

## Mention explicite du joueur

Une mention est résolue d'abord par :

1. identifiants et alias connus;
2. scènes de rencontre;
3. relations et connaissances acquises;
4. événements et fils associés;
5. recherche textuelle ou sémantique complémentaire.

Si plusieurs entités restent réellement plausibles et que la différence affecte l'action, l'IA demande laquelle est visée. Une correspondance approximative n'autorise aucune fusion d'identité.

Une demande méta peut consulter les connaissances ou le transcript accessibles au joueur sans faire avancer le temps. Une demande adressée à un PNJ ou exigeant une nouvelle observation reste une activité diégétique.

## Pipeline de recherche hybride

La recherche combine une base obligatoire avec plusieurs canaux de découverte bornés. Les canaux de découverte peuvent fonctionner en parallèle pour réduire la latence; leur résultat rejoint ensuite une validation et un classement communs.

### 1. Requête de rappel

Toute recherche reçoit :

- campagne et version courante;
- rôle demandeur et perspective autorisée;
- but du rappel;
- ancres structurées certaines;
- entrée du joueur si pertinente;
- fenêtre temporelle éventuelle;
- budget de candidats et de sortie.

L'IA peut proposer des alias ou formulations de recherche, mais ne peut pas ajouter une ancre certaine absente des données validées.

### 2. Inclusion obligatoire

Sont chargés hors compétition de score :

- état courant nécessaire;
- scène et processus actifs;
- acteurs présents;
- règles et contraintes applicables;
- engagements indispensables;
- résultats mécaniques à raconter.

Un souvenir candidat ne peut jamais évincer un élément obligatoire.

### 3. Canaux de candidats

#### Structuré

Recherche par identifiants, types, acteurs, lieux, objets, factions, fils, temps, relations et chaînes causales. Ce canal fournit les correspondances les plus fiables.

#### Graphe borné

Expansion depuis les ancres sur un nombre et des types de relations limités :

```text
acteur → relation → événement → lieu → fil
```

La profondeur et le volume sont configurables. L'expansion ne suit pas automatiquement toutes les relations du graphe.

#### Textuel

Recherche exacte ou lexicale sur noms, alias, formulations, descriptions et portions autorisées du transcript. Elle sert notamment lorsqu'un joueur cite une ancienne phrase.

#### Sémantique

Recherche par proximité de sens sur des représentations dérivées et sourcées. Elle sert à retrouver un souvenir formulé différemment, jamais à en garantir l'identité ou la vérité.

Chaque canal possède un quota de candidats afin qu'un grand nombre de résultats faibles ne sature pas le pipeline.

### 4. Filtrage de sécurité

Les restrictions de campagne, rôle, acteur et visibilité sont appliquées avant la recherche lorsque le moteur le permet, puis vérifiées à nouveau sur chaque résultat.

Un index sémantique porte au minimum les métadonnées suivantes : référence cible, campagne, type, visibilité, acteur concerné, version de contenu et période de validité. Les secrets peuvent utiliser un espace ou filtre séparé afin qu'une requête joueur ne les récupère jamais comme candidats.

### 5. Validation des candidats

Chaque candidat doit :

- résoudre vers une source existante;
- appartenir à la campagne et à la version attendues;
- respecter validité et temporalité;
- être accessible depuis la perspective demandée;
- expliquer son lien avec les ancres ou le but;
- conserver sa provenance;
- ne pas dupliquer un résultat plus autoritaire.

Une similarité élevée ne contourne aucun de ces contrôles.

### 6. Niveaux de priorité

Les candidats validés sont classés par niveaux avant tout affinage interne :

1. obligatoire;
2. correspondance structurée directe;
3. lien causal ou relationnel fort;
4. mention textuelle ou alias;
5. similarité sémantique validée;
6. suggestion faible, exclue en premier.

À niveau égal, le classement peut considérer importance, pertinence courante, temporalité, qualité de source et diversité. Ces facteurs ne sont pas fusionnés dans un score unique impossible à expliquer.

### 7. Dégradation contrôlée

- Si la recherche sémantique est indisponible, les canaux structurés, graphe et texte continuent de fonctionner.
- Si aucun candidat fiable n'est trouvé, le système reconnaît l'absence ou demande une précision.
- Il ne fabrique jamais un souvenir pour remplir un paquet vide.
- Les index textuels et sémantiques restent dérivés et reconstruisibles.

## Sélection finale

### Ordre de comparaison

Après les niveaux de priorité, la sélection compare explicitement :

1. adéquation au but du rappel;
2. proximité causale ou relationnelle;
3. importance systémique et narrative;
4. qualité et précision de la source;
5. pertinence temporelle;
6. apport de diversité au paquet.

La récence ne domine pas automatiquement : un ancien serment structurant peut rester plus important qu'un détail récent.

### Déduplication

Les résultats pointant vers le même fait, événement ou acteur sont regroupés. La représentation structurée autoritaire est conservée; les extraits textuels restent des formulations ou preuves de discours.

Deux perspectives différentes ne sont pas fusionnées. Une vérité, une croyance de PNJ et une hypothèse joueur portant sur le même sujet restent trois entrées liées mais distinctes.

### Diversité

Le sélecteur évite de remplir tout le paquet avec des variantes du même souvenir. Selon le but, il réserve une couverture suffisante à :

- état courant et changements;
- causalité;
- acteurs et relations;
- fils et engagements;
- demande explicite;
- contexte local ou temporel.

La diversité ne force pas l'ajout d'une catégorie sans résultat pertinent.

## Capsules de mémoire

Chaque résultat retenu devient une capsule structurée contenant :

- référence et type de source;
- fait, événement ou contenu subjectif utile;
- entités concernées;
- temps et validité;
- perspective;
- certitude ou nature subjective;
- provenance;
- raison et niveau d'inclusion;
- références vers les détails complets.

Une formulation courte peut être générée depuis la capsule. Elle reste dérivée, ne fusionne pas les contradictions et conserve les références permettant de vérifier ou reconstruire son contenu.

Plusieurs capsules très proches peuvent être condensées en une capsule de groupe si leurs sources et différences restent accessibles. Une condensation ne transforme jamais plusieurs rumeurs en fait confirmé.

## Perspectives et droits de révélation

Le pipeline construit des projections séparées :

### `system_mj`

Vérités, secrets et engagements nécessaires à l'orchestration de la scène. Les secrets sans rapport avec la tâche restent exclus.

### `player_character`

Connaissances, perceptions et croyances accessibles au personnage, avec leurs incertitudes. Les vérités non apprises restent exclues.

### `npc:<actorId>`

Connaissances, croyances, motivations et souvenirs propres au PNJ. Une connaissance du MJ ou d'un autre acteur ne lui est pas attribuée.

### `player_meta`

Transcript, notes et informations consultables hors jeu. Cette vue peut aider le joueur sans devenir la vérité du personnage ou du monde.

### `diagnostic`

Traces techniques, raisons de classement et erreurs. Cette vue n'est jamais intégrée à la narration.

Les droits sont appliqués avant recherche lorsque possible, après récupération, pendant la condensation et avant remise au consommateur. Une donnée exclue pour visibilité ne peut pas réapparaître dans un résumé dérivé.

## Budget de projection

Le budget est défini pour chaque rôle d'appel IA à partir de la capacité réelle du modèle. Aucun nombre universel de tokens n'est figé dans le modèle conceptuel.

### Réservations préalables

Avant d'allouer la mémoire, le système réserve :

- instructions et contrat du rôle;
- marge de sortie attendue;
- entrée actuelle du joueur;
- état et résultats obligatoires;
- marge de sécurité liée au comptage des tokens.

La mémoire reçoit le budget résiduel avec ses propres minima et maxima configurables.

### Sous-budgets mémoire

L'allocation protège dans cet ordre :

1. continuité immédiate et état courant;
2. engagements et causalité indispensables;
3. perspectives des acteurs présents;
4. rappel explicitement demandé;
5. relations et fils pertinents;
6. changements depuis la dernière rencontre;
7. lore et souvenirs secondaires;
8. suggestions sémantiques faibles.

Ces catégories possèdent des réserves et plafonds plutôt que des pourcentages immuables. Un budget inutilisé peut être redistribué aux catégories suivantes.

### Réduction en cas de dépassement

1. retirer doublons et formulations redondantes;
2. exclure suggestions faibles puis candidats sémantiques non nécessaires;
3. réduire le nombre d'éléments `dormant` et `archived`;
4. condenser les capsules secondaires en conservant leurs références;
5. raccourcir les formulations dérivées;
6. fractionner la tâche ou utiliser un appel spécialisé si les éléments obligatoires dépassent encore la capacité.

Une règle, un résultat, un droit de révélation ou un engagement indispensable n'est jamais tronqué silencieusement. Si les éléments obligatoires ne tiennent pas, le pipeline produit une erreur de budget explicite au lieu d'envoyer un contexte incomplet présenté comme fiable.

## Trace de projection

Chaque projection produit une trace contenant :

- identifiants de campagne, tour, snapshot et perspective;
- but du rappel et déclencheurs activés;
- budget total, réserves et consommation par section;
- canaux interrogés, quotas et nombre de candidats;
- candidats invalides avec raisons;
- éléments exclus pour visibilité, doublon, faible priorité ou dépassement;
- éléments inclus avec niveau, raison, coût estimé et sources;
- condensations réalisées et références regroupées;
- avertissements, fallbacks et dépassements;
- version des index et de la politique de sélection.

La trace complète peut contenir des informations privées et reste réservée au diagnostic autorisé. Une version expurgée peut expliquer les rappels sans révéler de secrets.

## Cas d'acceptation — retour tardif

Après plusieurs mois de temps de jeu, le personnage revient aux Archives de Lysenthe.

Le pipeline doit :

1. charger l'état actuel et la version de contenu épinglée;
2. identifier la dernière visite et les connaissances acquises alors;
3. calculer les changements validés depuis cette visite;
4. retrouver les PNJ connus encore liés au lieu;
5. réactiver les fils et engagements pertinents;
6. comparer anciennes perceptions et état présent;
7. exclure les secrets et événements sans signal accessible;
8. condenser les souvenirs secondaires;
9. respecter le budget sans perdre les invariants;
10. tracer chaque inclusion et exclusion importante.

Le cas échoue si le système dépend du transcript complet, révèle un secret, oublie un changement durable, confond une ancienne croyance avec la vérité ou dépasse silencieusement son budget.

## Audit de l'atelier

- Mémoire complète, mémoire vécue et mémoire projetée sont séparées.
- Conservation, validité, importance et cycle de rappel sont indépendants.
- Les index sont dérivés et reconstruisibles.
- Les déclencheurs forts et secondaires sont définis.
- La recherche hybride continue de fonctionner sans canal sémantique.
- Les perspectives et droits sont appliqués à chaque étape.
- Les capsules restent sourcées et ne fusionnent pas les croyances avec la vérité.
- Les budgets possèdent un ordre de réduction explicite.
- Toute sélection importante est traçable.
- Le retour tardif satisfait le critère de sortie sans charger toute la campagne.

## Exemple

Pour « Où ai-je déjà vu ce symbole en forme de vague brisée ? » :

1. résoudre les objets, lieux et factions déjà connus du personnage;
2. chercher leurs symboles structurés et descriptions associées;
3. explorer les scènes et événements où ces entités étaient perceptibles;
4. rechercher les formulations textuelles et sémantiques proches;
5. vérifier ce que le personnage avait réellement observé;
6. retourner les souvenirs sourcés ou signaler l'incertitude.

La proximité entre « vague brisée » et « emblème marin fendu » aide à découvrir le candidat; elle ne prouve pas qu'il s'agit du même symbole.

## Garde-fous

1. Le cycle de rappel ne modifie jamais la vérité.
2. L'archivage ne supprime aucune cause nécessaire.
3. L'oubli d'un acteur ne supprime pas la connaissance système de cet oubli.
4. Une donnée dérivée n'est jamais la seule copie d'une information autoritaire.
5. Un élément secret conserve ses restrictions lors de toute réactivation.
6. Une croyance ne devient pas vraie parce qu'elle est souvent rappelée.
7. Une importance systémique forte empêche l'éviction de l'état métier, pas nécessairement l'injection textuelle.
8. Les engagements d'intrigue restent récupérables tant que leur fil ou leurs conséquences peuvent revenir.

## Points reportés

- calibration des enveloppes initiales par modèle et par rôle définies dans `Exigences-non-fonctionnelles.md`;
- quotas chiffrés de candidats par canal;
- technologie d'index textuel et sémantique;
- stratégie physique de pagination et de cache;
- format des traces mémoire respectant la rétention définie dans `Resilience-securite-diagnostic.md`.
