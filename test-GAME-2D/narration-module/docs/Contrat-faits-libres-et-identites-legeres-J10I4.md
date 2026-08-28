# Contrat des faits libres et identités légères J10-I4

Statut : `ACTIF`

Contrats : `campaign-fact-registry/1`, `narrative-actor-registry/1` et
`campaign-fact-mutation/1`

## But

`CAMPAIGN_FACT` est le propriétaire persistant d'une dimension factuelle de
campagne absente du lore détaillé mais autorisée par ses ancres publiques. Une
valeur qui nomme un acteur encore inconnu référence une identité
`LIGHT_REFERENCE`. Les deux registres sont écrits dans le même commit.

Le contrat ne choisit pas un nom et ne fait pas parler un PNJ. Il valide et
persiste une proposition déjà produite par l'orchestration autorisée.

## Slot et cardinalité

Un slot est la paire stable `subjectRef + predicate`. Sa cardinalité V1 est
`SINGLE` : un seul fait peut porter le statut `ACTIVE` dans un slot. Une
assertion identique réutilise le fait et l'identité existants sans commit. Une
assertion différente est une contradiction et doit être refusée ; elle ne
remplace jamais implicitement l'état courant.

## Cycle de vie

- `ASSERT` crée `campaign.fact.asserted` lorsque le slot est vide ;
- `REPLACE` exige l'identifiant exact du fait courant, le clôt, puis crée
  `campaign.fact.replaced` et une nouvelle valeur active ;
- `INVALIDATE` exige aussi le fait courant, le clôt sans nouvelle valeur et
  crée `campaign.fact.invalidated`.

Chaque fait conserve visibilité publique, validité temporelle, sources,
niveau de connaissance, révisions d'assertion et de clôture, domaines
validateurs, fait remplacé et opération d'assertion. L'historique
reste reconstructible dans le registre ; le lore initial ne peut donc pas
écraser silencieusement un titulaire remplacé en campagne.

Le sujet emploie obligatoirement `lore-entity:<id>` et la propriété un chemin
absolu. Le validateur injecté vérifie l'entité ainsi que chaque source
`lore-fact:` ou `lore-fragment:` dans le catalogue généré avant toute opération.

## Identité légère

Une identité porte une référence, un nom public, un rôle public, ses sources et
la profondeur `LIGHT_REFERENCE`. Une référence existante ne peut être
réutilisée avec un autre nom ou rôle. Ce niveau ne crée ni présence de scène,
ni profil social, ni statistiques, ni secret.

## Atomicité et concurrence

Le runtime acquiert le lease d'écriture avant de relire les deux registres. Il
réutilise alors la valeur courante ou commite ensemble le registre factuel et
le registre d'identités. Une demande concurrente reçoit `CAMPAIGN_BUSY`; son
rejeu après libération retrouve le fait courant sans produire de doublon.

Les opérations abouties sont rejouables par `clientRequestId`. Les sources
`secret:`, `private:` et `hidden:` sont refusées pour ce chemin public.

## Lecture par le pipeline factuel

`createCampaignFactInformationReaderV1` reconstruit les faits effectifs à la
`campaignRevision` demandée. `createTargetedLoreInformationReaderV1` les place
avant les projections et le lore initial. Pour un même sujet et une même
propriété, `CAMPAIGN_FACT` remplace la valeur authored au lieu de créer deux
candidats contradictoires.

Le raccord produit doit employer
`createCampaignBackedTargetedInformationReaderV1`, qui injecte toujours le
lecteur des faits libres et celui des projections. L'activation de ce lookup
dans le contrôleur de tour reste le travail explicite de J10-I5/I6 ; I4 ne fait
encore ni divulgation ni performance.

Le contrat transverse applicable aux autres propriétaires est
[`Contrat-integration-autorite-persistante-et-catalogues.md`](Contrat-integration-autorite-persistante-et-catalogues.md).

## Limites

J10-I4 ne décide pas si un PNJ connaît ou révèle le fait. J10-I3 reste
propriétaire de la projection de connaissance et J10-I5 doit décider la
divulgation, les rumeurs, les secrets et la cause structurée d'un refus.
