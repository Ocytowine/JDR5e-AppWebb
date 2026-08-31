# Checkpoint J10-J1 — catalogue et graphe sémantiques d'information

Statut : `FERMÉ — CERTIFIÉ LOCALEMENT`

Date : 2026-08-31

## Résultat

Le lookup factuel ne classe plus `subjectMention` ou `requestedDimension` par
mots, racines, synonymes ou score de tokens. Pour `information-need/2`, il
consomme exclusivement :

- des références de sujets publiées ;
- des références de propriétés liées à leur sujet exact ;
- des références d'arêtes reliant une source et une cible exactes ;
- les propriétés de complétude qui permettent de distinguer réponse présente
  et donnée déclarée mais manquante.

Deux textes arbitraires sans vocabulaire commun produisent ainsi strictement le
même résultat lorsqu'ils transportent les mêmes sélecteurs.

## Auteur de lore ouvert

Toutes les entités de lore peuvent désormais déclarer, sans branche liée à leur
type :

- `relations_declarees` : relation, cible, type éventuel et force ;
- `proprietes_factuelles` : identifiant, libellé public, valeur éventuellement
  absente et niveau de connaissance.

Ces déclarations sont validées par le schéma, compilées dans les relations et
fragments ordinaires, puis régénérées par la commande officielle. Astryade
déclare ainsi son siège du pouvoir, son titre public établi et l'identité
personnelle actuellement manquante. Lysenthe déclare explicitement son siège
local. Il ne s'agit pas de règles dans le runtime.

## Frontière avec l'interpréteur

Le contexte public V8 expose un `lore-information-semantic-catalog/1` borné à :

- 7 sujets ;
- 18 propriétés ;
- 12 arêtes ;
- 2 niveaux de parcours depuis l'ancre de scène.

À l'ancre des Archives, le paquet sérialisé mesure environ 6,2 ko. Il ne contient
aucune valeur factuelle : uniquement des références, libellés, types et états
`PRESENT` ou `DECLARED_MISSING`. La vérité reste lue après routage par le
propriétaire factuel.

Les sujets et portées sont validés contre le contexte public. Propriétés et
arêtes sont validées contre le catalogue exact avant G5, puis une seconde fois
au lookup. Une référence inventée ne donne donc accès à rien.

## Compatibilité

`information-need/1` reste lisible sans réinterprétation lexicale : son fallback
parcourt déterministement les faits de l'ancre et de ses voisins. Les recettes
J10-I2, I3, I6 et I7 ont été migrées vers les sélecteurs V2 lorsqu'elles
certifient une résolution précise.

## Preuve ciblée

```powershell
npm run narration-module:test:j10j1-semantic-graph
```

La gate couvre génération du lore, propriété établie, propriété manquante,
parcours d'arête, indépendance totale à la prose, priorité campagne, frontière
temporelle, connaissance PNJ, contexte incarné, absence de nouvelle dette
lexicale et compilation du module.

Résultat : vert, sans appel OpenAI live.

## Suite

J10-J2 doit transmettre simultanément les faits établis et les dimensions
manquantes au performer et au fallback. La réponse doit corriger une prémisse
approximative, donner le titre connu et ne reconnaître comme inconnue que
l'identité personnelle absente.
