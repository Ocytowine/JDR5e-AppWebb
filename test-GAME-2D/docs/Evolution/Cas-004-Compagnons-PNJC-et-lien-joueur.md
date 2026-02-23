# Cas 004 — Compagnons PNJC pilotés IA (alliés du joueur)

## 1) Contexte fonctionnel
- Nom de l’idée: compagnons PNJC alliés pilotés par MJ IA
- Catégorie: `NARRATION` + `IA_MJ` + `TACTIQUE` + `CONTENU`
- Situation joueur: aventure avec allié non-joueur, coordination tactique, relation évolutive
- Valeur joueur: équipe vivante, interactions riches, décisions tactiques et émotionnelles crédibles

## 2) Objectif produit
Introduire des compagnons PNJC:
- créés depuis les sauvegardes du Character Creator,
- joués par l’IA MJ en combat,
- dotés de motivations propres,
- influencés par un niveau de lien avec le joueur,
- capables de communiquer via le sous-menu interaction (roue d’action), avec émission sonore détectable.

## 3) Portée MVP test

### 3.1 Source des compagnons
- Permettre de marquer une sauvegarde personnage comme `compagnon`.
- Charger ce compagnon directement dans la bataille comme allié piloté IA.

### 3.2 Identité et motivations
- Le compagnon utilise une fiche proche joueur (même nature de données via Cas 003).
- Ajout d’un bloc `companionProfile`:
  - motivations
  - tempérament tactique
  - seuils de confiance/risque

### 3.3 Lien joueur-compagnon
- Ajouter un curseur de lien (MVP) sur la plage `0..100`.
- Le lien influence:
  - obéissance aux directives,
  - priorité de protection du joueur,
  - probabilité de sacrifice,
  - volonté de coopérer activement.

### 3.4 Communication via roue d’action
- Ajouter un sous-menu `Communiquer` dans la roue d’action.
- Exemples d’ordres MVP:
  - `cible_prioritaire`
  - `couvrir`
  - `rester_discret`
  - `repli`
  - `tenir_position`
- Les communications génèrent un événement sonore (`NoiseEvent`) audible par d’autres créatures (intégration Cas 001).

### 3.5 Autonomie IA compagnon
- Le compagnon reste piloté IA, même après directive.
- L’IA est libre:
  - d’exécuter,
  - d’adapter,
  - ou de refuser selon motivations, contexte, lien, danger.
- Les réponses de compagnon (acceptation/refus/alternative) peuvent être explicites en narration courte.

## 4) Modèle de données cible (MVP)

```ts
interface CompanionProfile {
  companionId: string;
  actorId: string;
  relationToPlayer: {
    bondScore: number;
    trust: number;
    loyalty: number;
  };
  motivations: Array<{
    id: string;
    priority: number;
    description: string;
  }>;
  tacticalPersona: {
    protectPlayerBias: number;
    riskTolerance: number;
    obedienceBias: number;
  };
}

interface CompanionDirective {
  id: string;
  issuerId: string;
  companionId: string;
  type: "target_priority" | "cover" | "stealth" | "fallback" | "hold";
  payload?: Record<string, unknown>;
  emittedNoise: number;
  timestamp: number;
}
```

## 5) Règles structurantes
- R1: un compagnon est un acteur standard (Cas 003), avec mode de contrôle `ai` et faction alliée.
- R2: le lien est un modificateur de décision, pas un script absolu.
- R3: toute communication émet un signal bruit exploité par la perception.
- R4: le compagnon peut agir contre un ordre si conflit avec ses motivations critiques.
- R5: les changements de lien sont traçables (journal d’événements narratifs/tactiques).

## 6) Impacts systèmes

### 6.1 Runtime combat
- Ajouter gestion d’équipe alliée non-joueur.
- Ajouter cible et priorités pour coordination joueur-compagnon.

### 6.2 IA MJ
- Étendre les entrées IA avec:
  - directives récentes,
  - score de lien,
  - motivations,
  - contexte perceptif.

### 6.3 UI/Interaction
- Ajouter curseur de lien (UI de configuration compagnon).
- Ajouter menu `Communiquer` dans la roue d’action.
- Ajouter retour immédiat (icône/texte) sur réception d’ordre.

### 6.4 Sens et discrétion
- Brancher chaque communication sur `NoiseEvent`.
- Les ennemis peuvent détecter la communication selon distance/sens/ouïe.

## 7) Plan incrémental

### Phase A — Compagnon jouable en bataille (piloté IA)
- Flag sauvegarde `compagnon`.
- Spawn compagnon allié depuis Character Creator.
- Tour IA compagnon basique.

### Phase B — Lien et comportement
- Curseur de lien + impact décisionnel.
- Motivations minimales (2-3 archétypes).

### Phase C — Communication tactique
- Sous-menu `Communiquer`.
- Génération des directives + `NoiseEvent`.
- Boucle réponse compagnon.

### Phase D — Évolution relationnelle
- Évolution dynamique du lien selon événements.
- Exposition au MJ IA pour narration adaptative.

## 8) Risques et garde-fous
- Risque: IA imprévisible/frustrante
  - Garde-fou: règles de refus explicites + feedback clair
- Risque: surcharge UI
  - Garde-fou: commandes de communication limitées en MVP
- Risque: bruit tactique trop punitif
  - Garde-fou: calibrage intensité communication + options discrétion

## 9) Décision
- Priorité: `P0`
- Décision: `GO`
- Dépendances: Cas 001 (sens/signaux), Cas 003 (acteur unifié), narration IA MJ.

## 10) Questions de verrouillage
## 10) Décisions actées (session du 2026-02-23)
- Q1 validée: curseur de lien `0..100`.
- Q2 validée: `5` directives MVP dans la roue (`target_priority`, `cover`, `stealth`, `fallback`, `hold`).
- Q3 validée: anti-spam fixé à `1` directive explicite par tour joueur et par compagnon.
