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

## 11) Entrée en jeu & création de personnage (narration intégrée)
- Situation d’ouverture: `identique pour tous` (même scène de départ narrative).
- Séquence imposée:
	1. Scène d’introduction jouable courte (mise en contexte monde + enjeu initial).
	2. Passage obligatoire par les `Archives` (hub narratif/méta-diégétique).
	3. Ouverture du module `Création de personnage`.
	4. Retour en narration avec personnage créé et variables d’origine injectées.
- Contrat MVP:
	- La scène de départ ne dépend pas de la classe/race.
	- Les choix de création modulent les opportunités après le retour des Archives.

## 12) Contexte de lieu de départ (obligatoire)
- Chaque nouvelle partie doit initialiser un `Lieu de départ canonique`.
- Le lieu de départ doit fournir au minimum:
	- Gouvernance locale,
	- Faction(s) dominante(s),
	- Niveau ordre/chaos local,
	- 1 point d’intérêt immédiat,
	- 1 trame potentielle latente.
- Règle de cohérence: aucun événement initial ne peut ignorer ce contexte local.

## 13) Recrutement de compagnons & marchandage
### Recrutement compagnons
- Préconditions minimales:
	- Déclencheur narratif explicite,
	- Compatibilité minimale (affection/confiance/alignement),
	- Coût d’engagement (social, matériel, ou dette narrative).
- États recommandés de recrutement:
	- `Non rencontré` -> `Rencontré` -> `Négociation` -> `Recruté` | `Refus`.

### Marchandage
- Le marchandage est une interaction narrative à issue mécanique.
- Paramètres minimaux:
	- Position de départ du prix,
	- Levier narratif (réputation, relation, urgence, rareté),
	- Résultat borné (pas de rupture d’économie).
- Règle MVP: le marchandage ne doit jamais invalider les contraintes économiques globales.

## 14) Cadre MJ — règles DnD 2024
- Le MJ IA doit suivre les règles DnD 2024 comme `socle mécanique`.
- Politique d’arbitrage:
	- En conflit narration vs règle: la règle DnD 2024 prime.
	- Toute adaptation maison doit être déclarée explicitement comme `règle locale`.
- Traçabilité minimale côté système:
	- Référence de la règle appliquée,
	- Résolution produite,
	- Impact narratif résultant.

## 15) Politique de difficulté imposée par le MJ
- La difficulté est pilotée par le MJ IA mais doit rester lisible et cohérente.
- Entrées minimales de calibration:
	- Progression du groupe,
	- État des ressources,
	- Pression des trames en cours,
	- Contexte local (dangerosité).
- Garde-fous:
	- Pas de pics arbitraires sans cause narrative.
	- Après crise majeure: fenêtre de reprise (temps de répit).
	- Toute montée de difficulté doit générer au moins une voie de réponse jouable.

## 16) Extension de la définition de done (ajouts critiques)
- Entrée en jeu + passage Archives -> Création personnage -> retour narration implémentés.
- Lieu de départ canonique instancié avec ses champs obligatoires.
- Flux de recrutement compagnon et de marchandage branchés au runtime narratif.
- Cadre d’application DnD 2024 traçable dans les décisions MJ.
- Politique de difficulté active avec garde-fous de lisibilité et récupération.

## Annexes
- Tableau de transitions v1: [Transitions-v1-Quete-Trame-Compagnon-Marchandage.md](Transitions-v1-Quete-Trame-Compagnon-Marchandage.md)
