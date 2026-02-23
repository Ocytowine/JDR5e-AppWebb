# Cas 003 — Modèle acteur unifié (joueur/ennemi interchangeables)

## 1) Contexte fonctionnel
- Nom de l’idée: unifier le template de données des créatures non jouées avec celui du joueur
- Catégorie: `TACTIQUE` + `CONTENU` + `IA_MJ`
- Situation joueur: contrôle exceptionnel d’un ennemi, conversion PNJ <-> PJ, scénarios spéciaux
- Valeur joueur: cohérence système, flexibilité gameplay, moins de bugs de conversion

## 2) Problème actuel
Aujourd’hui, les modèles `Personnage`, `TokenState` et `EnemyTypeDefinition` sont proches mais non isomorphes.
Conséquences:
- mappings ad hoc joueur->token et ennemi->token,
- duplication de champs (`actions`, `movement`, `vision`, stats),
- risques de divergence fonctionnelle (ce qui marche joueur ne marche pas ennemi),
- coût de maintenance élevé.

## 3) Objectif produit
Avoir une **base de données acteur unique** où une entité (joueur, ennemi, invocation, PNJ) partage la même nature de données, et où seule la couche de rôle/contrôle change.

Principe: “Si je donne le contrôle d’un ennemi au joueur, aucune conversion fragile ne doit être nécessaire.”

## 4) Décision d’architecture proposée

### 4.1 Modèle canonique
Introduire un schéma central `ActorSheet` (canonique), avec:
- `identity` (id, label, tags)
- `progression` (niveau, classes, sous-classes, sources)
- `attributes` (caracs, mods, compétences)
- `combat` (HP, AC, attaques, ressources)
- `capabilities` (actions, réactions, sorts, sens, mouvements)
- `equipment` (armes, armures, objets, maîtrises)
- `ai` (profil décisionnel, speech profile, comportement)
- `runtimeState` (position, états temporaires, concentration, altitude)

### 4.2 Rôle séparé des données
Le “type d’acteur” ne définit plus la nature des données, seulement le contrôle:
- `control.mode`: `player` | `ai` | `scripted` | `hybrid`
- `faction`: `allied` | `hostile` | `neutral`

### 4.3 Compatibilité immédiate
- Conserver `Personnage` et `EnemyTypeDefinition` comme formats d’entrée legacy.
- Ajouter des normaliseurs vers `ActorSheet`:
  - `normalizeCharacterToActorSheet(...)`
  - `normalizeEnemyToActorSheet(...)`
- Le runtime combat consomme `ActorSheet` progressivement.

## 5) Schéma cible (extrait)

```ts
interface ActorSheet {
  id: string;
  kind: "humanoid" | "beast" | "undead" | string;
  control: { mode: "player" | "ai" | "scripted" | "hybrid"; faction: "allied" | "hostile" | "neutral" };

  progression: {
    level: number;
    classes?: Array<{ classId: string; subclassId?: string | null; level: number }>;
  };

  attributes: {
    abilities: Record<"FOR" | "DEX" | "CON" | "INT" | "SAG" | "CHA", { score: number; mod: number }>;
    skills?: Record<string, { proficiency: 0 | 1 | 2; bonus?: number }>;
  };

  combat: {
    hp: { current: number; max: number; temp?: number };
    armorClass: number;
    attackBonus?: number;
    resources?: Record<string, { current: number; max?: number }>;
  };

  capabilities: {
    movement?: { modes: Record<string, number>; profile?: unknown };
    vision?: unknown;
    senses?: unknown;
    actions?: string[];
    reactions?: string[];
    spellcasting?: unknown;
  };

  equipment?: unknown;
  ai?: { role?: string; combatProfile?: unknown; speechProfile?: unknown };
  runtimeState?: unknown;
}
```

## 6) Stratégie de migration

### Phase A — Canonique sans rupture
- Ajouter `ActorSheet` + normaliseurs.
- Continuer à charger les anciennes sources.
- Vérifier que joueur/ennemi convergent vers une structure runtime identique.

### Phase B — Runtime unifié
- Adapter `TokenState` pour s’appuyer sur `ActorSheet` (ou en devenir une vue runtime).
- Réduire les champs dupliqués dans `EnemyTypeDefinition`.

### Phase C — Données source convergentes
- Faire évoluer les JSON ennemis vers la même grammaire que les fiches joueur.
- Garder seulement des sections spécifiques IA/faction.

### Phase D — Nettoyage
- Supprimer les ponts legacy devenus inutiles.
- Stabiliser des tests de compatibilité acteur contrôlé joueur/IA.

## 7) Critères de réussite
- Un ennemi peut être contrôlé par le joueur sans patch spécifique de données.
- Un acteur passe de `control.mode=ai` à `control.mode=player` sans perte d’information.
- Les mécaniques combat/sorts/actions utilisent les mêmes pipelines pour tous les acteurs.
- Diminution mesurable des mappings spécifiques joueur vs ennemi.

## 8) Risques et garde-fous
- Risque: migration trop large
  - Garde-fou: adapter via normaliseurs intermédiaires, pas de big bang
- Risque: régressions runtime
  - Garde-fou: phase A “sans rupture” + cas de test croisés
- Risque: inflation du schéma
  - Garde-fou: noyau minimal + extensions par modules

## 9) Décision
- Priorité: `P0`
- Décision: `GO`
- Dépendances: Cas 001 (sens), Cas 002 (topologie verticale) doivent se brancher sur `ActorSheet` comme source unique des capacités.

## 10) Questions de verrouillage
- Q1: veut-on que `TokenState` devienne strictement une projection runtime de `ActorSheet` ?
- Q2: quelles données restent strictement “éditeur/création perso” et ne descendent pas en runtime combat ?
- Q3: quelle stratégie de versionnage de schéma pour les JSON existants (`v1`/`v2`) ?
