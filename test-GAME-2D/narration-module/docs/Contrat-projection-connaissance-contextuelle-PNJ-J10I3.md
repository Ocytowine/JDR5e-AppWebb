# Contrat de projection de connaissance contextuelle PNJ J10-I3

Statut : `ACTIF`

Contrat : `npc-contextual-knowledge-projection/1`

## But

La projection répond à une seule question : parmi les candidats factuels déjà
résolus, lesquels cet acteur est-il raisonnablement censé connaître ? Elle ne
décide ni vérité, ni création, ni droit de révélation, ni formulation.

```text
candidats I2 + acteur structuré
              │
       ┌──────┼────────┬────────────┐
       ▼      ▼        ▼            ▼
    commun   local   métier       acquis
       └──────┴────────┴────────────┘
                    │
                    ▼
       KNOWN ou UNKNOWN_TO_ACTOR
         pour chaque candidat
```

## Contexte acteur

Le contexte contient uniquement :

- une référence d'acteur ;
- des références de rôle structurées ;
- des localités de familiarité explicites ;
- les faits acquis fournis par `NpcAuthorizedKnowledgeContextV1` ;
- les `knowledgeRefs` visibles déjà attachées à l'acteur.

La présence actuelle dans un lieu ne donne pas automatiquement la familiarité
locale. Un voyageur aux Archives reste voyageur tant qu'une localité ou une
acquisition autoritaire ne dit pas le contraire.

L'adaptateur de rôle lit seulement le `publicRole` authored du PNJ. Il ne lit
jamais la saisie joueur et ne constitue donc pas un second interpréteur de
l'intention.

## Bases

- `COMMON_WORLD` : candidat classé `COMMUN` ;
- `LOCAL_FAMILIARITY` : candidat `LOCAL` dont la portée croise une localité de
  l'acteur ;
- `ROLE_EXPECTED` : propriété publique ou locale couverte par une politique de
  métier structurée, avec localité lorsque la règle l'exige ;
- `ACQUIRED` : identifiant ou source factuelle présent dans le registre acquis
  ou les références explicites de l'acteur.

Une base de rôle ne peut jamais ouvrir seule un candidat `RESTREINT` ou
`MJ_SECRET`. Les croyances et incertitudes restent dans l'autorité épistémique
existante et ne sont pas promues en faits objectifs par ce contrat.

## Composition I2-I3

`composeNpcInformationResolutionV1` réunit la recherche et la connaissance dans
`npc-information-resolution/1`. Le reçu conserve les décisions candidat par
candidat et laisse obligatoirement :

- `disclosure.decision = UNRESOLVED` ;
- `performerMayCreateFacts = false` ;
- `noCommit = true` dans la projection de connaissance.

Un fait connu ne devient donc jamais automatiquement une parole prononcée.

## Gate

`npm run narration-module:test:j10i3-contextual-knowledge` prouve :

- le garde local connaît le Tharque et son siège par localité et métier ;
- le voyageur connaît le ducat commun mais peut ignorer titulaire et siège ;
- une acquisition explicite ouvre uniquement le fait acquis ;
- l'archiviste local connaît la procédure publique liée à son rôle ;
- un archiviste non local n'hérite pas automatiquement de la procédure locale ;
- le rôle ne traverse pas la frontière restreinte ;
- le reçu composé reste sans divulgation, création ou commit.
