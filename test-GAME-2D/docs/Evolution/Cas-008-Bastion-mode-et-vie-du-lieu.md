# Cas 008 — Mode Bastion (gestion + narration du lieu)

## 1) Contexte fonctionnel
- Nom de l’idée: mode bastion narratif
- Catégorie: `NARRATION` + `GESTION` + `CONTENU`
- Valeur joueur: un ancrage persistant qui devient un moteur de quêtes, d’évolution et d’ambiance.

## 2) Déclencheur
- Acquisition d’une propriété -> création `bastion_runtime`.

## 3) Systèmes actifs
- Gestion
- Recrutement PNJ
- Production
- Défense
- Développement
- Quêtes liées au lieu

## 4) Données bastion (référence)
```json
{
  "surface": 240,
  "rooms": [
    {"name": "Grande salle", "size": 80},
    {"name": "Quartiers", "size": 40}
  ],
  "neighborhood": "Quartier marchand",
  "security": "faible",
  "tier": 1
}
```

## 5) Support narratif
- Générateur d’événements
- Aide RP
- Variantes d’ambiance
- Vie du bastion

## 6) Ambiance dédiée
- Entrée en mode bastion: narration plus posée, ton calme, focus gestion/construction.

## 7) Critères de réussite
- Le bastion produit des conséquences concrètes (économie, sécurité, quêtes).
- La narration du lieu évolue selon l’état réel du bastion.
- Le joueur ressent une progression territoriale, pas juste un écran de stats.

## 8) Décision
- Priorité: `P1`
- Décision: `GO`
