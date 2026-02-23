# Plan d’exécution — V1 Module Narration

Date: 2026-02-23
Périmètre: UI + Runtime + IA MJ + Mémoire narrative
Références:
- `Matrice-Narration-Globale-v1.md`
- `Transitions-v1-Quete-Trame-Compagnon-Marchandage.md`
- `../runtime/Transitions-v1-runtime.schema.json`

## 1) Objectif V1
Livrer une boucle jouable où:
- un événement narratif respecte le contrat canonique,
- les transitions d’états s’appliquent de manière déterministe,
- l’IA MJ reste cohérente au lore local,
- la mémoire conserve les impacts majeurs,
- le joueur comprend causes et conséquences dans le journal.

## 2) Ordre d’implémentation recommandé

### Phase A — Noyau runtime (priorité absolue)
**Livrables**
- Modèle `NarrativeEvent` conforme au schéma runtime.
- Moteur `TransitionEngine` appliquant `fromState -> toState`.
- Horloge en blocs (`hour` / `day` / `special`).
- Pipeline de conséquence (`local` / `regional` / `global`).

**Definition of done**
- 1 transition de chaque type (`quest`, `trama`, `companion`, `trade`) exécutable en test local.
- Rejet automatique des transitions invalides.

### Phase B — Cohérence IA + Lore
**Livrables**
- Service `ContextPack` (lieu/faction/histoire/acteur, min 2 ancres).
- Gates de cohérence (`canon`, `local`, `faction`, `temps`, `règles`).
- Auto-correction avant publication si gate critique échoue.

**Definition of done**
- Aucune sortie IA publiée sans passage des gates critiques.
- Explication structurée post-événement majeur disponible.

### Phase C — Mémoire narrative
**Livrables**
- Mémoire courte session (historique récent + anti-répétition).
- Mémoire longue (faits majeurs, réputation, relations compagnons).
- Atténuation temporelle des événements mineurs.

**Definition of done**
- Un événement majeur persiste après cycles de temps.
- Un événement mineur s’atténue selon règles définies.

### Phase D — Domaines de gameplay narratif
**Livrables**
- Quêtes: `Détectée / Acceptée / Terminée` + bifurcation d’échec.
- Trames: activation, escalade variable, clôture avec/sans voie joueur.
- Compagnons: rencontre, négociation, recrutement, départ durable, retour.
- Marchandage: négociation bornée sans rupture d’économie.

**Definition of done**
- Chaque domaine possède au moins 5 transitions vérifiées via le validateur runtime.

### Phase E — UI narration
**Livrables**
- Journal à bandeaux: `Quêtes acceptées`, `Intrigues`, `Trames monde`.
- Tri par urgence/échéance.
- Modal `faits + hypothèses PJ`.
- Highlights automatiques (info critique, changement d’état, échéance proche).

**Definition of done**
- Toute transition visible en UI en moins d’un cycle d’horloge.

### Phase F — Règles de démarrage & difficulté MJ
**Livrables**
- Intro standard -> passage Archives -> création personnage -> retour narration.
- Lieu de départ canonique obligatoire.
- Politique de difficulté MJ avec garde-fous (pas de pic arbitraire, fenêtre de reprise).
- Traçabilité de règle appliquée (DnD 2024 / règle locale déclarée).

**Definition of done**
- Une nouvelle partie complète suit ce flux sans rupture.

### Phase G — Qualité & pilotage
**Livrables**
- KPI actifs:
  - taux de répétition (prioritaire),
  - taux d’incohérence corrigée,
  - taux d’événements sans conséquence claire.
- Scénario de test long (2–3h simulées) avec export des logs.

**Definition of done**
- KPI collectés automatiquement et exploitables pour tuning.

## 3) Backlog d’implémentation minimal (ordre strict)
1. Types runtime + chargeur JSON + validation.
2. TransitionEngine + horloge blocs de temps.
3. ContextPack + gates + auto-correction.
4. Mémoire courte/longue + atténuation.
5. Quêtes puis Trames puis Compagnons puis Marchandage.
6. UI Journal + modal + highlights.
7. Flux d’entrée en jeu + création personnage narrative.
8. KPI + test longue durée.

## 4) Risques principaux
- Mélange des données “joueur visible” et “vérité interne IA”.
- Escalade trop rapide sans fenêtre de reprise.
- Répétition de motifs faute de mémoire courte robuste.
- Contradictions lore non journalisées.

## 5) Mitigations
- Séparer explicitement `whatPlayerKnowsNow` et `hiddenTruth`.
- Appliquer les garde-fous difficulté à chaque escalade.
- Bloquer répétitions sur fenêtre glissante.
- Forcer log d’audit sur chaque résolution de contradiction.

## 6) Premier sprint conseillé (ultra concret)
- Jour 1-2: runtime types + validation + chargeur.
- Jour 3-4: TransitionEngine + horloge.
- Jour 5: 4 transitions end-to-end (1 par domaine) + affichage journal basique.

## 7) État actuel & étapes restantes

### Déjà fait
- Base runtime opérationnelle (`TransitionEngine`, `NarrativeRuntime`, persistance JSON, `GameNarrationAPI`).
- Orchestration (`tickNarration`, `tickNarrationSafe`) et filtrage anti-rejouabilité.
- Gates de cohérence branchées (mode strict / non strict) avec démos validées.
- Démos npm couvrant transitions, tick, guards, blocage strict.

### En cours
- Stabilisation des règles de guards (affinage des gates et codes de rejet métier).

### Restant prioritaire
1. Connecter un vrai pipeline IA MJ (`ContextPack -> génération -> guards -> application`).
2. Implémenter mémoire narrative courte/longue avec atténuation temporelle réelle.
3. Étendre la couverture transitions (au-delà des cas de démo) sur tout le flux quête/trame/compagnon/marchandage.
4. Brancher la couche UI journal (bandeaux, tri, modal, highlights) sur l’état runtime.
5. Intégrer le flux d’entrée en jeu narratif (intro -> archives -> création perso -> reprise).
6. Ajouter KPI runtime automatiques + scénario long de validation.

### Critère de passage en “V1 jouable”
- Le runtime tourne avec contenu réel, pas seulement avec transitions d’exemple.
- Un tick narratif complet peut être exécuté en boucle sans crash ni incohérence bloquante.
- Les événements majeurs sont lisibles côté joueur et traçables côté système.
