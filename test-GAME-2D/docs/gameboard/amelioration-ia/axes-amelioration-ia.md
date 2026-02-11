# Ameliorations IA - Axes Proposes

Ce document decrit des axes d'amelioration concrets pour l'IA ennemie du GameBoard.
Il s'appuie sur les docs actuelles (boucle de combat, IA/reactions, architecture) et vise
un gain progressif sans refonte totale.

## 1) Decouplage et architecture
Objectif: rendre l'IA testable, evolutive et moins liee a `GameBoard`.

Actions proposees:
- Extraire un module `aiEngine` (pure functions) qui orchestre: resume -> intents -> resolution -> fallback.
- Limiter `GameBoard` a un role d'assemblage (I/O, rendu, hooks, UI).
- Exposer une interface stable `AiContext` (etat minimal, RNG, acces aux catalogues, queries de vision/path).
- Ajouter des tests unitaires sur `aiEngine` (scenarios deterministes).

Valeur immediate:
- Moins de regressions, iteration plus rapide sur l'IA.

## 2) Enrichir les evenements de reactions
Objectif: faire emerger des comportements tactiques avec un cout minimal.

Ajouts d'evenements (exemples):
- `damage.taken` (seuil PV, type degats, source).
- `ally.downed` (effet moral / repli / focus).
- `buff.applied` / `debuff.applied` (prioriser dispel, focus cible debuff).
- `cover.lost` / `cover.gained` (repositionnement defensif).
- `line_of_sight.lost` (recherche, contournement, action de reveal).
- `summon.appeared` (re-evaluation des menaces).

Valeur immediate:
- Reactions plus riches sans modifier le coeur des actions.

## 3) Ameliorer la boucle de decision tactique
Objectif: passer d'un fallback basique a une evaluation multicritere.

Actions proposees:
- Scoring d'actions base sur: probabilite de toucher, degats attendus, risque, position, couverture.
- Penalites pour les actions echouees recentes (memoire: `lastFailedReason`).
- Bonus pour les actions efficaces (`lastEffectiveActionId`).
- Parametres de profil par type d'ennemi (aggressif, prudent, soutien).

Valeur immediate:
- Decisions plus coherentes et lisibles pour le joueur.

## 4) Memoire et croyances (fog of war)
Objectif: stabiliser le comportement dans le brouillard de guerre.

Actions proposees:
- Maintenir une position estimee par cible avec decroissance de confiance.
- Partage d'alertes equipe avec TTL (expiration des alertes).
- Fuzz adaptatif: plus d'incertitude si l'ennemi n'a pas eu de vision recente.

Valeur immediate:
- IA moins "omnisciente", plus credible.

## 5) Planification legere (action plan)
Objectif: exploiter `actionPlan` sans complexite type behavior tree complet.

Actions proposees:
- Plans a 2 temps: 1) se mettre en position 2) executer action prioritaire.
- Plan annulable si vision change ou opportunite meilleure.
- Historique du plan pour debug (trace courte).

Valeur immediate:
- Moins d'errances, IA plus intentionnelle.

## 6) Observabilite et outils d'iteration
Objectif: rendre l'IA facile a diagnostiquer.

Actions proposees:
- Etendre `aiLastState` avec score des actions candidates.
- Ajouter un toggle "IA debug overlay" (affiche cible, plan, score, raison du choix).
- Journaliser les raisons d'echec (path impossible, action invalide, cible hors portee).

Valeur immediate:
- Correction plus rapide des comportements indésirables.

## 7) Integration narration et feedback joueur
Objectif: relier les decisions IA a une narration claire.

Actions proposees:
- Gabarits de phrases bases sur les raisons du choix (focus, repli, opportunisme).
- Marqueurs visuels (icones) lors de decisions clés (retraite, focus).

Valeur immediate:
- Joueur comprend "pourquoi" l'ennemi agit ainsi.

## Priorisation proposee
Court terme (1-2 sprints):
- Evenements de reactions additionnels.
- Scoring multi-criteres.
- Debug overlay minimal.

Moyen terme (3-4 sprints):
- Decouplage `aiEngine`.
- Memoire avec confiance/TTL.

Long terme:
- Planification legere 2 temps.
- Integration narration avancee.

## Definition de fini (checklist)
- IA deterministe en mode debug avec seed fixe.
- Tests unitaires sur 5 scenarios majeurs.
- Logs clairs: intent -> action -> resultat -> raison.
- Aucun comportement "bloquant" (tour vide ou boucle).
