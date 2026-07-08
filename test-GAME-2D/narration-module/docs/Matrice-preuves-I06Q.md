# Matrice de preuves I-06Q — scénario vertical qualité Locale/OpenAI

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06Q vérifie la qualité réelle de la boucle narrative de référence avant toute nouvelle généralisation. Le lot n'ajoute pas de capacité métier : il mesure le chemin existant `NarrativeTurnControllerV1` puis enrichissement IA local ou OpenAI-compatible.

## Périmètre livré

- scénario vertical fixe de 12 entrées joueur sur `reference-inn-rain-001`;
- vérification du contrôleur narratif, du rendu local et d'un mode OpenAI-compatible simulé sans réseau;
- oracles qualité sur ancrage, méta hors fiction, questions de possibilité sans action, continuité PNJ et absence de mutation durable inventée;
- script `narration-module:test:vertical-quality`;
- liste des écarts à traiter ensuite en I-06R.

Le live OpenAI réel reste opt-in et manuel : il dépend d'une clé serveur et de `NARRATION_OPENAI_LIVE=1`. I-06Q ne rend pas la suite de tests dépendante du réseau.

## Scénario vertical

| ID | Entrée joueur | Intention attendue | Point observé |
|---|---|---|---|
| I06Q-01 | `Où sommes-nous exactement ?` | `meta_question` | hors fiction, sans commit |
| I06Q-02 | `Pause : comment fonctionne cette scène côté règles ?` | `meta_question` | hors fiction, sans commit |
| I06Q-03 | `Je regarde autour de moi.` | `action` | observation ancrée |
| I06Q-04 | `Est-ce que je peux parler au garde ?` | `meta_question` | possibilité sociale simple, sans action |
| I06Q-05 | `Je demande au garde ce qui s'est passé.` | `speech` | parole committée, réponse PNJ |
| I06Q-06 | `Je demande au garde de répéter plus clairement.` | `speech` | continuité PNJ, non-répétition |
| I06Q-07 | `J'observe la porte du fond.` | `action` | observation post-mémoire courte |
| I06Q-08 | `Puis-je ouvrir la porte sans attirer l'attention ?` | `possibility_query` | action hypothétique non exécutée |
| I06Q-09 | `J'observe la pluie et les conversations.` | `action` | texture locale sans mutation |
| I06Q-10 | `Je demande à la serveuse pourquoi elle est nerveuse.` | `speech` | parole committée dans la scène |
| I06Q-11 | `J'essaie d'entrer dans l'arrière-salle discrètement.` | `action` | proposition sans commit métier |
| I06Q-12 | `Lui voler quelque chose ?` | `unclear_commitment` | clarification sans mutation |

## Preuves exécutables

| Preuve | Attendu |
|---|---|
| `npm run narration-module:test:vertical-quality` | Exécute les 12 entrées, mode local et OpenAI-compatible simulé, et vérifie les oracles qualité. |
| `npm run narration-module:test:narrative-turn-controller` | Confirme que le contrôleur I-06P reste stable. |
| `npm run narration-module:test:ai-narrative-enhancement` | Confirme que l'enrichissement IA borné reste stable. |
| `npm run narration-module:test:narrative-app-surface` | Confirme que la surface UI garde la séparation Locale/OpenAI. |
| `npm run narration-module:build` | Valide les types du module narration. |

## Critères couverts

| Critère I-06Q | Résultat |
|---|---|
| Réponse ancrée dans l'Auberge du Seuil | Couvert sur toutes les entrées fictionnelles. |
| Questions méta hors fiction | Couvert par I06Q-01 et I06Q-02. |
| Questions de possibilité sans action | Couvert par I06Q-08. |
| Garde non répétitif | Couvert par I06Q-05 et I06Q-06. |
| Aucune création durable non autorisée | Couvert par rejet lexical des succès, secrets, objets, PNJ et conséquences durables inventées. |
| OpenAI enrichit sans autorité métier | Couvert par mode OpenAI-compatible simulé; live réel reste opt-in. |
| Fallback/local acceptable | Couvert par mode local déterministe sur le même scénario. |

## Écarts à prioriser en I-06R

- La question `Est-ce que je peux parler au garde ?` était classée comme `meta_question`, pas comme `possibility_query`.
- Les questions de localisation comme `Où sommes-nous exactement ?` restaient hors fiction et n'exploitaient pas encore une réponse informative contextualisée autorisée.
- La parole à la serveuse réutilisait encore la réponse du garde, car la scène de référence ne possédait pas encore une logique PNJ distincte par interlocuteur.
- Le mode OpenAI live n'est pas intégré au script automatique afin d'éviter une dépendance à la clé et au réseau. Une trace manuelle pourra compléter cette matrice si nécessaire.

Les trois premiers écarts sont corrigés et verrouillés en I-06R par [`Matrice-preuves-I06R.md`](Matrice-preuves-I06R.md).

## Décision

I-06Q est clos dans son périmètre si le script vertical, le build narration et les régressions I-06P passent. Les corrections qualitatives ci-dessus doivent être traitées en I-06R, sans ouvrir encore I-06S.
