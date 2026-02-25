# Plan Refonte MJ Tool-Driven v1

Date: 2026-02-25  
Statut: Plan directeur a appliquer strictement
Execution courante: Phase 0 stabilisee + Phase 1 en validation (grounding/outils).

## Cap produit
Construire un MJ narratif fluide, coherent lore, non rigidifie par mots-cles, pilote par IA + outils.

Principes non-negociables:
- Le MJ repond depuis l'etat du monde courant.
- Le lore est une contrainte de coherence, pas un texte recite.
- Le joueur agit en texte libre (pas de pseudo-menu systematique).
- Les mecanismes serveur valident et persistent; ils ne dictent pas la narration.

## Ordre strict d'execution
Ne jamais sauter une phase.  
Ne pas modifier la phase N+1 tant que la phase N n'est pas validee.

1. Phase 0: Contrat MJ unique
2. Phase 1: Bus d'outils IA
3. Phase 2: Contexte canonique unifie
4. Phase 3: Garde-fous lore
5. Phase 4: Session DB narrative
6. Phase 5: Moteur intentions -> mutations
7. Phase 6: Trames/quetes/evenements en fond
8. Phase 7: Rendu MJ naturel
9. Phase 8: Debug separe

## Phase 0 - Contrat MJ unique
Objectif:
- Unifier toute decision MJ dans un schema unique.

Entrees minimales:
- message joueur
- world state (lieu, temps, tension, reputation, pending)
- contexte fiche PJ
- hints lore/session

Sortie minimale:
- intent
- mj_response (directAnswer/scene/actionResult/consequences/options?)
- tool_calls
- world_mutations
- lore_guard_report
- confidence

Definition of done:
- Plus aucune branche ad hoc qui repond hors contrat.

Suivi implementation (2026-02-25):
- Injection automatique `mjContract`/`mjResponse` via `sendJson` cote API.
- Priorite d'extraction unifiee (payload.mjResponse -> mjStructured -> resolvers -> fallback parse reply).
- Instrumentation des sources de contrat (`contractSource`) avec compteur serveur.
- Commande diagnostic `/contract-debug` pour mesurer les cas restant en `parsed-reply`.

## Phase 1 - Bus d'outils IA
Objectif:
- Le MJ appelle des outils pour raisonner, au lieu d'etre pilote par regex.

Outils minimaux:
- get_world_state
- query_lore
- query_player_sheet
- query_rules
- session_db_read
- session_db_write
- quest_trama_tick

Definition of done:
- Chaque reponse MJ peut etre retracee a une lecture outil (visible en debug seulement).

Suivi implementation (2026-02-25):
- `toolCalls` autorise dans la sortie IA structuree MJ.
- Bus serveur `mjToolBus` initialise avec outils de base:
  `get_world_state`, `query_lore`, `query_player_sheet`, `query_rules`, `session_db_read`, `session_db_write`, `quest_trama_tick`.
- Traces outils (`mjToolTrace`) injectees dans les payloads MJ structures pour alimenter le contrat.
- Etape de raffinement IA ajoutee: la reponse MJ structuree est recomposee apres execution outils, en tenant compte des resultats (`toolResults`).
- Priorisation d'outils ajoutee cote serveur selon intention/mode/message (fusionnee avec `toolCalls` IA), pour stabiliser la pertinence des lectures.
- `session_db_write` reste volontairement en mode simulation jusqu'a la phase 4.

Validation Phase 1 (a executer avant passage Phase 2):
- Commande `/phase1-debug` disponible pour suivre:
  `narrativeTurns`, `groundedTurns`, `ungroundedTurns`, `groundingRatePct`, `byIntent`.
- Commande `/contract-debug` conservee pour verifier les sources de contrat.
- Jeu minimal de prompts:
  `ou suis-je ?`, `je cherche la gerante`, `combien d'or j'ai`, `puis-je lancer minor-ward ?`, `je veux aller au port`.
- Critere de sortie pratique:
  chaque tour narratif critique (RP scene/action) doit remonter au moins une lecture outil traçable en debug.

## Phase 2 - Contexte canonique unifie
Objectif:
- Une seule source de verite contextuelle pour le MJ.

Contenu:
- position canonique (ville/territoire/region/lieu)
- temps canonique
- interlocuteur actif
- etat social local
- resume PJ exploitable
- pending actions

Definition of done:
- "Ou suis-je ?" repond juste sans regles de phrase.

## Phase 3 - Garde-fous lore
Objectif:
- Bloquer les incoherences fictionnelles.

Regles:
- coherence geographie/biome/infrastructure
- coherence politique/factions
- coherence temporelle

Definition of done:
- 0 incoherence majeure sur le jeu de prompts lore.

## Phase 4 - Session DB narrative
Objectif:
- Memoire de partie locale et persistante.

Entites:
- lieux decouverts
- PNJ session
- faits etablis
- rumeurs
- dettes/promesses

Priorite resolution:
- session DB > lore canon > fallback

Definition of done:
- Le MJ reutilise naturellement les faits etablis en session.

## Phase 5 - Moteur intentions -> mutations
Objectif:
- Convertir une intention libre en evolution monde coherente.

Intentions de reference:
- observe
- move
- social
- investigate
- risk_action
- system

Mutations:
- temps
- position
- reputation
- tension locale
- flags narratifs

Definition of done:
- Chaque tour produit soit mutation validee, soit justification narrative claire de non-mutation.

## Phase 6 - Trames/quetes/evenements en fond
Objectif:
- Faire vivre le monde hors action immediate du joueur.

Mecanique:
- tick de fond apres chaque tour
- progression trames/quetes selon etat du monde
- emergence d'evenements

Definition of done:
- Le monde evolue sur session longue sans script force.

## Phase 7 - Rendu MJ naturel
Objectif:
- Reponse MJ immersive, non mecanique.

Regles:
- Pas de "Tu peux maintenant..." automatique.
- Pas de blocs systeme visibles en mode RP.
- Les options ne sont affichees que si le MJ le juge utile.

Definition of done:
- Lecture percue comme MJ, pas assistant a gabarits.

## Phase 8 - Debug separe
Objectif:
- Garder la puissance de diagnostic sans polluer le RP.

Regles:
- traces outils/guards/mutations en canal debug
- RP propre cote joueur

Definition of done:
- UX RP nette + debugging complet activable.

## Protocole de gouvernance
- Toute demande de correction passe d'abord par: diagnostic -> cause systemique -> solution de phase.
- Eviter les patchs reactionnels hors phase.
- Chaque phase doit etre fermee par une batterie de tests avant de passer a la suivante.

## Engagement d'execution
Ce document est le plan de reference.  
L'implementation doit suivre l'ordre strict des phases ci-dessus.
