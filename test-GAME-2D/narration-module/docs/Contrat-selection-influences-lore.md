# Contrat de sélection des influences du lore

Statut : `IMPLEMENTE — SOCLE LORE-NAR-02`

Version : `lore-influence-packet/1`

Dernière mise à jour : 2026-07-22

## Objet

Construire un paquet déterministe et traçable de fragments de lore susceptibles de guider une création de scène, de lieu, de PNJ ou d'événement local.

Le sélecteur ne produit aucune prose, ne crée aucune entité et ne possède aucune autorité de commit. Il prépare une entrée structurée pour les modules créatifs et pour le constructeur de contexte existant.

## Entrées

- type de création demandé ;
- identifiant de l'ancre lore ;
- entités et fragments du paquet de contenu épinglé ;
- niveaux de connaissance autorisés ;
- nombre maximal d'influences.

Le contexte de campagne et les remplacements post-bootstrap ne font pas encore partie de ce socle. Ils devront filtrer ou remplacer les influences avant tout branchement runtime.

## Sortie

`LoreInfluencePacketV1` contient :

- l'ancre demandée ;
- sa chaîne géographique ;
- les entités liées retenues ;
- les fragments avec provenance ;
- leur degré d'influence ;
- leur dimension narrative ;
- la raison de leur sélection ;
- les dimensions non couvertes ;
- les diagnostics de budget ou de relation non résolue.

Chaque influence référence exactement un `LoreFragmentV1` par `lore-fragment:<fragmentId>`. Le texte reste une copie de travail sourcée, jamais une nouvelle autorité.

## Chaîne géographique V1

La remontée utilise les relations compilées :

`batiment → quartier → ville → region → territoire`

Elle s'arrête lorsqu'aucun parent correspondant n'existe, qu'une cible manque ou qu'un cycle est détecté. Le chemin du fichier wiki n'intervient jamais dans cette résolution.

## Relations complémentaires V1

Le sélecteur ajoute :

- factions propriétaires, résidentes, présentes ou actives ;
- espèces des profils de présence et de population de la chaîne ;
- cultures liées à au moins une espèce retenue et à au moins une zone de la chaîne.

Une culture liée seulement à l'espèce, mais absente de la zone, n'est pas automatiquement appliquée. Cette double condition évite de projeter toute culture d'une espèce sur chacun de ses membres.

## Degrés d'influence

| Degré | Attribution V1 | Interprétation |
|---|---|---|
| `STRICT_CANON` | fragments de l'ancre | la proposition ne peut pas les contredire |
| `LOCAL_GUIDANCE` | parents proches, factions et espèces locales | guide prioritaire, modulable par un détail plus précis |
| `REGIONAL_GUIDANCE` | parents éloignés et cultures régionales | complément créatif pour les dimensions laissées libres |

Le degré ne modifie pas la vérité de la source. Tout fragment provient du canon initial ; il indique seulement sa force d'application à la création courante.

## Dimensions V1

- `IDENTITY`
- `DESCRIPTION`
- `ENVIRONMENT`
- `POPULATION`
- `LANGUAGE`
- `CULTURE`
- `SOCIAL`
- `AUTHORITY`

Les champs structurés connus sont classés par leur contrat. Les entités `culture`, `espece` et `faction` fournissent également une dimension par défaut cohérente avec leur type.

Les sections Markdown classifiées de `lore-authoring/1` ne portent pas encore d'axe narratif structuré. Elles restent donc `DESCRIPTION` par défaut, sauf information déductible du type d'entité. Le sélecteur n'analyse pas leurs mots pour deviner artificiellement un axe. Une évolution éventuelle vers `lore-authoring/2` devra ajouter une métadonnée explicite si cette limite devient bloquante.

## Visibilité

Le demandeur fournit explicitement les niveaux autorisés. Le vertical joueur initial utilise uniquement `COMMUN` et `LOCAL`.

Le sélecteur :

- n'ajoute jamais implicitement `RESTREINT` ou `MJ_SECRET` ;
- ne transforme pas un niveau en connaissance acquise par le personnage ;
- ne remplace pas `SocialKnowledgeDomain` ;
- ne livre pas directement son paquet à une perspective joueur sans passage par le constructeur de contexte.

## Budget

`maximumInfluences` est un plafond positif. La sélection est ordonnée par proximité et relation, puis par identifiant et `fieldPath` pour rester déterministe.

Lorsque le plafond est atteint, le paquet porte `influence budget reached`. Ce plafond limite le nombre de fragments ; le budget final en tokens reste sous la responsabilité de `buildRoleContextV1`.

## Déterminisme et diagnostics

À entrées identiques, l'ordre, les raisons, les dimensions et les sources sont identiques. Les diagnostics V1 couvrent :

- ancre absente ;
- paramètres invalides ;
- identifiants d'entité dupliqués ;
- entités liées non résolues ;
- plafond d'influences atteint.

## Limites recensées à la livraison du socle

- les changements de campagne ne remplacent pas encore les valeurs du lore initial ;
- les profils de présence ne sont pas encore des relations compilées strictes vers `espece` ;
- les dimensions Markdown restent générales ;
- la sélection ne répartit pas encore équitablement un petit budget entre les dimensions ;
- les métadonnées globales `meta` ne sont pas encore ajoutées ;
- aucun générateur de scène ou de PNJ ne consomme encore le paquet.

## Preuve

`narration-module:test:lore-influence` vérifie sur les Archives de Lysenthe :

- chaîne Archives → Quartier → Lysenthe → Ylsséa → Astryade ;
- faction des Archivistes ;
- humains et elfes pondérés ;
- usages côtiers multi-espèces ;
- degrés local et régional ;
- exclusion de `MJ_SECRET` ;
- déterminisme ;
- budget borné ;
- rejet d'une ancre absente.

## Évolution envisagée lors de la livraison

À la livraison de ce socle, l'évolution envisagée était un adaptateur explicite entre `LoreInfluencePacketV1` et une proposition de scène dynamique, après superposition des remplacements de campagne et validation de la topologie, de la persistance et des secrets par leurs domaines propriétaires.

Cette section conserve l'intention du contrat, mais ne planifie aucun lot. L'état
et l'ordre de réalisation actuels appartiennent uniquement à
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).

