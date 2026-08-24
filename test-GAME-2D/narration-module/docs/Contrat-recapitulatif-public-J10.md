# Contrat du récapitulatif public de campagne J10

Statut : `RETENU — IMPLÉMENTATION J10-E NON DÉMARRÉE`

## Objet

Le récapitulatif aide le joueur à reprendre une campagne sans lui donner une
vue omnisciente. `player-campaign-recap/1` est une projection en lecture seule,
reconstruite à la demande depuis des projecteurs publics typés.

Il n'est pas une autorité, ne committe rien, ne fait pas avancer le temps et ne
devient pas une nouvelle mémoire du MJ.

## Sections autorisées

| Section | Source publique admise | Données interdites |
|---|---|---|
| situation | scène active, horloge et signaux déjà perçus | simulation privée, événement futur |
| personnes | acteurs visibles et dernière position publiquement connue | objectif, pression ou état social privé |
| groupe | projection publique dédiée du registre compagnon | politique d'autonomie et sources privées |
| engagements | projecteur mission/relation dédié | axes numériques, preuves et décisions non exprimées |
| enquête | découvertes et hypothèses exprimées du projecteur intrigue | vérité, causalité, perspectives et fausses pistes cachées |
| inventaire | projection propriétaire du personnage | inventaire externe, prix et ressources non connus |
| chronique | blocs effectivement rendus au joueur | diagnostics et payloads d'opération |

Les faits, témoignages et hypothèses conservent leur statut. Le récapitulatif ne
présente jamais une affirmation entendue ou une hypothèse comme vérité
objective.

## Composition obligatoire

Le compositeur ne lit pas directement `PlotRegistryV1`,
`MissionRelationRegistryV1`, `CompanionPartyRegistryV1` ou un payload privé. Il
consomme des projecteurs propriétaires qui produisent chacun une vue publique
bornée et versionnée.

`PlayerPublicContextV1` reste le socle pour le lieu, les présences et les
connaissances. Il devra être complété, sans élargir son autorité, par :

- `PlayerTravelSummaryProjectionV1` ;
- `PlayerCompanionSummaryProjectionV1` ;
- `PlayerEngagementSummaryProjectionV1` ;
- `PlayerPlotSummaryProjectionV1` ;
- `PlayerInventorySummaryProjectionV1`.

Une reformulation IA éventuelle reçoit uniquement la projection finale déjà
filtrée. La version locale structurée reste canonique pour l'affichage et sert
de fallback.

## Persistance et migrations

Le récapitulatif est reconstruit et n'ajoute aucun store IndexedDB. Un cache de
rendu éventuel peut utiliser la projection narrative existante, mais ne devient
jamais la source du prochain calcul. Aucune migration de campagne n'est requise
en J10-A/J10-E.

Le carnet privé est exclu par type et par dépendance : son repository ne peut
pas être injecté dans le compositeur.

## Refus obligatoires

- section demandant une source privée ou non projetée ;
- source dont la visibilité n'est pas joueur/personnage ;
- score social, vérité cachée, événement futur ou inventaire tiers ;
- absence de statut épistémique pour une affirmation ;
- tentative de transformer le récapitulatif en commande ou en contexte MJ
  durable.

## Preuves attendues

- sentinelles privées absentes de chaque projecteur puis du compositeur ;
- faits `HEARD`, `OBSERVED`, `CONFIRMED` et `REFUTED` conservés sans promotion ;
- intrigue parallèle : seules les intrigues effectivement découvertes sont
  visibles ;
- version locale disponible sans fournisseur IA ;
- reconstruction identique après rechargement, sans nouveau commit.
