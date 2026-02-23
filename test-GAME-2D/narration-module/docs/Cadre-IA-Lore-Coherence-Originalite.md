# Cadre IA — Cohérence & Originalité Lore

Date: 2026-02-23
But: garantir que l’IA produise des événements narratifs cohérents avec le monde, tout en restant surprenante.

## 1) Principe directeur
- Cohérence d’abord, originalité ensuite.
- Règle de base: `ancré dans le canon` + `variation contextuelle`.
- Contrat MVP recommandé: `70% ancrage lore / 30% nouveauté`.

## 2) Entrées obligatoires avant génération
- `Profil PJ`: passé, objectifs, réputation, relations compagnons.
- `Contexte lieu`: Monde > Continent > Territoire > Région > Ville > Quartier > Structure.
- `Contexte faction`: intérêts, alliés, ennemis, lignes rouges.
- `État du monde`: trames actives, incidents récents, niveau ordre/chaos local.
- `Contraintes système`: règles mécaniques non négociables, type d’événement (`Mission`, `Point d’intérêt`, `Trame`).

## 3) Construction d’un Context Pack (RAG lore)
- Étape A: récupérer les fragments lore les plus proches via recherche pondérée (cf. [test-LORE/wikiTag.js](../../test-LORE/wikiTag.js)).
- Étape B: forcer l’inclusion d’au moins 2 ancres minimales (MVP), idéalement parmi:
  - `Lieu`
  - `Faction ou Gouvernance`
  - `Historique/événement passé`
  - `Acteur vivant` (PNJ, groupe, compagnon)
- Étape C: condenser en `Context Pack` court (faits vérifiables uniquement, sans invention).

### Priorisation de scoring (Lot L3)
- Priorité 1: `Lieu actif` (cohérence immédiate de la scène)
- Priorité 2: `Profil/Passé du PJ`
- Le passé PJ influence faiblement la génération (éviter le sur-centrage joueur).
- Fallback si résultats faibles: `élargissement au parent (quartier->ville->région)` + `micro-événement local neutre`.

## 4) Génération en 2 temps
### 4.1 Brouillon canonique
- L’IA propose un événement strictement compatible avec le Context Pack.
- Vérifie explicitement:
  - causalité temporelle,
  - compatibilité géographique,
  - compatibilité politique/faction,
  - compatibilité avec niveau de magie local.

### 4.2 Variation originale contrôlée
- Ajouter 1 à 2 variations max parmi:
  - complication sociale,
  - détour logistique,
  - enjeu moral,
  - twist mineur lié au passé PJ.
- Interdits:
  - contradiction d’un fait canon,
  - deus ex machina,
  - changement brutal non préparé des motivations de faction.

## 5) Garde-fous de cohérence (gates)
- Gate 1 — `Canon`: aucun fait contredit le wiki.
- Gate 2 — `Local`: les éléments existent dans la zone active.
- Gate 3 — `Faction`: chaque action possède un intérêt compréhensible.
- Gate 4 — `Temps`: les causes précèdent les effets.
- Gate 5 — `Règles`: aucune exception mécanique narrative.
- Si un gate échoue: régénération partielle ciblée (pas régénération totale).

## 6) Mécanique d’originalité sans répétition
- Conserver un historique des derniers motifs utilisés (`objectif`, `complication`, `récompense`, `type d’issue`).
- Fenêtre glissante MVP: 5 événements.
- Tolérance répétition motif (`objectif + complication`): maximum 2 occurrences répétées sur la fenêtre.
- Favoriser la nouveauté par permutation:
  - même lieu, factions différentes,
  - même faction, enjeu différent,
  - même enjeu, mode de résolution différent.

### Politique de correction
- En cas d’incohérence: `régénération partielle ciblée` (pas de régénération complète par défaut).
- En cas d’échec d’un gate critique (`Canon` ou `Règles`): `auto-correction obligatoire avant publication`.

## 7) Sortie structurée recommandée (pour MJ + UI)
- `eventType`: Mission | PointInteret | Trame
- `anchorsUsed`: ids lore utilisés (lieu/faction/histoire/acteur)
- `whatPlayerKnowsNow`: texte joueur court
- `hiddenTruth`: vérité interne IA (non affichée)
- `coherenceChecks`: statut des 5 gates
- `noveltyDelta`: ce qui change vs événements récents
- `consequenceIfIgnored`: évolution monde si non traité

## 8) Règle d’écriture côté joueur
- Le joueur voit un texte immersif bref, jamais la mécanique interne brute.
- L’outil garde la traçabilité interne pour audit/cohérence future.

## 9) Priorités d’implémentation (MVP)
1. Context Pack + ancres minimales obligatoires.
2. Gates de cohérence (au moins Canon/Local/Faction/Temps).
3. Anti-répétition simple (interdiction de répétition immédiate).
4. Format de sortie structuré.

## 10) Indicateurs qualité à suivre
- `% événements régénérés pour incohérence`
- `% répétitions détectées à 5 événements glissants`
- `% événements avec conséquence claire si ignorés`
- `Temps moyen de génération`
