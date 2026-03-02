# Cartographie Responsabilites Noyau Narration v1

## But

Ce document fixe une lecture simple de ce qui decide quoi dans le noyau narration aujourd'hui.

Il ne corrige rien.

Il sert a :

- rendre le systeme lisible avant refonte,
- distinguer les couches qui se chevauchent,
- identifier ce qui releve du noyau, du secours, ou du nettoyage,
- preparer la Phase 2 sans ajouter de logique prematuree.

## Vue d'ensemble

Aujourd'hui, le traitement d'un tour RP est reparti entre quatre couches principales :

1. interpretation du tour
2. resolution de scene
3. rendu RP
4. nettoyage / sanitation de sortie

Le probleme actuel n'est pas qu'une couche manque totalement.

Le probleme est que :

- certaines responsabilites sont encore melangees,
- plusieurs branches resolvent et rendent en meme temps,
- des heuristiques de secours influencent encore la voie principale.

## Couche 1 - Interpretation du tour

### Role attendu

Cette couche devrait repondre a :

- que tente le joueur ?
- quelle cible est la plus probable ?
- est-ce un nouveau sujet ou une suite ?
- faut-il resoudre localement ou relayer plus loin ?

### Fonctions actuellement impliquees

#### Classification et extraction de base

- `classifyNarrationIntent(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `extractVisitIntent(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `extractLocateIntent(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `buildNarrativeDirectorPlan(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)

#### Gating par engagement

- `shouldHandleHypotheticalCommitment(...)` : [narrationCommitmentPolicy.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationCommitmentPolicy.js)
- `shouldRouteHypotheticalToLocalObservation(...)` : [narrationCommitmentPolicy.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationCommitmentPolicy.js)
- `shouldHandleInformativeCommitment(...)` : [narrationCommitmentPolicy.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationCommitmentPolicy.js)
- `shouldBypassInformativeCommitmentForLocalResolution(...)` : [narrationCommitmentPolicy.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationCommitmentPolicy.js)

### Lecture franche

Cette couche existe, mais elle n'est pas encore unifiee.

Elle est aujourd'hui repartie entre :

- une classification globale,
- des extracteurs specialises,
- des heuristiques de commitment.

Conclusion :

- l'interpretation est reelle,
- mais elle n'est pas encore centralisee dans un "acte situe" unique.

## Couche 2 - Resolution de scene

### Role attendu

Cette couche devrait repondre a :

- qu'est-ce qui est resolu maintenant ?
- comment l'etat de scene bouge ?
- quels faits de scene sont poses ?

### Fonctions actuellement impliquees

#### Resolution locale ciblee

- `buildVisitAdvisoryReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `buildLocateAdvisoryReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `buildDirectorNoRuntimeReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `maybeBuildShopOfferReply(...)` : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)
- `maybeBuildAnchoredInterlocutorReply(...)` : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

#### Resolution d'etat

- `applyWorldDelta(...)` : injecte un delta de monde sur le tour
- `applyCriticalMutation(...)` : pousse les mutations de contexte et d'ancres
- `persistNarrativeWorldStateWithPhase6(...)` : persiste le resultat du tour

#### Resolution branchee IA

- `buildAiNarrativeReplyForBranch(...)` : branche IA intermediaire, utilisee par plusieurs voies dans le handler

### Lecture franche

Cette couche est la plus melangee.

Pourquoi :

- plusieurs fonctions resolvent ET rendent du texte,
- certaines branches mutent le monde avant de savoir si la resolution choisie etait la bonne,
- le commerce a deja sa propre mini-resolution specialisee.

Conclusion :

- la resolution existe,
- mais elle n'est pas encore abstraite en une couche commune de "suite logique".

## Couche 3 - Rendu RP

### Role attendu

Cette couche devrait :

- assembler une reponse lisible,
- garder un ton propre,
- presenter la scene, le resultat, les consequences,
- sans decider a elle seule la logique du tour.

### Fonctions actuellement impliquees

- `buildMjReplyBlocks(...)` dans `server.js` : assembleur de base
- `buildMjReplyBlocks(...)` dans `narrationNaturalRenderer.js` : assembleur naturalise avec gestion des options
- `makeMjResponse(...)` : structure de sortie UI
- `parseReplyToMjBlocks(...)` : repartit un texte en blocs scene / action / consequences
- `normalizeMjOptions(...)` : nettoie les options
- `injectLockedStartContextReply(...)` : ajoute le contexte de depart verrouille en tete quand necessaire

### Lecture franche

Le rendu est deja relativement structure.

Le probleme n'est pas principalement l'absence d'assembleur.

Le probleme est que :

- certaines fonctions de resolution produisent directement du rendu,
- donc la frontiere entre "decider" et "dire" est encore poreuse.

Conclusion :

- le rendu RP existe comme couche identifiable,
- mais il n'est pas encore clairement separe de toutes les branches de resolution.

## Couche 4 - Nettoyage et sanitation

### Role attendu

Cette couche devrait :

- retirer les fuites techniques,
- harmoniser la sortie,
- corriger legerement la presentation,
- sans devenir un cache-misere structurel.

### Fonctions actuellement impliquees

- `sanitizePayload(...)` : [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)
- `applyAntiRepeat(...)` : [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)
- `buildVariationReply(...)` : [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)

### Lecture franche

Cette couche fait bien du nettoyage,
mais elle compense encore parfois des branches trop generiques.

Conclusion :

- sanitation utile,
- mais trop de poids encore sur la presentation corrective.

## Heuristiques de secours actuellement actives

Ces mecanismes existent pour tenir des cas reels.

Ils ne doivent pas etre supprimes aveuglement, mais ils ne doivent plus piloter le noyau a long terme.

### Heuristiques de lecture

- regex de perception / observation dans `narrationCommitmentPolicy.js`
- regex de bypass informatif local dans `narrationCommitmentPolicy.js`
- extracteurs cibles `visit` / `locate` dans `server.js`

### Heuristiques de resolution

- cues commerce dans `maybeBuildShopOfferReply(...)`
- cues de selection d'article
- cues de suivi de catalogue
- cues de suivi sur article focalise
- cues de reprise pronominale dans `maybeBuildAnchoredInterlocutorReply(...)`

### Heuristiques de rendu

- substitution de reponses repetitives dans `applyAntiRepeat(...)`
- gabarits de variation dans `buildVariationReply(...)`

## Repartition actuelle par responsabilite

### Qui decide l'acte ?

Aujourd'hui :

- pas une seule couche
- partage entre :
  - `classifyNarrationIntent(...)`
  - `extractVisitIntent(...)`
  - `extractLocateIntent(...)`
  - `narrationCommitmentPolicy.js`

Verdict :

- responsabilite eclatee

### Qui decide la cible ?

Aujourd'hui :

- partage entre :
  - l'intention heuristique
  - les extracteurs
  - `resolveImplicitInterlocutorFromMessage(...)`
  - l'etat de scene (`activeInterlocutor`, `activePoi`, `lastPlayerFocus`)

Verdict :

- cible souvent retrouvable,
- mais par accumulation de mecanismes.

### Qui decide la suite logique ?

Aujourd'hui :

- surtout les branches specialisees du handler,
- en particulier :
  - `maybeBuildShopOfferReply(...)`
  - les branches `visit`, `locate`, `travel`, `scene_only`

Verdict :

- pas de centre unique

### Qui decide le texte final ?

Aujourd'hui :

- partage entre :
  - les branches de resolution qui ecrivent deja leurs blocs,
  - `buildMjReplyBlocks(...)`,
  - `makeMjResponse(...)`,
  - `sanitizePayload(...)`

Verdict :

- couche identifiable,
- mais la production de texte commence trop tot dans le pipeline.

## Lecture cible a atteindre ensuite

La cible de la Phase 2 n'est pas de tout reecrire.

La cible est de rendre possible la lecture suivante :

1. interpretation unique du tour
2. choix d'un regime de resolution
3. resolution de scene
4. rendu RP
5. sanitation legere seulement

Autrement dit :

- interpretation avant resolution,
- resolution avant rendu,
- rendu avant sanitation,
- et pas l'inverse.

## Ce qu'on garde

Les elements suivants restent des acquis utiles :

- orientation locale
- deplacement proche mieux gere
- relecture d'offre et de selection sur le commerce
- ancres courtes de scene
- nettoyage d'une partie des fuites meta

Ils doivent etre rebranches, pas jetes.

## Ce qu'on vise ensuite

La suite logique apres cette cartographie est :

1. definir la structure minimale d'acte situe
2. faire calculer cette structure sans casser l'existant
3. faire lire l'existant par cette structure
4. reduire ensuite les grands fallbacks et les doublons

## Statut

- Cartographie de responsabilites : active
- Base de travail pour la Phase 2
