# Checkpoint — recherche factuelle ciblée J10-I2

Statut : `FERMÉ`

Date : 2026-08-27

## Résultat

Le catalogue narratif généré expose maintenant dans un index factuel classifié,
distinct des influences descriptives, le type de gouvernance, le siège du
pouvoir et le propriétaire principal. Le
lecteur `targeted-lore-information-lookup/1` reçoit uniquement le besoin V8,
l'ancre de scène et des références structurées.

Depuis `archives_de_lysenthe`, « qui dirige cette ville ? » résout :

- `lysenthe:/type_gouvernance` → `ducat` ;
- `lysenthe:/siege_pouvoir` → `Chateau Tharqual` ;
- `chateau_tharqual:/proprietaire_principal` → `Tharque regent de Lysenthe`.

Cette lecture suit les relations du catalogue complet et ne dépend donc pas de
la position de ces faits dans le paquet descriptif borné de la scène.

## Garanties

- une projection de campagne effective prime sur le texte initial ;
- chaque candidat conserve sa provenance ;
- les `knowledgeRefs` d'une présence visible peuvent alimenter la sélection ;
- le résultat est borné à huit candidats ;
- `COMMUN` et `LOCAL` sont les seuls niveaux admis par ce port ;
- le passé et le futur ne reçoivent pas le titulaire actuel par défaut ;
- `external:non_documente` reste non résolu ;
- aucun commit, aucune création, aucune connaissance d'acteur et aucune
  décision de divulgation ne sont produits.

## Vérifications

- `npm run narration-module:test:j10i2-targeted-lore`
- `npm run narration-module:test:narrative-lore-build-catalog`
- `npm run narration-module:test:campaign-lore-projection`
- `npm run narration-module:test:lore-playable-scene`
- `npm run build`
- `git diff --check`

Aucun appel OpenAI réel n'a été exécuté. Aucun commit Git n'a été créé.

## Reprise J10-I3

J10-I3 doit transformer les candidats factuels en une vue épistémique propre à
l'acteur : `COMMON_WORLD`, `LOCAL_FAMILIARITY`, `ROLE_EXPECTED` ou `ACQUIRED`.
Ce n'est qu'après cette étape puis la politique de divulgation que le performer
pourra recevoir les faits autorisés.

Première commande :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i2-targeted-lore
```
