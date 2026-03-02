# Contrat Decision Regime Resolution v1

## But

Ce document fixe la decision minimale de regime de resolution pour le noyau narration.

Il prolonge :

- [Contrat-Acte-Situe-Minimal-v1.md](c:/Users/Utilisateur/Desktop/JDR5e-AppWebb/test-GAME-2D/narration-module/docs/Contrat-Acte-Situe-Minimal-v1.md)

L'objectif est simple :

- le noyau doit pouvoir dire dans quel regime il traite le tour,
- sans encore modifier tout le moteur,
- et sans faire apparaitre cette decision dans la narration RP.

## Principe

La decision de regime de resolution se fait apres le calcul de l'acte situe.

Elle ne remplace pas l'acte situe.

Elle en est une lecture operationnelle.

## Structure minimale

La decision minimale contient :

- `mode`
- `toolFamily`
- `reason`

## Definition des champs

### 1. `mode`

Valeurs minimales retenues :

- `local_free`
- `tool_family`
- `unclear`

Ce champ indique le regime global de traitement du tour.

### 2. `toolFamily`

Valeurs minimales retenues au depart :

- `travel`
- `rest`
- `companions`
- `social_perception`
- `generic_heavy`
- `none`

Ce champ ne sert que si `mode = tool_family`.

Au debut, il reste un marquage de debug et de pilotage.

Il ne force pas encore une vraie delegation systematique.

### 3. `reason`

Ce champ explique pourquoi le noyau a choisi ce regime.

Exemples :

- `situated-act:move_far`
- `situated-act:rest-cue`
- `situated-act:companions-cue`
- `situated-act:missing-target`
- `situated-act:local-default`

## Regle de calcul minimale

### Cas 1 - Resolution locale libre

Le noyau choisit `local_free` si :

- le tour reste dans une scene lisible,
- aucune mecanique lourde n'est requise,
- les ancres et la resolution locale suffisent.

Exemples :

- observation
- orientation simple
- deplacement proche
- dialogue simple
- selection d'un element deja presente

### Cas 2 - Famille outillee

Le noyau choisit `tool_family` si :

- la situation releve d'une mecanique lourde,
- ou si le moteur detecte un cas qui ne doit plus etre traite comme simple resolution libre.

Exemples initiaux :

- voyage
- repos
- compagnons
- perception sociale / statut

### Cas 3 - Incertain

Le noyau choisit `unclear` si :

- la cible n'est pas assez stable,
- l'acte reste trop flou,
- ou si la scene ne permet pas encore une resolution propre.

Ce mode autorise :

- clarification,
- ou fallback transitoire,
- sans faire semblant qu'une vraie decision stable existe deja.

## Usage actuel

Dans cette phase, la decision de regime sert surtout a :

- rendre le noyau lisible,
- verifier le bon classement en debug,
- preparer le futur rebranchement des branches de resolution.

Elle ne doit pas encore :

- reordonner massivement le handler,
- ni introduire un nouveau flux de sortie RP.

## Statut

- Contrat minimal defini : actif
- Base immediate de travail pour la phase 4
