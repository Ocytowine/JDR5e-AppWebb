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

Lorsqu'un besoin ne correspond à aucun lieu existant, il passe d'abord par une
décision de destination. Une sortie déjà déclarée peut être matérialisée
directement. Un lieu librement proposé est classé comme création locale,
clarification, voyage, contradiction sourcée ou possibilité sous condition.

Le générateur n'est appelé qu'après une autorisation `CREATE_LOCAL`. Il peut
choisir ambiance, nom et détails compatibles, mais ne décide ni de la distance,
ni du parent, ni du droit de créer. Un nom propre demandé est conservé ; une
description libre peut recevoir un nom naturel différent.

Avant le commit, le système vérifie notamment :

- existence d'un lieu réutilisable ;
- parent et ancrage topologique ;
- doublons ;
- similarité lexicale avec un lieu connu ;
- décision sémantique bornée par le lore lorsque les règles locales ne
  suffisent pas ;
- connexions ;
- faits déjà engagés par une intrigue ou une interaction.

Le runtime actif matérialise un lieu local persistant et revisitable. Il ne
prétend pas encore gérer des modes d'existence distincts comme un marché
temporaire ou un bâtiment nouvellement construit : ces cas exigent leur cause
et leur processus temporel propriétaires.

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
OpenAI, une proposition distante produit un handoff de voyage sans création
locale. Un refus ou une condition ne consomme aucun temps de jeu. Après commit,
le contexte géographique est conservé pour pouvoir repartir d'une scène
dynamique ; un échec de présentation peut être restauré sans rejouer le commit.
