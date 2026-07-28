# État actuel et feuille de route du module narration

Date de référence : 2026-07-28

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
| Dialogue | actes structurés, performer PNJ borné, mémoire courte par acteur et conversations à plusieurs tours dans le vertical |
| Rédaction | `scene_writer` contrôlé par un plan de rendu, couverture minimale des référents et fallback déterministe |
| Interface | surface React, mode local/OpenAI, blocs narratifs et diagnostics système séparés |
| Handoffs | contrats tactique et repos disponibles ; moteurs jouables propriétaires encore incomplets |
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
  acteur, avec changement d'interlocuteur et sortie-retour de scène. La mémoire
  sociale durable reste différée.
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
- Les autorités complètes d'intrigue, d'inventaire, de tactique et de mémoire
  sociale longue ne sont pas ouvertes.
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

Statut : `EN_COURS_2026-07-28`

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
- la progression 006 vient après le premier hook repos/orchestrateur ;
- le bastion 008 ferme la série en raison de ses dépendances nombreuses ;
- les intrigues et événements cachés ont un sous-lot explicite 6D et ne sont
  plus reportés dans une suite indéterminée.

Références :

- [`Audit-lot-6-scenarios-005-009.md`](Audit-lot-6-scenarios-005-009.md) ;
- [`Contrat-repos-narratif-minimal.md`](Contrat-repos-narratif-minimal.md).

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
9. Garder `TASKS.md` court et ne créer aucun commit sans demande explicite.

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
