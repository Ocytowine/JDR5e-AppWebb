# Contrat du contexte personnage pour l'interpréteur

Statut : `ACTIF`

## But

`player_intent_interpreter` doit reconnaître une référence appartenant au
personnage sans recevoir sa fiche complète et sans décider si l'action est
possible.

Le chargeur produit désormais `interpreter-character-context/2`; la lecture de
V1 reste compatible. V2 ajoute un profil incarné explicitement public et des
capacités nommables cataloguées. Pour V8, cette projection rejoint
`interpreter-embodied-public-context/1`, jamais une projection mécanique ni une
autorité d'exécution.

## Source et contenu autorisé

Le contexte est reconstruit à chaque tour. Le profil de personnage actif
committé désigne les projections courantes ; le premier événement de bootstrap
reste un repli de compatibilité pour les anciennes campagnes :

- `character.narrative-projection` fournit l'identité, les langues,
  `observable.visibleEquipment`, `observable.physicalDescription` et les seuls
  champs publics nommés `biography`, `personality`, `objectives`, `flaws` ;
- `character.tactical-projection` fournit uniquement les identifiants déclarés
  d'actions et de sorts ;
- `character.state` fournit depuis J3 une projection bornée des exemplaires
  possédés, de leur quantité et de leur état de rangement ou d'équipement ;
- le catalogue installé fournit les libellés et alias publics correspondants ;
- un `featureId` privé n'est projeté que si le catalogue public `features`
  injecté possède une entrée explicite correspondante.

La sortie contient :

- `character.ref` et `character.label` ;
- des références `LANGUAGE`, `ACTION`, `SPELL`, `FEATURE`, `INVENTORY_ITEM` et
  `EQUIPPED_ITEM` ;
- leurs libellés, alias de catalogue et mots significatifs de libellé bornés ;
- les alias ambigus avec la liste de leurs candidats ;
- `embodiedProfile` avec identité, historique, récit personnel et apparence
  auto-déclarés ;
- `authority=INTERPRETATION_ONLY` et
  `ownerValidationRequired=true`.

Toutes les références portent `availability=REFERENCE_ONLY`. Ce terme signifie
seulement « le joueur peut raisonnablement faire allusion à cette référence ».
Il ne signifie ni disponible maintenant, ni utilisable, ni possédé dans un
contenant accessible, ni réussi.

## Données volontairement absentes

Le chargeur relit `character.state`, mais n'en projette que les exemplaires
possédés nécessaires à leur sélection. Il ne transmet pas :

- caractéristiques, modificateurs, PV, CA ou difficultés ;
- quantités de ressources, charges ou délais de récupération ;
- valeurs marchandes, offres, inventaires externes ou contreparties privées ;
- toute clé libre de `knownToPlayer` autre que les quatre clés publiques
  explicitement listées ;
- secrets de campagne ou connaissances privées ;
- décision de réussite, d'échec, de mutation ou de handoff.

Le nom historique `knownToPlayer` ne suffit toujours pas à autoriser une
transmission en bloc. V2 lit uniquement quatre chaînes connues, les normalise et
les borne à 800 caractères. Toute clé supplémentaire reste exclue.

De même, `observable` reste un objet libre. V2 ne lit que
`visibleEquipment` et `physicalDescription`. Une blessure visible ou un état de
forme ne pourra être ajouté qu'après création d'une projection publique typée
et maintenue par son propriétaire.

## Ambiguïté et clarification

Le contexte calcule les alias partagés. Si la saisie emploie un alias ambigu et
qu'aucun libellé ou autre alias ne distingue exactement un candidat :

1. V8 reçoit les alias et leurs candidats dans `referenceAmbiguities` ;
2. OpenAI déclare `NEEDS_CLARIFICATION` si le contexte public ne suffit pas ;
3. le runtime transmet ce statut sans second interpréteur lexical ;
4. le tour reste `noCommit` et `noGameTime`.

Exemple : si deux objets équipés acceptent l'alias « lame », « je prends ma
lame » demande laquelle. « Je prends l'épée de l'aube » peut rester précis.

Les références personnage ne sont pas des référents de scène. Elles ne peuvent
donc pas être copiées dans `targetMention.proposedRef`. L'IA conserve leur sens
dans l'objectif et la suggestion de domaine ; le résolveur propriétaire relit
ensuite l'état réel.

## Empreinte et reprise

Le contexte exact est inclus dans le matériau de `contextFingerprint` de
l'appel `player_intent_interpreter`. Une évolution de la fiche projetée ou du
catalogue produit donc une identité de contexte différente.

Le profil n'est pas mémorisé dans la mémoire sémantique : il est relu depuis les
agrégats courants à chaque nouvelle saisie. Une
reprise après rechargement ne conserve ainsi pas une ancienne disponibilité.

## Vérification

```powershell
npm run narration-module:test:interpreter-character-context
npm run narration-module:test:interpreter-embodied-context-g4
npm run narration-module:test:j10k2-interpreter-projection
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-openai-route
npm run narration-module:build
```

La première vérification prouve :

- la sélection des seuls champs autorisés ;
- la lecture bornée des objets possédés et des champs narratifs publics ;
- l'exclusion des valeurs mécaniques, champs libres et données privées sentinelles ;
- la présence du contexte dans la requête IA et son empreinte ;
- la clarification locale d'un alias ambigu ;
- l'absence de commit et de temps de jeu pendant cette clarification.

## Limites actuelles

- Depuis J10-K2, `roleContextPack` ne transporte plus la scène ni ses acteurs :
  il référence le manifeste local et l'unique
  `interpreter-embodied-public-context/1`. Le catalogue de sélection y utilise
  une projection tabulaire réversible, tandis que le catalogue canonique reste
  local pour valider les références proposées.
- `inputTokenBudget` est actuellement validé comme valeur déclarée mais ne
  borne pas le volume total réellement facturé par le fournisseur. J10-K4 doit
  mesurer instructions, contexte et schéma avant envoi, puis appliquer une
  politique explicite sans troncature silencieuse.
- Les aptitudes `featureIds` restent privées par défaut. Seules celles disposant
  d'une entrée dans le catalogue public `features` deviennent nommables.
- Le contexte public J1 possède désormais son contrat séparé
  `player-public-context/1`. Les blessures visibles et autres nouveaux états du
  personnage restent exclus tant que leur propriétaire ne les projette pas de
  manière structurée.
- Reconnaître une action, un sort ou un objet ne décide pas son exécution : la
  transaction J3 valide les gestes personnels et les échanges externes restent
  fermés sans leurs propriétaires.
