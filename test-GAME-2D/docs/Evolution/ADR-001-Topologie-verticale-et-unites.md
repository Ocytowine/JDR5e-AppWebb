# ADR-001 — Topologie verticale, unités métriques et règles de chute

- Date: 2026-02-23
- Statut: Acceptée
- Portée: moteur tactique, génération de map, perception, IA MJ, narration tactique

## Contexte
Le projet vise une expérience narrativo-tactique où:
- la grille tactique est hexagonale en XY,
- la verticalité (relief, bâtiments multi-niveaux, sous-sols, vol) est structurante,
- les systèmes de perception (Cas 001) et de navigation doivent rester data-driven.

Constat actuel:
- le runtime dispose d’une base `mapHeight`/`activeLevel`,
- mais la génération standard reste aplatie à niveau 0,
- les futures mécaniques (ouïe verticale, vol, transitions bâtiment) exigent un modèle topologique plus explicite.

## Décision
Nous adoptons les conventions suivantes:

1. **Unité unique**
- Toutes les distances horizontales, verticales et de portée sont exprimées en **mètres**.

2. **Topologie verticale native**
- Le moteur conserve une grille hex en XY.
- La verticalité est modélisée par une couche topologique explicite (niveaux, altitude, connecteurs).

3. **Hauteur d’étage MVP**
- Hauteur standard d’un étage: **3 m**.
- Cette valeur est surchargeable par les patterns de bâtiments.

4. **Vol MVP**
- Altitude de vol maximale en MVP: **30 m**.

5. **Chute (règle officielle DnD 5e)**
- Dégâts de chute: **1d6 contondants par 10 ft chutés, max 20d6**.
- Conversion moteur métrique: `dice = min(20, floor(distanceM / 3.048))`.
- Effet par défaut: état `prone` à l’atterrissage (sauf exception de règle).

6. **Transitions verticales data-driven**
- Les passages entre niveaux passent par des connecteurs (`ladder`, `stairs`, `climb`, `jump`, `drop`, `ramp`) ou règles spécifiques de vol/saut.

## Alternatives envisagées

### A. Rester en 2D plate + hacks ponctuels
- Avantage: implémentation rapide.
- Inconvénients: incohérences croissantes (LOS, perception, IA), dette technique forte.
- Décision: rejetée.

### B. Utiliser des unités mixtes (mètres + cases + feet)
- Avantage: compatibilité directe avec certaines règles papier.
- Inconvénients: ambiguïtés de conversion et bugs récurrents.
- Décision: rejetée.

### C. Approximer la chute à 3 m = 1d6
- Avantage: simplicité.
- Inconvénients: écart avec la règle officielle demandée.
- Décision: rejetée.

## Conséquences positives
- Cohérence systémique entre pathfinding, perception, combat et narration.
- Base robuste pour bâtiments multi-niveaux, sous-sols et vol.
- Réduction des ambiguïtés d’unités et meilleure traçabilité des calculs.

## Trade-offs acceptés
- Complexité initiale plus élevée sur le modèle runtime.
- Nécessité d’introduire des services topologiques dédiés.
- Besoin d’une migration progressive des modules existants.

## Actions de suivi
1. Implémenter les tickets Cas 002 Phase A/B (`T201` à `T208`).
2. Réaligner Cas 001 perception sur le modèle topologique Cas 002.
3. Ajouter des tests unitaires de conversion mètre/feet pour chute.
4. Ajouter des scénarios QA: bâtiment multi-niveaux, sous-sol, vol à 30 m.

## Références
- `docs/Evolution/Cas-002-Topologie-Altitude-Niveaux.md`
- `docs/Evolution/Cas-002-Tickets-Phase-A-B.md`
- `docs/Evolution/Cas-001-Sens-data-driven.md`
