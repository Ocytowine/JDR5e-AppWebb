# Contrat de création d'une information publique manquante J10-J3

Statut : `ACTIF`

Contrat de proposition : `missing-information-fact-proposal/1`

## Frontière d'autorité

Une propriété de lore absente n'est créable que si sa déclaration
`proprietes_factuelles` porte une politique explicite :

- `creation: TEXTE` pour une valeur textuelle publique ;
- `creation: IDENTITE` pour une identité légère ;
- absence de politique ou `INTERDITE` pour refuser toute création.

Une identité exige `propriete_role_identite`, référence vers une autre
propriété publique établie du même sujet. Le runtime ne déduit jamais la nature
de la valeur, son rôle ou son niveau depuis les mots du joueur.

## Proposition créative

Le rôle `scene_creator` reçoit uniquement la propriété autorisée, son libellé,
son type de valeur, le rôle public déjà établi et des faits contextuels publics.
Sa sortie contient une seule `generatedValue` et reste marquée
`PROPOSE_ONLY_NO_COMMIT`.

Le schéma Structured Outputs borne `propertyRef` et `valueKind` par des `const`.
Une sortie qui tente de changer de slot, de type ou d'autorité est rejetée avant
toute mutation. Le modèle ne fournit ni identifiant persistant, ni commande, ni
politique de divulgation.

## Propriétaire persistant

Le propriétaire local :

1. vérifie la politique déclarée et les sources publiques du lore ;
2. construit un identifiant stable pour une identité légère ;
3. prépare une commande `campaign-fact-mutation/1` ;
4. hors tour actif, écrit atomiquement l'identité et le fait `CAMPAIGN_FACT` de
   cardinalité `SINGLE`, puis recharge la révision ;
5. pendant un tour actif, fournit une préparation au propriétaire du tour, qui
   fusionne parole, état de scène, fait et identité dans son commit atomique ;
6. projette cette préparation validée vers le lookup du tour courant, tandis
   que les tours suivants lisent exclusivement la valeur persistée.

Le propriétaire ne crée jamais une seconde opération pendant qu'un tour détient
le verrou de campagne. Il ne libère pas non plus ce verrou prématurément.

Le reçu factuel porte alors `creation.status=EXECUTED` et les références du slot
et du fait. `performerMayCreateFacts` reste toujours `false`.

Si la génération, la validation, la préparation ou le commit échoue, aucun fait n'est écrit et
J10-J2 conserve sa réponse partielle. Une demande ultérieure peut reprendre le
processus.
