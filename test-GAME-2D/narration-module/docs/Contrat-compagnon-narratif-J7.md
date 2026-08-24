# Contrat du compagnon narratif J7

Statut : `FERMÉ — J7 CERTIFIÉ`

## Expérience joueur

Un PNJ durable peut rejoindre le personnage lorsqu'une relation ou une mission
acceptée justifie réellement ce choix. Une phrase comme « je viens avec toi »,
une forte affinité ou plusieurs conversations ne suffisent pas seules.

Le joueur continue de s'exprimer librement. Lorsqu'il demande quelque chose à
un compagnon, l'interpréteur peut résumer la demande, mais le PNJ conserve sa
volonté. Il peut :

- accepter ;
- adapter la manière de faire ;
- poser une condition ;
- refuser.

La réponse visible est racontée naturellement après la décision. Aucun statut
technique n'est montré au joueur.

## Autorités

- `mission-relation.registry` possède la cause de recrutement acceptée ;
- `campaign.npc-registry` garantit qu'il s'agit du même PNJ durable ;
- `social.actor-registry` conserve ses relations, préoccupations et mémoire ;
- `companion.party-registry` possède uniquement l'appartenance au groupe, la
  présence narrative, la séparation et l'historique des directives ;
- le monde et la scène possèdent toujours les lieux et déplacements ;
- `TravelProcess` lit une photographie versionnée du groupe sans décider qui en
  fait partie ;
- l'IA interprète et formule, mais ne recrute, ne commande et ne déplace aucun
  compagnon.

J7 ne crée aucune fiche tactique et n'injecte aucun allié dans `GameBoard`.
La frontière future est définie par
[`Contrat-frontiere-compagnon-tactique-J8.md`](Contrat-frontiere-compagnon-tactique-J8.md) :
le compagnon y reste autonome par défaut et aucun contrôle direct n'existe sans
capacité mécanique autoritaire active.

## Recrutement

Le recrutement exige simultanément :

1. un engagement `RELATION` ou `MISSION` en état `ACCEPTED` ;
2. une confirmation propriétaire enregistrée par cet engagement ;
3. un PNJ de campagne dont `actorId` et la cause durable correspondent ;
4. une politique d'autonomie sourcée pour ce PNJ ;
5. sa présence dans la même scène que le personnage au moment du recrutement.

La réussite ajoute le PNJ une seule fois au groupe actif. Une confirmation
fabriquée, un refus, une condition non résolue, un autre acteur ou un PNJ absent
sont refusés sans mutation.

Dans le parcours joueur composé en J9, une directive sémantique `FOLLOW`
adressée à un PNJ visible qui n'est pas encore membre exprime une demande de
recrutement. Elle ne suffit pas à recruter : le tour doit d'abord être fermé,
la décision J4 doit être `ACCEPTED`, puis un catalogue propriétaire doit fournir
la politique d'autonomie de ce PNJ. Sans l'une de ces preuves, aucune promotion
ni appartenance n'est créée.

## Appartenance et présence

Un membre possède un état narratif :

- `ACTIVE` : il voyage avec le personnage et peut être projeté dans sa scène ;
- `SEPARATED` : il reste compagnon, mais n'est plus projeté avec le groupe ;
- `LEFT` : il a quitté le groupe et ne peut revenir que par une nouvelle cause
  propriétaire.

Un déplacement validé du groupe met à jour la scène du compagnon actif. Une
simple narration ne peut pas le téléporter. La photographie exposée au voyage
contient le personnage et les seuls compagnons `ACTIVE`, avec la révision du
registre comme preuve.

Une séparation conserve le lieu ou la scène où le PNJ reste. Une réunion exige
que le monde confirme que le personnage et le PNJ se retrouvent au même endroit.

## Directives et volonté propre

Chaque compagnon possède une politique d'autonomie durable issue de sources
propriétaires. Elle autorise, adapte, conditionne ou refuse des catégories de
demande. Le texte du joueur ne choisit jamais directement le résultat.

Une directive conserve :

- la demande comprise et sa catégorie ;
- le résultat propriétaire ;
- l'adaptation ou les conditions publiques éventuelles ;
- les sources utilisées ;
- son état d'exécution séparé de la décision.

Accepter une directive ne prouve pas qu'elle a réussi. Une action qui change le
monde, un objet, une relation, une intrigue ou le temps doit encore passer par
le domaine propriétaire correspondant.

## Initiative

Un compagnon actif peut participer à une scène depuis une préoccupation sociale
déjà autorisée. Les règles d'initiative existantes restent applicables : cible
présente, délai, cause, événement committé et possibilité d'un résultat `CALM`.
Le statut de compagnon ne crée pas artificiellement une prise de parole.

## Reprise et rejeu

Le registre, les directives et les séparations sont persistants. Le même
`clientRequestId` restaure le résultat sans doubler un membre, une directive ou
un événement. Après rechargement, la projection relit le registre et n'affiche
que les compagnons actifs dans la scène actuelle.

## Installation immersive J10-C

La composition de campagne installe une politique explicite pour les PNJ
recrutables ; une parole seule ne suffit toujours pas. Le contrat sémantique V7
porte `presenceIntent` afin de distinguer une demande ordinaire, une séparation,
une réunion et un départ sans analyser ces mutations par mots-clés dans le
runtime. Le PNJ doit être visible et sa politique d'autonomie doit accepter ou
adapter la demande. La directive et le changement de présence sont alors
persistés atomiquement. Un refus ne change jamais l'appartenance au groupe.

## Preuves minimales J7

- recrutement refusé sans engagement accepté ;
- recrutement du même PNJ durable depuis une cause réelle ;
- présence dans plusieurs scènes après déplacements validés ;
- directive acceptée et autre directive refusée ou adaptée par la politique du
  PNJ ;
- séparation, absence de projection, réunion autorisée et reprise ;
- photographie de groupe compatible avec le voyage J6 ;
- demande écrite libre classée sans mots-clés métier puis décidée dans le même
  tour propriétaire ;
- réponse incarnée par le `npc_performer`, avec fallback narratif qui conserve
  exactement la décision ;
- initiative sociale bornée depuis une préoccupation persistée ;
- acceptation, refus et reprise certifiés dans le navigateur ;
- aucune projection tactique ni résultat d'action inventé.
