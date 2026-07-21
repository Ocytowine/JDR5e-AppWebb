# Consolidation des fondations narration

Date : 2026-07-21

Statut : `ACTIF`

## Rôle de ce document

Ce document est la source de reprise canonique du chantier narration. Il fixe le cap actif, les invariants, l'état des contrats et l'ordre des prochains travaux. `TASKS.md` reste synthétique, le journal conserve les raisons historiques et les recettes restent des observations, pas des spécifications.

Toute nouvelle session doit lire, dans cet ordre :

1. `README.md` et `TASKS.md` ;
2. ce document ;
3. les dernières décisions du `Journal-des-decisions.md` ;
4. `git status --short --branch` et le diff existant ;
5. les contrats spécialisés touchés par le lot.

## Cap produit

L'IA comprend l'intention, propose une mise en scène et joue les acteurs dans un contexte borné. Le logiciel reste seul maître des références valides, faits révélables, résultats, commits, temps, inventaire, tactique, règles, secrets et promotions durables.

Le but n'est ni un jeu à formulations scriptées, ni une prose libre faisant autorité. Le flux cible reste :

```text
compréhension sémantique IA
→ proposition structurée
→ validation locale d'autorité
→ résolution par le domaine propriétaire
→ plan de rendu positif
→ prose créative bornée
→ contrôle et fallback sûr
```

## Invariants non négociables

- `semanticIntent.playerGoal` porte le sens libre ; les champs canoniques servent au routage et ne doivent pas devenir un second langage naturel.
- Aucune regex ou liste de formulations ne décide du domaine, du commit, de la cible ou du résultat dans le flux actif.
- Une référence proposée par l'IA doit être visible, compatible et non ambiguë avant exploitation.
- Un texte visible ne peut augmenter l'engagement du joueur ni annoncer un résultat absent de la résolution.
- Une parole PNJ est une affirmation attribuée, jamais une vérité objective automatique.
- Un fait caché ou retenu ne devient visible que par une enveloppe de révélation ou une résolution propriétaire.
- Une texture créative ne produit ni objet, ni présence, ni réaction, ni état mécanique, ni causalité réutilisable.
- Une texture reste limitée au rendu courant et n'entre pas dans la mémoire factuelle, les règles ou les préconditions.
- Le critique IA est une défense sémantique supplémentaire, pas l'unique source de sûreté.
- Une panne ou un rejet conserve le dernier rendu déterministe autorisé et ne rejoue jamais un commit.

## Autorité des affirmations visibles

Le plan de rendu classe positivement ce qui peut apparaître :

| Catégorie | Autorité | Persistance |
|---|---|---|
| `SOURCE_FACT` | fait public sourcé par la scène, le lore ou un snapshot | selon sa source |
| `CONFIRMED_RESULT` | effet confirmé par la résolution propriétaire | selon le commit |
| `ATTRIBUTED_SPEECH` | parole, croyance ou refus d'un acteur identifié | parole mémorisable, contenu non promu en vérité |
| `EPHEMERAL_TEXTURE` | reformulation sensorielle ou atmosphérique compatible | tour courant uniquement |
| `FORBIDDEN_CLAIM` | secret, résultat, état, présence ou réaction sans source | jamais visible |

Une `EPHEMERAL_TEXTURE` peut reformuler une sensation déjà disponible, souligner une tension ou relier stylistiquement des faits confirmés. Elle ne peut pas ajouter une matière précise, un éclairage mécaniquement pertinent, l'état interne d'un mécanisme, une histoire causale, une nouvelle source sonore, une personne, une action ou une réaction.

## État consolidé

- I-06ZL à I-06ZR : fidélité intention-système fermée dans son périmètre.
- NAR-125 : frontière sémantique de narration.
- NAR-126 : résolution perceptive minimale.
- NAR-127 : contrôle indépendant de l'expression joueur.
- NAR-128 : retrait du veto lexical, perception des points d'intérêt et stabilisation structurée de domaine.
- NAR-129 : plan positif et texture éphémère représentés dans `NarrativeRenderAuthorityV1`; matrice adversariale initiale couvrant un faux état mécanique déclaré comme texture.
- NAR-130 : acte de dialogue structuré (`INITIATE_CONVERSATION`, `ASK_QUESTION`, `MAKE_STATEMENT`, `REQUEST_ACTION`, `OTHER`), enveloppe de connaissance explicite, repli performer visible et répliques antérieures reconstruites depuis les projections effectivement affichées.
- Gate adversariale NAR-129/NAR-130 : fausses présences, événements et faits déclarés comme texture rejetés ; une référence de mémoire PNJ n'est acceptée que si elle correspond aux faits publics ou à une projection de réplique effectivement fournie au performer.
- NAR-131 : registre déclaratif de capacités runtime, dispositions `HANDLE`/`HANDOFF`/`CLARIFY`, commandes tracées et absence de routage par `canonicalActionHint` — `IMPLEMENTE_DANS_PERIMETRE`.
- NAR-132 : recette déterministe de dix tours, deux PNJ, répétition, alternance, handoff et reprise; mémoire courte bornée par acteur — `GATE_DETERMINISTE_OK`.
- Limite ouverte : les échecs `mj_planner` et `npc_performer` ne sont pas tous visibles avec la même clarté que les incidents de rendu.

## Ordre des lots de consolidation

1. `NAR-129` — plan de rendu positif et texture éphémère non réutilisable — `IMPLEMENTE_DANS_PERIMETRE`.
2. `NAR-130` — actes de dialogue, connaissances PNJ et mémoire des paroles réellement prononcées — `IMPLEMENTE_DANS_PERIMETRE`.
3. `NAR-131` — routage de domaine ouvert sans multiplication de catégories lexicales — `IMPLEMENTE_DANS_PERIMETRE`.
4. Gate adversariale déterministe : modèle déclarant à tort une sortie sûre, faux mécanisme, fausse présence, fausse mémoire et résultat anticipé — `IMPLEMENTE_DANS_PERIMETRE`.
5. Certification OpenAI live répétée sur perception, action suspendue, dialogue et changement de domaine.
6. Revue de gate post-I-06ZR et choix explicite de la prochaine capacité métier.

## Travaux actuellement interdits

Jusqu'à la gate de consolidation :

- pas d'ouverture réelle de la porte ;
- pas de révélation de l'arrière-salle ;
- pas de combat jouable ;
- pas de mutation d'inventaire ;
- pas de moteur social mécanique ;
- pas d'intrigue ou de création durable automatique ;
- pas de mémoire sociale longue ;
- pas de correction par dictionnaires de mots ou phrases.

## Gate de sortie

La consolidation est fermée seulement si :

- les tests déterministes de contrats passent ;
- les sorties adversariales sensibles sont rejetées ;
- aucune texture n'est reprise comme fait, mémoire ou précondition ;
- une même intention structurée garde cible, domaine, commit et temps à travers ses formulations ;
- un échec IA reste visible et ne fabrique pas de fiction compensatoire ;
- la recette OpenAI ne laisse passer aucun résultat, état mécanique, présence, réaction ou faux historique hors autorité ;
- le diff est relu et un point de sauvegarde Git est décidé explicitement avec l'utilisateur.

## Prochaine étape concrète

Exécuter la recette longue en OpenAI live avec diagnostics de latence et de mémoire, puis réaliser la revue de gate post-I-06ZR avant de choisir une capacité métier.
