# Matrice Narration Globale v1

Date: 2026-02-23
Statut: Référence de cadrage MVP
Portée: Gouvernance narrative globale (IA MJ, quêtes, trames, compagnons, lore)

## 1) Principes non négociables
- Narration = pilier principal.
- Règles mécaniques > exception narrative.
- L’échec est une bifurcation narrative, pas un game over.
- Toute crise majeure doit avoir une cause explicable côté joueur.

## 2) Contrat canonique d’un événement narratif (MVP)
Champs obligatoires:
- Type: Mission | Point d’intérêt | Trame
- Déclencheur: temps | ignorance | événement externe (PNJ/faction) | seuil relation/réputation
- Ce que le joueur sait maintenant
- Conséquence si ignoré
- Ancrages lore utilisés: lieu | faction | histoire | acteur

Champs recommandés:
- Niveau d’urgence
- Fenêtre temporelle
- Impact attendu (local, régional)

## 3) Horloge narrative globale
- Base: blocs de temps (heures/jours) + événements spéciaux.
- Les escalades de trame consomment des blocs de temps.
- Le repos agit comme pivot de progression, mais ne doit pas annuler les conséquences mondes en cours.

## 4) Cycle de vie minimal (MVP)
### Quête
- États: Détectée -> Acceptée -> Terminée
- Ignorée/abandonnée: conséquence significative

### Trame
- Démarrage: événement non élucidé ou ignorance répétée
- Escalade: variable selon trame, via déclencheurs validés
- Fin: peut se clore avec ou sans voie joueur

### Compagnon
- Loyauté: affection, confiance, alignement
- Évolution: tensions, départ durable possible, retour via arc dédié

## 5) Tableau de transitions à maintenir
Format obligatoire:
- État actuel | Condition | Nouvel état | Conséquence

Règle d’usage:
- Toute nouvelle mécanique narrative doit d’abord être exprimée dans ce tableau avant implémentation.

## 6) Cohérence lore et contradictions
- Règle active: en contradiction, la source la plus locale (zone active) prime.
- Toute contradiction résolue doit être journalisée (pour audit futur).
- La mémoire narrative s’atténue avec le temps, sauf événements majeurs.

## 7) Équité IA MJ et anti-frustration
- Explication post-événement majeur: obligatoire (cause, règle, impact).
- Éviter l’empilement de chocs narratifs sans fenêtre de reprise.
- Les conséquences doivent ouvrir au moins une continuité jouable (même négative).

## 8) Journal joueur (UX narrative)
- Vue principale: panneau structuré avec bandeaux.
- Catégories validées: Quêtes acceptées | Intrigues en cours | Trames monde actives.
- Tri par défaut: urgence/échéance.
- Modal de détail: faits + hypothèses du PJ.

## 9) KPI de suivi narration
Prioritaire:
- Taux de répétition sur fenêtre glissante.

Secondaires recommandés:
- Taux de régénération pour incohérence.
- Taux d’événements sans conséquence claire.
- Lisibilité perçue (retours joueur).

## 10) Définition de done (narration globale MVP)
- Contrat événement implémenté et respecté sur tous les types.
- Tableau de transitions rempli pour Quête/Trame/Compagnon.
- Horloge blocs de temps branchée aux escalades.
- Règle de contradiction locale appliquée systématiquement.
- Journal joueur fonctionnel avec catégories/tri/modal définis.
- KPI prioritaire mesuré et visible.
