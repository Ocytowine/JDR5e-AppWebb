# Axes technologiques (décisions structurées)

But: choisir des orientations techniques durables pour éviter les revirements coûteux.

## Principes directeurs
- Prioriser la valeur narrative avant la complexité technique.
- Séparer clairement narration, mémoire, IA et tactique.
- Éviter toute intégration IA non observable (logs + sorties structurées obligatoires).
- Préférer des contrats de données stables aux comportements implicites.

## Matrice de décision

### Axe 1 — Architecture narrative (priorité critique)
- Option A: narration dispersée dans l’UI et les scripts
- Option B: `Narrative Engine` central (état narratif + règles d’orchestration)
- Choix visé: **B**
- Pourquoi: garantit la cohérence et facilite l’évolution scénaristique.
- Risque: demande une modélisation initiale sérieuse.

### Axe 2 — Mémoire de jeu (priorité critique)
- Option A: historique brut peu structuré
- Option B: mémoire multi-couches (session, aventure, monde) avec règles de rétention
- Choix visé: **B**
- Pourquoi: continuité forte sans explosion de contexte.
- Risque: stratégie de synthèse à calibrer.

### Axe 3 — Intégration IA MJ (priorité critique)
- Option A: réponses textuelles libres
- Option B: orchestration outillée avec schémas de sortie (`intent`, `effects`, `choices`, `narration`)
- Choix visé: **B**
- Pourquoi: rend l’IA exploitable par le moteur et testable.
- Risque: design de prompts et contrats à itérer.

### Axe 4 — Pipeline tactique (priorité haute, coeur technique secondaire)
- Option A: règles tactiques isolées du narratif
- Option B: pipeline tactique branché sur les états narratifs et retours de conséquences
- Choix visé: **B**
- Pourquoi: cohérence produit et originalité du jeu.
- Risque: interface de hand-off à bien définir.

### Axe 5 — Observabilité et fiabilité (priorité haute)
- Option A: debug ponctuel manuel
- Option B: journal d’événements, traces des décisions IA, replay minimal
- Choix visé: **B**
- Pourquoi: indispensable pour corriger des bugs narratifs complexes.
- Risque: surcoût initial d’instrumentation.

### Axe 6 — Topologie verticale et altitude (priorité critique)
- Option A: grille 2D plate avec hacks ponctuels
- Option B: modèle topologique vertical natif (altitude en mètres, niveaux, connecteurs, vol)
- Choix visé: **B**
- Pourquoi: prérequis pour bâtiments multi-niveaux, sous-sols, sens verticaux et combat aérien.
- Risque: complexification du pathfinding/LOS, à amortir par implémentation par phases.

### Axe 7 — Modèle acteur unifié (priorité critique)
- Option A: schémas distincts joueur/ennemi avec mappings ad hoc
- Option B: schéma canonique `ActorSheet` + normaliseurs de compatibilité
- Choix visé: **B**
- Pourquoi: rend les entités interchangeables (joueur/IA) et réduit la dette de transformation.
- Risque: migration progressive à orchestrer pour éviter les régressions.

## Décisions actées
- [x] Décision 001: ADR-001 — Topologie verticale, unité mètre, étage 3 m, vol 30 m, chute DnD officielle.
- [ ] Décision 002:
- [ ] Décision 003:

## Template de décision (ADR léger)
### DEC-XXX — <titre>
- Date:
- Contexte:
- Décision:
- Alternatives envisagées:
- Conséquences positives:
- Trade-offs acceptés:
- Actions de suivi:

## Contrat cible IA MJ (première proposition)
- Entrées minimales:
	- État narratif courant
	- Mémoire résumée pertinente
	- Fiche joueur/groupe
	- Règles et contraintes de scène
- Sortie structurée minimale:
	- `narration`: texte joueur
	- `intent`: intention système (exploration, dialogue, menace, transition)
	- `choices`: options proposées
	- `effects`: changements d’état à appliquer
	- `tacticalHooks`: déclencheurs éventuels vers le pipeline tactique
	- `memoryWrite`: éléments à mémoriser
