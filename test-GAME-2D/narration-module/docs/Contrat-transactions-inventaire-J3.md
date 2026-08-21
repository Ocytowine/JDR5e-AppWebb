# Contrat des transactions d'inventaire J3

Statut : `FERMÉ — GESTION, TRANSFERTS ET COMMERCE CERTIFIÉS`

## But

Le joueur exprime par écrit ce qu'il veut faire avec ses objets. L'interpréteur
reconnaît le sens ; `inventory-transaction/1` décide seul si l'action est
possible et applique l'état. Ni le texte du joueur ni la prose du MJ ne peuvent
créer une possession, choisir secrètement un exemplaire ou contourner une
contrainte.

## Projection et sélection

Le contexte de l'interpréteur expose les objets réellement possédés sous forme
de références typées. Il peut connaître leur libellé, leur quantité et leur
état `EQUIPPED`, `DIRECT` ou `STORED`, mais pas les secrets mécaniques du
personnage, un prix de marchand ou l'inventaire privé d'un tiers.

Le runtime relit ensuite `character.state` et exige un unique exemplaire. Pour
`ranger` et `sortir`, un contenant possédé unique doit aussi être nommé. Pour
`équiper`, un emplacement compatible, connu et libre doit être déterminé. Une
ambiguïté ou une absence produit un refus local sans commit et sans temps.

Les définitions d'objet viennent du catalogue partagé `src/data/items` déjà
utilisé par le plateau et la création de personnage : armes, armures, objets,
contenants, outils et munitions. J3 ne maintient pas de copie de ces objets.
`torch-toggle.json` reste une action du plateau ; l'objet possédé correspondant
est `obj_torche`.

## Gestes ouverts dans la campagne

- `STORE` : ranger un objet non équipé dans un contenant possédé ;
- `RETRIEVE` : sortir un objet du contenant nommé ;
- `EQUIP` : équiper un objet directement accessible dans un emplacement libre ;
- `UNEQUIP` : libérer l'emplacement occupé par l'objet.
- `DEPOSIT` : transférer un objet direct et non équipé vers le lieu actif ;
- `TAKE` : prendre un exemplaire réellement présent et accessible dans ce lieu.
- `GIVE` : remettre un objet direct à un PNJ présent qui autorise ce transfert ;
- `RECEIVE` : recevoir un objet que ce PNJ marque comme accessible ;
- `BUY` et `SELL` : échanger un exemplaire et la monnaie physique dans la même
  transaction, depuis une offre active dont le prix correspond au catalogue.

Chaque réussite écrit atomiquement :

1. l'inventaire et les emplacements de `character.state` ;
2. la liste équipée de `character.tactical-projection` ;
3. l'équipement visible de `character.narrative-projection` ;
4. pour un transfert, `inventory.external-ownership` ;
5. l'événement public `inventory.transaction-applied`.

Ces petits gestes ne font pas avancer l'horloge. Un rejeu de l'opération ne
produit pas une seconde mutation. Le texte original, le résultat et les trois
projections sont restaurés après rechargement.

## Refus obligatoires

La transaction est refusée si l'objet ou le contenant n'est pas possédé, si
l'objet est encore équipé avant rangement, s'il est encore rangé avant
équipement, si le contenant n'est pas catalogué, si sa capacité est
insuffisante, si un cycle de contenants apparaîtrait, ou si l'emplacement est
incompatible ou occupé. Le refus n'écrit aucun agrégat et n'avance pas le
temps.

## Échanges avec les PNJ et commerce

Les propriétaires de scène et de PNJ vivent dans
`inventory.external-ownership`. Donner exige leur politique persistante
`acceptsDirectTransfers`; recevoir exige un exemplaire marqué accessible.

Le marchand existant des Halles des Commerces possède une plume et de l'encre,
ainsi que deux offres réelles d'achat et de vente. Le prix d'une pièce d'or est
relu depuis `src/data/items`. L'objet et la pièce changent de propriétaire dans
le même état ; une offre absente, fermée, falsifiée ou non solvable est refusée.
La route lointaine vers les Halles reste du ressort du futur système de voyage :
J3 ne téléporte pas le joueur pour rendre l'offre accessible.

La consommation reste réservée à une politique ou un effet propriétaire. Le
justificatif d'accès conserve son contrat spécialisé et ne devient pas une
transaction générale.

## Preuves

```powershell
npm run narration-module:test:runtime-routing
npm run narration-module:test:interpreter-character-context
npm run narration-module:test:campaign-adventure-j2
npm run narration-module:test:inventory-commerce-j3
npm run build
```

La gate continue vérifie sortie et rangement de pièces dans la bourse,
déséquipement et rééquipement de l'épée, refus d'un rangement impossible,
transfert des mêmes pièces vers le lieu puis retour, absence de temps,
synchronisation des projections et reprise sans doublon.
La preuve commerce vérifie achat, vente, restitution des dix pièces initiales,
conservation de l'exemplaire et refus d'un prix différent du catalogue.
