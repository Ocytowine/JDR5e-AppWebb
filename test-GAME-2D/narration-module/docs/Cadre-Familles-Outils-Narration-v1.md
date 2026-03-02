# Cadre Familles Outils Narration v1

## But

Ce document pose un cadre clair pour les grandes familles d'outils qui devront soutenir le module narration.

Il ne decrit pas encore leur implementation.

Il sert a :

- separer proprement la narration libre des mecaniques lourdes,
- eviter d'ajouter des outils au hasard,
- definir ce qu'un outil narratif doit produire,
- garder le MJ comme couche de mise en scene, pas comme moteur de calcul improvise.

## Principe general

Certaines situations peuvent etre gerees principalement par :

- l'intention situee,
- les ancres de scene,
- la resolution locale sobre,
- le lore disponible.

Mais certaines mecaniques ont besoin d'un socle plus fiable.

Dans ces cas, le MJ ne doit pas improviser seul :

- il doit s'appuyer sur un outil dedie,
- l'outil calcule, valide ou structure,
- puis le MJ transforme ce resultat en scene vivante.

## Regle directrice

Un outil narratif ne doit jamais etre pense comme :

- "un bloc de texte de plus"

Un outil narratif doit produire au minimum :

1. un resultat brut exploitable,
2. des faits de scene,
3. des contraintes de resolution,
4. eventuellement une trace de debug separee de la narration.

Le MJ s'appuie ensuite sur ces sorties pour parler naturellement.

## Sortie attendue d'un outil narratif

Chaque outil narratif devrait tendre vers un format conceptuel commun.

### 1. Resultat brut

Exemples :

- distance, temps de trajet, destination atteinte,
- objets proposes,
- repos effectue ou interrompu,
- compagnon disponible ou absent,
- action de bastion resolue,
- progression ou niveau atteint.

### 2. Faits de scene

Ces faits doivent etre integrables dans les ancres de scene.

Exemples :

- `presented_options`
- `revealed_fact`
- `travel_segment`
- `rest_completed`
- `rest_interrupted`
- `npc_companion_present`
- `bastion_state_changed`
- `level_up_available`
- `social_perception_shift`

### 3. Contraintes

L'outil peut aussi produire :

- ce qui est autorise,
- ce qui est bloque,
- ce qui exige une precision supplementaire,
- ce qui doit attendre une prochaine etape.

### 4. Debug separe

Le detail technique doit rester visible en mode details si besoin,
mais il ne doit jamais contaminer la sortie RP.

## Familles d'outils prioritaires

### 1. Voyage

#### Pourquoi un outil est necessaire

Le voyage ne doit pas reposer sur une simple estimation narrative.

Il engage :

- la carte,
- la geographie,
- les distances,
- la duree,
- l'horloge monde,
- le changement de zone active.

#### Ce que l'outil devra gerer

- point de depart
- destination
- distance estimee ou calculee
- temps de trajet
- mode de deplacement
- consequences temporelles
- eventuel passage par des zones ou etapes

#### Ce que le MJ en fait

Le MJ ne recalcule pas.

Il :

- met en scene le trajet,
- fait sentir le changement d'echelle,
- decrit l'arrivee,
- garde la coherence du temps et du lieu.

### 2. Repos

#### Pourquoi un outil est necessaire

Le repos touche a des changements d'etat reccurents.

Si c'est traite seulement en prose, on perd vite :

- la coherence temporelle,
- les recuperations,
- les interruptions,
- les effets a moyen terme.

#### Ce que l'outil devra gerer

- type de repos (court, long, autre)
- duree
- passage du temps
- recuperation
- interruption
- conditions du lieu

#### Ce que le MJ en fait

Le MJ :

- decrit le moment de pause,
- met en scene le contexte,
- raconte une interruption si elle existe,
- traduit narrativement les effets du repos.

### 3. Bastions

#### Pourquoi un outil est necessaire

Un bastion ou une propriete n'est pas juste un decor.

C'est un point d'ancrage durable avec :

- etat,
- activites,
- ressources,
- effets indirects,
- consequences a moyen terme.

#### Ce que l'outil devra gerer

- etat du bastion
- activites en cours
- evolutions locales
- evenements ou repercussions
- decisions du joueur liees au lieu

#### Ce que le MJ en fait

Le MJ :

- fait sentir que ce lieu compte,
- raconte les retombees,
- integre le bastion dans la vie du monde.

### 4. Compagnons

#### Pourquoi un outil est necessaire

Les compagnons ne doivent pas etre de simples "PNJ notes quelque part".

Ils doivent pouvoir exister comme elements suivis de la scene et de la session.

#### Ce que l'outil devra gerer

- identite du compagnon
- type (allié, monture, creature, autre)
- presence actuelle
- disponibilite
- etat general
- role probable dans la scene

#### Ce que le MJ en fait

Le MJ :

- les fait exister dans la scene,
- sait s'ils sont la ou non,
- sait quand ils influencent une action,
- garde une coherence relationnelle simple.

### 5. Passage de niveau

#### Pourquoi un outil est necessaire

Le passage de niveau n'est pas seulement une note technique.

Il modifie :

- les possibilites du personnage,
- sa place dans la fiction,
- les options qui deviennent raisonnablement accessibles.

#### Ce que l'outil devra gerer

- condition de progression
- niveau atteint
- gains ou choix ouverts
- etat en attente de validation si necessaire

#### Ce que le MJ en fait

Le MJ :

- traduit cette progression en fiction,
- ouvre de nouvelles possibilites,
- garde la progression lisible et sobre.

### 6. Perception du personnage et regard du monde

#### Pourquoi un outil est necessaire

Ce point est souvent traite de facon trop diffuse, alors qu'il influence fortement la qualite du MJ.

Il faut mieux prendre en compte :

- comment le personnage lit le monde,
- comment le monde lit le personnage.

#### Ce que l'outil devra gerer

- statut apparent
- reputation
- signes d'appartenance
- apparence marquante
- reactions sociales probables
- filtres de perception utiles

#### Ce que le MJ en fait

Le MJ :

- nuance les reactions des PNJ,
- ajuste le ton social de la scene,
- met en valeur ce qui change selon qui est observe et qui observe.

## Ce qui ne doit pas devenir un outil

Tout ne doit pas etre outille.

Il ne faut pas creer un outil pour :

- chaque petite reponse locale,
- chaque observation ordinaire,
- chaque echange simple,
- chaque changement de formulation.

Une scene doit rester libre tant que :

- le contexte est lisible,
- les ancres suffisent,
- aucune mecanique lourde n'a besoin d'etre calculee ou suivie.

## Critere pour decider qu'un outil est justifie

Un outil devient justifie si au moins un de ces cas est vrai :

1. la coherence depend d'un calcul ou d'un etat difficile a improviser proprement,
2. la mecanique se repete et doit rester stable sur plusieurs tours,
3. le resultat doit etre memorise comme fait de scene ou etat de session,
4. la narration libre seule produirait trop d'incoherence, de flottement ou de pseudo-regles.

## Ordre de priorite recommande

Pour ne pas disperser le chantier, l'ordre le plus sain est :

1. Voyage
2. Repos
3. Compagnons
4. Perception du personnage et regard du monde
5. Bastions
6. Passage de niveau

Pourquoi :

- Voyage et repos touchent directement a la continuite de scene et au temps.
- Compagnons et perception sociale influencent fortement la qualite immediate du MJ.
- Bastions et niveau sont importants, mais plus faciles a cadrer une fois la base plus stable.

## Lien avec la reconsolidation

Ce document n'est pas une fuite en avant.

Il est utile seulement si on garde cette discipline :

- d'abord reconsolider le centre du moteur,
- ensuite brancher les outils majeurs sur une architecture plus propre,
- pas l'inverse.

Sinon, on ajoutera de nouveaux outils sur un socle encore trop hybride.

## Resume court

Le MJ doit rester libre sur la mise en scene.

Mais certaines grandes mecaniques doivent etre soutenues par des outils dedies.

La bonne architecture est :

- outil = calcul / etat / faits de scene,
- moteur = interpretation situee,
- MJ = narration.

## Statut

- Cadre conceptuel : actif
- A utiliser comme reference avant toute creation d'un nouvel outil narratif majeur
