# Cadrage du lore narratif et des créations dynamiques

Statut : `CADRAGE DE RÉFÉRENCE — LOT INITIAL LIVRÉ`

Dernière mise à jour : 2026-07-22

## Objet

Préparer l'évolution de `wiki/lore/` pour qu'il guide en priorité la narration et les créations dynamiques sans devenir un catalogue exhaustif de toutes les scènes possibles.

Ce document ne modifie pas encore le contrat figé `lore-authoring/1`. Il établit les écarts observés, les responsabilités attendues et l'ordre de travail avant de décider si `lore-authoring/2` est nécessaire.

## Position produit

Le lore fournit l'état initial canonique et les influences créatives du monde. Il ne remplace pas l'état courant de campagne et n'a pas à préfabriquer chaque rue, intérieur, figurant ou événement local.

Une création narrative doit pouvoir combiner quatre degrés d'influence :

| Degré | Usage | Effet attendu |
|---|---|---|
| `STRICT_CANON` | fait ou entité explicitement établi | aucune contradiction ni substitution silencieuse |
| `LOCAL_GUIDANCE` | lieu, culture, faction ou population directement liée | forte influence sur les choix visuels et sociaux |
| `REGIONAL_GUIDANCE` | parent géographique ou culturel plus distant | cohérence générale sans recopier un lieu existant |
| `OPEN_CREATION` | absence de source plus précise | invention autorisée sous les contraintes globales et l'état de campagne |

Ces degrés décrivent une politique de sélection future. Ils ne constituent pas encore une nouvelle énumération persistée.

## Audit du socle existant

### Forces disponibles

- `lore-authoring/1` valide treize types : géographie, factions, métadonnées, espèces, cultures, PNJ et histoire.
- Les sources produisent des entités, relations et fragments déterministes avec provenance jusqu'au champ source.
- Les niveaux `COMMUN`, `LOCAL`, `SPECIALISE`, `RESTREINT` et `MJ_SECRET` séparent déjà visibilité, savoir et secret.
- Les profils de présence pondèrent rôles et espèces aux niveaux ville, quartier et bâtiment.
- Les profils de langues, population, société et autorité existent déjà sur plusieurs types géographiques.
- Les cultures disposent de valeurs, coutumes, organisation sociale et esthétique.
- Les factions disposent d'une idéologie, de traits identifiants, d'une tenue, d'un fonctionnement et de langues.
- Les PNJ canoniques disposent d'une apparence, d'une expression, de motivations, d'objectifs, de relations, de connaissances et de croyances initiales.
- L'adaptateur `lore-playable-scene-adapter/1` sait produire une scène minimale depuis un bâtiment, un quartier ou une ville et exclure les fragments secrets.

Les preuves du 2026-07-22 passent sur 28 sources réelles, une exclusion explicite et les treize templates d'auteur. La compilation du corpus relit les index réels des races et langues au lieu d'accepter une liste de références écrite dans le test.

### Limites du corpus réel

Le corpus actuellement ingéré contient :

- 1 royaume ;
- 3 régions ;
- 1 ville ;
- 7 quartiers ;
- 7 bâtiments ;
- 3 factions ;
- 3 entités `meta` ;
- 2 espèces ;
- 1 culture régionale multi-espèces.

Il ne contient encore aucune source réelle de type `pnj`, `periode_historique` ou `evenement_historique`, même si leurs templates, schémas et fixtures existent. L'absence de PNJ canonique dans le pilote est volontaire : aucun acteur nommé suffisamment établi n'a été trouvé dans les sources analysées.

La matière existante suffit pour une première expérimentation centrée sur Lysenthe : elle décrit déjà populations, rôles probables, langues, climat, autorité, factions, fonctions urbaines et plusieurs éléments esthétiques. Elle ne suffit pas encore à valider toute la chaîne culturelle et la création durable d'un PNJ.

### Écarts techniques et éditoriaux

1. L'adaptateur de scène consomme principalement l'entité du lieu demandé. Il ne construit pas un héritage borné bâtiment → quartier → ville → région → monde, puis cultures et factions liées.
2. Les fiches réelles utilisent largement le corps Markdown non classifié. Ce texte est conservé, mais `lore-authoring/1` précise qu'il n'entre dans aucun fragment de recherche.
3. Les templates `quartier` et `batiment` invitent à décrire une ambiance ou un aspect observable, mais ne structurent pas encore les axes narratifs récurrents comme sons, odeurs, matériaux, lumière, rythme, usages et contrastes.
4. Les profils décrivent ce qui est probable, mais aucune politique commune ne précise encore comment fusionner, pondérer et expliquer les influences de plusieurs niveaux géographiques.
5. La création éphémère de scène et la création dynamique durable existent comme contrats séparés, mais le paquet de lore qui doit guider leur proposition n'est pas encore défini.
6. Le PNJ générique autrefois dérivé par l'adaptateur était une projection de démonstration. Depuis la reprise du 2026-07-27, les rôles probables alimentent `ambientPopulation` sans créer de figure individualisée dans `presentNpc`; ils restent des présences représentatives et non un recensement exhaustif.
7. Le diagnostic visible ne montre pas encore quelles sources ont contraint ou inspiré une création.

## Frontières d'autorité à conserver

- Le wiki établit le canon initial, les styles, distributions, coutumes et possibilités locales.
- L'état de campagne remplace toute valeur mutable après le bootstrap : position, relation, objectif courant, connaissance acquise, dommage ou état d'un lieu.
- L'IA sélectionne et combine des influences, puis propose une création. Elle ne crée pas seule une route, un lieu durable, un PNJ persistant ou un fait de campagne.
- Le domaine propriétaire valide la création et sa profondeur de persistance.
- Une absence de détail dans le wiki autorise une invention contrôlée ; elle ne constitue pas une interdiction de créer.
- Un élément inventé ne devient pas rétroactivement du lore source. Il garde une provenance de campagne.

## Contrat conceptuel à instruire

Le module de sélection doit produire un paquet commun, indépendant du consommateur :

```ts
interface LoreInfluencePacketV1 {
  subject: {
    creationType: "SCENE" | "NPC" | "PLACE" | "LOCAL_EVENT";
    anchorEntityIds: string[];
  };
  canonicalAnchors: LoreInfluenceRefV1[];
  prohibitions: LoreInfluenceRefV1[];
  visualInfluences: LoreInfluenceRefV1[];
  populationInfluences: LoreInfluenceRefV1[];
  culturalInfluences: LoreInfluenceRefV1[];
  socialInfluences: LoreInfluenceRefV1[];
  environmentalInfluences: LoreInfluenceRefV1[];
  unresolvedDimensions: string[];
  sourceRefs: string[];
}
```

Le nom et la forme définitive restent à valider. Le contrat devra au minimum porter pour chaque influence sa source, son degré, sa portée, sa visibilité et la raison de sa sélection.

Le paquet ne doit contenir ni prose de scène finale, ni décision de commit, ni profil de PNJ déjà matérialisé. Les générateurs de scène et de PNJ seront des consommateurs distincts du même paquet.

## Stratégie de sélection envisagée

Pour une scène demandée, la recherche progresse du précis vers le général :

1. sous-emplacement ou lieu actif ;
2. bâtiment ou lieu parent ;
3. quartier ;
4. ville ;
5. région et territoire ;
6. factions réellement présentes ou propriétaires ;
7. cultures et espèces liées aux populations retenues ;
8. règles narratives globales `meta`.

La proximité ne suffit pas : chaque information est ensuite filtrée par perspective, niveau de connaissance, état courant de campagne, pertinence pour le type de création et budget de contexte.

Les champs précis doivent primer sur leurs parents. Les parents complètent les dimensions absentes sans écraser les variations locales. Une contradiction réelle doit être diagnostiquée ; elle ne doit pas être résolue silencieusement par la dernière source lue.

## Premier vertical d'acceptation

Scénario cible : le personnage quitte une auberge de Lysenthe et entre dans une rue qui n'existe pas comme entité préfabriquée.

Le vertical est accepté lorsque le runtime peut :

1. identifier l'ancre de campagne et sa chaîne géographique ;
2. sélectionner des influences publiques pertinentes et sourcées ;
3. distinguer contraintes canoniques, guides locaux et dimensions libres ;
4. proposer une rue cohérente avec Lysenthe sans recopier un quartier existant ;
5. faire valider son rattachement et sa profondeur de persistance ;
6. construire une `PlayableSceneStateV1` utilisable ;
7. conserver une identité stable si la rue est promue ;
8. reconstruire la même scène après sortie et retour ;
9. exposer dans la notification système les sources, degrés d'influence, créations et promotions ;
10. ne révéler aucun fragment `RESTREINT` ou `MJ_SECRET` à la perspective joueur.

La première version n'a pas besoin de créer un PNJ durable. Elle peut générer des présences anonymes et éphémères conformes aux profils de population. La promotion d'un de ces figurants constituera le vertical suivant.

## Objectifs à court terme

### LORE-NAR-01 — Cartographie éditoriale

- inventorier les champs réellement utiles à la narration par type de fiche ;
- classer la matière actuelle entre canon, influence créative, information découvrable et prose non indexée ;
- choisir un petit corpus Lysenthe représentatif pour la migration expérimentale ;
- produire au moins une vraie culture, une vraie espèce et, seulement lorsque leurs références existent, un PNJ canonique minimal.

Gate : le corpus pilote couvre visuel, environnement, population, langue, usages sociaux, culture et faction sans secret exposé.

Avancement au 2026-07-22 : la matière existante d'Ylsséa, Lysenthe, du Quartier des Archives et des Archivistes est classifiée et couverte par une preuve de compilation. Les espèces `humains` et `elfes` référencent les races `human` et `elf` des catalogues réels ; leurs langues référencent également les index réels. `culture_cotiere_ylssea` formalise les seuls usages régionaux déjà documentés, comme culture multi-espèces non obligatoire. La matrice détaillée est dans [`Matrice-corpus-pilote-lore-narratif.md`](Matrice-corpus-pilote-lore-narratif.md).

### LORE-NAR-02 — Héritage et sélection

- définir le contrat du paquet d'influences ;
- définir la résolution de la chaîne géographique et des relations culturelles ;
- définir précédence, fusion, budgets et diagnostics de contradiction ;
- prouver une sélection déterministe sur un bâtiment, un quartier et une création sans lieu exact.

Gate : chaque influence sélectionnée possède une provenance et une justification testable.

Avancement au 2026-07-22 : socle livré par `lore-influence-packet/1`. Le sélecteur résout la chaîne géographique, les factions, espèces et cultures pertinentes, filtre les niveaux de connaissance et respecte un plafond déterministe. Voir [`Contrat-selection-influences-lore.md`](Contrat-selection-influences-lore.md). Le raccord aux remplacements de campagne et au générateur de scène appartient au lot suivant.

### LORE-NAR-03 — Décision de schéma

- déterminer quels besoins peuvent être satisfaits par des sections Markdown classifiées ;
- réserver les nouveaux champs aux données qui doivent être fusionnées, pondérées ou validées ;
- décider explicitement entre une évolution compatible de contenu et `lore-authoring/2` ;
- préparer migration, templates et tests avant toute modification du corpus complet.

Gate : aucune clé ad hoc n'est ajoutée à une fiche réelle et aucun parseur parallèle du wiki n'est créé.

## Objectifs à moyen terme

### LORE-NAR-04 — Création de scène guidée

Brancher le paquet d'influences sur une proposition de scène dynamique, sa validation, sa persistance graduée et sa projection jouable. Certifier le vertical de la rue non préparée.

Avancement au 2026-07-22 : l'adaptateur lit les projections attribuées à `CampaignFactDomain` et produit une proposition `PLACE`. La gate contrôle topologie, identité, doublons et profondeur. `place-creation-command/1` prépare ensuite un commit atomique des registres lieu/topologie/faits, et la scène jouable n'est reconstruite qu'après confirmation des trois agrégats. L'exécution repository et le branchement au contrôleur restent à livrer. Voir [`Contrat-creation-scene-guidee-lore.md`](Contrat-creation-scene-guidee-lore.md).

### LORE-NAR-05 — Création et promotion de PNJ

Réutiliser le même paquet pour créer une présence éphémère cohérente avec population, culture, faction et lieu, puis la promouvoir vers `LIGHT_REFERENCE` ou `FULL_ENTITY` dans le `NarrativeActorDomain`.

### LORE-NAR-06 — Continuité et retour tardif

Vérifier qu'un lieu ou PNJ créé conserve son identité et son historique de campagne, tout en relisant les sources de lore épinglées sans écraser les changements survenus en jeu.

### LORE-NAR-07 — Outils d'auteur et observabilité

Fournir validation, diagnostics de couverture et aperçu des influences sélectionnables. La surface joueur conserve une seule zone `Système — Notification système` pour les traces de lore, mémoire, création et temps.

## Hors périmètre immédiat

- migration narrative complète de toutes les sources historiques ;
- génération de tous les types de créations dynamiques ;
- éditeur graphique du wiki ;
- recherche vectorielle ou dépendance à un fournisseur IA pour sélectionner le canon ;
- création durable automatique sans validation de domaine ;
- duplication du lore dans IndexedDB comme état courant mutable.

## Étape historique ayant suivi ce cadrage

Le contrat minimal LORE-NAR-02 de sélection et d'héritage sur le corpus pilote
a ensuite été produit. Cette mention retrace l'enchaînement livré ; elle ne
constitue plus une prochaine étape. La planification courante appartient à
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).

## Références

- [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md)
- [`Contrat-pipeline-ia-creations.md`](Contrat-pipeline-ia-creations.md)
- [`Creations-dynamiques.md`](Creations-dynamiques.md)
- [`Dossier-de-conception.md`](Dossier-de-conception.md)
- [`Integration-domaines.md`](Integration-domaines.md)
- [`Contrat-transition-locale-scene.md`](Contrat-transition-locale-scene.md)
- [`Matrice-corpus-pilote-lore-narratif.md`](Matrice-corpus-pilote-lore-narratif.md)
- [`Contrat-selection-influences-lore.md`](Contrat-selection-influences-lore.md)
- [`Contrat-creation-scene-guidee-lore.md`](Contrat-creation-scene-guidee-lore.md)
- `wiki/Template/lore-v1/README.md`
