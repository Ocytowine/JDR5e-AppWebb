# 🧠 Brainstorming — Map Module (remise sur les rails)

---

## 🎯 Vision du projet

L'application est un **jeu type Donjons & Dragons où le MJ est une IA**.  
Le **Map Module** n'est pas un outil de jeu en temps réel — c'est le **moteur de réalité du monde** que le MJ IA habite.

### Ce que le module doit produire
Quand le joueur se trouve en cellule X :
- Le MJ IA interroge le module pour obtenir le **contexte de ce lieu**
- Le module retourne : factions présentes, tensions, événements récents, rumeurs, opportunités
- Le MJ utilise ces données pour **justifier** la géographie, les factions en place, les événements émergents

### Exemples d'émergence attendue
- Un conflit qui éclate dans la case actuelle
- Une ville en flammes suite à une montée de tension
- Une armée en marche vers un objectif de faction

---

## 🔍 Diagnostic — Le "plafond de verre"

Le monde stagne vite. L'évolution fonctionne jusqu'à un certain point puis se bloque.  
**3 cycles sont cassés :**

### Cycle 1 — Les objectifs ne progressent pas
- `currentPhaseIndex` n'avance jamais dans le moteur
- Les factions tournent en rond sans jamais réussir, échouer, ou passer à l'étape suivante

### Cycle 2 — La tension monte mais rien ne répond
- Les pressions (criminal, social, commercial…) s'accumulent
- Le monde ne dépense ni ne transforme cette tension
- Résultat : accumulation sans réaction = monde figé

### Cycle 3 — Le succès est une impasse
- Un monde vivant : `succès → relâchement → vulnérabilité → nouveau conflit`
- Cette **boucle de recyclage** n'existe pas dans le moteur actuel

### Problème structurel de fond
> Le moteur est très sophistiqué mais il n'y a **pas de format de sortie défini** pour le MJ IA.  
> La question centrale manquante : *"Quand le joueur est en cellule X, que doit retourner le Map Module au MJ IA ?"*

---

## 🗺️ État des lieux technique

### ✅ Ce qui est solide
| Brique | État |
|---|---|
| Grille hexagonale + couches | ✅ Complet |
| Éditeur de carte (terrain, zones, routes, lieux) | ✅ Très avancé |
| Persistance JSON via server.js | ✅ Fonctionnel |
| Modèle de données runtime (types.ts) | ✅ Très riche |
| Pipeline de tick (engine.ts) | ✅ Fonctionnel |
| Pressions (criminal, social, commercial…) | ✅ Actif |
| Factions + objectifs + acteurs mobiles | ✅ En données |
| Logistique & mobilité | ✅ Implémenté |
| Mode éditeur / mode visualisation | ✅ Présent |

### ⚠️ Ce qui est en chantier
| Chantier | Problème |
|---|---|
| Phases d'objectifs | `currentPhaseIndex` n'avance jamais |
| Cycle systémique | Pressions montent, monde ne réagit pas |
| Modèle de temps | `microTick` / `macroTick` ambigu en pratique |
| Interface MJ IA | **Inexistante** — format de sortie non défini |
| Boucle de recyclage | Succès → nouvel état n'existe pas |

### 🚨 Dette technique
| Fichier | Taille | Problème |
|---|---|---|
| `WorldMapEditorScreen.tsx` | ~9 396 L | Maintenabilité très difficile |
| `engine.ts` | ~1 749 L | Sous-systèmes non découplés |
| `mapAdapter.ts` | ~1 252 L | Adaptateurs mélangés |
| Types dupliqués | — | `SimulationObjectiveCategory` ≠ `ObjectiveCategory` |

---

## 🧩 3 Axes stratégiques

### Axe 1 — Réparer le métabolisme *(finir ce qui est commencé)*
- Activer les phases d'objectifs dans le moteur (`currentPhaseIndex`)
- Implémenter la boucle : `succès → relâchement → vulnérabilité → nouveau conflit`
- Calibrer et documenter : `1 microTick = 1h`, `1 macroTick = 6h`
- **Résultat attendu** : le monde ne stagne plus après 5 ticks

### Axe 2 — Créer l'interface MJ IA *(ce qui manque le plus)*
- Définir la requête : `getWorldContextForCell(cellId, playerPosition)`
- Définir le format de sortie structuré (JSON consommable par un LLM) :
  ```
  {
    factions: [...],       // factions présentes et leur état
    tensions: [...],       // pressions actives et leur intensité
    recentEvents: [...],   // événements des N derniers ticks
    rumors: [...],         // informations accessibles au joueur
    opportunities: [...]   // accroches narratives disponibles
  }
  ```
- **Résultat attendu** : le module devient interrogeable par le MJ IA

### Axe 3 — Simplifier pour débloquer *(réduire la dette)*
- Découper `WorldMapEditorScreen.tsx` en sous-composants par panel
- Unifier les types dupliqués (source de vérité unique dans `types.ts`)
- Définir une frontière claire : `éditeur | runtime | interface MJ`
- **Résultat attendu** : tester et itérer sans se battre avec le code

---

## ❓ Points à clarifier pour affiner la roadmap

- [ ] **1. Connexion MJ IA** : Le MJ IA est-il déjà connecté au module, ou ce lien est encore entièrement à construire ?
- [ ] **2. Temporalité du monde** : Le monde tourne-t-il en temps réel pendant une session joueur, ou évolue-t-il entre les sessions (préparation offline) ?
- [ ] **3. Symptôme le plus pénible aujourd'hui** :
  - `a)` Le monde se fige après quelques ticks
  - `b)` L'éditeur est trop lourd à manipuler
  - `c)` Tu ne sais pas ce que la simulation "produit" pour le MJ
  - `d)` Autre

---

## 🗓️ Roadmap (à affiner selon les réponses ci-dessus)

```
Phase 1 — Stabilisation & métabolisme
  ├── Unifier les types dupliqués
  ├── Documenter micro/macroTick
  ├── Corriger currentPhaseIndex
  └── Implémenter la boucle de recyclage succès→nouvel objectif

Phase 2 — Interface MJ IA
  ├── Définir getWorldContextForCell()
  ├── Définir le format de sortie JSON
  └── Brancher sur le runtime existant

Phase 3 — Désendettement technique
  ├── Découper WorldMapEditorScreen.tsx
  ├── Découper engine.ts par sous-système
  └── Créer la frontière éditeur / runtime / interface MJ

Phase 4 — Monde vivant avancé
  ├── Événements émergents déclenchés par seuils de pression
  ├── Couche visuelle "objectifs actifs" sur la carte
  └── Intégration wiki → contexte narratif
```
