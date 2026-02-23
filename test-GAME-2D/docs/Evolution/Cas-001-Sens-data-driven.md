# Cas 001 — Système de sens data-driven (vision, ouïe, odorat)

## 1) Contexte fonctionnel
- Nom de l’idée: Système de sens data-driven
- Catégorie: `TACTIQUE` + `IA_MJ` + `NARRATION`
- Situation joueur: exploration, infiltration, combat, pistage
- Valeur joueur: meilleure immersion et décisions tactiques plus riches

## 2) Objectif produit
Construire un module de perception unifié où chaque créature possède un profil sensoriel (vision, ouïe, odorat, modes spéciaux), utilisé:
- côté joueur: overlays simples + retours textuels lisibles
- côté MJ IA: signaux structurés exploitables pour narration et décisions

## 3) Proposition technique (compatible base existante)

### 3.1 Modèle de données
Introduire un profil sensoriel additionnel (sans casser `visionProfile` déjà présent):

```ts
interface SenseProfile {
  sight?: {
    lightMode?: "normal" | "lowlight" | "darkvision";
    dazzledByBrightLight?: boolean;
    thermalVision?: { enabled: boolean; range: number; throughWallsPenalty?: number };
    magicSight?: { enabled: boolean; range: number; detectsAuras?: boolean };
  };
  hearing?: {
    enabled: boolean;
    baseRange: number;
    throughWallAttenuation: number;
    verticalAttenuation: number;
    minSignalToDetect: number;
  };
  smell?: {
    enabled: boolean;
    baseRange: number;
    windSensitivity?: number;
    throughWallAttenuation: number;
    minSignalToDetect: number;
  };
}
```

Idée clé: conserver `visionProfile` pour la compatibilité runtime actuelle, et brancher `senseProfile` en couche supérieure de perception.

### 3.2 Pipeline perception (nouveau service)
Créer un service central de perception (ex: `game/engine/runtime/perception/`):
1. Entrées: observateur, état map (lumière, murs, niveaux), sources de signaux, tokens
2. Calcul par canal: vision / ouïe / odorat
3. Fusion en `PerceptionReport`
4. Sortie double:
   - UI joueur: éléments affichables simples
   - IA MJ: payload structuré compact

### 3.3 Vision (extensions)
Réutiliser le socle existant (`vision.ts` + `lighting.ts`) et ajouter:
- sensibilité à l’éblouissement (`dazzledByBrightLight`) quand lumière > seuil
- vision thermique: détection partielle derrière obstacles (faible précision)
- vision magique: détection d’aura (booléen + intensité simple)

### 3.4 Ouïe
Modèle par intensité de bruit:
- chaque événement produit un `NoiseEvent` (`intensity`, `position`, `kind`)
- propagation simplifiée: distance + atténuation murs + atténuation verticale
- sortie: zone probable + confiance (faible/moyenne/forte)

Note d’alignement: la verticalité est désormais pilotée par le `Cas-002-Topologie-Altitude-Niveaux.md`.
Le modèle perception doit consommer ce référentiel (altitude en mètres + niveaux/connexions), pas un `zLevel` simplifié isolé.

### 3.5 Odorat
Modèle simplifié “trace d’odeur”:
- source odorante avec intensité et décroissance temporelle
- propagation courte portée + forte atténuation à travers murs
- sortie: direction probable + fraîcheur de piste

Décision MVP: pas de vent en V1 (ajout en V2 si besoin).

## 4) Contrat de sortie (UI + IA)

### 4.1 Sortie joueur (simple)
- Vision: overlays déjà existants + variantes (ébloui/thermique/magique)
- Ouïe: ciblage de zone + texte contextuel
- Odorat: indice directionnel court (ex: “odeur métallique vers l’est”)

### 4.2 Sortie IA MJ (structurée)

```ts
interface PerceptionReport {
  observerId: string;
  seen: Array<{ targetId: string; clarity: "full" | "partial" | "faint" }>;
  heard: Array<{ sourceId?: string; zone: { x: number; y: number; r: number }; confidence: number }>;
  smelled: Array<{ sourceId?: string; direction: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"; confidence: number }>;
  alerts: string[];
}
```

Ce rapport peut alimenter directement les endpoints de narration/speech existants.

## 5) UI joueur (approche minimale)
- Ne pas surcharger l’écran.
- Une couche active à la fois: `Vision` / `Ouïe` / `Odorat`.
- Détails textuels scalés par perception (distance, score, conditions).

## 6) Plan d’implémentation par phases

### Phase A — Fondations (faible risque)
- Ajouter `senseProfile` aux types de tokens (sans enlever `visionProfile`)
- Créer types `NoiseEvent`, `SmellTrace`, `PerceptionReport`
- Stub de service de fusion perception

### Phase B — Ouïe MVP
- Générer des `NoiseEvent` depuis mouvements/attaques/sorts
- Calcul simple de détection (distance + murs + verticalité)
- UI zone + description courte
- Signal IA MJ branché

Règle MVP validée: atténuation identique pour tous les matériaux (pas de table matériau en V1).

### Phase C — Vision avancée
- Éblouissement + thermique + magie (au moins 1 mode complet)
- Retours textuels et flags IA

### Phase D — Odorat MVP
- Traces odorantes basiques
- Direction + confiance
- Exploitation IA MJ

## 7) Risques et garde-fous
- Risque: explosion de complexité simulation
  - Garde-fou: modèles simplifiés et seuils discrets
- Risque: UI illisible
  - Garde-fou: une seule couche sensorielle affichée à la fois
- Risque: IA confondue par trop de signaux
  - Garde-fou: payload compact, borné en taille

## 8) Décision
- Priorité: `P0` (fort impact originalité)
- Décision: `GO` (implémentation incrémentale)
- MVP technique recommandé: commencer par Ouïe + rapport IA structuré

## 9) Questions à trancher (pour passer au dev)
- Q1: règles de perception verticale à dériver du Cas 002 (atténuation vs différentiel d’altitude, transitions audibles, limites de détection).

## 10) Décisions actées (session du 2026-02-23)
- Q2 validée: thermique autorisé à travers murs avec atténuation identique quel que soit le matériau (V1).
- Q3 validée: odorat MVP sans vent.
- Q1 redirigée vers Cas 002: la verticalité n’est plus traitée comme hypothèse locale du Cas 001.
