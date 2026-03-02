# Audit Reconsolidation Plan v1

## Reference unique

Ce document recale le chantier sur le plan de reference suivant :

- [Plan-Refonte-Intention-Situee-Et-Continuite-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Plan-Refonte-Intention-Situee-Et-Continuite-v1.md)

But :

- retrouver une lecture claire de l'objectif,
- distinguer ce qui est conforme, partiel, ou hors cible,
- identifier les rustines et les doublons probables,
- definir la prochaine reprise sans ajouter de complexite inutile.

## Verdict franc

Le chantier a produit des ameliorations reelles, mais il a aussi accumule des couches heterogenes.

Etat global :

- la direction generale converge partiellement vers le plan,
- plusieurs correctifs locaux ont debloque des cas utiles,
- mais le systeme reste trop hybride :
  - une partie est orientee "intention situee",
  - une partie reste pilotee par heuristiques de formulation,
  - une partie continue a se replier sur des fallbacks qui parlent encore a la place du MJ.

Conclusion :

- le projet n'est pas hors de controle,
- mais il est devenu difficile a piloter sans passe de reconsolidation.

## Cartographie de conformite au plan

### 1. Principe : l'intention situee doit etre l'unite de travail

Attendu du plan :

- comprendre l'acte tente ici et maintenant,
- le relier a la scene en cours,
- deduire la suite logique,
- sans se limiter a `story_action`, `social_action`, `informatif`, etc.

Etat reel :

- partiellement conforme

Preuves :

- une sous-categorie `locate_place` existe deja : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- certaines relectures locales existent deja (selection, prix, essai) : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Limite structurelle :

- la lecture "acte situe" n'existe pas encore comme structure centrale du pipeline,
- le systeme continue a dependre de heuristiques textuelles directes dans plusieurs branches.

Impact :

- bon comportement sur certains sous-cas,
- fragilite des que la formulation change ou que le contexte sort du couloir prevu.

### 2. Principe : la scene doit avoir des ancres persistantes

Attendu du plan :

- conserver ce qui vient d'etre etabli pour repondre naturellement au tour suivant.

Etat reel :

- partiellement conforme

Preuves :

- `lastSceneFact`, `lastPlayerFocus`, `lastPendingChoice`, `lastPresentedItems` existent deja dans le `sceneFrame` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- ces ancres sont relues dans la narration commerce : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Limite structurelle :

- ces ancres sont surtout exploitees dans la branche boutique,
- il n'existe pas encore de schema general de "faits de scene recents" pour tous les contextes,
- pas de politique claire de duree de vie / oubli / compactage.

Impact :

- la relecture multi-tours existe, mais reste locale et inegale.

### 3. Principe : les outils doivent produire des faits de scene

Attendu du plan :

- un outil ne doit pas seulement remplir du texte,
- il doit nourrir des faits reutilisables par la scene.

Etat reel :

- partiellement conforme

Preuves :

- `session_shop_offer` nourrit `lastPresentedItems` et plusieurs ancres : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Limite structurelle :

- il n'existe pas encore d'interface commune "fait de scene produit par un outil",
- le debug ne distingue pas encore clairement :
  - resultat brut d'outil,
  - fait de scene retenu.

Impact :

- le commerce beneficie d'un debut d'integration utile,
- mais le principe n'est pas generalise.

### 4. Principe : le runtime ne doit plus parler a la place du MJ

Attendu du plan :

- pas de phrases techniques deguises,
- pas de pseudo-stabilisation vide,
- le runtime contraint, il ne narre pas.

Etat reel :

- partiellement conforme

Preuves :

- le sanitizer retire plusieurs fuites meta : [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)
- des micro-descriptions contextuelles existent pour orientation / deplacement / scene : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)

Limite structurelle :

- `buildDirectorNoRuntimeReply(...)` produit encore beaucoup de texte "par defaut" : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- l'anti-repeat remplace encore des reponses par des variations generiques si le contenu n'est pas detecte comme "concret" : [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)

Impact :

- le texte est plus propre qu'avant,
- mais une partie du rendu reste encore du fallback verni.

## Rustines actuellement actives

Les elements ci-dessous ne sont pas a traiter comme "mauvais" automatiquement, mais comme des dispositifs de secours a surveiller.

### 1. Gating par commitment

Fichier :

- [narrationCommitmentPolicy.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationCommitmentPolicy.js)

Constat :

- `shouldRouteHypotheticalToLocalObservation(...)`
- `shouldBypassInformativeCommitmentForLocalResolution(...)`

Ces fonctions sont utiles, mais elles restent basees sur des indices textuels directs.

Statut :

- heuristiques de secours

Risque :

- elles resolvent des cas, mais elles ne constituent pas une vraie interpretation situee.

### 2. Resolution commerce locale

Fichier :

- [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Constat :

- `maybeBuildShopOfferReply(...)`
- `resolvePresentedItemSelection(...)`
- `resolvePresentedCatalogFollowUp(...)`
- `resolveFocusedItemFollowUp(...)`

Cette zone a debloque de vrais cas utiles, mais elle concentre deja beaucoup de logique narrative specialisee.

Statut :

- utile, mais trop specialise et trop central

Risque :

- si on continue a empiler ici, cette fonction devient un sous-moteur narratif parallele.

### 3. Fallback d'interlocuteur ancre

Fichier :

- [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Constat :

- `maybeBuildAnchoredInterlocutorReply(...)`

Cette fonction sert a conserver la cible sociale quand la comprehension est insuffisante.

Statut :

- filet de securite utile

Risque :

- elle maintient le fil, mais peut encore produire de l'inertie au lieu de resoudre.

### 4. Anti-repeat par substitution

Fichier :

- [narrationRpOutputSanitizer.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationRpOutputSanitizer.js)

Constat :

- `applyAntiRepeat(...)`
- `buildVariationReply(...)`

Statut :

- rustine de presentation

Risque :

- ce mecanisme masque parfois le vrai probleme au lieu de corriger la branche source,
- il peut reintroduire une reponse generique alors que la logique amont devait etre amelioree.

## Doublons probables

Les zones ci-dessous n'ont pas encore ete dedupliquees proprement. Elles ne sont pas forcement des doublons exacts, mais elles portent des responsabilites qui se chevauchent.

### 1. Description locale repartie a plusieurs endroits

Actuellement, la production de reponses "locales" existe dans :

- `buildVisitAdvisoryReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `buildLocateAdvisoryReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `buildDirectorNoRuntimeReply(...)` : [server.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server.js)
- `maybeBuildShopOfferReply(...)` : [narrationChatHandler.js](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/server/narrationChatHandler.js)

Risque :

- plusieurs "mini-renderers" narratifs coexistent,
- chacun gere une partie de la scene,
- la coherence de style et de responsabilite devient difficile a tenir.

### 2. Maintien de cible sociale a plusieurs niveaux

Actuellement, la conservation d'un interlocuteur est geree par :

- l'etat global (`activeInterlocutor`)
- le `sceneFrame` (`activeInterlocutorLabel`)
- `resolveImplicitInterlocutorFromMessage(...)`
- `maybeBuildAnchoredInterlocutorReply(...)`
- la branche commerce qui force `Commercant local`

Risque :

- la cible sociale est souvent conservee, mais par plusieurs mecanismes imbriques,
- ce qui complique la lecture causale d'un tour.

### 3. Fuite moteur traitee a la source et au sanitizer

Actuellement, certaines fuites ont ete corrigees :

- dans les branches sources,
- puis re-nettoyees dans `narrationRpOutputSanitizer.js`

Risque :

- doublon de responsabilite
- le sanitizer peut masquer des problemes structurels qui devraient etre corriges dans la branche emettrice.

## Ce qui fonctionne vraiment aujourd'hui

Il faut le garder explicitement pour ne pas tout remettre en cause.

### Comportements reellement debloques

- `que vois-je ?` est mieux traite qu'avant
- `c'est ou ?` / `ou se trouve ... ?` peut passer en orientation locale
- `je veux aller ...` puis `j'y vais` fonctionne mieux
- une offre boutique peut etre memorisee
- `je choisis ...`, `je demande le prix`, `je veux l'essayer` peuvent relire un objet deja montre
- certaines fuites meta visibles ont ete eliminees

### Valeur de ces acquis

- ils ne doivent pas etre supprimes aveuglement,
- ils doivent etre conserves comme comportement de reference,
- mais ensuite re-integres dans une architecture plus propre.

## Ce qui reste hors cible par rapport au plan

### 1. L'acte situe n'est pas encore central

Le systeme ne calcule pas encore une structure unique du type :

- `actType`
- `targetKind`
- `targetRef`
- `objectRef`
- `sceneLink`
- `engagement`
- `expectedNextStep`

Sans cette couche, le comportement reste disperse dans les branches.

### 1 bis. Le moteur ne distingue pas encore assez les deux regimes de resolution

Ce point est devenu plus clair avec :

- [Scenario-Reference-02.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Scenario-Reference-02.md)
- [Cadre-Familles-Outils-Narration-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Cadre-Familles-Outils-Narration-v1.md)

Le moteur doit maintenant distinguer explicitement deux regimes :

1. la resolution locale libre
2. les mecaniques lourdes soutenues par des outils dedies

### Resolution locale libre

Ce regime couvre :

- observation,
- dialogue simple,
- deplacement proche,
- reponse locale sobre,
- progression immediate d'une scene lisible.

Dans ce cas :

- les ancres de scene,
- l'intention situee,
- et le lore

doivent suffire la plupart du temps.

### Mecaniques lourdes outillees

Ce regime couvre :

- voyage,
- repos,
- compagnons,
- bastions,
- passage de niveau,
- perception du personnage et regard du monde,
- et d'autres familles futures du meme ordre.

Dans ce cas :

- le moteur ne doit pas improviser seul,
- il doit savoir deleguer a un outil de famille approprie,
- puis reintegrer le resultat dans la scene.

Probleme actuel :

- cette distinction n'est pas encore posee comme regle centrale,
- donc certaines situations risquent d'etre traitees soit trop librement, soit avec de mauvaises heuristiques, au lieu d'etre orientees vers la bonne couche.

### 2. Les heuristiques de formulation gardent trop de poids

Exemples :

- regex / cues dans `narrationCommitmentPolicy.js`
- cues commerce et selection dans `maybeBuildShopOfferReply(...)`
- cues sociaux dans `buildDirectorNoRuntimeReply(...)`

Probleme :

- ces heuristiques sont utiles comme secours,
- mais elles pilotent encore trop la decision au lieu d'etre seulement des indices.

### 3. Le runtime continue a porter une partie du rendu RP

`buildDirectorNoRuntimeReply(...)` reste encore un gros point de repli narratif.

Probleme :

- tant que cette fonction reste le "grand fallback" a elle seule,
- elle fige une partie du rendu dans des gabarits raisonnables mais encore standardises.

### 4. La reconsolidation ne prepare pas encore explicitement l'extensibilite

Jusqu'ici, la reconsolidation a surtout ete pensee comme :

- nettoyage,
- reduction des rustines,
- simplification des doublons,
- recentrage sur l'intention situee.

C'est juste, mais ce n'est plus suffisant.

Avec le scenario 2 et le cadre des familles d'outils, la reconsolidation doit aussi preparer :

- un noyau capable d'accueillir de nouvelles familles de mecanique,
- sans reintroduire une logique de patch local a chaque ajout,
- et sans transformer chaque nouvelle famille en sous-moteur narratif parallele.

Ce que cela implique :

1. le noyau doit savoir reconnaitre qu'une situation releve d'une famille outillee
2. le noyau doit pouvoir demander une resolution de famille sans melanger cela au rendu RP
3. le noyau doit reintegrer le resultat comme :
   - faits de scene,
   - contraintes,
   - suite logique

Probleme actuel :

- l'existant prepare un peu cela avec le commerce,
- mais ce n'est pas encore une architecture generale,
- donc si on ajoute Voyage, Repos ou Compagnons maintenant sans recadrage, on reproduira le meme empilement specialise.

## Regle de reprise du chantier

La suite ne doit plus ajouter de nouvelles fonctions specialisees sans recadrage.

### Regles obligatoires

1. Toute nouvelle modification doit citer d'abord la section du plan visee.
2. Toute nouvelle heuristique textuelle doit etre marquee comme "secours" et non comme logique principale.
3. Toute nouvelle branche narrative doit preciser :
   - sa responsabilite,
   - ce qu'elle remplace,
   - ce qu'elle laisse volontairement hors de son perimetre.
4. Avant d'ajouter une nouvelle resolution locale, verifier si :
   - `buildDirectorNoRuntimeReply(...)`
   - `maybeBuildShopOfferReply(...)`
   - `maybeBuildAnchoredInterlocutorReply(...)`
   couvrent deja partiellement le cas.
5. Le sanitizer ne doit plus servir a "sauver" une branche structurellement mauvaise.

## Prochaine etape recommandee

Ne pas repartir sur un nouveau patch de wording.

La prochaine etape saine est :

### Etape 1 - Formaliser la couche "acte situe" minimale

Sans encore tout refondre, il faut definir une structure unique intermediaire pour le tour courant.

Objectif :

- unifier la lecture de ce que le joueur tente,
- utiliser les ancres de scene avant les heuristiques textuelles,
- faire passer les heuristiques au rang d'indices secondaires.

### Etape 2 - Rebrancher les branches existantes sur cette couche

Cibles prioritaires :

- orientation locale
- confirmation de proposition active
- selection d'un element deja presente
- question sur un interlocuteur deja etabli

### Etape 2 bis - Ajouter une decision de regime de resolution

Le noyau doit ensuite pouvoir trancher, pour chaque tour :

- resolution locale libre
- ou bascule vers une famille de mecanique outillee

Cette decision ne doit pas etre confondue avec :

- le texte final,
- ni une simple classification d'intention,
- ni une heuristique isolee.

Elle doit devenir un point central de la reprise.

### Etape 3 - Ensuite seulement simplifier

Quand la couche "acte situe" existe, on pourra :

- dedupliquer des blocs de `maybeBuildShopOfferReply(...)`
- alleger `buildDirectorNoRuntimeReply(...)`
- reduire le role du sanitizer comme rustine narrative

## Resume court

Le chantier a produit des gains utiles, mais il est devenu trop hybride.

Le bon cap n'est plus :

- ajouter encore des correctifs locaux.

Le bon cap est :

- figer un centre de gravite unique,
- rebrancher l'existant dessus,
- puis supprimer les couches redondantes.

Le plan de reference reste valide.

Le probleme n'est pas le plan.

Le probleme est que le code actuel le suit seulement par morceaux.
