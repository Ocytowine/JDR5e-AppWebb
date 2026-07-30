# Contrat cible — monde vivant et initiative des PNJ

Statut : `LIVRE_CERTIFIE`
Priorité : `TRANSVERSE_6C_6D`
Gate cible : `6V`

## Promesse de jeu

Le personnage joueur participe au monde ; il n'en est ni le moteur unique ni
la cible automatique.

Une scène doit pouvoir évoluer parce qu'un acteur, une faction, un processus ou
un événement possède sa propre cause. Un PNJ peut interpeller le personnage,
agir devant lui, partir, attendre quelqu'un, répondre à un tiers ou poursuivre
un objectif qui ne le concerne pas directement.

L'autonomie ne signifie pas produire du bruit. Une scène calme peut rester
calme lorsqu'aucune cause n'exige de mouvement.

## Temps réel et temps diégétique

Une attente réelle devant l'écran, une pause ou une fermeture de l'application
ne fait jamais progresser la campagne.

Le monde peut agir :

- à l'entrée dans une scène, depuis les événements déjà exigibles ;
- après une action ou un échange ayant fait avancer le temps de jeu ;
- pendant une attente, un voyage, un repos ou un autre processus diégétique ;
- lors d'une frontière temporelle ou d'une échéance validée ;
- hors écran, lorsque l'horloge de campagne avance.

L'application traite les événements dus avant de restituer la main au joueur.
Elle ne demande pas une entrée vide au joueur pour « réveiller » la scène.

## Trois niveaux à distinguer

### Réaction

Un PNJ répond à une parole, une action ou un événement perceptible. Cette
capacité existe partiellement dans le pipeline actuel mais doit utiliser son
état social et ses connaissances propres.

### Initiative locale

Un acteur présent choisit d'agir depuis une cause qui lui appartient :

- objectif ou activité en cours ;
- relation, dette, crainte ou engagement ;
- événement perçu ;
- échéance ou urgence ;
- changement local du monde.

L'initiative peut viser le personnage, un autre acteur, un objet ou le lieu.
La simple présence du joueur ne constitue jamais une cause suffisante.

### Évolution autonome

Des acteurs, factions, mobiles, processus et intrigues évoluent hors de la
scène. Leurs résultats sont committés par leurs domaines propriétaires. Ils ne
deviennent narratifs que lorsqu'un canal de perception, de connaissance ou de
diffusion les rend accessibles.

## Chaîne d'autorité

```text
horloge ou événement causal validé
  -> domaine propriétaire
  -> décision ou changement committé
  -> événement typé et visibilité
  -> routeur non autoritaire
  -> sélection des effets pertinents pour la scène
  -> SceneEventBundle
  -> planificateur et performers des acteurs concernés
  -> narration
  -> restitution de la main au joueur
```

Le routeur transporte. Le domaine social décide d'une évolution sociale. Le
monde décide d'une action de faction ou d'un déplacement. L'intrigue conserve
sa vérité privée. Le planificateur compose la scène. Le rédacteur ne crée pas
après coup la cause nécessaire à une intervention.

## Contrat minimal d'une initiative

Une initiative candidate doit porter au minimum :

- l'acteur source et son domaine propriétaire ;
- une cause committée ou une règle versionnée ;
- l'objectif immédiat de l'acteur ;
- les cibles éventuelles, dont aucune n'est implicitement le joueur ;
- l'instant ou la fenêtre d'exécution ;
- les préconditions et motifs d'annulation ;
- les connaissances utilisées par l'acteur ;
- la portée perceptible et les secrets à exclure ;
- l'urgence, la possibilité d'interruption et la condition de restitution de
  la main ;
- une clé d'idempotence.

Une sortie IA peut proposer la forme d'une action ou d'une réplique. Elle ne
peut ni inventer l'état social qui la motive, ni committer son résultat.

## Sélection et rythme

Lorsque plusieurs initiatives sont possibles, la sélection est stable et
prend en compte :

- événement exigible ou danger immédiat ;
- engagement ou objectif déjà actif ;
- pertinence locale et capacité réelle de l'acteur ;
- nouveauté pour la scène ;
- coût d'interruption pour le joueur ;
- budget de rythme, répétition et délai depuis la dernière initiative.

Les gestes d'ambiance peuvent enrichir la scène sans obtenir un tour complet.
Une initiative significative ne peut pas être remplacée par une animation
décorative. À l'inverse, le système ne doit pas interrompre chaque action du
joueur pour prouver que les PNJ existent.

## Frontière de connaissance

Une action autonome peut être :

- directement perceptible ;
- perceptible seulement par ses signes ;
- apprise par un canal ultérieur ;
- entièrement privée pour le moment.

L'événement privé reste committé sans être envoyé au rédacteur. Un PNJ ne peut
agir que depuis ce qu'il sait, croit ou perçoit. Le joueur ne reçoit jamais une
cause secrète pour expliquer artificiellement un comportement visible.

## Répartition dans la feuille de route

### 6C — fondation sociale et première initiative locale

6C doit livrer :

- état social et connaissances persistantes par acteur ;
- objectifs ou préoccupations sociales exploitables ;
- proposition d'initiative locale causée ;
- sélection bornée à une frontière de scène ;
- premier parcours où un PNJ présent prend l'initiative sans saisie préalable
  du joueur.

Cette première initiative reste locale et utilise une fixture causale. Elle ne
prétend pas encore simuler une intrigue complète.

### 6D — évolution autonome et projection vers la scène

6D doit livrer :

- événements et échéances privés appartenant à l'intrigue ;
- évolution hors écran quand l'horloge avance ;
- ingestion d'événements monde committés ;
- classification visible, inférable, connaissable ou cachée ;
- composition d'un `SceneEventBundle` ;
- interruption ou mouvement de scène, puis restitution de la main.

### Consolidation de la simulation mondiale

Le `map-module/world-simulation` reste l'autorité macroscopique. Son chantier
complète la variété des causes : objectifs multi-phases, opportunités de
faction et mobiles non-système. Le module narration ne duplique pas ce moteur.

## Gate 6V avant 6E

La verticale est certifiée avant d'ouvrir 6E si les scénarios suivants passent :

1. un PNJ interpelle le personnage à l'entrée d'une scène pour une cause
   antérieure et vérifiable ;
2. pendant une attente diégétique, un acteur agit envers un autre acteur sans
   cibler artificiellement le personnage ;
3. un événement urgent interrompt une activité exactement à son échéance ;
4. une situation ignorée évolue hors écran puis produit seulement des
   conséquences perceptibles au retour ;
5. un événement distant reste committé mais non narré ;
6. une fermeture réelle prolongée ne fait pas avancer le monde ;
7. rechargement et rejeu ne doublent ni initiative, ni temps, ni conséquence ;
8. une scène sans cause pertinente reste calme ;
9. plusieurs initiatives concurrentes sont ordonnées de manière reproductible ;
10. aucune connaissance privée n'est révélée par la justification d'un PNJ.

Cette gate prolonge notamment `NAR-ACC-003`, `NAR-ACC-005` et `NAR-ACC-007`.

Certification obtenue le 2026-07-29 par
[`Matrice-certification-gate-6V-monde-vivant.md`](Matrice-certification-gate-6V-monde-vivant.md).
L'avance diégétique ouvre désormais aussi une frontière sociale locale après
les événements causaux, sauf lorsqu'une interruption urgente doit conserver la
priorité.
