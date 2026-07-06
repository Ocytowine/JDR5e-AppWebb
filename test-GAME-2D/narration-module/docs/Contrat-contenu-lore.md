# Contrat auteur et projection du lore

Statut : `FIGE`

Version du contrat : `lore-authoring/1`

## Objet

Définir comment écrire, valider, relier et fragmenter le lore inclus dans un paquet de contenu `campaign-bootstrap/2`. Ce contrat couvre les entités géographiques existantes et ajoute les espèces, cultures, PNJ canoniques, périodes et événements historiques nécessaires à la sélection contextuelle future.

Il ne définit ni la mémoire d'une campagne, ni les connaissances acquises par le personnage, ni un prompt IA. Le wiki fournit un état initial versionné. Après le bootstrap, les domaines de campagne restent propriétaires des positions, relations, connaissances et autres données mutables.

## Séparation des autorités

| Donnée | Autorité |
|---|---|
| statistiques, traits et capacités d'une espèce jouable | catalogue mécanique épinglé |
| histoire, apparence, répartition et perceptions d'une espèce | entité lore `espece` |
| coutumes et organisation d'un groupe | entité lore `culture` |
| état initial d'un PNJ canonique | entité lore `pnj` |
| état courant du PNJ après création de campagne | `NarrativeActorDomain`, `WorldDomain` et domaines associés |
| fait historique canonique | entité lore historique |
| ce que le PJ ou un PNJ sait de ce fait | `SocialKnowledgeDomain` après initialisation |

Une fiche lore ne recopie pas une formule ou statistique mécanique. Elle référence une entrée de catalogue. Une valeur comme la position actuelle d'un PNJ est nommée `lieu_initial` dans le wiki afin de ne pas concurrencer la campagne.

## Emplacement des sources et templates

- `wiki/lore/` contient uniquement des sources destinées à l'ingestion.
- `wiki/Template/lore-v1/` contient les modèles d'auteur et n'est jamais parcouru par le générateur de paquet.
- tout autre fichier sous `wiki/lore/` doit être validé ou figurer dans une liste d'exclusion versionnée;
- le chemin ne fournit ni l'identité, ni le type, mais reste enregistré dans la provenance.

## Enveloppe commune

Toutes les sources portent les champs suivants :

```yaml
schema_version: 1
type: espece
id: elfes
nom: Elfes
aliases: []
resume: Peuple ancien présent dans plusieurs régions de Dunia.
mots_cles: []
informations: []
```

Contraintes :

- `schema_version` vaut exactement `1`;
- `type` appartient au registre de types de ce contrat;
- `id` respecte `^[a-z][a-z0-9_]{2,127}$` et est unique dans le paquet;
- `nom` et `resume` sont non vides;
- `aliases` et `mots_cles` sont des listes de chaînes non vides, normalisées et sans doublon;
- une clé inconnue provoque `WIKI_UNKNOWN_KEY`;
- le corps Markdown complète la source, sans remplacer les champs requis;
- commentaires et Markdown restent des données inertes.

Le générateur dérive `searchTerms` de `nom`, `aliases`, `mots_cles` et des termes explicitement autorisés par le sous-schéma. Le nom de fichier n'est jamais ajouté comme alias implicite.

## Blocs d'information

Les connaissances susceptibles d'être sélectionnées séparément utilisent :

```ts
interface LoreInformationBlockV1 {
  id: string;
  niveau: "COMMUN" | "LOCAL" | "SPECIALISE" | "RESTREINT" | "MJ_SECRET";
  texte: string;
  sujets: string[];
  entites_liees: string[];
}
```

`id` est unique dans l'entité et respecte le motif des identifiants lore. `texte` est non vide. `sujets` contient des termes de recherche contrôlés. Chaque valeur de `entites_liees` doit résoudre une entité du paquet ou une référence externe explicite.

`catalogEntryId` désigne l'identifiant d'une entrée `GAME_CATALOG_ENTRY` du paquet épinglé. Il ne devient jamais une entité lore implicite.

### Niveaux de connaissance

| Niveau | Sens au bootstrap | Projection future |
|---|---|---|
| `COMMUN` | connaissance générale pouvant initialiser les vues ordinaires | accessible si pertinente et non contredite par la campagne |
| `LOCAL` | connaissance commune à une population ou un lieu lié | nécessite une origine, présence ou acquisition compatible |
| `SPECIALISE` | savoir de métier, d'étude, de religion ou de faction | nécessite capacité, appartenance ou résolution de règle |
| `RESTREINT` | information accessible seulement par une source ou permission explicite | absente tant qu'aucune acquisition n'est committée |
| `MJ_SECRET` | vérité ou préparation privée | uniquement perspectives système privées pertinentes |

Le niveau ne prouve jamais qu'un acteur précis connaît l'information. Il fournit une règle d'initialisation et de découverte. Après le bootstrap, les connaissances et croyances par acteur sont persistées séparément.

## Registre des types

### Types géographiques et organisationnels existants

`royaume`, `territoire`, `region`, `ville`, `quartier`, `batiment`, `faction` et `meta` conservent leurs sous-schémas historiques, désormais validés avec l'enveloppe commune. Leurs références typées sont projetées vers `LoreRelationV1`. Les 25 sources structurées présentes sous `wiki/lore/` constituent le corpus réel de non-régression; tout document restant hors schéma doit apparaître dans `wiki/lore-exclusions.json` avec une raison non vide.

### `espece`

Décrit une espèce jouable ou rencontrable sans dupliquer ses règles :

```text
jouable: boolean
rencontrable: boolean
classification: string
catalogue_mecanique: null | { entry_kind: race | creature, entry_id: string }
apparence_observable: string[]
biologie: { maturite: null | integer, esperance_vie: null | integer, particularites: string[] }
langues: catalogEntryId[]
cultures_associees: entityId[]
regions_presence: { region: entityId, importance: RARE | MINORITAIRE | NOTABLE | MAJEURE }[]
```

`jouable: true` exige une référence de catalogue `race`. `rencontrable: true` n'exige pas de statistique mécanique : une espèce peut exister dans le lore avant la création d'un profil tactique.

### `culture`

Décrit un groupe culturel sans l'assimiler automatiquement à une espèce :

```text
especes_associees: entityId[]
zones_associees: entityId[]
langues: catalogEntryId[]
valeurs: string[]
coutumes: string[]
organisation_sociale: string[]
esthetique: string[]
relations_factions: entityId[]
```

Une espèce peut référencer plusieurs cultures et une culture plusieurs espèces. Une formulation présentant un comportement moral comme biologique doit être signalée pour revue de contenu.

### `pnj`

Décrit un acteur canonique destiné à être matérialisé dans la campagne :

```text
espece: entityId
culture: null | entityId
role_public: string
lieu_initial: entityId
factions: entityId[]
apparence: string[]
expression: { registre: string, rythme: string, habitudes: string[] }
motivations_initiales: string[]
objectifs_initiaux: string[]
relations_initiales: { pnj: entityId, relation: string, details: string }[]
connaissances_initiales: { entity: entityId, information_id: string }[]
croyances_initiales: { sujet: string, texte: string, confiance: integer 0..100 }[]
importance: FIGURANT | SECONDAIRE | MAJEUR
```

`connaissances_initiales` signifie ce que le PNJ sait. Un secret portant sur lui ou sur le monde reste un bloc `informations` avec le niveau adapté. Les deux concepts ne sont jamais fusionnés.

### `periode_historique`

```text
debut: HistoricalDateV1
fin: null | HistoricalDateV1
periode_parente: null | entityId
territoires: entityId[]
cultures: entityId[]
caracteristiques: string[]
evenements_majeurs: entityId[]
```

### `evenement_historique`

```text
periode: null | entityId
date: HistoricalDateV1
lieux: entityId[]
participants: entityId[]
causes: { evenement: entityId, certitude: ETABLIE | CONTESTEE | LEGENDAIRE }[]
consequences: string[]
```

```ts
interface HistoricalDateV1 {
  calendar_id: string;
  annee: number | null;
  mois: number | null;
  jour: number | null;
  precision: "JOUR" | "MOIS" | "ANNEE" | "PERIODE" | "INCONNUE";
}
```

La vérité canonique d'un événement, sa version publique, une hypothèse et une légende utilisent des blocs distincts. Une cause `CONTESTEE` ne devient pas un fait établi dans un contexte joueur.

## Projection normalisée et fragments

Chaque source validée produit un `LoreEntityV1` conforme à `campaign-bootstrap/2`. Les champs de référence produisent des `LoreRelationV1` typées. Les fragments sont créés sur des frontières sémantiques stables :

1. identité et résumé;
2. chaque champ structuré descriptif utile indépendamment;
3. chaque entrée d'une collection lorsque son sens est autonome;
4. chaque `LoreInformationBlockV1` comme fragment distinct;
5. chaque section Markdown classifiée par un titre stable, si elle n'est pas déjà couverte.

Une section Markdown indexable commence par un titre de niveau 2 à 6 portant explicitement son niveau :

```markdown
## [LOCAL] Traditions observées à Lysenthe
```

Les valeurs admises sont celles de `LoreKnowledgeLevelV1`. Un texte ou titre non classifié reste conservé dans `LoreEntityV1.body`, produit `WIKI_BODY_UNCLASSIFIED` et n'entre dans aucun fragment de recherche. Le compilateur ne lui attribue jamais implicitement un niveau public.

Un fragment porte en plus de `LoreFragmentV1` :

```text
knowledgeLevel
relatedEntityIds
topics
```

Son `fragmentId` est dérivé de l'identité d'entité et du `fieldPath`, jamais de sa position arbitraire dans un découpage en tokens. Modifier le texte change l'empreinte, mais une régénération identique conserve les mêmes identifiants et le même ordre.

Les fragments `MJ_SECRET` sont séparés avant indexation destinée aux perspectives joueur. Ils ne sont pas seulement filtrés après une recherche sémantique.

## Déclencheurs de sélection attendus

Le futur pipeline de mémoire peut découvrir les fragments par :

- lieu courant et chaîne géographique;
- acteurs présents ou ciblés;
- espèce, culture, historique et langues du PJ;
- factions, objets, symboles et événements liés;
- noms et alias explicitement mentionnés;
- relation de graphe bornée;
- niveau de connaissance et perspective autorisée.

Le contenu ne décide pas seul de l'inclusion finale. Le `TurnSnapshot`, le rôle, la perspective, les connaissances committées et le budget restent autoritaires.

## Diagnostics supplémentaires

En plus des diagnostics de `campaign-bootstrap/2` :

- `WIKI_TEMPLATE_IN_INGESTION_ROOT`;
- `WIKI_INFORMATION_ID_DUPLICATE`;
- `WIKI_KNOWLEDGE_TARGET_MISSING`;
- `WIKI_MECHANICAL_REFERENCE_MISSING`;
- `WIKI_MUTABLE_FIELD_AMBIGUOUS`;
- `WIKI_SPECIES_CULTURE_CONFLATION`;
- `WIKI_SECRET_INDEX_LEAK`.

## Preuves exigées

- une fixture valide et au moins une fixture invalide pour chaque nouveau type;
- résolution des références vers catalogues et autres entités;
- fragmentation déterministe avec provenance jusqu'au `fieldPath`;
- absence des fragments `MJ_SECRET` dans un index ou paquet joueur;
- initialisation distincte des vérités, connaissances et croyances d'un PNJ;
- recherche d'une espèce par nom, alias, culture et région;
- recherche d'un événement par lieu, participant et conséquence;
- régénération identique du paquet et de tous ses fragments.
- validation des treize templates d'auteur et compilation du corpus réel sans source ignorée implicitement.

## Évolution

Une nouvelle clé, valeur d'énumération ou sémantique de visibilité exige `lore-authoring/2`, une entrée dans le journal des décisions et une migration ou preuve de compatibilité. Un enrichissement du corps Markdown sans changement de structure produit une nouvelle version du paquet de contenu, pas une nouvelle version de schéma.
