# Cas 007 — Réputation, relations et perception sociale

## 1) Contexte fonctionnel
- Nom de l’idée: systèmes sociaux narratifs
- Catégorie: `NARRATION` + `MEMOIRE` + `SOCIAL`
- Valeur joueur: des PNJ qui réagissent à ce que le joueur projette et a fait, pas à des métadonnées cachées.

## 2) Perception sociale
- Les classes ne sont pas visibles socialement.
- Les PNJ jugent: apparence, posture, attitude, réputation.
- Aucun PNJ ne “détecte” directement la classe.

## 3) Réputation (globale)
Variables:
- `rep_local`
- `rep_faction`
- `rep_global`

Effets:
- accès/fermeture de dialogues
- accueil/hostilité de zone
- coûts/avantages contextuels

## 4) Lien relationnel (PNJ individuel)
Variables:
- `trust`
- `affinity`
- `fear`
- `debt`
- `history_flags`

Effets:
- dialogues modifiés
- quêtes uniques
- aides/trahisons
- réactions émotionnelles

## 5) Logique runtime (concept)
```txt
NarrativeSystem
 ├─ HRP_notifications()
 ├─ reputation_update()
 ├─ relationship_update()
 └─ social_perception_eval()
```

## 6) Critères de réussite
- Les interactions sociales évoluent visiblement selon l’historique.
- Les variables sociales influencent réellement quêtes et comportements.
- Les retours HRP restent légers, sans casser l’immersion.

## 7) Décision
- Priorité: `P0`
- Décision: `GO`
