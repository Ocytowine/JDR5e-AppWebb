# Checkpoint — divulgation d'information PNJ J10-I5

Statut : `FERMÉ`

Date : 2026-08-28

## Résultat

La vérité résolue, la connaissance de l'acteur et son droit de parler sont
maintenant trois décisions séparées. `npc-information-disclosure/1` produit une
sortie structurée, sans commit et sans autorité de création ou de formulation.

## Gate certifiée

- le garde répond directement avec le fait public du Tharque ;
- une base `ACQUIRED` ne devient pas un faux refus lié au rôle de garde ;
- une rumeur reste une croyance qualifiée ;
- une incertitude conserve sa modalité propre ;
- un secret connu est retenu sans valeur, référence ou preuve privée dans la
  projection ;
- une ignorance réelle est déclarée comme telle ;
- l'archiviste n'est proposé que pour une procédure qu'il couvre réellement,
  avec une référence publique justifiant l'orientation ;
- perspectives, croyances sociales et résolutions objectives restent sous
  leurs autorités existantes.

## Vérifications

- `npm run narration-module:test:j10i5-disclosure`
- `npm run narration-module:build`
- `npm run narration-module:test:knowledge-claims`
- `git diff --check`

Aucun appel OpenAI réel n'a été exécuté. Aucun commit Git n'a été créé par
Codex pour ce jalon.

## Reprise J10-I6

J10-I6 doit construire le paquet performer uniquement depuis
`authorizedFacts`, fournir un fallback local équivalent, enregistrer la parole
comme témoignage attribué sans promouvoir les croyances en vérité et exposer
le diagnostic développeur recherche → connaissance → divulgation.

Première commande :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i5-disclosure
```

