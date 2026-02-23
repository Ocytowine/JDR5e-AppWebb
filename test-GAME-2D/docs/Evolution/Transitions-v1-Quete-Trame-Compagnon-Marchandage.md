# Transitions v1 — Quête / Trame / Compagnon / Marchandage

Date: 2026-02-23
Statut: Pré-rempli (base MVP)
Format: `État actuel | Condition | Nouvel état | Conséquence`

## 1) Quêtes

| État actuel | Condition | Nouvel état | Conséquence |
|---|---|---|---|
| Détectée (non acceptée) | Le joueur accepte explicitement | Acceptée | Ajout au journal, suivi actif possible |
| Détectée (non acceptée) | Temps écoulé + ignorance répétée | Détectée (non acceptée) | Escalade potentielle en trame (si déclencheurs atteints) |
| Détectée (non acceptée) | Événement externe faction/PNJ modifie le contexte | Détectée (non acceptée) | Mise à jour des informations connues + niveau d’urgence |
| Acceptée | Objectif atteint selon conditions de quête | Terminée | Récompenses + impact réputation/relations + clôture journal |
| Acceptée | Délai dépassé ou condition critique non remplie | Acceptée | Échec narratif: conséquence monde + voie secondaire ouverte |
| Acceptée | Abandon explicite par le joueur | Acceptée | Conséquence significative (réputation/trame/relations) |

Notes MVP:
- L’échec est traité comme bifurcation, pas comme état terminal bloquant.
- Les états `Bloquée` / `Échouée` restent hors MVP (extension possible).

## 2) Trames monde

| État actuel | Condition | Nouvel état | Conséquence |
|---|---|---|---|
| Latente | Déclencheur actif (temps/ignorance/événement externe/seuil relation-réputation) | Active | Apparition dans journal (trame active) |
| Active | Escalade valide (cadence propre à la trame) | Active | Augmentation pression narrative + impact local/régional |
| Active | Intervention joueur réussie | Active | Réduction partielle de pression / réorientation de la trame |
| Active | Non-intervention prolongée | Active | Le monde agit de façon autonome (conséquences progressives) |
| Active | Condition de clôture atteinte (avec voie joueur) | Clôturée | Résolution contextualisée |
| Active | Condition de clôture atteinte (sans voie joueur) | Clôturée | Résolution autonome du monde |

## 3) Compagnons (relation + présence)

| État actuel | Condition | Nouvel état | Conséquence |
|---|---|---|---|
| Non rencontré | Déclencheur narratif de rencontre | Rencontré | Fiche relationnelle initialisée |
| Rencontré | Conditions minimales de compatibilité atteintes | Négociation | Ouverture de dialogue d’engagement |
| Négociation | Accord (social/matériel/dette narrative) | Recruté | Compagnon disponible selon règles d’activation |
| Négociation | Désaccord ou refus explicite | Refus | Fermeture temporaire, possible réouverture contextuelle |
| Recruté | Tension forte ou conflit de valeurs | Recruté | Baisse d’un ou plusieurs axes (affection/confiance/alignement) |
| Recruté | Rupture de seuil relationnel + contexte défavorable | Départ durable | Compagnon quitte le groupe, arc retour requis |
| Départ durable | Arc de réconciliation réussi | Recruté | Retour compagnon avec séquelles relationnelles possibles |

## 4) Marchandage (interaction narrative à issue mécanique)

| État actuel | Condition | Nouvel état | Conséquence |
|---|---|---|---|
| Offre initiale | Le joueur engage une tentative de marchandage | Négociation de prix | Calcul des leviers (réputation/relation/urgence/rareté) |
| Négociation de prix | Test/argument réussi dans les bornes système | Accord ajusté | Prix modifié dans plage autorisée |
| Négociation de prix | Test/argument échoué | Offre maintenue | Prix inchangé, possible impact relationnel |
| Négociation de prix | Échec critique ou exigence abusive | Rupture négociation | Vente refusée temporairement ou majoration contextuelle |
| Accord ajusté | Validation du joueur | Transaction conclue | Échange effectué, mise à jour économie + journal si pertinent |

Bornes MVP:
- Le marchandage ne doit pas casser l’économie globale.
- Les écarts de prix sont bornés par type d’objet/contexte.

## 5) Règles transverses de validation

- Toute transition doit référencer au moins un déclencheur explicite.
- Toute conséquence majeure doit être explicable au joueur (cause, règle, impact).
- Les transitions doivent respecter le contexte local prioritaire en cas de contradiction lore.
- En cas de conflit narration/règle DnD 2024: la règle prime.

## 6) Champs techniques recommandés (runtime)

- `entityType`: quest | trama | companion | trade
- `fromState`
- `trigger`
- `toState`
- `consequence`
- `ruleRef` (référence règle DnD 2024 ou règle locale déclarée)
- `loreAnchors`
- `timestamp` (bloc temps)

## 7) Fichiers runtime prêts à l’emploi

- Schéma JSON: [Transitions-v1-runtime.schema.json](Transitions-v1-runtime.schema.json)
- Exemple conforme: [Transitions-v1-runtime.example.json](Transitions-v1-runtime.example.json)
