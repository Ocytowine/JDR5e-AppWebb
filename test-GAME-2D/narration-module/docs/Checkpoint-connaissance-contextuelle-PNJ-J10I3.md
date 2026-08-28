# Checkpoint — connaissance contextuelle PNJ J10-I3

Statut : `FERMÉ`

Date : 2026-08-28

## Résultat

La sortie factuelle J10-I2 est maintenant reliée à une projection de
connaissance par candidat. Dans la scène réelle des Archives :

- le garde local connaît le Tharque régent et le Château Tharqual par
  `LOCAL_FAMILIARITY` et `ROLE_EXPECTED` ;
- le type de gouvernement `ducat` ajoute `COMMON_WORLD` ;
- un voyageur non local peut ignorer le titulaire et le siège ;
- un fait explicitement présent dans le registre social devient `ACQUIRED` ;
- un archiviste local connaît la procédure publique couverte par son métier.

Le reçu `npc-information-resolution/1` porte ces décisions candidat par
candidat. Sa divulgation reste `UNRESOLVED` et le performer ne reçoit encore
aucune autorité de création.

## Garanties

- aucune connaissance du joueur n'entre dans l'entrée du projecteur ;
- la localité est déclarée, jamais déduite de la seule position actuelle ;
- les faits acquis proviennent de `NpcAuthorizedKnowledgeContextV1` ;
- les rôles sont des références structurées issues du rôle public authored ;
- `ROLE_EXPECTED` ne traverse ni `RESTREINT` ni `MJ_SECRET` ;
- projection et composition ne committent rien ;
- connaissance et divulgation restent deux décisions distinctes.

## Vérifications

- `npm run narration-module:test:j10i3-contextual-knowledge`
- `npm run narration-module:test:knowledge-claims`
- `npm run narration-module:test:complete-conversations`
- `npm run build` — 1595 modules transformés
- `git diff --check`

La tentative de commande inexistante
`narration-module:test:npc-knowledge-context` a été remplacée par la gate
existante `narration-module:test:knowledge-claims`, qui exécute bien
`verify-npc-knowledge-context.ts` et passe.

Aucun appel OpenAI réel n'a été exécuté. Aucun commit Git n'a été créé par
Codex pour ce jalon.

## Reprise J10-I4

J10-I4 doit créer et persister une dimension publique stable lorsqu'elle manque,
notamment le nom personnel du Tharque, avec identité légère et fait de mandat
atomiques, idempotents et reconstructibles.

Première commande :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i3-contextual-knowledge
```
