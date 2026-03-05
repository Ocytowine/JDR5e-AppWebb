# Kit MJ - Cas pratiques v1

## But du kit

Ce document sert a piloter le module narration comme un MJ operationnel.
Le focus est: quoi lire, quoi decider, quoi renvoyer, quoi preparer pour le tour suivant.

Ce n'est pas un document UI.
Ce n'est pas un document d'implementation technique detaillee.

## Boucle MJ en 6 etapes

1. Lire l'action joueur et reformuler l'objectif reel.
2. Verifier le contexte local (acteurs, acces, tension, danger, temps).
3. Choisir l'arbitrage: auto reussite, test, refus, clarification.
4. Produire une reaction visible immediate cote joueur.
5. Appliquer les consequences systeme (relations, flags, temps, alerte, memoire).
6. Preparer 2-3 suites probables pour garder la scene fluide.

## Regles transverses

- Ne jamais inventer un fait absent de la verite systeme.
- Si intention ambigue, demander clarification avant action irreversible.
- Separer strictement ce qui est visible joueur et ce qui est verite cachee.
- Toute consequence durable doit etre tracee (memoire ou event).
- Toute action risquee doit avoir un cout/risque explicite.

## Matrice des 10 actions frequentes

### 1) Saluer / aborder un PNJ

- `action_joueur`: "Je salue la personne devant moi."
- `intention_probable`: ouvrir contact social, tester disposition.
- `donnees_minimales_requises`: role PNJ, humeur, disposition envers PJ, etiquette locale.
- `arbitrage`: auto le plus souvent; test social si contexte tendu.
- `reactions_mj_possibles`: salut neutre, froideur, accueil positif, demande protocolaire.
- `consequences_immediates`: ouverture ou fermeture du dialogue.
- `preparation_tour_suivant`: sujet de conversation probable, seuil de mefiance.
- `runtime_hint`: `startDialogue(target_id)` ou aucune commande si pure narration.

### 2) Observer une zone

- `action_joueur`: "J'observe l'entree."
- `intention_probable`: obtenir des indices, evaluer risques.
- `donnees_minimales_requises`: visibilite, elements saillants, activite locale, heure/meteo.
- `arbitrage`: auto pour evident; test perception pour detail cache.
- `reactions_mj_possibles`: description neutre, indice partiel, contradiction apparente.
- `consequences_immediates`: nouvelles infos visibles.
- `preparation_tour_suivant`: 2 pistes actionnables basees sur ce qui est vu.
- `runtime_hint`: `queryLore(topic_ids)` ou `requestCheck(skill_id=perception, ...)`.

### 3) Demander une information

- `action_joueur`: "Je demande ce qu'il s'est passe ici."
- `intention_probable`: extraire une verite utile via social.
- `donnees_minimales_requises`: ce que le PNJ sait, fiabilite, peur/interet, tabous.
- `arbitrage`: auto pour info publique; test social pour info sensible.
- `reactions_mj_possibles`: info utile, info partielle, info biaisee, refus poli.
- `consequences_immediates`: qualite d'info recueillie.
- `preparation_tour_suivant`: recoupement possible, nouvelle cible PNJ/lieu.
- `runtime_hint`: `startDialogue(...)`, `queryLore(...)`, eventuel `requestCheck(...)`.

### 4) Se deplacer vers un point

- `action_joueur`: "Je vais vers la porte des archives."
- `intention_probable`: changer position pour agir.
- `donnees_minimales_requises`: distance, acces, obstacle, zone interdite.
- `arbitrage`: auto si acces normal; refus/clarify si destination inconnue.
- `reactions_mj_possibles`: deplacement simple, blocage garde, contretemps.
- `consequences_immediates`: position mise a jour, temps avance.
- `preparation_tour_suivant`: interactions disponibles a destination.
- `runtime_hint`: `moveLocal(...)`, puis `enterLocation(...)` si applicable.

### 5) Entrer dans un lieu

- `action_joueur`: "J'entre."
- `intention_probable`: franchir un acces.
- `donnees_minimales_requises`: statut acces (ouvert/restreint/ferme), autorisation, surveillance.
- `arbitrage`: auto si ouvert; test ou refus si restreint.
- `reactions_mj_possibles`: entree fluide, controle, refus sec, exigence de preuve.
- `consequences_immediates`: changement de lieu, tension sociale eventuelle.
- `preparation_tour_suivant`: nouveaux PNJ/objets scene interieure.
- `runtime_hint`: `enterLocation(...)`, eventuel `requestCheck(...)` ou `rejectAction(...)`.

### 6) Fouiller / inspecter un objet

- `action_joueur`: "Je fouille le bureau."
- `intention_probable`: trouver preuve, ressource, secret.
- `donnees_minimales_requises`: etat objet, contenu possible, risque piege/surveillance.
- `arbitrage`: test si resultat non trivial.
- `reactions_mj_possibles`: rien d'utile, indice mineur, element cle, declenchement risque.
- `consequences_immediates`: info/objet obtenu ou alerte.
- `preparation_tour_suivant`: lien avec fragment/event en cours.
- `runtime_hint`: `requestCheck(...)`, `addJournalEntry(...)`, eventuel `createEvent(...)`.

### 7) Mentir / persuader / intimider

- `action_joueur`: "Je le convaincs de me laisser passer."
- `intention_probable`: modifier comportement PNJ.
- `donnees_minimales_requises`: psychologie cible, rapport de force, enjeux du PNJ.
- `arbitrage`: test social quasi systematique.
- `reactions_mj_possibles`: accepte, hesite, refuse, contre-demande.
- `consequences_immediates`: statut social local modifie.
- `preparation_tour_suivant`: memoriser disposition PNJ et seuil d'escalade.
- `runtime_hint`: `requestCheck(...)`, `setFlag(...)`, mise a jour relation.

### 8) Action interdite (vol, intrusion forcee)

- `action_joueur`: "Je vole le document."
- `intention_probable`: obtenir gain rapide a haut risque.
- `donnees_minimales_requises`: surveillance, difficultes, sanctions, temoins.
- `arbitrage`: test ou refus si impossible.
- `reactions_mj_possibles`: succes discret, succes partiel, echec avec detection.
- `consequences_immediates`: alerte, reputation, changement securite locale.
- `preparation_tour_suivant`: reaction garde/faction, branche fuite/social/combat.
- `runtime_hint`: `requestCheck(...)`, `createEvent(...)`, `setFlag(...)`, eventuel `startCombat(...)`.

### 9) Utiliser une competence / outil / pouvoir

- `action_joueur`: "J'utilise perception magique sur la salle."
- `intention_probable`: reveler un niveau d'information non visible.
- `donnees_minimales_requises`: prerequis, cout ressource, portee, contrepartie.
- `arbitrage`: auto si effet garanti; test/resistance selon regles.
- `reactions_mj_possibles`: revelation utile, bruit narratif, effet partiel.
- `consequences_immediates`: ressources consommees, nouvelles infos.
- `preparation_tour_suivant`: opportunite ouverte par la revelation.
- `runtime_hint`: `requestCheck(...)`, `advanceTime(...)`, mise a jour ressource/etat.

### 10) Action vague / meta

- `action_joueur`: "Je fais ce qu'il faut."
- `intention_probable`: indeterminee.
- `donnees_minimales_requises`: aucune suffisante sans precision.
- `arbitrage`: clarification obligatoire.
- `reactions_mj_possibles`: question guidee avec 2-3 options claires.
- `consequences_immediates`: aucune action irreversible.
- `preparation_tour_suivant`: attente choix joueur explicite.
- `runtime_hint`: `ASK_CLARIFY` (ou equivalent), `runtime_actions=[]`.

## Templates reutilisables

### Template scene locale

```json
{
  "scene_id": "scene-xxx",
  "location_id": "location-xxx",
  "time_of_day": "late_afternoon",
  "weather": "clear",
  "actors_present": [
    { "actor_id": "npc-1", "role": "guard", "disposition_to_player": "neutral" }
  ],
  "access_state": {
    "main_entry": "restricted"
  },
  "tension_level": "low",
  "active_risks": ["surveillance"]
}
```

### Template PNJ reactif

```json
{
  "actor_id": "npc-1",
  "role": "guard",
  "knows": ["entree reservee"],
  "wants": ["respect du protocole"],
  "fears": ["sanction hierarchique"],
  "player_disposition": "neutral",
  "escalation_thresholds": {
    "suspicion_up_if": ["insistance", "mensonge_detecte"],
    "hostile_if": ["force_entry"]
  }
}
```

### Template consequence

```json
{
  "turn_id": "turn-xxx",
  "visible_outcome": "Le garde bloque l'acces et demande une raison valable.",
  "system_updates": [
    { "type": "flag", "id": "guard_suspicion", "op": "increment", "value": 1 },
    { "type": "time", "op": "add_minutes", "value": 2 }
  ],
  "memory_updates": {
    "player_view": ["Le garde filtre strictement l'entree."],
    "truth_view": ["Le poste de garde a ete renforce ce soir."]
  },
  "next_options": ["dialoguer", "observer", "quitter_zone"]
}
```

## DoD pratique (PASS/FAIL)

Un cas pratique est considere pret si:

1. L'intention joueur est reformulee clairement (objective explicite).
2. Les donnees minimales requises sont presentes ou une clarification est demandee.
3. L'arbitrage choisi est justifie (auto/test/refus/clarify).
4. La reaction immediate joueur est coherente avec le contexte local.
5. Les consequences systeme sont tracees (memoire, flags, temps, event si necessaire).
6. Aucune verite cachee n'est leakee dans la sortie joueur.
7. Le tour suivant dispose de 2-3 options preparees.

## Priorite d'usage

Pour avancer vite en v1:

1. Implementer d'abord les cas 1, 2, 4, 10.
2. Puis ajouter 3, 5, 8 (noyau enquete + securite logique).
3. Ensuite enrichir 6, 7, 9 selon besoins de campagne.

