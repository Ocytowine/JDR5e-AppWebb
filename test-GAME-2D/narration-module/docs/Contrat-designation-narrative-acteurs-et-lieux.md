# Contrat de désignation narrative des acteurs et des lieux

Statut : contrat V1 implémenté le 2026-07-27.

## Problème traité

`displayName` ne doit plus décider à lui seul si le personnage connaît un nom propre. Une même chaîne servait auparavant d'identité interne, d'alias de ciblage, de titre UI et de formulation narrative. Cela produisait des sorties comme `Archiviste est visible ici` et risquait de révéler un nom canonique encore inconnu.

Le contrat `narrative-designation/1` est une projection strictement accessible au personnage. L'identité canonique non révélée reste hors de cette projection, donc hors du contexte du `scene_writer`, du registre public de référents et de l'UI.

## États

| État | Exemple de première mention | Exemple de reprise |
|---|---|---|
| `UNKNOWN` | `une silhouette encapuchonnée` | `la silhouette encapuchonnée` |
| `DESIGNATION` | `une silhouette d'archiviste aux gestes soigneux` | `l'archiviste aux gestes soigneux` |
| `KNOWN` | `Ilyne Varec` | `Ilyne Varec` |

`DESIGNATION` signifie qu'une personne ou un lieu est stable et reconnaissable par ses signes publics, sans que son nom propre soit connu. Un métier n'est donc ni un nom propre, ni un recensement exhaustif du lieu.

## Règles d'autorité

- une observation peut produire ou réutiliser une désignation visible ;
- la promotion `ambientPopulation` vers `SCENE_ACTOR`, puis vers un PNJ de campagne, conserve la désignation courante ;
- aucune promotion technique ne transforme `DESIGNATION` en `KNOWN` ;
- seul un fait de révélation sourcé peut appeler la transition pure `revealNarrativeNameV1` ;
- le futur domaine social propriétaire devra persister cette révélation ; le `scene_writer` ne possède pas cette autorité ;
- un lieu wiki explicitement identifiable peut être `KNOWN` depuis sa source lore ;
- un lieu dynamique reçoit d'abord une désignation publique stable, sans nom canonique secret injecté dans le contexte narratif.

## Consommateurs

La même projection alimente :

- l'ouverture et le retour de scène ;
- les résultats de perception ;
- le registre public de référents et ses alias ;
- le nom de locuteur dans les bulles PNJ ;
- le contexte borné du `scene_writer` ;
- les promotions locale et campagne.

Les anciennes fixtures sans désignation restent compatibles. Les nouveaux producteurs wiki et dynamiques doivent fournir le contrat et sont couverts par `npm run narration-module:test:narrative-designation`.
