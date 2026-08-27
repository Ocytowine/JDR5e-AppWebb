# Contrat de recherche factuelle ciblée J10-I2

Statut : `ACTIF`

Contrat : `targeted-lore-information-lookup/1`

## But

Le lecteur transforme un `information-need/1` déjà compris par V8 en candidats
factuels sourcés. Il ne relit jamais la saisie brute et ne tente pas de produire
la réplique du PNJ.

```text
besoin V8 + ancre de scène + knowledgeRefs
                    │
                    ▼
       sujet exact ou relation géographique
                    │
                    ▼
       propriétés et relations pertinentes
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
   lore initial       projection campagne
          └─────────┬─────────┘
                    ▼
       candidats sourcés, sans commit
```

## Entrée

La requête fournit :

- le besoin structuré V8 ;
- l'entité lore qui ancre la scène ;
- la campagne et sa révision de lecture ;
- les `knowledgeRefs` déjà portées par la présence visible ;
- la frontière de niveau autorisée, limitée en I2 à `COMMUN` et `LOCAL`.

Une mention exacte ou une référence publique proposée sélectionne directement
le sujet. Une mention contextuelle comme « cette ville » remonte la relation
géographique de l'ancre. Une question de gouvernement actuel suit ensuite la
ville vers son `siege_pouvoir`, puis le siège vers son
`proprietaire_principal`.

## Priorité et provenance

Pour chaque couple `entityId + fieldPath`, la projection effective de campagne
remplace ou masque le fragment initial. Sans projection, le lore initial reste
effectif. Chaque candidat conserve ses références `lore-fragment:*` et, le cas
échéant, `campaign-lore-projection:*` et les causes publiques de campagne.

La lecture produit au plus huit candidats. Elle ne dépend pas des seize
influences descriptives du paquet de scène : ce budget sert à composer une
ambiance, pas à répondre à une question précise.

## Frontières

- `READ_ONLY_FACT_LOOKUP` est l'unique autorité du résultat ;
- `noCommit` vaut toujours `true` ;
- aucune référence `RESTREINT` ou `MJ_SECRET` n'est admise ;
- une portée passée ou future ne réutilise pas le titulaire courant ;
- une référence `external:non_documente` reste une dimension manquante ;
- le lecteur ne décide ni connaissance du PNJ, ni divulgation, ni création ;
- le performer ne reçoit encore aucun candidat en J10-I2.

## Gate

`npm run narration-module:test:j10i2-targeted-lore` prouve :

- Lysenthe → ducat → Château Tharqual → Tharque régent ;
- résolution de « cette ville » depuis les Archives ;
- priorité d'un remplacement de campagne ;
- consommation bornée d'une `knowledgeRef` locale ;
- refus de la frontière secrète ;
- absence de recyclage du présent pour une question passée ;
- résultat sans commit et validé par son contrat.
