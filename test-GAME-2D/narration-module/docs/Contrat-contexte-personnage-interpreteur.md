# Contrat du contexte personnage pour l'interpréteur

Statut : `ACTIF`

## But

`player_intent_interpreter` doit reconnaître une référence appartenant au
personnage sans recevoir sa fiche complète et sans décider si l'action est
possible.

Le contrat actif est `interpreter-character-context/1`. Il s'agit d'une
projection minimale de compréhension, jamais d'une projection mécanique ni
d'une autorité d'exécution.

## Source et contenu autorisé

Le contexte est reconstruit à chaque tour. Le profil de personnage actif
committé désigne les projections courantes ; le premier événement de bootstrap
reste un repli de compatibilité pour les anciennes campagnes :

- `character.narrative-projection` fournit l'identité, les langues et
  `observable.visibleEquipment` ;
- `character.tactical-projection` fournit uniquement les identifiants déclarés
  d'actions et de sorts ;
- le catalogue installé fournit les libellés et alias publics correspondants.

La sortie contient :

- `character.ref` et `character.label` ;
- des références `LANGUAGE`, `ACTION`, `SPELL` et `EQUIPPED_ITEM` ;
- leurs libellés, alias de catalogue et mots significatifs de libellé bornés ;
- les alias ambigus avec la liste de leurs candidats ;
- `authority=INTERPRETATION_ONLY` et
  `ownerValidationRequired=true`.

Toutes les références portent `availability=REFERENCE_ONLY`. Ce terme signifie
seulement « le joueur peut raisonnablement faire allusion à cette référence ».
Il ne signifie ni disponible maintenant, ni utilisable, ni possédé dans un
contenant accessible, ni réussi.

## Données volontairement absentes

Le chargeur ne lit jamais l'agrégat privé `character.state`. Il ne transmet
pas :

- caractéristiques, modificateurs, PV, CA ou difficultés ;
- quantités de ressources, charges ou délais de récupération ;
- inventaire non visible, monnaie, quantités ou valeurs ;
- biographie, personnalité, objectifs ou défauts ;
- secrets de campagne ou connaissances privées ;
- décision de réussite, d'échec, de mutation ou de handoff.

Le nom historique `knownToPlayer` ne suffit pas à autoriser une transmission à
l'IA : ce bloc est libre, potentiellement long et mêle actuellement biographie,
objectifs et autres données sans classification de confidentialité. Il est donc
entièrement exclu de V1.

De même, `observable` reste un objet libre. V1 ne lit que son champ structuré
`visibleEquipment`. Une blessure visible, un état de forme ou une connaissance
personnelle ne pourront être ajoutés qu'après création d'une projection
publique typée et maintenue par leur propriétaire.

## Ambiguïté et clarification

Le contexte calcule les alias partagés. Si la saisie emploie un alias ambigu et
qu'aucun libellé ou autre alias ne distingue exactement un candidat :

1. l'interpréteur reçoit l'instruction de produire `unclear_intent` ;
2. une garde locale vérifie encore le résultat accepté ;
3. cette garde remplace toute interprétation trop affirmative par une
   clarification ;
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

Le contexte n'est pas mémorisé dans la mémoire sémantique des cinq derniers
tours : il est relu depuis les agrégats courants à chaque nouvelle saisie. Une
reprise après rechargement ne conserve ainsi pas une ancienne disponibilité.

## Vérification

```powershell
npm run narration-module:test:interpreter-character-context
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-openai-route
npm run narration-module:build
```

La première vérification prouve :

- la sélection des seuls champs autorisés ;
- l'absence de lecture de `character.state` ;
- l'exclusion d'un objet non équipé et de données privées sentinelles ;
- la présence du contexte dans la requête IA et son empreinte ;
- la clarification locale d'un alias ambigu ;
- l'absence de commit et de temps de jeu pendant cette clarification.

## Limites actuelles

- Les aptitudes `featureIds` sont encore rangées dans
  `privateMechanical` : elles restent exclues tant qu'une projection publique
  dédiée ne les classe pas comme références interprétables.
- Les connaissances du personnage et ses états observables ne disposent pas
  encore d'un contrat public typé.
- Reconnaître une action, un sort ou un objet ne raccorde pas son exécution :
  les commandes inventaire et tactique générique restent à définir avec leurs
  propriétaires.
