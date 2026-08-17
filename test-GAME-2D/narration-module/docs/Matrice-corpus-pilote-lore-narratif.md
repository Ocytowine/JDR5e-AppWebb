# Matrice du corpus pilote de lore narratif

Statut : `ACTIF — LORE-NAR-01`

Dernière mise à jour : 2026-07-22

## Objet

Identifier la matière utilisable pour guider une création de scène autour de Lysenthe, sans inventer les informations absentes et sans modifier prématurément `lore-authoring/1`.

Le corpus pilote suit la chaîne :

`Ylsséa → Lysenthe → Quartier des Archives → Archives de Lysenthe → Archivistes de Lysenthe`

La région est incluse parce qu'une scène créée dans la ville doit pouvoir hériter de son climat, de ses traditions et de son esthétique côtière lorsque le niveau local ne précise pas ces dimensions.

## Couverture par source

| Source | Canon structuré | Fragments narratifs classifiés | Apport principal | Limite actuelle |
|---|---|---|---|---|
| `ylssea` | climat, relief, risques, peuples, ressources, activités | identité, paysages, culture, langues, architecture, habits, musique, cuisine, saisons | guide régional visuel et culturel | aucune culture autonome liée |
| `lysenthe` | population, présences, langues, société, environnement, quartiers, factions | identité urbaine, port, halles, ville haute, institutions | distributions urbaines et contraintes canoniques | influences humaine et elfique seulement textuelles |
| `quartier_des_archives` | présences, langues, société | architecture, population, activités, lieux, sécurité, rumeurs | variation locale administrative et religieuse | aucune liste structurée de lieux connectés ni profil d'autorité |
| `archives_de_lysenthe` | fonction, propriétaire, accès, sécurité, présences, rumeurs, connexions | aucun corps nécessaire à ce stade | ancre canonique précise et contraintes d'accès | peu de matière sensorielle propre au bâtiment |
| `archivistes_de_lysenthe` | rôle, langues, grades, fonctionnement, tenue, équipement, idéologie, signes | rôle urbain et présence observable | comportement, apparence et expression des membres | ce profil de faction ne remplace pas une culture ni un PNJ |

## Axes narratifs

| Axe | Région | Ville | Quartier | Bâtiment | Faction | État pour une scène dynamique |
|---|---|---|---|---|---|---|
| climat et météo probable | fort | localisé | hérité | hérité | sans objet | exploitable |
| architecture et matériaux | présent | influence générale | fort | lacunaire | tenue seulement | exploitable avec héritage |
| lumière | absent | absent | absent | absent | absent | libre sous contraintes de scène et d'heure |
| sons | musique et festivals | activité portuaire implicite | activités implicites | travail implicite | voix basse | partiel, ne pas transformer l'implicite en canon |
| odeurs | cuisine et mer implicites | vents marins | absent | absent | cire mentionnée | partiel |
| population et espèces | proportions régionales | pondération urbaine | pondération locale | pondération locale | non prescriptif | exploitable |
| métiers et rôles | activités | rôles communs | rôles administratifs | rôles du lieu | grades | exploitable |
| langues | proportions textuelles | profil structuré | profil structuré | hérité | profil détaillé | exploitable |
| mœurs et coutumes | fêtes, marchés, cuisine, habits | autorité et accueil | formalité et réserve | procédures d'accès | idéologie et méthode | exploitable mais non unifié |
| religion | Douze au niveau global | culte présent | temples voisins | absent | absent | partiel |
| autorité et sécurité | faible précision | forte présence | sécurité locale | accès privé et sécurité forte | chaîne interne | exploitable |
| tensions | risques naturels | corruption et contraste social | accès au savoir | mandats et salles fermées | neutralité affichée | exploitable sans inventer de conflit actif |
| secrets | niveaux disponibles | aucun bloc secret pilote | rumeurs seulement | rumeurs seulement | idéologie spécialisée | aucune révélation autorisée |

## Classement de la matière

### Canon contraignant

- Lysenthe est une cité portuaire fortifiée d'Ylsséa.
- Le Quartier des Archives appartient à Lysenthe.
- Les Archives de Lysenthe appartiennent à ce quartier et sont contrôlées par les Archivistes.
- L'accès aux Archives est privé et leur niveau de sécurité est élevé.
- Les distributions de population, rôles et langues fournissent des probabilités, pas une obligation pour chaque individu.

### Guides créatifs locaux

- pierre monumentale, colonnades civiles, places pavées et parvis religieux ;
- formalité, réserve envers les étrangers et faible visibilité de la violence ;
- archivistes, clercs, gardes, copistes, juristes et libraires ;
- vêtements gris perle, surmanches sombres, cire, sceaux et gestes économes chez les Archivistes ;
- procédures, mandats, classement, précision et rythme méthodique.

### Guides régionaux de complément

- climat océanique, brumes, vents et embruns ;
- pierre, toits de tuiles et esthétique côtière ;
- tissus colorés, marchés artisanaux, musique et cuisine maritime ;
- festivals et rythme saisonnier.

Ces éléments ne doivent être injectés que lorsqu'ils sont pertinents. Un bureau fermé des Archives n'a pas à sentir systématiquement la soupe de poisson sous prétexte que la cuisine régionale en contient.

### Dimensions libres

En l'état du corpus, le générateur peut proposer prudemment :

- la disposition précise d'une rue ou d'une pièce non canonique ;
- la lumière et les détails météorologiques compatibles avec l'heure ;
- des sons et odeurs circonstanciels plausibles ;
- des variantes individuelles de vêtements ou d'attitude ;
- des présences anonymes respectant les distributions locales.

Ces propositions restent des créations de campagne. Elles ne deviennent pas des faits du wiki.

### Dimensions non autorisées sans apport supplémentaire

- attribuer une coutume à tous les humains ou tous les elfes ;
- définir une culture elfique de Lysenthe à partir de la seule mention d'une influence elfique ;
- inventer la doctrine détaillée d'un culte des Douze ;
- transformer une rumeur sur les lignages en vérité ;
- créer un PNJ canonique majeur ou ses secrets ;
- décider que toute présence issue d'un rôle probable appartient aux Archivistes.

## Règles éditoriales retenues pour le pilote

1. Les faits souvent fusionnés ou pondérés restent dans le front matter structuré.
2. La matière descriptive destinée à la recherche utilise des sections `## [NIVEAU] Titre stable`.
3. Une section narrative ne duplique pas inutilement un champ structuré déjà fragmenté.
4. Une rumeur reste explicitement formulée comme rumeur, même avec le niveau `LOCAL`.
5. Les détails sensoriels observables utilisent `COMMUN` ou `LOCAL`; ils ne doivent pas être cachés sous `RESTREINT` uniquement pour contrôler le prompt.
6. Une lacune reste une lacune documentée jusqu'à décision d'auteur ou création de campagne.
7. Une culture décrit un groupe social relié à une zone et ne doit pas être déduite automatiquement d'une espèce.

## Décisions prises pour les premières sources `espece` et `culture`

- Le test du paquet de production relit directement les index de races et langues existants. Une référence absente du catalogue réel fait échouer la compilation.
- `humains` et `elfes` sont les identifiants d'entités lore. `human` et `elf` restent les identifiants du catalogue mécanique. Les pondérations de Lysenthe utilisent désormais les identifiants lore pluriels.
- `culture_cotiere_ylssea` représente des usages régionaux partagés et documentés. Elle est liée aux humains et aux elfes sans prétendre décrire tous les membres de ces espèces.
- Les fiches d'espèce citent les catalogues mécaniques sans recopier leurs traits, vitesses ou capacités.
- `commun` et `elfique` restent pour le moment des références de catalogue. Une future entité de lore ne serait justifiée que par un besoin narratif propre non couvert par le catalogue.

Les données absentes, notamment biologie et apparence générale des espèces, restent vides plutôt que d'être déduites des règles mécaniques. Aucune référence `external:` n'a été utilisée pour contourner l'intégrité du corpus.

## Preuve automatisée

`narration-module/tests/lore/verify-lore-compilation.ts` exige désormais que les quatre sources possédant un corps narratif dans le pilote produisent des fragments `/body/*` classifiés et dotés de sujets stables :

- `ylssea` : au moins 5 ;
- `lysenthe` : au moins 4 ;
- `quartier_des_archives` : au moins 5 ;
- `archivistes_de_lysenthe` : au moins 2.

Cette preuve empêche un retour silencieux à une prose conservée mais introuvable par le sélecteur de lore.

## Étape historique ayant suivi cette preuve

Le contrat minimal de sélection LORE-NAR-02 a ensuite défini sur ce corpus la
chaîne d'héritage, la précédence, les raisons de sélection et le budget. Cette
section ne planifie plus aucun travail ; voir la feuille de route canonique
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).
