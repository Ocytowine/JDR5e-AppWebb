# État actuel et feuille de route du module narration

Date de référence : 2026-07-30

Statut : `SOURCE_CANONIQUE_ACTIVE`

## Rôle de ce document

Ce document est le point de reprise unique du chantier narration. Il répond à
quatre questions :

1. quel produit nous construisons ;
2. ce qui fonctionne réellement aujourd'hui ;
3. les limites encore ouvertes ;
4. dans quel ordre nous allons travailler.

`TASKS.md` ne conserve que le lot immédiat. Les contrats décrivent le
comportement exigé. Les matrices et audits prouvent ou expliquent un travail
passé, mais ne définissent plus la feuille de route.

En cas de contradiction, l'ordre d'autorité documentaire est :

1. code et tests exécutables ;
2. contrat actif du comportement concerné ;
3. ce document ;
4. `TASKS.md` pour l'ordre immédiat ;
5. décisions historiques, audits, handoffs et matrices de preuve.

## Objectif produit

Offrir un jeu de rôle narratif dans lequel le joueur peut s'exprimer librement,
recevoir une réponse immersive et agir sur un monde cohérent, sans transformer
le modèle IA en base de données, moteur de règles ou autorité de campagne.

Le wiki sert d'appui de cohérence et d'inspiration. Il décrit ce qui est établi,
mais son silence ne signifie pas que le monde est vide. Une archive centrale
peut donc contenir des copistes, des lecteurs ou des gardes ambiants compatibles
avec le lieu, même si seule la fonction d'archiviste est explicitement décrite.
Ces présences ne deviennent pas pour autant des PNJ durables ou des faits de
lore.

## Modèle de fonctionnement

```text
entrée libre du joueur
→ interprétation sémantique structurée
→ résolution locale des référents et capacités
→ arbitrage par le domaine propriétaire
→ résultat autorisé
→ rédaction narrative utile
→ validation locale de la sortie
→ projection visible et persistance
```

Le nombre d'appels IA dépend du besoin :

- une orientation vers une présence déjà visible peut utiliser uniquement
  l'interpréteur ;
- une observation générale peut ajouter le `scene_writer` ;
- le `coherence_critic` est une défense conditionnelle pour les sorties à risque,
  pas un passage obligatoire ni une seconde autorité métier ;
- un dialogue peut appeler le performer PNJ avec la mémoire et les connaissances
  qui lui sont explicitement accessibles.

Un rejet de prose ne déclenche pas une invention compensatoire. Le runtime garde
le dernier rendu déterministe autorisé et expose l'incident séparément dans le
diagnostic système.

## Invariants non négociables

- Le sens libre vient de l'interprétation sémantique, pas d'une liste locale de
  formulations joueur.
- Le logiciel décide seul des références valides, capacités, règles, résultats,
  temps, commits, secrets, inventaire et promotions durables.
- Le wiki contraint les faits établis sans devenir une liste exhaustive des
  détails ordinaires compatibles avec la scène.
- L'identité révélée au joueur dépend de ce que le personnage connaît ou apprend.
  Un métier visible, une personne déjà repérée et un nom propre connu ne sont pas
  la même chose.
- Une parole PNJ est attribuée à son auteur. Elle n'est pas promue
  automatiquement en vérité de campagne.
- La texture créative peut enrichir une sensation ou une ambiance compatible.
  Elle ne crée pas de présence, objet, secret, résultat mécanique ou causalité
  réutilisable.
- La réponse du MJ est une prose narrative. Les clés de données, champs wiki,
  traces de pipeline et diagnostics restent hors de cette prose.
- Une panne IA ne rejoue jamais un commit et ne masque pas silencieusement le
  problème.
- Les raccourcis de performance sont fondés sur des structures validées, jamais
  sur le vocabulaire exact saisi par le joueur.

## Exemples de frontière

### Présence et identité

Si le registre de scène connaît une employée visible mais que son nom n'a pas été
révélé, le MJ peut parler d'« une archiviste » ou de « la femme aperçue près des
rayonnages ». Il ne doit pas afficher son identifiant technique ni son nom caché.

### Lore et création ambiante

Le wiki peut établir que les Archives conservent des chartes et sont surveillées.
Le rédacteur peut mettre en scène le froissement des registres ou des copistes au
travail si le plan de rendu l'autorise. Il ne peut pas inventer une charte
secrète, un crime ou un personnage durable.

### Intention composée

Pour « je m'approche de l'archiviste, je la salue, puis je recule », V5 conserve
l'ordre : approche réversible, acte de parole, éloignement et libération du focus
conversationnel. La phrase du joueur ne devient pas un script lexical local.

### Question de lore

Une question du joueur n'autorise pas une révélation globale. La réponse est
construite depuis les faits publics, les connaissances du personnage et les
paroles attribuables aux interlocuteurs. Ce qui est inconnu reste inconnu ou
devient l'objet d'une recherche en jeu.

## État réellement livré

| Domaine | État au 2026-07-28 |
|---|---|
| Noyau et persistance | opérations idempotentes, temps, snapshots, IndexedDB et reconstruction du fil disponibles dans le périmètre actuel |
| Intention | contrats sémantiques V2 à V5, référents locaux, orientation visible, composantes ordonnées et gate réaliste de huit tours intégrés |
| Perception | distinction présence, trait visible et indice incertain ; observation bornée par les signes autorisés |
| Scènes | scène wiki, transitions locales, création guidée lore et retour vers une scène connue disponibles |
| Population | séparation population ambiante, acteur local, désignation révélée et PNJ de campagne |
| Dialogue | actes structurés, performer PNJ borné, mémoire courte par acteur, profil conversationnel éphémère révisé et conversations à plusieurs tours |
| Rédaction | `scene_writer` contrôlé par un plan de rendu, couverture minimale des référents et fallback déterministe |
| Interface | surface React, mode local/OpenAI, blocs narratifs et diagnostics système séparés |
| Handoffs | repos narratif minimal jouable, segmenté et restaurable ; résultat terminal transmis par outbox à un routeur non autoritaire ; tactique jouable encore incomplet |
| Validation | régressions déterministes, recettes navigateur et recettes OpenAI ciblées ; build global validé au dernier point de contrôle |

Le dernier vertical Archives valide notamment :

- une question simple sur les personnes visibles sans clarification artificielle ;
- une réponse narrative qui ne fuit pas `fonction_principale`, `rumeurs` ou une
  autre clé wiki ;
- l'approche d'une présence, un dialogue et un retour de scène ;
- une intention sociale composée exécutée dans l'ordre ;
- une référence pronominale clarifiée après libération du focus, puis une reprise
  avec cible explicite ;
- un changement d'interlocuteur et une transition complète vers
  l'arrière-salle puis retour ;
- un parcours court d'orientation sans appel inutile au rédacteur ou au critique.

## Limites connues

- La gate V5 de référence est certifiée, mais elle ne prétend pas couvrir toutes
  les combinaisons possibles d'intentions libres.
- Les conversations longues sont couvertes jusqu'à cinq couples mémorisés par
  acteur, avec changement d'interlocuteur, sortie-retour de scène et profil
  subjectif éphémère restaurable. La promotion de cette matière en mémoire
  sociale durable reste soumise à une autorité propriétaire.
- La promotion durable d'un acteur local est raccordée à une acceptation
  mission/relation persistée ; le cycle complet de quête et les axes sociaux
  longs restent à construire.
- Le catalogue lore narratif est désormais généré au build ; l'indexation
  incrémentale d'un corpus beaucoup plus vaste reste différée.
- Les projections de campagne `REPLACE` et `WITHHOLD` surchargent le lore pour
  les scènes et créations dynamiques ; les faits libres sans ancre lore restent
  hors du contrat V1.
- Le créateur de personnage doit fournir une projection mécanique stable aux
  tests de compétence.
- Le premier noyau d'intrigue privée est ouvert ; la génération complète
  d'intrigues, l'inventaire, le tactique et la mémoire sociale longue ne le sont
  pas encore.
- Les initiatives PNJ causées et la projection des événements autonomes sont
  raccordées et certifiées par la gate 6V. Le contenu de chaque campagne reste
  fourni par ses domaines propriétaires.
- Les métriques sont maintenant séparées par rôle dans la gate Archives ; elles
  doivent être conservées et étendues aux futurs corpus.

## Feuille de route ordonnée

### Lot 0 — base documentaire

Statut : `TERMINE_2026-07-28`

Objectif : rendre l'état, les méthodes et les objectifs retrouvables sans
reconstruire l'historique.

Terminé lorsque `TASKS.md`, ce document, l'index et le README du module ne se
contredisent plus et que les anciens suivis concurrents sont retirés.

### Lot 1 — stabilisation V5 et gate réaliste

Statut : `TERMINE_2026-07-28`

Objectif : prouver que la compréhension libre, l'ordre des composantes, la
résolution et la narration restent cohérents sur un parcours de joueur réaliste.

Travail :

- compléter le corpus simple/composé/perception/dialogue/transition ;
- tester les erreurs de cible, ambiguïtés réelles et changements
  d'interlocuteur ;
- mesurer chaque rôle IA séparément ;
- vérifier le rendu joueur et les diagnostics système ;
- comparer les sorties répétées sans exiger une phrase identique.

Terminé lorsque les tests déterministes, la recette OpenAI documentée et le build
passent sans révélation indue, mutation non autorisée, fallback silencieux ni
régression narrative majeure.

Résultat :

- gate déterministe de huit tours verte ;
- confiance faible transformée en clarification exploitable plutôt qu'en panne
  IA ;
- `RECENT_FOCUS` validé localement même si l'IA fournit un identifiant ;
- gate OpenAI composée verte : interpréteur 4 appels, moyenne 3,05 s ; performer
  3 appels, moyenne 12,8 s ; critique conditionnel 1 appel, 4,3 s ;
- clarification sans focus validée avec le seul interpréteur ;
- transition OpenAI complète en 2,5 minutes, sans fallback ;
- régressions ciblées et build global verts.

### Lot 2 — catalogue lore narratif de build

Statut : `TERMINE_2026-07-28`

Objectif : fournir aux rôles IA seulement les influences utiles au contexte,
avec provenance, niveau de connaissance et budget maîtrisés.

Travail :

- générer le catalogue depuis `wiki/lore` avec le script propriétaire ;
- appliquer la configuration de modèles déjà benchmarkée ;
- vérifier que l'absence d'un détail dans le wiki n'interdit pas les créations
  ambiantes compatibles ;
- conserver la topologie et les commits sous autorité locale.

Résultat :

- compilation du wiki retirée du navigateur au profit de
  `narrative-lore-build-catalog/1` ;
- 15 paquets de scène générés depuis 23 sources utiles, avec provenance,
  niveaux `COMMUN`/`LOCAL` et budget de 16 influences ;
- dimensions absentes conservées comme ouvertures créatives contrôlées ;
- aucun texte source brut, aucune topologie et aucun commit dans le catalogue ;
- `scene_creator` configuré par défaut sur `gpt-5.6-luna/none`, avec surcharges
  explicites conservées ;
- test de catalogue, test de route serveur et build TypeScript verts.

### Lot 3 — conversations PNJ longues

Statut : `TERMINE_2026-07-28`

Objectif : maintenir voix, identité révélée, connaissances et mémoire courte sur
des échanges prolongés et des retours de scène.

Ce lot n'ouvre ni vérité automatique des paroles, ni relation mécanique durable.

Résultat :

- identité de locuteur dérivée génériquement, sans liste de PNJ de fixture ;
- cinq couples joueur → réponse exacte au maximum par acteur ;
- isolement entre interlocuteurs et éviction déterministe des anciens échanges ;
- reconstruction des réponses d'un acteur dynamique après sortie-retour ;
- parole persistée avec autorité `PRESENTATION_ONLY`, sans engagement durable ;
- profil conversationnel produit dans le même appel, révisé seulement après une
  performance acceptée et isolé par `actorId` ;
- perspective, préoccupations, opinions, sujets d'ouverture, limites et style
  disponibles sans promotion automatique ni mutation du registre social ;
- gate déterministe de 13 tours, test navigateur et recette OpenAI continue de
  14 tours verts ;
- mesure OpenAI séparée : interpréteur 2,717 s, performer 12,280 s et critique
  4,598 s de moyenne.

### Lot 4 — autorité mission/relation

Statut : `TERMINE_2026-07-28`

Objectif : créer le domaine propriétaire capable d'accepter un engagement et
d'émettre la confirmation nécessaire à la promotion durable d'un PNJ.

La narration et le performer peuvent proposer ou exprimer ; ils ne confirment
pas eux-mêmes la cause durable.

Résultat :

- registre persistant séparant proposition et résolution ;
- quatre décisions conservées : acceptée, refusée, conditionnelle et incertaine ;
- frontière explicite entre autorité de quête et autorité sociale ;
- confirmation émise uniquement pour une acceptation propriétaire ;
- relecture obligatoire du registre avant promotion, ce qui rejette une
  confirmation fabriquée ou altérée ;
- commits atomiques, rejeu idempotent et conflit de commande détecté ;
- raccord contrôleur et recette navigateur de retour puis promotion validés.

### Lot 5 — lore surchargé par l'état de campagne

Statut : `TERMINE_2026-07-28`

Objectif : faire primer les changements validés de la campagne sur le contenu
auteur lors de la sélection de contexte et de la création de scènes.

Résultat :

- registre `CampaignFactDomain` séparé du catalogue auteur immuable ;
- projections `REPLACE` et `WITHHOLD` committées atomiquement avec provenance ;
- fusion déterministe à une révision de campagne donnée ;
- historique conservé pour relire une ancienne révision ;
- même lecteur injecté dans le brief du `scene_creator` et l'adaptateur de scène
  lore ;
- sources privées refusées, rejeu idempotent et conflit détecté ;
- tests prouvant priorité, masquage, provenance et absence de mutation du
  catalogue généré.

### Lot 6 — scénarios 005 à 009 et intégrations

Statut : `TERMINE_2026-07-30`

Objectif : reprendre orchestrateur, progression, social, bastion et repos selon
leurs dépendances réelles, puis brancher progressivement créateur de personnage,
monde, inventaire et tactique.

Audit initial :

- le repos 009 devient le premier vertical, car processus, temps, interruption
  et commits existent déjà ;
- le cas 005 est découpé en routeur d'événements sans autorité, puis noyau
  d'intrigue après l'état social ;
- le social 007 précède l'intrigue complète pour porter connaissances,
  croyances et relations des acteurs ;
- une verticale transverse 6V impose que 6C ouvre l'initiative locale des PNJ
  et que 6D raccorde l'évolution autonome à la scène ;
- la progression 006 vient après le premier hook repos/orchestrateur ;
- le bastion 008 ferme la série en raison de ses dépendances nombreuses ;
- les intrigues et événements cachés ont un sous-lot explicite 6D et ne sont
  plus reportés dans une suite indéterminée.

Résultat du sous-lot 6A :

- intention `rest` ouverte uniquement si son propriétaire est injecté ;
- type de repos conservé dans le contrat sémantique, sans dictionnaire lexical
  dans le runtime ;
- démarrage et segments atomiques, temporels et rejouables ;
- interruption et continuation fondées sur le checkpoint committé ;
- achèvement bloqué en attente des autorités de bénéfices ;
- contrôle UI et restauration IndexedDB validés dans trois scénarios navigateur.

Résultat du sous-lot 6B :

- enveloppe `orchestration-event-router/1` créée dans le commit terminal du
  repos ;
- données privées de sécurité exclues avant la frontière d'orchestration ;
- routeur limité à la validation, la sélection stable et la livraison ;
- hook `rest.lifecycle-signal/1` purement signalétique ;
- erreur temporaire, reprise et absence d'abonné couvertes sans double temps ni
  double bénéfice.

Objectif transversal 6V :

- le personnage est un participant, jamais le déclencheur implicite du monde ;
- une initiative PNJ exige une cause, un objectif et des connaissances propres ;
- elle peut viser le lieu ou un autre acteur plutôt que le joueur ;
- l'évolution hors écran dépend uniquement du temps diégétique validé ;
- les événements privés restent hors du contexte du rédacteur ;
- la gate 6V est certifiée avant l'ouverture de 6E.

Résultat du sous-lot 6C :

- registre social persistant distinct de la projection UI ;
- faits connus, croyances, relations orientées, réputation, dettes, promesses
  et préoccupations séparés par acteur ;
- frontière autonome du contrôleur sans fausse saisie joueur ;
- initiative locale committée vers une cible explicitement présente, ou résultat
  `CALM` sans commit ;
- projection bornée vers le performer et restauration navigateur sans
  duplication.

Résultat du sous-lot 6D :

- vérité privée, engagements et voies d'indice committés avant mise en scène ;
- évolution hors écran pilotée uniquement par l'horloge diégétique ;
- révélations classifiées et committées séparément de la vérité ;
- adaptation des seuls signaux perceptibles issus des événements monde déjà
  committés, sans rejouer `world-simulation` ni exposer ses données internes ;
- perceptions d'intrigue et du monde réunies dans un bundle causal commun ;
- échéance importante arrêtant l'avance, mise en scène puis restitution de la
  main au joueur ;
- absence de fuite et rejeu sans duplication couverts au niveau domaine et
  navigateur.

Gate 6V certifiée le 2026-07-29 :

- initiative PNJ vers le joueur ou un tiers depuis une cause antérieure ;
- nouvelle frontière sociale après avance diégétique ;
- priorité conservée pour une interruption urgente ;
- scène calme, ordre stable, secrets exclus et rejeu sans duplication ;
- commande unique `narration-module:test:living-world-gate`.

6E-A à 6E-C livrés le 2026-07-29 :

- disponibilité issue d'un événement committé et d'une politique injectée ;
- choix de classe conservé sans mutation implicite du personnage ;
- événement source dédupliqué et payload privé exclu de la projection publique ;
- choix explicites et candidat complet revalidés par l'autorité
  personnage/ruleset ;
- registre, état personnage et projections tactique et narrative appliqués dans
  un commit unique ;
- rejet, rejeu, conflit et panne injectée sans mutation partielle ;
- résumé public committé transformé en narration déterministe, puis restauré
  par le fil commun sans duplication ni nouvelle application.

6E-D livré le 2026-07-29 après réouverture du lot :

- segment de repos court ou long typé `CHARACTER_PROGRESSION`, lié au
  personnage et à la récompense ;
- preuve committée obligatoire avant application, avec refus d'un segment
  interrompu, étranger ou antérieur à la disponibilité ;
- adaptateur lisant les catalogues actuels du créateur sans les recopier dans
  la narration ;
- candidat construit depuis l'entrée exacte du nouveau niveau ;
- niveau global, maîtrise et PV maximum recalculés par le ruleset épinglé ;
- contenu absent, choix non implémenté ou référence inconnue suspendant la
  progression sans commit et sans compensation inventée ;
- progression mécanique maintenue distincte de l'évolution sociale et
  personnelle.

6F-A livré le 2026-07-29 :

- définition du bastion comme propriété durable liée à un lieu, et non comme
  simple scène ou texte de possession ;
- audit confirmant les fondations lieu, temps, monde, PNJ, social, mission et
  rendu ;
- absence confirmée d'autorité de propriété, de catalogue de travaux et de
  transaction économique de campagne ;
- matrice attribuant chaque propriété à une autorité unique ;
- découpage retenu : établissement 6F-B, travail temporisé 6F-C, occupants
  6F-D, incidents et défense 6F-E ;
- interdiction de rendre gratuit ou automatique un prérequis dont le domaine
  propriétaire n'existe pas encore.

6F-B livré le 2026-07-29 :

- registre propriétaire séparé du lieu et du lore ;
- événement d'acquisition committé, politique injectée et lieu existant exigés ;
- établissement atomique, dédupliqué et rejouable ;
- événement public sans prix, dette ou payload privé de la source ;
- narration déterministe n'ajoutant ni pièce, ni occupant, ni ressource ;
- restauration navigateur sans duplication et rollback sans état partiel.

6F-C livré le 2026-07-29 :

- travail absent du catalogue injecté refusé avant toute mutation ;
- durée, prérequis, effet et narration d'achèvement issus uniquement de la
  définition cataloguée ;
- coût ou matériau externe bloqué sans autorité et preuve, jamais converti en
  gratuité ;
- ordre et échéance committés ensemble, puis achèvement par l'horloge unique ;
- installation, ordre terminé et événement public écrits atomiquement ;
- projection du résultat committé et restauration navigateur sans duplication.

6F-D livré le 2026-07-29 :

- PNJ persistant et rôle catalogué exigés avant toute affectation ;
- acceptation relue depuis une décision propriétaire committée ;
- refus ou autorité absente sans mutation ;
- registre du bastion limité au rôle et aux faits publics, sans copie de l'état
  privé de l'acteur ;
- frontière autonome dédiée au contrôleur, sans fausse saisie joueur ;
- résultat `CALM` sans commit lorsqu'aucune initiative n'est autorisée ;
- première activité autonome cataloguée, committée puis projetée dans le fil ;
- rejeu et restauration navigateur sans duplication.

6F-E livré le 2026-07-29 :

- incidents uniquement dérivés d'une opération et d'un événement propriétaires
  committés ;
- politique et catalogue injectés, sans liste locale de menaces ou
  d'opportunités ;
- occasion conservée ouverte et conséquence bornée à l'installation visée ;
- attaque refusée sans propriétaire tactique ;
- registre du bastion, processus actif et graine tactique committés ensemble ;
- aucun résultat de combat, dégât, butin ou vainqueur inventé par la narration ;
- projection du résumé public sans fuite du payload privé de la cause ;
- rejeu et restauration navigateur sans duplication.

Le vertical contractuel 6F est ainsi fermé. La prochaine étape concrète est un
lot d'intégration jouable : brancher des catalogues de campagne réels et les
commandes joueur dans la surface principale, puis certifier en build complet le
départ et le retour d'une défense tactique. Ce lot ne devra pas modifier les
autorités désormais établies.

7A livré le 2026-07-29 :

- session tactique restaurée uniquement depuis l'événement public, le registre
  du bastion, le processus et la graine committés ;
- identités de campagne, de processus et de lieu vérifiées ensemble ;
- défense en attente signalée dans la surface narration ;
- ouverture de la surface tactique avec la session persistée ;
- plateau avertissant explicitement que son combat manuel n'est pas un résultat
  de campagne ;
- aucune acquisition, attaque ou fixture ajoutée à la campagne Archives ;
- restauration navigateur couverte.

7B livré le 2026-07-29 :

- projections personnage, équipe, adversaire et carte résolues par des
  adaptateurs injectés, sans fiche locale ou personnage d'exemple ;
- zones, terrain, dangers, lumière et visibilité confrontés à la graine ;
- types d'adversaires et positions exacts chargés depuis les catalogues et la
  projection ;
- configuration libre contournée et démarrage automatique du plateau ;
- refus avant combat des références absentes, équipes incohérentes, grilles
  insuffisantes, positions impraticables, surprises et alliés non supportés ;
- contexte lié au `processId` conservé dans la surface tactique ;
- contrat, test déterministe, test navigateur et guide français ajoutés.

7C-A livré le 2026-07-30 :

- journal du plateau conservé dans un snapshot de frontière de tour ;
- état des participants, ressources, initiative et carte committé dans un
  checkpoint révisionné et protégé par empreinte ;
- rejeu idempotent d'une même sauvegarde ;
- checkpoint restauré avec la défense active puis injecté dans `GameBoard` ;
- rechargement navigateur sans régénération de carte ni nouveau jet
  d'initiative.

7C-B livré le 2026-07-30 :

- durée de round et mapping des fins fournis par la projection, sans décision
  lexicale du plateau ;
- checkpoint terminal exigé avant l'outcome ;
- état final, ressources, positions, journal et neutralisations conservés dans
  `TacticalOutcomeV1` ;
- conséquences personnage et bastion laissées comme candidats non appliqués ;
- outcome et processus en attente persistés atomiquement et rejouables ;
- session en attente restaurable puis retour vers la surface narration.

7C-C livré le 2026-07-30 :

- registre injecté d'autorités, sans propriétaire implicite ;
- PV confrontés aux agrégats personnage et projection tactique ;
- incident confronté au registre de bastion actif ;
- interprétation de la condition terminale déléguée à une politique injectée ;
- temps, deltas, processus et outcome intégrés atomiquement ;
- rejeu idempotent sans double dégât ;
- continuation MJ déterministe persistée depuis l'événement public résolu.

Le vertical technique 7C est fermé. La prochaine étape est de brancher des
catalogues, références et causes de bastion réels dans une campagne jouable,
sans amorçage artificiel des Archives.

8A livré le 2026-07-30 :

- constructeur de graine alimenté par un catalogue de rencontre injecté ;
- projection joueur confrontée aux agrégats personnage réels ;
- références personnage conservées jusqu'au retour 7C ;
- carte, adversaires et fins définis par le catalogue, sans table runtime ;
- résolution terminale issue de la même entrée cataloguée ;
- payload privé de la cause exclu du seed ;
- factory du contrôleur réunissant entrée, préparation et autorités de retour.

8B livré le 2026-07-30 :

- profil du personnage actif persisté atomiquement au bootstrap ;
- références des agrégats canonique, tactique, narratif et position conservées
  sans recopier la fiche ;
- dépendances contenu et règles confrontées à celles de la campagne ;
- résolveur relisant le profil et les agrégats avant projection ;
- adaptateur GameBoard injecté, sans personnage d'exemple de secours ;
- équipe joueur déclarée par la rencontre et non déduite par le runtime ;
- catalogue de défense chargé depuis l'entrée versionnée du paquet épinglé.

8C livré le 2026-07-30 :

- cause relue exclusivement depuis une opération et un événement committés ;
- politique injectée responsable de comprendre la source monde ou intrigue ;
- cible limitée aux bastions actifs et refus d'une identité périmée ;
- aucune décision fondée sur le nom ou le texte de l'événement ;
- frontière calme sans opération, commit ou rendu ;
- commande dérivée de manière déterministe et rejeu idempotent ;
- défense tactique réelle passant par cette nouvelle frontière ;
- données privées de la cause exclues du routage et de la projection.

8D livré le 2026-07-30 :

- campagne IndexedDB isolée réellement bootstrapée depuis la sortie actuelle
  du créateur de personnage ;
- paquet de contenu, profil actif et catalogue de défense versionnés relus ;
- cause monde committée routée vers un bastion actif sans exposer son payload
  privé ;
- ouverture réelle de `GameBoard`, checkpoint puis restauration après
  rechargement ;
- outcome terminal, validations propriétaires, temps et deltas intégrés
  atomiquement ;
- continuation publique restaurée exactement une fois après un nouveau
  rechargement ;
- aucun raid ou bastion de test ajouté à la campagne Archives ;
- défauts d'intégration corrigés sur la longueur des identifiants persistants,
  les textures Pixi chargées tardivement et l'idempotence de l'entrée de scène
  sociale après avance de l'horloge.

Le lot 8 et le vertical bastion-tactique sont fermés par une preuve navigateur
complète. La prochaine étape n'est pas une nouvelle autorité métier : le lot 9
doit d'abord cadrer le chemin de campagne réellement accessible dans le build
principal et son ordre avec la consolidation restante de la simulation du
monde.

9A livré le 2026-07-30 :

- entrée principale, pilote Archives, stockage legacy des fiches, bootstrap,
  contenu généré et simulation de carte audités dans le code ;
- absence de résolveur de contenu/ruleset installé confirmée ;
- cycle de scène manquant au bootstrap réel et usages résiduels des identités
  `PROTOTYPE_*` recensés ;
- différence entre simulation React et événement monde committé explicitée ;
- contrat du lot 9 découpé en 9B liaisons, 9C porte d'entrée, 9D composition,
  9E simulation et 9F certification du build principal ;
- première frontière fixée : créer ou reprendre une campagne depuis une fiche
  validée avant d'exposer les commandes métier.

9B livré le 2026-07-30 :

- identités runtime regroupées dans `campaign-runtime-bindings/1` et validées ;
- constantes historiques limitées au profil du pilote ;
- contrôleur, transition cataloguée, création dynamique, frontières de scène
  et reprise de jet capables de lire les agrégats propres à une campagne ;
- première scène activée par un commit idempotent qui complète la position et
  crée son cycle de scène ;
- gate 8D rejouée avec des identifiants non-prototype, sans amorçage manuel du
  cycle de scène.

9C livré le 2026-07-30 :

- paquet `campaign-bootstrap/2` généré pour le navigateur sans livrer le texte
  wiki auteur brut ;
- catalogues du créateur et ruleset MVP résolus depuis les sources installées ;
- fiche active lue et diagnostiquée uniquement par un adaptateur UI ;
- campagne identifiée par la version exacte de sa sauvegarde de départ, puis
  bootstrapée et reprise sans réimport silencieux ;
- entrée réelle `créer / reprendre / pilote Archives` certifiée dans Chromium ;
- refus avant écriture d'une fiche dont une référence catalogue est absente.

Références :

- [`Audit-lot-6-scenarios-005-009.md`](Audit-lot-6-scenarios-005-009.md) ;
- [`Contrat-repos-narratif-minimal.md`](Contrat-repos-narratif-minimal.md) ;
- [`Contrat-routeur-evenements-orchestrateur.md`](Contrat-routeur-evenements-orchestrateur.md) ;
- [`Contrat-cible-monde-vivant-et-initiative-pnj.md`](Contrat-cible-monde-vivant-et-initiative-pnj.md) ;
- [`Contrat-etat-social-durable-et-initiative-locale.md`](Contrat-etat-social-durable-et-initiative-locale.md) ;
- [`Contrat-noyau-intrigue-et-revelation-bornee.md`](Contrat-noyau-intrigue-et-revelation-bornee.md) ;
- [`Matrice-certification-gate-6V-monde-vivant.md`](Matrice-certification-gate-6V-monde-vivant.md) ;
- [`Contrat-progression-personnage-bornee.md`](Contrat-progression-personnage-bornee.md) ;
- [`Contrat-bastion-minimal.md`](Contrat-bastion-minimal.md) ;
- [`Contrat-integration-jouable-bastion-tactique.md`](Contrat-integration-jouable-bastion-tactique.md).
- [`Guide-defense-bastion-et-plateau-tactique.md`](Guide-defense-bastion-et-plateau-tactique.md).

## Méthode obligatoire pour chaque lot

1. Relire ce document, `TASKS.md`, le contrat concerné et le diff existant.
2. Écrire ou ajuster le contrat avant de modifier son architecture.
3. Construire une fixture et des oracles déterministes à partir d'un comportement
   joueur, pas d'une phrase unique.
4. Implémenter au plus près du domaine propriétaire, sans nouveau hardcode
   lexical.
5. Exécuter les tests ciblés puis les régressions proportionnées au risque.
6. Si un rôle IA change, lancer une recette OpenAI exacte et conserver les
   métriques par rôle.
7. Exécuter le build global.
8. Relire le diff et le statut Git, puis mettre à jour ce document seulement si
   l'état ou l'ordre change.
9. À la clôture d'un lot fonctionnel, créer ou mettre à jour un guide en
   français expliquant le fonctionnement, des exemples, les commandes de test
   et les limites encore non jouables.
10. Garder `TASKS.md` court et ne créer aucun commit sans demande explicite.

## Règles documentaires

- Une seule feuille de route active : ce document.
- Un seul tableau de bord immédiat : `TASKS.md`.
- Un contrat actif décrit une règle actuelle, pas le journal de son
  implémentation.
- Une matrice de preuve, une recette, un audit ou un handoff est historique dès
  que son lot est fermé.
- Les longues listes de tâches terminées restent dans Git et les preuves, pas
  dans `TASKS.md`.
- Toute nouvelle documentation doit être ajoutée à l'index avec un rôle clair :
  `ACTIF`, `PREUVE_HISTORIQUE` ou `ARCHIVE`.
- Les guides français sont des documents `ACTIF` destinés à la compréhension et
  aux futurs tests fonctionnels ; ils distinguent toujours preuve automatisée
  et fonctionnalité réellement accessible dans le build principal.
