# Cadrage I-06ZE - Resolution IA des referents locaux recents

Date : 2026-07-10

Statut : `CADRE`

## Objectif

Permettre au module narration de comprendre une action courte qui reprend un referent recent du joueur, sans coder de regles metier specifiques.

Cas declencheur observe :

```text
Je me dirige vers la porte du fond
je l'ouvre
```

Le probleme n'est pas la porte du fond en elle-meme. Le probleme est que la deuxieme entree est traitee comme une phrase isolee alors que le fil visible donne un referent recent probable.

I-06ZE doit donc ajouter une continuite locale de referent interpretee par IA et validee par contrat.

## Principe non negociable

Ce lot ne doit pas introduire de hard code de type :

- si texte contient `porte`, alors cible = porte du fond ;
- si texte contient `ouvrir`, alors ouvrir la porte du fond ;
- si phrase precedente contient tel mot, alors appliquer telle consequence.

La comprehension du referent appartient au role IA `player_intent_interpreter`.

Le code doit seulement :

- fournir un contexte court et borne ;
- valider que le referent propose existe dans la scene visible ;
- valider que le referent est unique et compatible avec l'action ;
- rejeter ou demander clarification si la proposition n'est pas sure ;
- empecher toute consequence durable, secret, saut de scene ou revelation non autorisee.

## Position dans le pipeline

Pipeline cible :

```text
entree joueur brute
-> contexte scene visible + derniers focus locaux
-> player_intent_interpreter
-> proposition intention + resolution de referent
-> validation locale stricte
-> resolution bornee existante ou clarification
-> scene_writer uniquement pour le rendu autorise
```

`scene_writer` ne doit pas resoudre le referent. Il peut seulement narrer une sortie deja autorisee.

## Contexte court autorise

Le paquet envoye a `player_intent_interpreter` peut contenir :

- les derniers inputs joueur visibles, tronques ;
- les dernieres intentions structurees acceptees ;
- les cibles visibles recemment mises en avant ;
- les points d'interet visibles de la scene ;
- les PNJ visibles de la scene ;
- les restrictions d'autorite.

Il ne doit pas contenir :

- secrets MJ ;
- etat tactique non autorise ;
- inventaire non necessaire ;
- pensees internes PNJ non revelees ;
- historique long ou resume narratif global.

## Sortie cible ajoutee

Le contrat `ai-intent-interpretation/1` peut etre etendu par un champ optionnel `referentResolution`.

Exemple :

```json
{
  "intentType": "action",
  "commitment": "committed",
  "target": {
    "kind": "object",
    "ref": "poi:back-room-door",
    "label": "porte du fond"
  },
  "action": "open",
  "coreMeaning": "Le personnage veut ouvrir la porte du fond mentionnee juste avant.",
  "referentResolution": {
    "schemaVersion": 1,
    "usedPreviousContext": true,
    "referentSource": "recent_focus",
    "resolvedRef": "poi:back-room-door",
    "resolvedLabel": "porte du fond",
    "evidence": [
      "Entree precedente: Je me dirige vers la porte du fond",
      "Entree actuelle: je l'ouvre"
    ],
    "ambiguity": "none",
    "confidence": "high"
  }
}
```

Le champ est une proposition IA. Il n'est pas une autorisation de commit.

## Validation locale requise

La proposition est rejetee ou transformee en clarification si :

- `resolvedRef` ne correspond pas a une entite visible ou a un point d'interet visible de la scene ;
- plusieurs referents recents sont plausibles ;
- l'action proposee est incompatible avec le type de referent ;
- `confidence` est inferieur a `high` pour une action engagee ;
- `ambiguity` n'est pas `none` ;
- la proposition ajoute un fait non fourni ;
- la proposition revele ce qu'il y a derriere un obstacle ;
- la proposition implique une consequence durable non autorisee.

## Comportements attendus

### Cas accepte

```text
Je me dirige vers la porte du fond
je l'ouvre
```

Attendu :

- l'IA propose `target.ref = poi:back-room-door` ;
- `referentResolution.usedPreviousContext = true` ;
- le code valide que la porte du fond est visible et unique ;
- le systeme peut produire une resolution bornee ;
- aucune revelation automatique derriere la porte.

### Cas clarification par incompatibilite

```text
Je regarde la serveuse
je l'ouvre
```

Attendu :

- l'IA peut signaler que le pronom reprend probablement la serveuse ;
- le code rejette car `open` est incompatible avec une personne ;
- clarification.

### Cas clarification par ambiguite

```text
Je regarde la porte et le gobelet
je l'ouvre
```

Attendu :

- referents concurrents ;
- clarification.

### Cas sans contexte suffisant

```text
je l'ouvre
```

Attendu :

- pas de referent recent fiable ;
- clarification.

## Resolution bornee de la porte

Si la cible `porte du fond` est validee, I-06ZE peut autoriser une resolution minimale :

- le personnage tente d'ouvrir ou entrouvre la porte ;
- les PNJ visibles reagissent par attitude observable ;
- aucune information secrete ou nouvelle scene derriere la porte n'est revelee ;
- aucun temps tactique, combat, repos ou handoff n'est declenche.

Tout passage vers une nouvelle scene, revelation ou consequence durable devra etre un lot separe.

## Hors perimetre

- Pas de `mj_planner`.
- Pas d'intrigue dynamique.
- Pas de changement de scene complet.
- Pas de tactique.
- Pas de generation de contenu derriere la porte.
- Pas de memoire longue.
- Pas de listes lexicales extensives pour deviner les pronoms.

## Preuves attendues

Le lot devra ajouter ou renforcer des tests sur :

- interpretation IA/fake de referent local recent ;
- rejet d'un referent invisible ;
- rejet d'une action incompatible avec le referent ;
- clarification si ambiguite ;
- resolution bornee sans secret pour un point d'interet visible ;
- absence de hard code special `porte du fond` dans la logique generique.

Commandes probables :

```powershell
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-resolution
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:narrative-app-surface
npm run narration-module:build
```

## Decision de suite

I-06ZE est le prochain micro-lot recommande.

Il doit corriger la continuite locale observee sans remplacer l'IA par des conditions codees. Le code reste arbitre et validateur, pas interprete principal.
