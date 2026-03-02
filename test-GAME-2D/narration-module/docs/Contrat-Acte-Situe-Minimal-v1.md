# Contrat Acte Situe Minimal v1

## But

Ce document definit la structure minimale d'"acte situe" pour la reprise du noyau narration.

Il ne decrit pas encore l'implementation.

Il fixe un contrat simple pour :

- centraliser la lecture du tour courant,
- sortir de la simple classification globale,
- preparer une vraie resolution de scene,
- sans refondre tout le handler en une seule passe.

## Position dans l'architecture

L'acte situe doit etre calcule :

- apres la lecture du message et du contexte,
- avant les grandes branches de resolution,
- avant le rendu RP.

Il doit servir a relier :

1. ce que le joueur dit maintenant
2. ce qui est deja etabli dans la scene
3. ce que le moteur doit resoudre tout de suite

## Structure minimale retenue

L'acte situe minimal de cette reprise contient les champs suivants :

- `actType`
- `targetKind`
- `targetRef`
- `objectRef`
- `sceneLink`
- `engagement`
- `expectedNextStep`
- `resolutionMode`

## Definition de chaque champ

### 1. `actType`

#### Role

Decrire l'acte concret tente par le joueur au tour courant.

#### Exemples attendus

- `observe`
- `move_near`
- `move_far`
- `enter`
- `greet`
- `ask`
- `choose`
- `refuse`
- `wait`
- `leave`
- `inspect`
- `attempt`

#### Regle

`actType` doit rester plus proche d'une action de scene que d'une categorie technique.

On ne veut pas ici :

- `story_action`
- `social_action`
- `free_exploration`

Ces categories globales peuvent encore exister ailleurs,
mais elles ne suffisent pas comme acte situe.

### 2. `targetKind`

#### Role

Decrire la nature de la cible la plus probable de l'acte.

#### Exemples attendus

- `location`
- `poi`
- `interlocutor`
- `group`
- `item`
- `information`
- `direction`
- `event_interest`
- `none`

#### Regle

Ce champ ne dit pas encore "qui exactement".

Il dit :

- quel type de chose est vise.

### 3. `targetRef`

#### Role

Identifier la cible probable la plus concrete du tour, si elle est retrouvable.

#### Exemples attendus

- `Rue marchande`
- `annexe de copie`
- `scribe d'accueil`
- `marchande`
- `quartier des artisans`
- `point d'interet : convoi de gardes`

#### Regle

Ce champ peut rester vide si la cible n'est pas assez claire.

Il ne doit pas forcer une cible artificielle.

### 4. `objectRef`

#### Role

Decrire l'objet concret de la demande ou de l'action.

C'est ce que le joueur vise dans la cible,
pas forcement la cible elle-meme.

#### Exemples attendus

- `une tenue`
- `la tunique d'etude`
- `un registre public recent`
- `le prix`
- `la provenance de l'article`
- `l'apparence du scribe`

#### Regle

`targetRef` et `objectRef` peuvent etre differents.

Exemple :

- cible : `marchande`
- objet : `le prix de la tunique`

### 5. `sceneLink`

#### Role

Decrire le lien du tour courant avec ce qui precede.

C'est un champ central pour eviter de traiter chaque message comme isole.

#### Valeurs minimales retenues

- `new_topic`
- `continuation`
- `confirmation`
- `selection`
- `precision`
- `relance`
- `refusal`
- `correction`

#### Definition des valeurs

##### `new_topic`

Le joueur ouvre un nouveau point dans la scene.

##### `continuation`

Le joueur poursuit clairement le fil immediat deja etabli.

##### `confirmation`

Le joueur valide une proposition ou une action en attente.

##### `selection`

Le joueur choisit explicitement parmi des elements deja presentes.

##### `precision`

Le joueur resserre ou precise une demande deja engagee.

##### `relance`

Le joueur fait avancer un echange sans ajouter encore une precision forte.

##### `refusal`

Le joueur refuse, renonce ou coupe une voie ouverte.

##### `correction`

Le joueur reajuste ou corrige une cible / intention precedente.

### 6. `engagement`

#### Role

Conserver le niveau d'engagement du message,
mais en tant qu'indice de lecture et non comme verdict final de resolution.

#### Valeurs minimales retenues

- `informatif`
- `hypothetique`
- `declaratif`
- `volitif`
- `unknown`

#### Regle

Ce champ ne doit plus decider seul la reponse.

Il sert a nuancer l'acte situe.

Exemple :

- `je cherche une tenue pour l'ecole de magie`

peut rester `informatif`,
mais l'acte situe reste exploitable.

### 7. `expectedNextStep`

#### Role

Decrire la prochaine resolution logique si rien ne bloque.

#### Exemples attendus

- `decrire les environs`
- `presenter une direction`
- `confirmer le deplacement`
- `faire repondre l'interlocuteur`
- `presenter des options deja coherentes`
- `demander une precision sur la cible`
- `opposer une limite credible`

#### Regle

Ce champ ne decrit pas encore le texte final.

Il decrit ce que le moteur doit resoudre maintenant.

### 8. `resolutionMode`

#### Role

Indiquer dans quel regime de resolution le tour doit partir.

#### Valeurs minimales retenues

- `local_free`
- `tool_family`
- `unclear`

#### Definition des valeurs

##### `local_free`

Le noyau peut resoudre ce tour avec :

- les ancres,
- le lore,
- une resolution locale simple,
- sans mecanique lourde outillee.

##### `tool_family`

Le tour releve d'une famille de mecanique qui devra etre soutenue par un outil dedie.

Exemples futurs :

- voyage
- repos
- compagnons
- perception sociale / statut

##### `unclear`

Le noyau ne peut pas encore trancher proprement.

Ce cas permet :

- soit une clarification,
- soit un fallback transitoire,
- sans pretendre qu'une vraie lecture situee est deja acquise.

## Ce qui peut etre calcule tout de suite avec l'existant

Sans refondre tout le moteur, on peut deja calculer une premiere version de :

- `actType`
- `targetKind`
- `targetRef` partiel
- `objectRef` partiel
- `sceneLink`
- `engagement`
- `expectedNextStep` simple
- `resolutionMode` sur un premier tronc

### Sources reutilisables

- `classifyNarrationIntent(...)`
- `extractVisitIntent(...)`
- `extractLocateIntent(...)`
- `narrationCommitmentPolicy.js`
- `sceneFrame`
- `activeInterlocutor`
- `lastSceneFact`
- `lastPlayerFocus`
- `lastPresentedItems`
- etat des actions / deplacements en attente

## Ce qui restera encore heuristique au debut

Cette premiere version ne sera pas "pure" des le premier branchement.

Les points suivants resteront encore des appuis heuristiques transitoires :

### 1. Derivation de `actType`

Une partie viendra encore :

- des extracteurs existants,
- de cues lexicaux deja en place.

### 2. Derivation de `sceneLink`

Au debut, `confirmation`, `selection` et `precision` dependront encore en partie :

- des ancres disponibles,
- de formes reconnues,
- de l'existant du handler.

### 3. Derivation de `resolutionMode`

Au debut, `tool_family` ne couvrira pas encore de vraies familles actives hors commerce.

Il servira surtout a :

- marquer les cas qui ne doivent plus etre traites comme de simples resolutions libres.

## Regles de discipline

### 1. Pas de texte dans l'acte situe

L'acte situe ne doit pas embarquer de prose RP.

Il decrit la lecture et la direction de resolution, pas la reponse.

### 2. Pas de logique de rendu deduite directement ici

On ne doit pas inferer :

- des phrases,
- des blocs de reponse,
- des options UI

dans cette couche.

### 3. Pas de surprecision artificielle

Si une cible n'est pas claire :

- on laisse un champ vide,
- ou on marque `unclear`,

plutot que de forcer une interpretation fausse.

## Exemples de lecture attendue

### Exemple 1

Message :

`que puis-je voir autour de moi ?`

Lecture attendue :

- `actType = observe`
- `targetKind = location`
- `targetRef = activeLocation`
- `objectRef = environs immediats`
- `sceneLink = continuation` ou `new_topic` selon contexte
- `engagement = informatif`
- `expectedNextStep = decrire les environs`
- `resolutionMode = local_free`

### Exemple 2

Message :

`c'est ou, le quartier des artisans ?`

Lecture attendue :

- `actType = ask`
- `targetKind = direction`
- `targetRef = quartier des artisans`
- `objectRef = orientation`
- `sceneLink = new_topic`
- `engagement = informatif`
- `expectedNextStep = presenter une direction`
- `resolutionMode = local_free`

### Exemple 3

Message :

`j'y vais`

Avec une proposition de trajet active

Lecture attendue :

- `actType = move_near` ou `move_far` selon la proposition
- `targetKind = location`
- `targetRef = destination en attente`
- `objectRef = trajet propose`
- `sceneLink = confirmation`
- `engagement = declaratif`
- `expectedNextStep = confirmer le deplacement`
- `resolutionMode = local_free`

### Exemple 4

Message :

`je choisis la tunique d'etude`

Avec une offre deja presente

Lecture attendue :

- `actType = choose`
- `targetKind = item`
- `targetRef = la tunique d'etude`
- `objectRef = article presente`
- `sceneLink = selection`
- `engagement = declaratif`
- `expectedNextStep = confirmer le choix et avancer localement`
- `resolutionMode = local_free`

### Exemple 5

Message :

`je veux rejoindre le quartier du port, meme si c'est loin`

Lecture attendue :

- `actType = move_far`
- `targetKind = location`
- `targetRef = quartier du port`
- `objectRef = deplacement inter-zone`
- `sceneLink = new_topic`
- `engagement = volitif`
- `expectedNextStep = basculer vers une resolution de voyage`
- `resolutionMode = tool_family`

## Ce que ce contrat permet

Ce contrat est assez petit pour :

- etre branche sans tout reecrire,
- donner enfin une lecture centrale du tour,
- laisser l'existant survivre provisoirement,
- mais en le rebranchant progressivement sur un centre plus propre.

## Statut

- Contrat minimal defini : actif
- Base de travail immediate pour la Phase 3
