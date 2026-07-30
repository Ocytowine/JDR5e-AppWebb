# Guide de la simulation du monde en campagne — lot 9E

## À quoi sert ce raccord ?

La carte possédait déjà un moteur capable de faire évoluer les factions,
pressions, objectifs et acteurs mobiles. Avant le lot 9E, les boutons de la
vue React faisaient toutefois avancer une copie locale : recharger la page
effaçait cette avance et la narration ne pouvait pas s'y fier.

En campagne joueur, la chaîne est maintenant :

```text
bouton +1 h ou +6 h
→ demande adressée au runtime de campagne
→ simulation calculée depuis le dernier état committé
→ horloge + curseur + état du monde committés ensemble
→ événements autoritaires filtrés pour la scène active
→ conséquence perceptible ajoutée au fil narratif
```

La vue React affiche donc le résultat ; elle n'en est plus l'autorité.

## Exemple simple

La campagne est à `00:00:08` et le monde a été simulé jusqu'à `00:00:00`.
Le joueur demande `+1 h` :

- l'horloge de campagne passe à `01:00:08` ;
- le moteur traite la frontière entière de `01:00:00` ;
- le curseur monde devient `01:00:00` ;
- les huit secondes restantes ne sont pas perdues.

L'ensemble est écrit par un seul commit. Une panne ne peut donc pas laisser
l'heure avancée avec un monde resté en arrière.

## Ce que le joueur voit

Après l'ouverture d'une campagne réelle, l'onglet **Monde** apparaît dans la
navigation principale. Dans **Simulation**, les boutons `+1 h` et `+6 h`
font une avance persistante. Le reset et l'édition disparaissent dans ce mode,
car ils créeraient une seconde version du monde.

Un signal n'est raconté que s'il concerne la localisation de la scène active.
Par exemple, un signal militaire à `city:lysenthe` peut devenir une courte
observation narrative si la scène se trouve dans la chaîne géographique de
Lysenthe. Les événements internes, les calculs de pression et les changements
éloignés restent cachés.

La carte installée actuelle est encore le bac de simulation de Valmorin. Le
raccord de 9E est opérationnel, mais son contenu ne garantit donc pas qu'un
signal local soit produit aux Archives de Lysenthe à chaque avance. Le lot 9F
prépare et certifie une recette complète reproductible depuis le build.

## Refus protecteurs

- une durée autre qu'un nombre entier de `1` à `24` heures est refusée ;
- un effet planifié appartenant à un autre runtime bloque l'avance au lieu
  d'être résolu par la carte ;
- une campagne ancienne déjà avancée mais dépourvue d'état monde n'est pas
  initialisée rétroactivement avec une fausse origine ;
- rejouer la même identité de demande restitue le même résultat sans second
  commit.

Une campagne existante encore à la seconde zéro peut initialiser son état monde
au premier accès à l'onglet.

## Vérifications

Depuis `test-GAME-2D/` :

```bash
npm run narration-module:test:campaign-world-simulation
npm run narration-module:test:time:map-adapter
npm run narration-module:test:world-scene-events
npm run build
```

Le premier test prouve l'initialisation, le commit atomique, la restauration et
l'idempotence. Les deux suivants protègent respectivement l'adaptateur du moteur
de carte et la frontière qui ne révèle que les signaux perceptibles.

## Ce que 9E ne prétend pas résoudre

Le raccord n'ajoute pas artificiellement un raid, un bastion ou une intrigue
aux Archives. Il ne termine pas non plus la calibration du moteur de monde.
Le lot 9F reste responsable de la certification navigateur du parcours réel et
de sa recette manuelle française.
