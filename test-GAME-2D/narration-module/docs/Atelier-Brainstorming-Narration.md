# Atelier Brainstorming — Narration

Date: 2026-02-23
Format: Lots de 4 questions rapides

## Lot 1 — Cadrage
- Pilier prioritaire: Quêtes & arcs narratifs
- Style: Mélange adaptatif selon contexte
- Contrôle: Très cadré (règles strictes)
- Cadence: Lots courts successifs

## Lot 2 — Design quêtes
- Structure retenue: Procédurale majoritaire
- Complexité: 3 niveaux (`simple`, `standard`, `épique`)
- Gestion échec: Conséquence narrative + autre voie (pas de blocage dur)

### Déclencheurs / types narratifs exprimés

#### 1) Mission
- Forme: demande claire formulée
- Portée: mineure ou majeure
- Cible: PJ ou autre entité
- Exemple: contrat affiché (vol de charrette, récompense, contact)

#### 2) Point d’intérêt
- Origine: ne découle pas forcément d’une action du PJ
- Présentation: altercation, perception passive, autres sens
- Effet: libre attention du joueur, enquête possible
- Exemple: bruit étrange au grenier

#### 3) Trame
- Origine: événement non élucidé (point d’intérêt ignoré ou quête non menée)
- Évolution: escalade vers conséquence ou quête majeure

## Points déjà verrouillés
- Narration = pilier central
- Règles strictes
- Quêtes procédurales avec cadre structuré

## Lot 3 — Formalisation du socle
- Typologie `Mission / Point d’intérêt / Trame`: **socle officiel**
- Source des points d’intérêt: pas limitée aux sens (aussi rêves, courrier, autres vecteurs)
- Rythme d’escalade d’une trame: **moyen** (plusieurs étapes)
- Contrats (infos minimales): `Objectif` (autres champs à préciser)

## Lot 4 — Règles de génération
- Fréquence des points d’intérêt aléatoires: **faible (rare)**
- Trame après ignorance mission/point d’intérêt: **évolution seulement parfois**
- HRP en aventure: minimal strict
- HRP en test: besoin d’un mode debug avec notifications abondantes

### Note à clarifier
- Contrats: choix reçu à la fois `Objectif suffit` et `Commanditaire`.
- Proposition de règle conditionnelle: `Objectif` obligatoire, `Commanditaire` recommandé/optionnel selon source de mission.

### Décision actée
- Contrats: `Objectif` **et** `Commanditaire` obligatoires.

## Lot 5 — Cycle de vie des quêtes
- États retenus: `Détectée (non acceptée)`, `Acceptée`, `Terminée`
- Suivi joueur: `Panneau journal structuré`
- Déclencheurs d’escalade validés:
	- Temps écoulé
	- Ignorance répétée
	- Événement externe (PNJ/faction)
	- Seuil relation/réputation
- Abandon d’une quête acceptée: **conséquence significative**

### Point de conception à traiter
- Les états `En cours`, `Bloquée`, `Échouée` ne sont pas retenus pour l’instant.
- Si besoin, ils pourront être réintroduits en extension du cycle minimal.

## Lot 6 — Contraintes du procédural
- Sources prioritaires de génération:
	- `État du monde (factions, tensions, événements)`
	- `Contexte local (zone, météo, ressources, dangers)`
- Squelette MVP de quête: `Objectif + étapes séquentielles (2 à 4) + résolution`
- Anti-répétition obligatoire: `Variation obligatoire de la complication`
- Quête ignorée/abandonnée: `Escalade automatique dans le monde (impact fort)`

## Lot 7 — Gouvernance IA MJ
- Autorité IA MJ: **forte** (peut créer/transformer des situations librement)
- Garde-fou MVP non négociable: `Respect strict des règles mécaniques (pas d’exception narrative)`
- Priorité en cas de conflit: `Règle mécanique d’abord`
- Transparence UI: `Minimal` (effets visibles, raisonnement caché)

## Lot 8 — Récompenses, économie et pacing
- Récompenses prioritaires MVP:
	- `Récompenses matérielles (or, objets)`
	- `Déblocages narratifs (infos, accès, alliances)`
	- `Progression personnage (XP, talents, aptitudes)`
	- `Réputation/relations sociales`
- Garde-fou inflation MVP: `Aucun garde-fou MVP`
- Rythme de montée en puissance visé: `Lent et exigeant`
- Rôle du repos: `Central` (repos = pivot de progression)

### Point d’attention
- L’absence de garde-fou inflation au MVP est volontaire mais à revalider en pré-prod pour éviter les effets boule de neige.

## Lot 9 — Bastion et compagnons (coûts/risques)
- Entretien bastion: `Coût variable selon taille/activité du bastion`
- Non-paiement entretien: `Dégradation forte` (services indisponibles, tensions)
- Compagnons actifs simultanés: `3+ compagnons actifs max`
- Pression narrative pendant absence joueur: `Moyen` (incidents contextuels)

## Lot 10 — Échec, mort et récupération
- Définition d’un échec MVP: `Objectif de quête non atteint (délai/conditions)`
- Mort PJ (règle de base): `Mort possible avec options de retour coûteuses`
- Séquelles après retour à la vie: `Séquelles possibles`
- Vitesse de récupération après crise majeure: `Lente` (arc dédié)

### Point à clarifier
- Conséquence par défaut lors d’un échec MVP:
	- L’échec est une `étape`, jamais une fin de partie.
	- Impact `narratif` prioritaire (monde qui continue, opportunités secondaires, réputation, relation compagnons).
	- Exemple: village non sauvé -> survivants à aider, image dégradée, compagnon affecté.

## Lot 11 — Relations compagnons (loyauté/trahison)
- Modèle de loyauté MVP: `3 axes` (`affection`, `confiance`, `alignement`)
- Trahison: `Possible à tout moment selon IA MJ`
- Départ de compagnon: `Départ durable`, retour via `arc dédié`
- Réconciliation après conflit fort: `Variable selon gravité`

### Point de vigilance
- La trahison possible à tout moment donne une grande liberté à l’IA MJ; des garde-fous d’équité/perception joueur seront à cadrer en lot dédié.

## Lot 12 — Équité IA MJ (lisibilité/anti-frustration)
- Signal préalable avant événement IA MJ dur: `Aucun signal préalable`
- Explication après événement majeur: `Résumé structuré` (`cause`, `règle`, `impact`)
- Garde-fou anti-frustration prioritaire: `Temps de répit après crise narrative`
- Override debug: `Non` (jamais d’override)

### Note de cohérence
- Le système assume une surprise possible avant événement dur, compensée par une lisibilité forte après coup et une fenêtre de répit narrative.

## Lot 13 — Contrats de quêtes (texte/ton/variantes)
- Format principal du contrat: `Narratif moyen` (petit paragraphe immersif)
- Ton dominant: `Variable selon faction/donneur`
- Niveau de variantes textuelles MVP: `Élevé` (variantes contextuelles larges)
- Vision UX formulée:
	- Boucle centrale = échange `MJ < PJ < MJ`
	- UI en onglets avec un onglet `Quêtes`
	- Bandeaux pour `quêtes acceptées/suivies`, `intrigues`, `trames`
	- Au clic sur un bandeau: petit modal affichant ce qui est connu à ce stade

### Point de conception
- Les champs minimaux affichés en permanence (`objectif`, `commanditaire`, `urgence`, `récompense`, `risque`) restent à fixer explicitement dans un lot UI dédié.

## Lot 14 — Journal de quêtes (bandeaux/tri/affichage)
- Bandeaux séparés visuellement:
	- `Quêtes acceptées`
	- `Intrigues en cours`
	- `Trames monde actives`
- Tri par défaut: `Urgence/échéance d’abord`
- Niveau d’info modal MVP: `Moyen` (`faits + hypothèses du PJ`)
- Highlight automatique d’un bandeau si:
	- `Nouvelle info critique`
	- `Changement d’état`
	- `Risque d’échéance proche`

## Lot 15 — Trames monde (escalade/cadence/résolution)
- Cadence d’escalade: `Variable selon trame`
- Déclencheurs d’escalade (alignés Lot 5):
	- `Temps écoulé`
	- `Ignorance répétée`
	- `Événement externe (PNJ/faction)`
	- `Seuil relation/réputation`
- Extension validée: le `monde` peut prendre part activement à la trame (évolutions autonomes)
- Résolution: certaines trames peuvent se clore `sans voie joueur`
- Traçabilité journal: `Timeline structurée` (`étape`, `cause`, `impact`)

## Lot 16 — Priorité narration globale (noyau opérationnel)
- Champs obligatoires d’un événement narratif MVP:
	- `Type` (`Mission` / `Point d’intérêt` / `Trame`)
	- `Déclencheur` (temps / ignorance / PNJ-faction / relation-réputation)
	- `Ce que le joueur sait maintenant`
	- `Conséquence si ignoré`
	- `Ancrages lore utilisés` (lieu/faction/histoire/acteur)
- Gestion des contradictions lore: `La source la plus locale (zone active) prime`
- Horloge narrative globale: `Blocs de temps (heures/jours) + événements spéciaux`
- Équité IA MJ absolue: `Toujours expliciter la cause après un choc narratif`

## Lot 17 — Priorité narration globale (gouvernance longue)
- Transitions d’états: `Tableau clair` avec colonnes `état actuel / condition / nouvel état / conséquence`
- Mémoire narrative long terme: `Atténuation avec le temps`, sauf `événements majeurs`
- Charte de ton globale: `Sobriété politique réaliste + intensité contrôlée`
- KPI prioritaire suivi narration: `Taux de répétition sur fenêtre glissante`

## Lot 18 — Branche IA Character Creator (esthétique + lore)
- Objectif MVP: proposer un `copilote IA` qui affine `style visuel` + `background` sans remplacer les choix du joueur
- Positionnement: complément direct du `Character Creator`, connecté au module `narration` et au module `tactique`
- Entrées minimales joueur:
	- `Race / classe / historique`
	- `2 à 5 traits de personnalité`
	- `1 contrainte visuelle forte` (ex: cicatrice, symbole, couleur dominante)
	- `1 ambition narrative` (ex: vengeance, rédemption, ascension)

### Pipeline UX proposé (MVP)
1. Le joueur remplit une base courte (identité + intentions)
2. L’IA propose `3 directions esthétiques` + `3 variantes de background`
3. Le joueur sélectionne/édite une proposition
4. L’IA génère:
	- un `prompt token tactique` (vue top-down / lisibilité grille)
	- un `prompt portrait fiche narration` (buste/plan rapproché, expressif)
5. Le joueur valide, régénère ou verrouille le résultat

### Règles de cohérence lore
- Toute proposition IA doit référencer explicitement:
	- `ancrage faction` (ou absence assumée)
	- `ancrage lieu/région`
	- `événement fondateur` du personnage
- Interdits de cohérence:
	- pas de contradiction avec les règles mécaniques (Lot 7)
	- pas d’élément visuel/lore hors cadre de ton global (Lot 17)
- Sortie background structurée recommandée:
	- `Origine`
	- `Motivation actuelle`
	- `Secret / dette / fracture`
	- `Lien monde` (PNJ, faction, lieu)

### Prompts image — gabarits de sortie
- Gabarit `Token tactique`:
	- "Créer un token de jeu de rôle fantasy, vue du dessus lisible sur grille, silhouette claire, palette contrôlée, fond propre/isolé, équipement cohérent avec [classe], marque visuelle [contrainte], style semi-réaliste, sans texte, sans watermark."
- Gabarit `Portrait narration`:
	- "Créer un portrait de personnage fantasy pour fiche narrative, cadrage buste, expression [trait dominant], détails vestimentaires cohérents avec [origine sociale], lumière dramatique modérée, arrière-plan discret lié à [région], style illustratif cohérent, sans texte, sans watermark."

### Données à stocker (liaison modules)
- `character_ai_profile`:
	- `style_tags[]`
	- `lore_tags[]`
	- `prompt_token_current`
	- `prompt_portrait_current`
	- `version`
- Historique minimal:
	- `prompt_history[]` (timestamp + type + seed si dispo)
	- `validation_state` (`draft` / `validated` / `locked`)

### Critères d’acceptation MVP
- Le joueur peut générer au moins `1 token` et `1 portrait` exploitables sans retouche lourde
- Le background IA produit une version courte (5–8 lignes) + une version étendue (15–25 lignes)
- Les sorties restent cohérentes avec la charte de ton et les règles mécaniques
- Le flux complet tient en `<= 3 minutes` pour une première itération

## Synthèse opérationnelle
- Référence unique: [Matrice-Narration-Globale-v1.md](Matrice-Narration-Globale-v1.md)
