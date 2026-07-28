# Contrat du catalogue lore narratif de build

Statut : actif depuis le 2026-07-28  
Contrat : `narrative-lore-build-catalog/1`

## But

Le navigateur ne compile plus directement `wiki/lore`. Le build transforme le
corpus auteur en un catalogue narratif déterministe, validé et borné. La scène
consomme ce produit ; les rôles IA continuent de recevoir uniquement leur vue
compacte, jamais le catalogue entier.

```text
wiki/lore + catalogues mécaniques
          │
          ▼
compilateur lore autoritaire
          │
          ▼
catalogue généré au build
          │
          ▼
scène locale ──► brief borné du rôle IA
```

Le fichier
`src/narration-ui/generated/narrativeLoreCatalog.generated.json` est un produit
du script `npm run gen:narrative-lore-catalog`. Il ne doit pas être modifié à la
main.

## Contenu

Le catalogue conserve :

- l'empreinte racine du corpus et la provenance des entités/fragments retenus ;
- les lieux jouables de type bâtiment, quartier et ville ;
- la fermeture géographique et culturelle utile à leurs influences ;
- un paquet `lore-influence-packet/1` par lieu ;
- un budget maximal de 16 influences par paquet ;
- les niveaux joueur `COMMUN` et `LOCAL` comme frontière explicite ;
- les dimensions non renseignées dans `unresolvedDimensions`.

Il ne conserve ni texte source brut, ni proposition de connexion, ni topologie,
ni commande de commit.

## Interprétation de l'absence

Une dimension dans `unresolvedDimensions` est ouverte, pas interdite. Par
exemple, si le wiki ne décrit pas le bruit exact d'une salle, une prose
compatible peut évoquer le froissement du papier. Elle ne peut pas transformer
ce détail en fait durable, en passage secret, en objet utile ou en causalité.

Les influences ont trois degrés :

- `STRICT_CANON` : fait propre au lieu, à respecter ;
- `LOCAL_GUIDANCE` : cohérence de proximité ;
- `REGIONAL_GUIDANCE` : inspiration de fond.

L'absence volontaire de degré `OPEN_CREATION` dans une influence évite de
fabriquer une fausse source. L'ouverture est représentée par les dimensions non
résolues et reste bornée par la politique du rôle.

## Autorités

- Le compilateur lore possède la validation des sources et de leurs références.
- Le catalogue possède la sélection déterministe et la provenance du contexte.
- L'adaptateur de scène possède la frontière visible/masquée.
- `scene_creator` propose uniquement de la matière créative.
- `WorldDomain`, `SceneDomain` et, selon la profondeur, `CampaignFactDomain`
  gardent la topologie, la validation et le commit.

Le wiki guide la création ; il ne devient ni un inventaire exhaustif du monde,
ni une autorité d'exécution.

Les changements validés en cours de partie ne réécrivent jamais ce catalogue.
Le `CampaignFactDomain` les conserve dans
[`Contrat-projection-campagne-sur-lore.md`](Contrat-projection-campagne-sur-lore.md),
puis les lecteurs construisent une vue effective où la campagne prime avec sa
propre provenance.

## Configuration IA certifiée

Le serveur utilise par défaut `gpt-5.6-luna` avec
`reasoning=none` pour le seul rôle `scene_creator`, conformément au benchmark
V2. Les variables `NARRATION_OPENAI_SCENE_CREATOR_MODEL` et
`NARRATION_OPENAI_SCENE_CREATOR_REASONING_EFFORT` restent des surcharges
explicites. `NARRATION_OPENAI_MODEL` reste le repli global volontaire.

## Preuves

`npm run narration-module:test:narrative-lore-build-catalog` vérifie :

- la reproductibilité malgré l'ordre des sources compilées ;
- l'égalité entre le wiki courant et le fichier généré ;
- provenance, niveaux de connaissance et budget ;
- la présence de dimensions ouvertes ;
- l'absence de texte source brut et d'autorité topologique.

`npm run narration-module:test:narrative-openai-route` vérifie la configuration
par défaut et les surcharges du `scene_creator`.
