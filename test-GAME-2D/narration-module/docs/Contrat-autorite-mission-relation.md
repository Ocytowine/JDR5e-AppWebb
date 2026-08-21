# Contrat d'autorité mission/relation

Statut : `ACTIF`  
Version : `mission-relation-registry/1`  
Dernière mise à jour : 2026-08-20

## But

Ce domaine transforme une proposition narrative en décision durable sans
confondre les paroles d'un PNJ, la prose du MJ et l'état de campagne.

Il fournit le premier raccord propriétaire nécessaire à la promotion d'un
acteur local en PNJ de campagne :

```text
proposition PROPOSED
  ├─ REFUSED      → aucune confirmation
  ├─ CONDITIONAL  → conditions conservées, aucune confirmation
  ├─ UNCERTAIN    → incertitude conservée, aucune confirmation
  └─ ACCEPTED     → confirmation propriétaire vérifiable
                       └─ promotion durable autorisée
```

## Proposition

Une proposition identifie :

- un engagement stable ;
- son type `MISSION` ou `RELATION` ;
- la scène et l'acteur concernés ;
- la future référence durable ;
- un résumé public et ses sources publiques ;
- son proposant : joueur, PNJ, monde ou système.

Exemple : le joueur demande au copiste de recopier un journal. Cette demande
crée une proposition `MISSION` en état `PROPOSED`. La réplique « je vais y
réfléchir » ne la transforme pas en acceptation.

Dans la campagne jouable, une demande d'action clairement adressée par écrit à
un PNJ visible passe désormais par ce raccord. L'état `PROPOSED`, les identifiants
et le commit restent invisibles : le joueur ne voit que son expression et la
réaction narrative du PNJ, enrichie par le pipeline IA ou par son relais local
naturel. Le performer peut choisir les mots, mais ne peut ni accepter la
mission, ni ajouter une condition, ni modifier le registre.

## Résolution

La résolution appartient au domaine métier concerné :

| Engagement | Autorité requise | Preuve requise | Cause de promotion |
|---|---|---|---|
| `MISSION` | `QUEST` | `QUEST_RESOLUTION` | `ONGOING_COMMITMENT` |
| `RELATION` | `SOCIAL` | `SOCIAL_RESOLUTION` | `RELATION_CONFIRMED` |

Les quatre dispositions ont un sens durable distinct :

- `ACCEPTED` : l'engagement est confirmé et une confirmation propriétaire est
  émise ;
- `REFUSED` : le refus est conservé sans effet de promotion ;
- `CONDITIONAL` : les conditions explicites sont conservées, sans promotion
  avant une nouvelle décision ;
- `UNCERTAIN` : l'absence de décision est conservée telle quelle.

Dans la campagne installée, cette décision est prise avant la formulation de la
réponse. L'IA reçoit la décision et ses conditions comme une limite à exprimer
naturellement ; elle ne peut ni les remplacer ni en inventer d'autres. Une
condition remplie ou une hésitation levée autorise une nouvelle décision
propriétaire. Une acceptation ou un refus est final.

Une résolution conditionnelle sans condition est invalide. Une autorité sociale
ne peut pas confirmer une mission et une autorité de quête ne peut pas confirmer
une relation.

## Fin de mission et relation

Une mission acceptée peut se terminer par `SUCCESS`, `FAILURE` ou `ABANDONED`.
La fin, son résumé public et ses sources sont persistés une seule fois. Une
réplique narrative ne suffit donc pas à déclarer une réussite ou un échec : le
domaine appelant doit fournir la cause validée. L'abandon suit la même commande
propriétaire lorsqu'il résulte d'une décision explicite du joueur.

Une fin peut demander un effet relationnel. Le raccord social réutilise
strictement les axes existants `trust`, `affinity`, `fear` et `debt`; aucun axe
parallèle n'est créé. L'effet va du PNJ concerné vers le personnage joueur et
conserve la fin de mission comme source.

## Confirmation et promotion

La confirmation contient l'engagement, la commande propriétaire et la cause
durable. Elle n'est pas un jeton fourni sur l'honneur par l'appelant.

Avant toute nouvelle promotion, le runtime recharge le registre
mission/relation et vérifie :

- que l'engagement existe et est `ACCEPTED` ;
- qu'il concerne exactement la scène et l'acteur demandés ;
- que l'opération de résolution correspond ;
- que la confirmation reçue est identique à celle enregistrée.

Une confirmation fabriquée, altérée, refusée, conditionnelle ou incertaine est
donc rejetée. Le performer PNJ, le scene writer et le coherence critic peuvent
exprimer ou mettre en forme une proposition ; aucun ne peut effectuer ce
commit.

## Atomicité et rejeu

Proposition et résolution sont chacune persistées par un commit atomique
contenant :

- l'opération acceptée ;
- la nouvelle version du registre ;
- un événement visible par le joueur.

Le même `clientRequestId` avec la même commande restaure le résultat sans second
effet. Le réemploi de cet identifiant avec un contenu différent produit
`IDEMPOTENCY_CONFLICT`.

## Preuves

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:mission-relation-authority
npm run narration-module:test:mission-dialogue-j4
npm run narration-module:test:campaign-npc-promotion-commit
npm run narration-module:test:npc-return-ui
```

Le premier test couvre les quatre dispositions, les frontières d'autorité, la
vérification persistée et le rejeu. Le test navigateur prouve qu'une
confirmation fabriquée est refusée, puis qu'une acceptation réelle permet la
promotion du même acteur après son retour en scène.

La preuve J4 vérifie proposition et rejeu, décision narrative, nouvelle décision
après une condition, réussite, échec, abandon et effet sur un axe relationnel
autorisé. Elle vérifie aussi que les textes de secours ne montrent aucun nom
d'état technique au joueur.
