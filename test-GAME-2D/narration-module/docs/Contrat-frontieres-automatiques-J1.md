# Contrat J1 — étapes automatiques après une action

Statut : `ACTIF — AUDIT TERMINÉ, CORRECTION À IMPLÉMENTER`

## Explication simple

Après certaines actions, le jeu doit laisser les systèmes réagir avant de
rendre la main au joueur. Le code appelle ces moments des « frontières ».

Exemple : après un voyage ou une heure de repos, une intrigue peut avancer, un
événement du monde peut devenir visible, puis un PNJ présent peut décider de
prendre la parole.

Ces réactions ne doivent être exécutées ni deux fois, ni dans le désordre, ni
oubliées.

## Ordre commun attendu

Lorsqu'une action validée a réellement changé la campagne :

```text
résultat du domaine propriétaire
→ cause de bastion éventuelle
→ évolution des intrigues arrivées à échéance
→ événements du monde devenus visibles
→ si le joueur garde la main : initiative locale éventuelle d'un PNJ
→ affichage des résultats dans cet ordre
→ restitution de la main au joueur
```

Une question de lecture, une clarification, un refus avant validation ou une
action sans changement de campagne ne déclenche pas cette chaîne.

## Résultat de l'audit

| Famille de tour | État observé | Attendu |
|---|---|---|
| Ouverture ou reprise | intrigue et monde, puis initiative d'entrée | conserver, mais distinguer une vraie entrée d'un simple rafraîchissement |
| Question ou clarification sans changement | aucune réaction automatique | correct |
| Action ou dialogue sans changement | aucune réaction automatique | correct |
| Action ou dialogue avec changement, sans déplacement | chaîne non centralisée et généralement absente | exécuter seulement si le temps ou une cause pertinente a changé |
| Entrée dans un nouveau lieu | intrigue et monde, puis initiative d'entrée | correct dans l'interface actuelle |
| Avance naturelle du monde | bastion, intrigue et monde, puis initiative locale | correct dans l'interface actuelle |
| Segment de repos | intrigue et monde, puis initiative locale tant que le repos continue | vérifier aussi la fin du repos |
| Résultat d'un test de compétence | affichage du résultat uniquement | décider selon le temps et les effets réellement committés |
| Progression du personnage | pas de chaîne commune | aucune réaction sans temps ; traiter seulement les causes produites |
| Activité ou incident de bastion | méthodes séparées | passer par la chaîne commune lorsqu'un événement committé l'exige |
| Fin d'une séquence tactique | intégration propriétaire, puis réactions surtout lors de la reprise | exécuter une fois après l'intégration, sans attendre un rechargement |

## Problème principal

Les briques existent déjà dans `NarrativeTurnControllerV1`, mais l'interface
les appelle depuis plusieurs parcours différents. Le contrôleur ne possède pas
encore une seule méthode qui décide, depuis le résultat committé, quelles
réactions automatiques sont nécessaires.

Cette dispersion crée trois risques :

- oublier une réaction après une nouvelle famille de tour ;
- exécuter deux fois une réaction lors d'une reprise ;
- afficher les événements dans un ordre différent selon l'écran utilisé.

## Correction autorisée

Ajouter au contrôleur une orchestration unique et typée. Son entrée devra dire :

- quelle opération vient de finir ;
- si elle a produit un commit ;
- si le temps a avancé ;
- si le personnage est entré dans une nouvelle scène ;
- quelles causes committées doivent être transmises au bastion ;
- si le joueur peut encore recevoir une initiative de PNJ.

La méthode ne devra rien déduire du texte affiché. Elle appellera les briques
existantes dans l'ordre commun, rassemblera leurs paquets d'affichage et
retournera une trace indiquant ce qui a été exécuté ou ignoré.

## Règles de sécurité

- Une même opération source produit les mêmes identifiants de rejeu.
- Une chaîne rejouée ne crée aucun second événement ni second affichage.
- L'initiative PNJ n'est évaluée qu'après intrigue et monde, et seulement si
  ces systèmes rendent la main au joueur.
- Un changement de scène utilise `SCENE_ENTRY`; un simple passage du temps
  utilise `LOCAL_TIME_BOUNDARY`.
- Une réponse sans commit et sans temps n'appelle aucune frontière.
- Une erreur d'affichage après commit ne rejoue jamais le résultat métier.

## Gate de correction

La vérification devra couvrir au minimum :

- question sans commit : zéro frontière ;
- dialogue sans effet durable : zéro frontière ;
- action avec temps : intrigue, monde, puis initiative locale ;
- transition : chaîne causale, puis initiative d'entrée ;
- fin de repos : chaîne locale exécutée une fois ;
- intégration tactique : chaîne exécutée une fois ;
- reprise : aucune duplication ;
- interruption par le monde : aucune initiative PNJ ajoutée derrière.
