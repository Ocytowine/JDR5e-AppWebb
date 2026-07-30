# Guide des lieux connus, créés et des déplacements

Statut : `GUIDE_ACTIF`

## Lieu connu et scène active

Le wiki fournit les lieux établis du lore : nom, fonction, connexions et
contraintes. Une scène active est la projection jouable d'un lieu à un instant
de campagne.

Le silence du wiki ne signifie pas qu'un lieu est vide. Une archive centrale
peut contenir des lecteurs, copistes et gardes ambiants compatibles. Ces détails
ordinaires ne deviennent pas automatiquement des PNJ ou faits durables.

## Déplacement

Le joueur peut viser une sortie visible. L'interpréteur propose une
destination, mais la topologie et le domaine monde valident le passage.

```text
intention de déplacement
→ référent visible
→ connexion canonique
→ validation monde et temps
→ commit de position et cycle de scène
→ reconstruction de la destination
→ narration d'arrivée
```

Un nom proche ou une phrase du MJ ne peut pas créer une connexion. Un trajet
long utilise un processus distinct.

## Lieu créé dynamiquement

Lorsqu'un besoin ne correspond à aucun lieu existant, un lieu peut être proposé
depuis le profil local : monde, territoire, région, ville et quartier.

Le générateur peut choisir ambiance, nom et détails compatibles. Il ne peut pas
contredire la géographie, les autorités ou les connexions établies.

Avant le commit, le système vérifie notamment :

- existence d'un lieu réutilisable ;
- parent et ancrage topologique ;
- doublons ;
- fonction et densité locale ;
- mode d'existence ;
- connexions ;
- faits déjà engagés par une intrigue ou une interaction.

Modes d'existence possibles :

- `preexisting_undiscovered` : le lieu existait mais n'avait pas été découvert ;
- `newly_established` : une cause et une durée expliquent sa création ;
- `temporary` : campement, marché ou chantier ;
- `hidden` : lieu préexistant qui n'était pas publiquement connu.

## Ce que connaît le personnage

Connaître l'existence d'un lieu, pouvoir le voir et savoir comment y aller sont
trois informations différentes. Une question de lore ne révèle pas
automatiquement les lieux cachés ou inconnus.

Le rendu utilise les faits publics, les connaissances du personnage et les
paroles attribuées. Une rumeur peut orienter une recherche sans devenir une
vérité de campagne.

## Persistance

Un lieu créé et validé rejoint les registres du monde. Il peut être retrouvé
après rechargement et réutilisé au lieu d'être régénéré. Une correction
ultérieure doit être tracée ; elle ne réécrit pas silencieusement l'historique.

## Tests disponibles

```powershell
npm run narration-module:test:lore-playable-scene
npm run narration-module:test:scene-ephemeral-creation
npm run narration-module:test:lore-guided-scene
npm run narration-module:test:scene-transition
npm run narration-module:test:transition-ui
npm run narration-module:test:npc-return-ui
npm run narration-module:test:indexeddb
```

Selon la version de `package.json`, la création dynamique est aussi couverte par
les tests de transition, de catalogue lore et d'IndexedDB. `npm run build`
regénère le catalogue narratif avant compilation.

En mode local, la création guidée par OpenAI n'est pas disponible. En mode
OpenAI, une proposition distante reste soumise aux mêmes validateurs et ne peut
pas s'afficher avant validation.
