# Checkpoint J10-K2 — projection unique de l'interpréteur

Statut : `FERMÉ`

Date : 2026-09-01

## Livré

- manifeste réel `narrative-context-manifest/1` construit et validé pour chaque
  appel V8 disposant d'un contexte incarné ;
- manifeste conservé localement et absent du payload fournisseur ;
- `roleContextPack` réduit à la référence du manifeste et à
  `task.embodiedContext`, sans scène ni acteur ;
- scène, acteurs, interlocuteur, interaction et focus conservés une seule fois
  dans la projection incarnée ;
- catalogue de sélection projeté en lignes tabulaires avec colonnes explicites ;
- transformation réversible conservant exactement 7 sujets, 18 propriétés et
  12 relations dans la fixture des Archives ;
- règle générale demandant à OpenAI de sélectionner l'unique sujet public
  sémantiquement compatible relié à l'ancre de scène ;
- aucune détection locale de mots, synonymes, territoire, ville ou région ;
- gate simulée transportant « le pays » vers
  `lore-entity:astryade` et un `information-need/2` complet ;
- mapping V8, routage propriétaire G5, confidentialité G4 et dette lexicale
  conservés.

## Mesures avant/après

| Section | K0 | K2 | Écart |
|---|---:|---:|---:|
| entrée applicative | 18 050 caractères | 12 553 caractères | -30,5 % |
| `roleContextPack` | 2 904 caractères | 177 caractères | -93,9 % |
| catalogue sémantique | 7 726 caractères | 5 153 caractères | -33,3 % |
| corps fournisseur complet | 33 704 caractères | 28 164 caractères | -16,4 % |

Les instructions passent de 7 384 à 7 987 caractères parce qu'elles expliquent
le transport tabulaire et la résolution sémantique générale. Le gain net reste
de 5 540 caractères sur le corps complet.

## Autorité et limites

La projection compacte ne contient toujours aucune valeur factuelle et
n'accorde aucun commit, temps, succès, connaissance PNJ ou divulgation. Le
catalogue canonique complet reste local et continue seul de valider les
références proposées par OpenAI.

Le corps K2 représente encore environ 7 041 tokens par estimation grossière.
K2 réduit le doublon mais ne prétend donc pas fermer le dépassement du budget
déclaré : la mesure et la politique applicables appartiennent à J10-K4.

La sélection d'Astryade est certifiée avec un fournisseur contractuel simulé.
La qualité réelle du modèle sur le corpus ouvert sera vérifiée en K6 ; aucun
appel OpenAI live n'a été effectué ici.

## Vérification

```powershell
npm run narration-module:test:j10k2-interpreter-projection
```

Cette gate couvre K2, K1, la baseline historique K0, G3, G4, G5, la dette
lexicale et le build TypeScript du module.

Le build global et la route OpenAI serveur sont également verts. La recette
historique générale `narration-module:test:ai-intent-interpretation` conserve
un échec antérieur hors K2 : son assertion attend une notification technique
`SYSTEM_NOTICE`, alors que le code versionné annote actuellement le bloc
`NPC_SPEECH`. K2 ne modifie aucun de ces deux fichiers ; cet écart doit être
tranché selon la règle produit qui interdit d'insérer du diagnostic technique
dans la fiction.

## Reprise

J10-K3 doit appliquer la même discipline aux autres rôles IA : performer PNJ,
writer, creator, critic et création factuelle. Chaque migration doit justifier
ses projections, exclure les données sans rapport et conserver les contrats
d'autorité existants.
