# Contrat de génération d'intrigue J5

Statut : `LIVRÉ`  
Version : `plot-candidate/1`  
Dernière mise à jour : 2026-08-20

## But

Créer pendant la partie une situation à explorer, sans préparer une aventure
qui dicte les actions du joueur et sans remplacer `plot-registry/1`.

Le nouveau raccord est uniquement placé avant le noyau existant :

```text
contexte public autorisé
→ proposition créative de l'IA, sans autorité
→ contrôles structurés
→ promotion par plot-registry/1
→ évolution et révélations existantes
```

## Contexte autorisé

Le générateur reçoit seulement les lieux, acteurs, faits publics, signaux du
monde et références de sources fournis par la campagne. Il ne peut pas ajouter
un acteur ou un lieu durable en le citant simplement dans sa proposition.

Le constructeur de contexte sait déjà extraire la scène visible, ses acteurs,
sa tension et les connaissances publiques du personnage. Les signaux du monde
doivent être fournis par leur propriétaire ; aucun événement n'est simulé ou
inventé par ce raccord.

## Proposition et contrôles

Une proposition fournit :

- une vérité cachée et ses sources d'ancrage ;
- une chronologie causale sans boucle ;
- une motivation sourcée pour chaque acteur causal, liée aux étapes où il
  agit ;
- les perspectives distinctes des acteurs : connaissance, croyance, erreur ou
  mensonge ;
- au moins deux voies indépendantes par révélation indispensable ;
- une fausse piste et une voie existante permettant de la réfuter ;
- des signes publics qui ne recopient jamais la vérité cachée ;
- les éventuelles évolutions futures et leurs effets classés.

Une proposition invalide est refusée avant tout commit. En cas d'indisponibilité
de l'IA, aucune intrigue locale de remplacement n'est inventée.

Après les contrôles locaux, un `coherence_critic` compare motivations, actions,
perspectives et engagements. Une motivation contradictoire ou qui suppose un
savoir absent bloque la proposition avant sa promotion.

## Promotion et suivi

Une proposition valide est convertie vers `PlotStateV1`, puis créée par
`createPlotV1`. Vérité, engagements, causalité, perspectives, pistes et étapes
futures sont donc conservés avant leur mise en scène.

Lorsqu'un effet lié à une piste est réellement révélé, le registre mémorise la
découverte publique. Une observation, une inférence ou un témoignage reste une
information acquise : elle ne remplace pas la vérité cachée et une hypothèse du
joueur ne peut pas réécrire celle-ci.

Une déclaration explicite du joueur comme « je pense que… » peut maintenant
être conservée comme hypothèse `UNCONFIRMED`. Ce statut ne confirme rien et ne
modifie ni la vérité, ni les causes, ni les pistes.

Quand un PNJ prend la parole, `npc_performer` reçoit seulement les perspectives
d'intrigue attribuées à cet acteur. Le statut interne qui indique qu'une
croyance est erronée est retiré de cette vue : le PNJ peut donc l'exprimer
naturellement comme sa croyance, sans connaître la vérité cachée. Les
perspectives des autres acteurs, les causes privées et les fausses pistes ne
sont jamais transmises dans ce paquet.

## Résolution

Une conclusion explicite comme « j'en conclus que… » est d'abord conservée
comme hypothèse. Le contrôleur de cohérence la compare ensuite à la vérité et
aux découvertes, sans montrer cette vérité au joueur. Une conclusion fausse ou
prématurée reste une hypothèse et ne ferme rien.

La commande `plot-resolution/1` accepte seulement une conclusion validée avec
deux voies découvertes et indépendantes pour chaque révélation indispensable.
Chaque fausse piste doit aussi posséder une réfutation découverte. La commande
ferme alors l'intrigue, marque la bonne hypothèse comme soutenue et les fausses
hypothèses reconnues comme réfutées.

Dans le build principal OpenAI, seule une recherche écrite, volontaire et
approfondie peut demander cette création. Une observation rapide, une
conversation ordinaire, l'absence d'acteur pertinent ou une intrigue déjà
active n'appellent pas le générateur. Un refus du générateur reste invisible et
ne bloque pas le tour du joueur.

Après une création acceptée, les pistes immédiatement exigibles passent dans
la boucle d'évolution et de révélation du noyau au cours du même tour. Le joueur
reçoit donc un signe narratif issu de sa recherche, et non un succès technique
silencieux dont l'effet n'apparaîtrait qu'à sa prochaine action.

## Preuves

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:plot-candidate-j5
npm run narration-module:test:plot-authority
```

La première preuve couvre contexte de scène, sortie IA contrôlée, acteurs et
lieux autorisés, causalité, deux pistes, fausse piste, absence de fuite,
promotion, découverte par observation et témoignage, hypothèse du joueur,
évolution hors écran, motivations et vue propre au PNJ. Elle déroule dix
échanges narratifs jusqu'à la résolution et vérifie notamment que le clerc
ne reçoit ni la vérité cachée, ni le savoir de l'archiviste, ni l'indication que
sa croyance est fausse. La seconde protège le noyau historique, son évolution
hors écran et son rejeu.
