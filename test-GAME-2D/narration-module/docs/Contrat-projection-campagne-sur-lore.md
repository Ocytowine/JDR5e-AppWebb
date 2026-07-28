# Contrat de projection de campagne sur le lore

Statut : `ACTIF`  
Contrat : `campaign-lore-projection-registry/1`  
Dernière mise à jour : 2026-07-28

## But

Le catalogue généré au build décrit l'état auteur initial. Il reste immuable
pendant la partie. Lorsqu'un événement validé change cet état, le
`CampaignFactDomain` conserve une projection séparée et la fournit aux lecteurs
narratifs.

```text
catalogue lore immuable ───────────────┐
                                      ├─ fusion déterministe ─► contexte effectif
registre de projections de campagne ──┘
                         priorité la plus haute
```

Exemple : le wiki indique que les Archives accueillent le public. Après un
événement validé de campagne, une projection peut remplacer ce fragment par
« l'accueil public est suspendu ». La scène et le `scene_creator` doivent alors
utiliser la fermeture, tandis que le fichier généré au build reste inchangé.

## Périmètre V1

Une projection cible exactement un couple lore `entityId + fieldPath` déjà
présent dans le paquet d'influences sélectionné.

Elle possède l'une de ces dispositions :

- `REPLACE` : le texte de campagne remplace le texte auteur dans le contexte
  effectif ;
- `WITHHOLD` : le fragment n'entre plus dans le contexte effectif.

La V1 ne peut pas :

- modifier le wiki ou le catalogue généré ;
- créer une connexion, un lieu, un PNJ ou une règle ;
- révéler un fragment absent du paquet ou hors du niveau de connaissance
  autorisé ;
- ajouter arbitrairement un fait sans ancre lore ;
- être écrite par un rôle IA.

Un nouveau fait durable sans cible lore appartient à un autre contrat du
`CampaignFactDomain` ; il n'est pas déguisé en surcharge.

## Autorité et provenance

Chaque projection est enregistrée par un commit atomique du
`CampaignFactDomain`, avec :

- une commande acceptée ;
- une révision de campagne ;
- des références de sources publiques ;
- un événement visible ;
- une écriture du registre propriétaire.

Les références `secret:`, `private:` et `hidden:` sont interdites dans cette
projection destinée au contexte joueur. La frontière de connaissance initiale
reste celle du paquet lore généré.

## Fusion

Pour chaque cible demandée :

1. le lecteur sélectionne la projection dont la révision est la plus récente,
   sans dépasser la révision de campagne demandée ;
2. en l'absence de projection, le texte lore initial reste effectif ;
3. `REPLACE` conserve le texte initial dans la trace mais expose le texte de
   campagne comme texte effectif ;
4. `WITHHOLD` retire l'influence du brief ;
5. les références lore et campagne sont conservées comme provenance ;
6. l'ordre initial et le budget du paquet ne changent pas.

Le rejeu historique est donc possible : une lecture à une ancienne révision ne
voit pas une projection ajoutée plus tard.

## Lecteurs V1

La même projection effective doit alimenter :

- le brief borné du `scene_creator` pour les lieux dynamiques ;
- l'adaptateur d'une scène lore déjà écrite avant son exposition au contrôleur.

La topologie et les commits de création restent dans leurs domaines
propriétaires.

## Preuves

- absence de projection : résultat identique au lore initial ;
- remplacement : campagne prioritaire et double provenance ;
- masquage : fragment absent du contexte effectif ;
- deux versions : lecture historique déterministe ;
- cible étrangère ou source privée : rejet ;
- rejeu identique sans second commit, conflit si la commande change ;
- catalogue généré inchangé ;
- scène lore et création dynamique alimentées par le même lecteur.

Ces oracles sont exécutés par :

```powershell
npm run narration-module:test:campaign-lore-projection
npm run narration-module:test:narrative-lore-build-catalog
npm run narration-module:test:lore-guided-scene
npm run narration-module:test:lore-playable-scene
```
