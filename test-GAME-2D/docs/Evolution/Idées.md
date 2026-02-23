# Backlog d'idées (brainstorming guidé)

Règle simple: une idée est prioritaire si elle renforce la narration et la continuité de l’aventure, sans casser le socle technique.

## Inbox brute
Dépose ici tout ce qui te vient, sans filtrer.

- [x] Système de sens data-driven: vision avancée (dark/light/thermique/magie), ouïe (à travers murs et étages), odorat (pistes) avec UI simple + payload IA MJ
- [x] Topologie verticale: relief, bâtiments multi-niveaux, sous-sols, transitions (échelle/escalier/escalade/saut) et vol à altitudes variables
- [x] Unifier les templates joueur/ennemi pour rendre une créature ennemie jouable sans friction de données
- [x] Compagnons PNJC alliés pilotés IA: lien joueur, directives via communication, impacts perception sonore
- [x] Aventure narrative orchestratrice (pilier central: narration, quêtes, déclencheurs mécaniques)
- [x] Progression narrative (multiclassage + level up conditionnés par événements RP)
- [x] Réputation/relations/perception sociale (pas de détection de classe)
- [x] Mode bastion (gestion + narration du lieu)
- [x] Système de repos narratif (danger caché, activités, interruptions)

## Tri rapide (premier passage)
Pour chaque idée, indiquer une catégorie principale:
- `NARRATION` (rythme, scènes, arcs, quêtes)
- `MEMOIRE` (continuité, rappel, historique, conséquences)
- `IA_MJ` (guidage, arbitrage, adaptation)
- `TACTIQUE` (pipeline d’action, résolution combat, états)
- `CONTENU` (classes, sous-classes, items, sorts, lore)
- `OUTILLAGE` (debug, validation, productivité)

## Fiche d'évaluation (copier/coller)
### Idée: <titre>
- Catégorie:
- Cas d’usage joueur:
- Problème exact résolu:
- Impact narration (1-5):
- Impact immersion (1-5):
- Coût implémentation (1-5):
- Risque technique (1-5):
- Dépendances:
- Entrées nécessaires (données/état):
- Sorties attendues:
- Effets de bord potentiels:
- Décision: `GO` | `LATER` | `DROP`
- Pourquoi:

## Questions à poser systématiquement (anti-oubli)
- Quel événement déclenche cette feature?
- Où est stockée l’information avant et après exécution?
- Comment cette feature affecte la mémoire long terme?
- Quel fallback si l’IA ne répond pas ou répond mal?
- Quelle trace de debug permet de comprendre ce qui s’est passé?

## Priorités actuelles (court terme)
- [ ] Poser une boucle narrative robuste avant d’ajouter des sous-systèmes.
- [ ] Définir le contrat de sortie structuré du MJ IA.
- [ ] Définir la mémoire minimale nécessaire à la continuité.
- [x] Cadrer le premier sous-système tactique relié narration: perception multi-sens.
- [x] Cadrer le socle vertical (niveaux/altitudes) qui conditionne perception + navigation.
- [x] Cadrer un modèle acteur unifié (joueur/ennemi) pour réduire la dette de mapping.
- [x] Cadrer les compagnons PNJC (alliés IA) et leur lien dynamique avec le joueur.
- [x] Cadrer le pilier aventure narrative et ses sous-systèmes (progression, social, bastion, repos).

## Parking lot (bonnes idées, pas maintenant)
-
-
-

## Idées traitées
- [GO][P0] Cas 001 — Système de sens data-driven (voir `Cas-001-Sens-data-driven.md`)
- [GO][P0] Cas 002 — Topologie/altitude/niveaux (voir `Cas-002-Topologie-Altitude-Niveaux.md`)
- [GO][P0] Cas 003 — Modèle acteur unifié joueur/ennemi (voir `Cas-003-Modele-acteur-unifie-joueur-ennemi.md`)
- [GO][P0] Cas 004 — Compagnons PNJC et lien joueur (voir `Cas-004-Compagnons-PNJC-et-lien-joueur.md`)
- [GO][P0] Cas 005 — Aventure narrative orchestrateur (voir `Cas-005-Aventure-narrative-orchestrateur.md`)
- [GO][P0] Cas 006 — Progression narrative multiclassage + levelup (voir `Cas-006-Progression-narrative-multiclasse-et-levelup.md`)
- [GO][P0] Cas 007 — Réputation, relations et perception sociale (voir `Cas-007-Reputation-relations-et-perception-sociale.md`)
- [GO][P1] Cas 008 — Mode bastion et vie du lieu (voir `Cas-008-Bastion-mode-et-vie-du-lieu.md`)
- [GO][P0] Cas 009 — Système de repos narratif (voir `Cas-009-Systeme-de-repos-narratif.md`)

