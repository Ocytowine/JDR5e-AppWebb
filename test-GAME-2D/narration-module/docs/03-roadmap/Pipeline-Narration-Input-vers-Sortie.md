# Pipeline narration: de l'input joueur a la sortie narrative

Ce document explique, en francais simple, comment le module narration traite un tour:

1. le joueur envoie une action
2. le serveur l'interprete
3. le runtime applique les effets
4. l'IA aval redige le texte final
5. la memoire est mise a jour
6. le cycle recommence au tour suivant

L'objectif est de comprendre le chemin complet "input -> runtime -> narration -> memoire -> tour suivant".

## Vue d'ensemble

Le pipeline est separe en deux grandes etapes:

1. `/api/narration-module/process-turn`
   - interprete l'intention
   - prepare la memoire projetee
   - applique les actions runtime
   - construit un `ai_handoff`

2. `/api/narration-module/generate-narration`
   - prend le `ai_handoff`
   - demande a l'IA aval de rediger la scene finale
   - applique les mises a jour de memoire post-narration

En pratique, `process-turn` produit la verite de jeu du tour, puis `generate-narration` produit le texte joueur.

## La boucle complete d'un tour

```text
[Input joueur]
    |
    v
[process-turn]
    |
    +--> ouverture session memoire du tour
    +--> avance d'horloge + cleanup
    +--> projection memoire avant intention
    +--> analyse de l'intention
    +--> normalisation / resolution par intent
    +--> seed de scene / lore / acteurs visibles
    +--> construction du plan runtime
    +--> execution runtime
    +--> resynchronisation memoire
    +--> construction du ai_handoff
    |
    v
[generate-narration]
    |
    +--> prompt aval a partir du ai_handoff
    +--> narration finale joueur
    +--> fallback si la narration viole le contrat
    +--> ecriture des resumes / leads / updates d'interaction
    |
    v
[Memoire de campagne mise a jour]
    |
    v
[Tour suivant]
```

## 1. Entree joueur

Le client envoie un paquet qui contient notamment:

- `campaign_id`
- `character_id`
- `player_input`
- `location_id`
- `player_narrative_snapshot`
- `narration_context`
- `narration_goal`
- `narration_constraints`

Ce paquet ne dit pas encore "quoi faire exactement". Il donne le contexte brut du tour.

## 2. Ouverture du tour dans `process-turn`

Le handler principal initialise la session de tour.

Operations importantes:

- ouverture d'une session memoire de tour
- incrementation du `turn_index`
- reevaluation d'eventuels enrichissements d'entites en attente
- nettoyage des entites expirees

But:
- travailler en memoire sur un etat coherent
- ne pas reecrire le store JSON a chaque mini-operation

## 3. Projection memoire avant intention

Avant meme de choisir l'action, le systeme construit une projection memoire utile au tour courant.

Cette projection fusionne:

- le canon wiki
- les overrides de campagne
- le contexte local du tour
- les entites, relations, events et connaissances pertinents

But:
- donner a l'analyse d'intention un contexte compact
- eviter de raisonner sur toute la memoire brute

## 4. Analyse de l'intention

Le module amont produit un `intent_packet`.

Exemples d'intents:

- `observe`
- `ask_info`
- `move_local`
- `talk`
- `attempt_forbidden`
- `meta_unclear`

Le paquet contient typiquement:

- `intent_type`
- `intent_confidence`
- `destination_id`
- `target_actor_hint`
- `target_actor_id`
- `requires_clarification`
- `clarification_question`

Important:
- ce paquet n'est pas la verite finale
- il passe ensuite dans des resolvers metier cote serveur

## 5. Normalisation et resolution par intent

Le serveur applique ensuite des helpers dedies par type d'intent.

### `observe`

Role:
- decrire ce qui est perceptible ici et maintenant

Le resolver:
- detecte un focus perceptif eventuel
- verifie les acteurs visibles
- prepare la scene locale

Regle importante:
- si aucun acteur n'est visible, la narration ne doit pas inventer un PNJ directement abordable

### `ask_info`

Role:
- repondre a une question de savoir du PJ

Le resolver:
- verifie si la question est vraiment une demande de connaissance
- requalifie vers `observe` si le joueur demande en fait "ce qu'il voit"
- priorise une cible acteur si la question vise une entite connue

### `move_local`

Role:
- deplacer le PJ localement

Le resolver:
- tente de convertir une destination textuelle en destination canonique
- peut utiliser le lore, les sorties visibles, les synonymes et le contexte local
- refuse un faux deplacement si rien de concret n'est resolu

Exemple sain:
- "je vais aux archives" -> `quartier_des_archives`

Exemple refuse:
- "je me rapproche des marchands" si aucun sous-espace ou acteur approchable n'est materialise

### `talk`

Role:
- engager un dialogue avec une cible sociale

Le resolver:
- gere la continuite de dialogue
- gere les clarifications pendantes
- cherche un acteur visible / proche / resoluble
- refuse de creer un PNJ ex nihilo si personne n'est vraiment contactable

But:
- parler a quelqu'un deja revele ou legitimement approchable
- ne pas transformer une ambiance de foule en interlocuteur magique

## 6. Seed de scene et lore local

Une fois l'intention stabilisee, le serveur nourrit l'etat de scene.

Il peut:

- charger du lore wiki cible
- charger du lore local de campagne
- creer ou mettre a jour l'etat runtime du lieu
- materialiser des acteurs visibles si l'intent l'exige vraiment

Exemples:

- `buildLocationRuntimeSeed(...)`
- `ensureObservedSceneActors(...)`
- `ensureAmbientSceneActors(...)`

Le point cle est la distinction entre:

- ambiance de lieu
- presence diffuse
- acteur visible
- acteur parlable

Cette distinction evite de confondre "un marche vivant" avec "un marchand deja disponible".

## 7. Construction du plan runtime

Le serveur construit ensuite:

- `input_contract`
- `output_contract`

Le `output_contract` fixe:

- la decision retenue
- le plan
- les risques
- les actions runtime a executer
- les contraintes de narration

Exemples d'actions runtime:

- `moveLocal`
- `queryLore`
- `advanceTime`
- `startDialogue`

Le contrat sert de pont entre la resolution metier et l'execution runtime.

## 8. Execution runtime

Le moteur runtime recoit:

- le `turnId`
- le `input_contract`
- le `output_contract`
- le `stateBefore`

Il execute les actions et renvoie un `trace` contenant notamment:

- `runtime_actions`
- `state_diff`
- `state_after`

Cette etape est la verite systeme du tour.

Autrement dit:
- si ce n'est pas dans le runtime, ce n'est pas arrive

## 9. Resynchronisation de la memoire

Apres execution runtime, le serveur reinjecte le resultat dans la memoire de campagne.

Il met a jour notamment:

- `world_overrides`
- les entites runtime
- les verites locales
- les `hidden_truth_updates`

Puis il recalcule:

- la verite effective apres tour
- la projection memoire apres tour

Cette projection post-tour servira a la narration aval.

## 10. Construction du `ai_handoff`

Le `ai_handoff` est le paquet transmis a l'IA narratrice aval.

Il contient:

- l'intention finale retenue
- le contrat d'entree
- le contrat de sortie
- les actions runtime executees
- le diff d'etat
- la verite effective
- la memoire projetee
- le lore selectionne
- les demandes d'enrichissement d'entites
- pour `talk`, un `talk_context` riche

Le `talk_context` peut inclure:

- la cible principale
- les acteurs proches
- le mode de scene
- les roles `primary / secondary / background`
- des `speaker_cues`
- un `dialogue_blueprint`

But:
- donner a l'IA aval une base fiable
- eviter qu'elle improvise la logique metier

## 11. Generation de la narration finale

La route `/generate-narration` prend le `ai_handoff` et construit un prompt aval tres contraint.

Regles importantes:

- ne pas inventer d'action non executee
- ne pas reveler la verite cachee
- respecter la perception immediate en `observe`
- produire du dialogue direct en `talk` quand le contrat l'impose

L'IA renvoie un JSON structure:

- `player_text`
- `mj_notes`
- `next_turn_hints`
- `entity_enrichment_proposals`

## 12. Garde-fous de narration

Le module n'accepte pas aveuglement la sortie du modele.

Il applique des garde-fous:

- fallback si la narration manque le discours direct attendu en `talk`
- filtrage des `next_turn_hints`
- sanitation des enrichissements d'entites

Exemple:
- si un `talk` demande du discours direct mais que le modele renvoie un resume plat, le serveur reconstruit une scene dialogique minimale

## 13. Ecriture memoire post-narration

Une fois la narration finale obtenue, le serveur ecrit:

- un resume automatique joueur
- des leads automatiques
- des mises a jour d'interaction sur l'acteur parle
- d'eventuels enrichissements differees ou acceptes

Cette phase est importante car elle alimente le tour suivant.

Le systeme ne repart donc jamais de zero:
- il repart de la memoire mise a jour par la narration du tour precedent

## 14. La boucle de campagne

Le tour suivant recommence avec:

- un `turn_index` plus haut
- une memoire joueur enrichie
- un etat local mis a jour
- des acteurs potentiellement deja connus
- un contexte de dialogue potentiellement actif

La boucle complete ressemble a ceci:

```text
Tour N
  -> input joueur
  -> process-turn
  -> runtime execute
  -> ai_handoff
  -> generate-narration
  -> memoire mise a jour

Tour N+1
  -> nouvelle projection memoire
  -> nouvelle interpretation
  -> nouvelle execution
  -> nouvelle narration
```

## 15. Regle mentale utile pour debugger

Pour comprendre un bug, il faut toujours se demander a quel niveau il est apparu:

1. `input joueur`
   - la demande a-t-elle ete mal formulee ou mal contextualisee ?

2. `intent_packet`
   - l'intention a-t-elle ete mal classee ?

3. `resolvers metier`
   - le serveur a-t-il mal normalise `observe / ask_info / move_local / talk` ?

4. `runtime`
   - l'action a-t-elle reellement ete executee ?

5. `ai_handoff`
   - le paquet donne a l'IA aval etait-il correct ?

6. `narration aval`
   - le texte final a-t-il sur-interprete le paquet runtime ?

En pratique:
- si le runtime ne contient pas un fait, la narration n'aurait pas du l'affirmer
- si la narration affirme un fait absent du runtime, le probleme est soit dans le handoff, soit dans les garde-fous aval

## 16. Resume ultra court

Le pipeline fonctionne comme une boucle a 4 couches:

1. le joueur demande quelque chose
2. le serveur convertit cette demande en intention et en actions runtime
3. le runtime produit la verite du tour
4. l'IA aval transforme cette verite en texte joueur et enrichit la memoire

Puis le cycle recommence.
