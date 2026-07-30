# Matrice de certification — gate 6V « monde vivant »

Date : 2026-07-29
Statut : `CERTIFIEE`
Commande :

```powershell
npm run narration-module:test:living-world-gate
```

## Portée

Cette gate certifie les contrats transverses livrés par 6C et 6D. Elle n'ajoute
ni scénario de démonstration au build principal, ni contenu de campagne, ni
second moteur de simulation.

Les fixtures posent des causes et états initiaux. Les décisions, commits,
classements, filtrages, interruptions et projections sont produits par les
runtimes réels.

## Critères

| # | Comportement certifié | Preuve exécutable |
|---|---|---|
| 1 | Un PNJ peut interpeller le personnage depuis une cause antérieure. | `social-actor-authority` vérifie une préoccupation privée committée, une cible joueur explicite et une projection sans justification privée. |
| 2 | Après une avance diégétique, un acteur peut agir envers un autre acteur. | `rest-ui` avance une heure, ouvre `LOCAL_TIME_BOUNDARY`, puis projette l'avertissement du garde à la serveuse. |
| 3 | Un événement urgent arrête l'activité à son échéance et garde la priorité. | `world-scene-events` vérifie la frontière exacte ; `rest-ui` vérifie interruption, absence de bénéfice et restitution du contrôle. |
| 4 | Une situation ignorée évolue hors écran et ne révèle que ses signes. | `plot-authority` et `plot-evolution-ui`. |
| 5 | Un événement distant reste committé sans être narré. | `plot-authority` et `world-scene-events` excluent les perceptions d'un autre lieu. |
| 6 | Le temps réel ne fait pas avancer le monde. | `time:kernel` fonde toute échéance sur `CampaignClock` ; aucune horloge murale ne propose une avance. |
| 7 | Rejeu et rechargement ne doublent ni initiative, ni temps, ni conséquence. | Tests d'autorité et quatre recettes navigateur de la gate. |
| 8 | Une scène sans cause locale pertinente reste calme. | `social-actor-authority` retourne `CALM` sans commit. |
| 9 | Des initiatives concurrentes sont ordonnées de manière stable. | `social-actor-authority` sélectionne la préoccupation exigible la plus urgente ; `time:kernel` certifie l'ordre causal indépendamment de l'énumération. |
| 10 | Une justification privée de PNJ ou du monde n'atteint jamais le rendu. | `social-actor-authority`, `world-scene-events`, `social-initiative-ui` et `world-event-ui`. |

## Résultat

La commande complète est verte le 2026-07-29 :

- cinq suites déterministes de domaine et de temps ;
- six scénarios navigateur ;
- initiative à l'entrée et après avance diégétique ;
- intrigue et événement monde filtrés ;
- interruption, restauration et absence de duplication.

La gate autorise l'ouverture de 6E. Elle ne prétend pas que chaque campagne
possède déjà du contenu social, des intrigues ou des correspondances monde :
ces données restent fournies par leurs propriétaires.
