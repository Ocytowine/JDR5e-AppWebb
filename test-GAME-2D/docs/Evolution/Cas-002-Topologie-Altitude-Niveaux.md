# Cas 002 — Topologie, altitude et niveaux (terrain, bâtiments, vol)

## 1) Contexte fonctionnel
- Nom de l’idée: Gestion complète des niveaux/altitudes
- Catégorie: `TACTIQUE` + `NARRATION` + `IA_MJ`
- Situation joueur: exploration verticale, infiltration, combat multi-étages, poursuites
- Valeur joueur: profondeur tactique forte et cohérence narrative des environnements

## 2) Objectif produit
Introduire une topologie verticale native du moteur:
- relief du terrain (altitude variable)
- bâtiments multi-niveaux (au-dessus et en dessous)
- transitions verticales (échelle, escalier, escalade, saut)
- vol à différentes hauteurs

Unité officielle pour toutes les distances et hauteurs: **mètre**.

## 3) Périmètre fonctionnel

### 3.1 Terrain et altitude
- Chaque cellule porte une altitude de base en mètres (`groundElevationM`).
- La pente/rupture d’altitude influence le coût de mouvement et la visibilité.
- La topologie n’est pas limitée à `0`: relief positif et négatif autorisé.

### 3.2 Bâtiments et sous-sols
- Les bâtiments peuvent contenir plusieurs niveaux superposés.
- Les sous-sols existent sous la zone de base (altitudes négatives).
- Les hauteurs d’étage sont dérivées de la hauteur des murs (règle explicite).

Décision MVP: hauteur standard d’étage = `3 m` (les patterns de bâtiments peuvent surcharger cette valeur).

### 3.3 Transitions verticales
- Types d’accès: `ladder`, `stairs`, `climb`, `jump`, `drop`, `ramp`.
- Chaque accès a des contraintes (coût, test, capacité requise, sens autorisé).
- Les transitions sont data-driven et traçables par le moteur.

### 3.4 Vol
- Une créature volante possède une altitude dynamique (`flightAltitudeM`).
- Le vol peut rester sur la même cellule XY avec changement d’altitude.
- Le moteur doit gérer interactions sol-air-air et contraintes de portée/LOS.

Décision MVP: plafond de vol tactique = `30 m`.

## 4) Modèle de données cible (proposition)

```ts
interface TopologyCell {
  x: number;
  y: number;
  groundElevationM: number;
  levelId?: string | null;
}

interface VerticalLevel {
  id: string;
  parentId?: string | null;
  kind: "terrain" | "building" | "underground" | "air";
  baseElevationM: number;
  ceilingElevationM?: number | null;
}

interface VerticalConnector {
  id: string;
  kind: "ladder" | "stairs" | "climb" | "jump" | "drop" | "ramp";
  from: { x: number; y: number; levelId: string };
  to: { x: number; y: number; levelId: string };
  moveCostM: number;
  requiresCheck?: { ability: "FOR" | "DEX" | "CON" | "SAG"; dc: number };
}

interface AltitudeState {
  levelId: string;
  elevationM: number;
  flightAltitudeM?: number;
}
```

## 5) Règles structurantes (MVP)
- R1: distances, portées et hauteurs utilisent la même unité: mètre.
- R2: la grille reste hex en XY; la verticalité est une couche topologique supplémentaire.
- R3: un changement d’altitude explicite passe par un connecteur vertical (hors vol/saut autorisé).
- R4: LOS/vision/ouïe tiennent compte du différentiel d’altitude.
- R5: les sous-sols sont des niveaux valides avec altitude négative.
- R6: chutes selon règle officielle DnD 5e (1d6 dégâts contondants par 10 ft chutés, max 20d6), avec conversion en mètres pour le moteur.

### 5.1 Chute (DnD officiel, moteur en mètres)
- Formule dégâts: `dice = min(20, floor(distanceM / 3.048))`.
- Dégâts: `dice d6` contondants.
- Effet d’état: créature `prone` à l’atterrissage, sauf exception de règle/feature.
- Paramètre technique recommandé: conserver la formule officielle (3.048 m) et éviter l’approximation 3 m pour les dégâts.

## 6) Impacts systèmes

### 6.1 Pathfinding
- Passage d’un pathfinding XY à un graphe `(x, y, levelId)`.
- Les connecteurs verticaux deviennent des arêtes du graphe.
- Coût total = coût XY + coût vertical + coût de terrain.

### 6.2 Vision, lumière, perception
- La LOS devra intégrer altitude source/cible + obstacles verticaux.
- Les sens (Cas 001) dépendent du modèle vertical du Cas 002.
- Le rendu joueur peut rester simple (niveau actif), mais le runtime calcule en 3D logique.

### 6.3 IA MJ
- Fournir des signaux structurés: menace en hauteur, cible en contrebas, accès vertical possible, fuite verticale.
- Le MJ IA exploite des résumés compacts, pas une géométrie brute.

### 6.4 Génération de map
- Le générateur doit produire:
  - altitude de terrain
  - niveaux de bâtiments
  - connecteurs verticaux
  - zones souterraines éventuelles

## 7) Stratégie de mise en oeuvre (incrémentale)

### Phase A — Fondations topologiques
- Introduire `levelId` + `elevationM` runtime.
- Créer modèle `VerticalConnector`.
- Conserver rendu sur niveau actif (pas de visualisation 3D complexe).

### Phase B — Bâtiments et sous-sols
- Génération de bâtiments multi-niveaux simple.
- Ajout escalier/échelle data-driven.
- Ajout sous-sol minimal sur quelques maps de test.

### Phase C — Moteur de mouvement vertical
- Pathfinding `(x,y,levelId)`.
- Coûts et validations de transitions.
- Journaux de debug verticaux.

### Phase D — Perception et combat verticaux
- LOS/portée/perception intégrant altitude.
- Ajustements de règles tactiques selon différentiel de hauteur.

### Phase E — Vol multi-altitude
- État de vol par créature.
- Déplacements et interactions sol-air.
- Intégration IA et narration.

## 8) Risques et garde-fous
- Risque: explosion de complexité moteur
  - Garde-fou: progression par phases et contrats stricts
- Risque: confusion UX
  - Garde-fou: UI niveau actif + logs explicites
- Risque: dette technique LOS/pathfinding
  - Garde-fou: centraliser toute logique verticale dans des services dédiés

## 9) Décision
- Priorité: `P0`
- Décision: `GO`
- Raison: prérequis structurel pour vision/ouïe/odorat avancés, bâtiments riches et vol.

## 10) Questions de verrouillage (prochaine session)
## 10) Décisions actées (session du 2026-02-23)
- Q1 validée: hauteur standard `3 m` (surchargeable par pattern de bâtiment).
- Q2 validée: plafond de vol MVP `30 m`.
- Q3 validée: chute selon règle officielle DnD 5e.
