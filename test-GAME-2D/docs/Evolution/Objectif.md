# Objectif du projet (version figée de référence)

## Vision
Créer un jeu de rôle narratif orienté solo (avec variante coop possible), où la narration est le coeur de l’expérience et où le module tactique 2D sert de résolution des situations d’action.

## Proposition de valeur
- Narration dynamique guidée par un maître de jeu IA.
- Univers et progression portés par classes, sous-classes, items et sorts utilisables autant en narration qu’en tactique.
- Système cohérent: les choix narratifs influencent les états de jeu, et les résultats tactiques réinjectent des conséquences dans l’histoire.

## Piliers produit (ordre de priorité)
1. Narration/scénarisation (coeur produit)
2. Mémoire (continuité des événements, personnages, quêtes, conséquences)
3. Orchestration IA MJ (guidage, arbitrage, adaptation)
4. Moteur d’action tactique/pipeline (secondaire mais critique techniquement), incluant la gestion de topologie verticale (altitude/niveaux/vol)

## Portée MVP réaliste
- Boucle narrative jouable de bout en bout sur un mini-scenario.
- État narratif persistant minimal (personnages, quêtes, décisions, flags).
- Intégration IA MJ encadrée (prompts, sorties structurées, garde-fous).
- Pont narration → action tactique → retour narration.
- Build local reproductible et documentation de reprise à jour.

## Hors périmètre immédiat
- Coop réseau complet en temps réel.
- Génération IA totalement autonome sans contrôle produit.
- Interface d’édition lourde tant que la boucle coeur n’est pas stabilisée.

## Critères de réussite
- Un scénario court est jouable du début à la fin sans rupture de continuité.
- Les données de contenu (classes/items/sorts) ont un usage clair en narration et en tactique.
- Le MJ IA produit des sorties exploitables par le moteur (format structuré stable).
- Reprise du projet possible en moins de 10 minutes via les docs Evolution.

## Contraintes de pilotage
- Toute idée doit préciser sa valeur narrative avant sa valeur technique.
- Toute décision technique structurante est tracée dans `Choix-techno.md`.
- Toute nouvelle mécanique doit indiquer son impact sur mémoire, narration et tactique.

## Jalon en cours (à mettre à jour)
- Jalon: Boucle coeur narration + mémoire + intégration IA MJ (première version stable).
- Définition de terminé:
  - Build OK
  - Mini-scenario narratif complet jouable
  - Hand-off narration ↔ tactique fonctionnel sur au moins 1 cas
  - Documentation d’avancement tenue à jour

