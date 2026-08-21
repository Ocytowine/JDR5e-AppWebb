# Contrat J1 — étapes automatiques après une action

Statut : `LIVRÉ — PARCOURS MIGRÉS ET REJEU CERTIFIÉ`

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

## Problème corrigé

Les briques existaient déjà dans `NarrativeTurnControllerV1`, mais l'interface
les appelait depuis plusieurs parcours différents. Le contrôleur possède
maintenant une seule méthode qui décide, depuis le résultat committé, quelles
réactions automatiques sont nécessaires.

La correction ferme les trois risques relevés :

- oublier une réaction après une nouvelle famille de tour ;
- exécuter deux fois une réaction lors d'une reprise ;
- afficher les événements dans un ordre différent selon l'écran utilisé.

## Correction appliquée

Le contrôleur expose une orchestration unique et typée. Son entrée indique :

- quelle opération vient de finir ;
- si elle a produit un commit ;
- si le temps a avancé ;
- si le personnage est entré dans une nouvelle scène ;
- quelles causes committées doivent être transmises au bastion ;
- si le joueur peut encore recevoir une initiative de PNJ.

La méthode ne déduit rien du texte affiché. Elle appelle les briques existantes
dans l'ordre commun, rassemble leurs paquets d'affichage et retourne une trace
indiquant ce qui a été exécuté ou ignoré.

## Avancement de la correction

`NarrativeTurnControllerV1.processAutomaticBoundaries` est maintenant le point
de passage commun. Il :

- refuse de lancer une réaction annoncée sans commit ;
- appelle les causes de bastion avant les intrigues et le monde ;
- ignore explicitement cette branche lorsqu'aucun système de bastion n'est
  actif dans la campagne, sans empêcher les autres réactions ;
- n'appelle l'initiative PNJ que si le monde rend la main ;
- distingue entrée de scène et passage du temps ;
- retourne les paquets d'affichage dans leur ordre et une trace explicite.

Les parcours d'avance naturelle du monde, de transition de scène, de repos,
d'intégration tactique et de reprise utilisent désormais cette méthode. Le
repos conserve l'initiative locale entre ses segments actifs ; à sa fin ou lors
d'une interruption, il laisse les intrigues et le monde réagir sans relancer
une initiative de repos. Une issue tactique fait réagir le monde dès son
intégration, sans attendre un rechargement. La reprise réutilise le même ordre
et les mêmes identifiants stables, sans second affichage.

## Règles de sécurité

- Une même opération source produit les mêmes identifiants de rejeu.
- Une chaîne rejouée ne crée aucun second événement ni second affichage.
- L'initiative PNJ n'est évaluée qu'après intrigue et monde, et seulement si
  ces systèmes rendent la main au joueur.
- Un changement de scène utilise `SCENE_ENTRY`; un simple passage du temps
  utilise `LOCAL_TIME_BOUNDARY`.
- Une réponse sans commit et sans temps n'appelle aucune frontière.
- Une erreur d'affichage après commit ne rejoue jamais le résultat métier.

## Gate de correction livrée

La vérification couvre :

- question sans commit : zéro frontière ;
- dialogue sans effet durable : zéro frontière ;
- action avec temps : intrigue, monde, puis initiative locale ;
- transition : chaîne causale, puis initiative d'entrée ;
- fin de repos : chaîne locale exécutée une fois ;
- intégration tactique : chaîne exécutée une fois ;
- reprise : aucune duplication ;
- interruption par le monde : aucune initiative PNJ ajoutée derrière.

La recette navigateur `world-event-ui` ajoute une preuve de bout en bout : une
heure est exécutée par le vrai moteur de simulation, un signal qu'il produit
naturellement est raconté sans ses identifiants privés, puis reste unique après
rechargement et rejeu de la même demande.
