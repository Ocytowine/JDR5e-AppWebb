# Cas 003 — Tickets techniques prêts à coder (Phase A/B)

## Objectif
Unifier la nature des données joueur/ennemi via un schéma canonique `ActorSheet`, sans casser le runtime existant.

## Convention
- Priorité: `P0` à `P2`
- Effort: `S` / `M` / `L`
- DoD: definition of done

## Phase A — Canonique sans rupture

### T301 — Définir les types `ActorSheet`
- Priorité: `P0`
- Effort: `M`
- Objectif: introduire un modèle canonique minimal et extensible
- Fichiers cibles:
  - `src/game/actors/types.ts` (nouveau)
  - `src/types.ts` (exports/compat)
- Détails:
  - Définir blocs: `identity`, `control`, `progression`, `attributes`, `combat`, `capabilities`, `ai`, `runtimeState`
  - Garder les champs strictement nécessaires pour la migration initiale
- DoD:
  - Types compilent
  - Aucun import cassé

### T302 — Créer normaliseur joueur -> `ActorSheet`
- Priorité: `P0`
- Effort: `M`
- Objectif: convertir `Personnage` vers modèle canonique
- Fichiers cibles:
  - `src/game/actors/normalizeCharacterToActorSheet.ts` (nouveau)
- Détails:
  - Mapper stats/combat/actions/réactions/vision/mouvement
  - Définir règles fallback pour champs optionnels
- DoD:
  - Retour stable sur personnages incomplets

### T303 — Créer normaliseur ennemi -> `ActorSheet`
- Priorité: `P0`
- Effort: `M`
- Objectif: convertir `EnemyTypeDefinition` (+ runtime enemy) vers modèle canonique
- Fichiers cibles:
  - `src/game/actors/normalizeEnemyToActorSheet.ts` (nouveau)
- Détails:
  - Mapper `aiRole/combatProfile/speechProfile` dans bloc `ai`
  - Mapper actions/réactions/capacités au même format que joueur
- DoD:
  - Ennemi normalisé partage les mêmes sections que joueur

### T304 — Adaptateur `ActorSheet` -> `TokenState`
- Priorité: `P0`
- Effort: `M`
- Objectif: garder le runtime actuel opérationnel
- Fichiers cibles:
  - `src/game/actors/toTokenState.ts` (nouveau)
  - `src/GameBoard.tsx`
- Détails:
  - Produire un `TokenState` cohérent depuis un `ActorSheet`
  - Éviter duplication de logique entre joueur et ennemi
- DoD:
  - Création tokens joueur/ennemi passe par même pipeline d’adaptation

### T305 — Journalisation de compatibilité
- Priorité: `P1`
- Effort: `S`
- Objectif: détecter les champs manquants pendant migration
- Fichiers cibles:
  - `src/game/actors/compatReport.ts` (nouveau)
- Détails:
  - Produire warnings normalisés (champ absent, fallback appliqué)
- DoD:
  - Rapport lisible activable en debug

## Phase B — Runtime unifié progressif

### T306 — Point d’entrée unique de création d’acteur runtime
- Priorité: `P0`
- Effort: `M`
- Objectif: éviter chemins parallèles joueur/ennemi
- Fichiers cibles:
  - `src/game/actors/createRuntimeActor.ts` (nouveau)
  - `src/GameBoard.tsx`
- Détails:
  - Entrée polymorphe (`Personnage` ou ennemi source)
  - Sortie: `ActorSheet` + `TokenState`
- DoD:
  - Remplacement des appels de création initiaux sans régression visible

### T307 — Réduire doublons de schéma dans `EnemyTypeDefinition`
- Priorité: `P1`
- Effort: `M`
- Objectif: délester les champs devenus redondants
- Fichiers cibles:
  - `src/game/enemyTypes.ts`
  - `src/data/enemies/*`
- Détails:
  - Marquer legacy certains champs de transition
  - Préparer section canonique alignée `ActorSheet`
- DoD:
  - JSON ennemi toujours lisibles, runtime inchangé

### T308 — Support contrôle interchangeable (`ai` <-> `player`)
- Priorité: `P0`
- Effort: `M`
- Objectif: permettre changement de mode de contrôle sans conversion fragile
- Fichiers cibles:
  - `src/GameBoard.tsx`
  - `src/game/actors/*`
- Détails:
  - Basculer `control.mode` sans perte de données
  - Vérifier action/reaction/spellcasting sur acteur ex-ennemi
- DoD:
  - Cas démonstration: un ennemi contrôlé joueur agit correctement

### T309 — Matrice de tests de compatibilité acteur
- Priorité: `P0`
- Effort: `S`
- Objectif: verrouiller la non-régression de la migration
- Fichiers cibles:
  - `docs/Evolution/QA-ActorSheet-compat.md` (nouveau)
- Détails:
  - Scénarios: joueur natif, ennemi natif, ennemi contrôlé joueur, invocation
  - Vérifier: création token, action, réaction, ciblage, narration
- DoD:
  - Checklist exécutable manuellement de bout en bout

## Ordre conseillé d’exécution
1. `T301`
2. `T302`
3. `T303`
4. `T304`
5. `T306`
6. `T308`
7. `T305`
8. `T307`
9. `T309`

## Notes de migration
- Les phases C/D du Cas 003 (convergence JSON source + nettoyage legacy) restent planifiées après stabilisation A/B.
- Cas 001 et Cas 002 devront lire les capacités via `ActorSheet` comme source canonique.

## Priorisation fine (risque/valeur)

### Lot 1 — Fondations indispensables
- Tickets: `T301`, `T302`, `T303`
- Objectif: créer le socle canonique + normalisation des deux sources.
- Risque: faible à moyen (impact surtout typage et mapping).
- Valeur: très haute (base de toute migration).

### Lot 2 — Pont runtime sécurisé
- Tickets: `T304`, `T306`
- Objectif: brancher `ActorSheet` sans casser le runtime combat existant.
- Risque: moyen (point sensible `GameBoard`/création tokens).
- Valeur: très haute (réduction immédiate des chemins parallèles).

### Lot 3 — Cas d’usage produit clé
- Tickets: `T308`, `T309`
- Objectif: prouver la promesse “ennemi contrôlé joueur” + verrouiller tests de compat.
- Risque: moyen (révèle incohérences cachées).
- Valeur: critique (validation fonctionnelle directe de l’idée).

### Lot 4 — Durcissement migration
- Tickets: `T305`, `T307`
- Objectif: observabilité migration + réduction progressive des doublons legacy.
- Risque: faible à moyen.
- Valeur: moyenne mais structurante long terme.

## Dépendances explicites
- `T301` est prérequis de `T302`, `T303`, `T304`.
- `T304` est prérequis de `T306`.
- `T306` est prérequis de `T308`.
- `T308` et `T304` sont prérequis de `T309`.
- `T305` peut être lancé après `T302`/`T303`.
- `T307` doit démarrer après stabilisation `T306`/`T308`.

## Stratégie de livraison recommandée
- Milestone M1: fin Lot 1 (`T301-302-303`)
- Milestone M2: fin Lot 2 (`T304-306`)
- Milestone M3: fin Lot 3 (`T308-309`) = objectif produit atteint
- Milestone M4: fin Lot 4 (`T305-307`) = dette de migration réduite

## Critères Go/No-Go par milestone
- M1 Go: normalisation joueur+ennemi retourne un `ActorSheet` valide sur jeux de données réels.
- M2 Go: création runtime passe par un point d’entrée unique sans régression visible.
- M3 Go: scénario “ennemi contrôlé joueur” validé de bout en bout.
- M4 Go: logs de compatibilité stables + doublons critiques supprimés.
