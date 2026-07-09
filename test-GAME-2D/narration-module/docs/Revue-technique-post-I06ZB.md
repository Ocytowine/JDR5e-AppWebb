# Revue technique narration post-I-06ZB

Date : 2026-07-09

Statut : `POINT_DE_REPRISE`

## Objet

Cette revue fige l'état réel du module narration après les correctifs live autour d'I-06ZA/I-06ZB et de l'ouverture contrôlée du `scene_writer` sur les questions de contexte no-commit.

Elle doit aider à poursuivre le développement sans retomber dans les dérives précédentes :

- coder des formulations au lieu de faire interpréter l'intention par l'IA;
- laisser l'IA créer des faits non fournis pour rendre une scène plus vivante;
- ouvrir `mj_planner`, intrigue, tactique ou repos avant que la scène jouable courte soit stable;
- perdre le fil entre documentation, tests et comportement UI.

## État validé

Le flux actuel est cohérent avec l'objectif produit :

- le joueur écrit librement;
- l'intention peut être interprétée par OpenAI côté serveur, avec fallback conservateur;
- les questions de contexte restent sans commit métier et sans temps de jeu;
- le `scene_writer` peut enrichir ces réponses de contexte;
- la narration visible reste sous contrôle du code : commit, temps, inventaire, tactique, secrets et lore durable ne sont pas décidés par l'IA;
- les sorties OpenAI invalides ou non exploitables retombent vers le fallback local.

Le dernier test manuel sur `peut tu décrire la scene ?` est jugé acceptable :

- la scène reste cloisonnée à l'Auberge du Seuil;
- les faits visibles restent globalement connus : pluie, salle commune, garde blessé, serveuse, porte vers l'arrière-salle;
- la narration est plus littéraire sans déclencher d'action, de temps ou de conséquence.

Points de vigilance non bloquants :

- des mots comme `entrée`, `chacun`, `convives`, `clients`, `occupants` peuvent sous-entendre des présences ou dynamiques non explicitement fournies;
- ces cas ne doivent pas être traités par accumulation de listes lexicales;
- ils doivent être traités par contrat de contexte, discipline factuelle et matrices de certification.

## Correctifs techniques récents

### Ouverture contrôlée de `scene_writer` sur contexte no-commit

Le `scene_writer` est maintenant autorisé sur une réponse `NO_COMMIT_RESPONSE` uniquement si :

- l'intention est une question de contexte ou méta;
- `noGameTime=true`;
- un bloc MJ local de réponse existe déjà;
- la question n'est pas une possibilité risquée ou une clarification.

Pour ces réponses, le bloc IA remplace le bloc MJ local plutôt que d'ajouter un doublon.

### Historique visible court

Le paquet `scene_writer` reçoit un historique visible borné afin de réduire les répétitions :

- 3 derniers paquets;
- 6 blocs visibles maximum;
- texte tronqué;
- aucune vérité cachée brute.

### Diagnostic OpenAI

L'UI distingue maintenant :

- OpenAI non appelé;
- OpenAI appelé mais sortie inutilisable;
- OpenAI indisponible;
- fallback local utilisé.

Les diagnostics fournisseur expurgés sont remontés jusqu'à l'UI quand c'est utile.

### Budget JSON strict

Le budget de sortie `scene_writer` a été augmenté afin de permettre une enveloppe JSON stricte complète :

- requête interne : 1200 tokens;
- limite route : 1500 tokens;
- les autres rôles restent limités à 1000 tokens.

### Discipline factuelle

Le schéma OpenAI `scene_writer` impose maintenant `factDiscipline` par bloc.

Le bloc doit déclarer :

- `addedUnsupportedFacts`;
- `usesOnlyProvidedVisibleEntities`;
- `noNewEvents`;
- `noHiddenPresence`;
- `notes`.

Le pipeline rejette le bloc si cet audit indique :

- un fait ajouté non supporté;
- une entité visible non fournie;
- un événement nouveau;
- une présence cachée ou dissimulée non fournie.

Cette approche est volontairement contractuelle. Les régressions peuvent utiliser des exemples textuels réels, mais la décision principale ne doit pas dépendre d'une phrase exacte.

## Écarts restants

### E-01 — Qualité live non certifiée pour `scene_writer`

Statut : `OUVERT`

Le comportement live devient bon sur quelques essais, mais il n'existe pas encore de matrice courte de certification dédiée au `scene_writer` live.

Risque : croire que le flux est stable alors que seuls quelques cas manuels ont été observés.

Action recommandée : ouvrir un micro-lot de certification live, sans nouvelle capacité.

Cas minimaux :

- météo;
- localisation;
- description générale de scène;
- description des personnes présentes;
- description ciblée du garde;
- description ciblée de la serveuse;
- question sur la porte du fond;
- répétition de question météo;
- répétition de description générale;
- possibilité risquée sans action;
- parole au garde.

Critères :

- aucune action exécutée sur contexte/possibilité;
- aucun temps de jeu sur contexte/possibilité;
- aucun PNJ/groupe/événement non fourni;
- aucune révélation de secret;
- narration non générique;
- variation acceptable sur répétition;
- fallback propre si OpenAI échoue.

### E-02 — Contexte de scène encore trop pauvre

Statut : `OUVERT`

Le `scene_writer` reçoit un contexte exploitable, mais il manque encore une structure explicite assez riche pour éviter les ambiguïtés sans hard code.

Besoin probable :

- liste canonique des entités visibles autorisées;
- liste canonique des éléments visibles autorisés;
- faits sensoriels autorisés;
- faits instables interdits sauf commit;
- politique de figurants anonymes : fermé par défaut dans la scène de référence;
- distinction entre texture sensorielle et fait de monde.

Ce travail doit renforcer le paquet de contexte, pas ajouter des règles lexicales.

### E-03 — Surface UI encore marquée prototype

Statut : `OUVERT`

Le fil commence encore par des messages de prototype comme `La surface narration est prête...`.

Risque : la première impression produit ne correspond pas à la scène jouable.

Action recommandée :

- remplacer l'amorce prototype par une ouverture de scène issue du `PlayableSceneStateV1`;
- conserver éventuellement un indicateur technique discret hors fil fictionnel;
- tester que le fil initial présente directement le lieu, les PNJ visibles et la tension.

### E-04 — Fallback local d'intention encore lexical

Statut : `OUVERT`

Le fallback doit rester conservateur et sûr, mais il ne doit pas devenir le moteur de compréhension.

Action recommandée :

- ne pas enrichir le fallback avec de nouvelles familles de formulations sauf sécurité critique;
- enrichir plutôt le contrat IA avec des champs sémantiques si un problème d'intention réapparaît.

### E-05 — Code legacy encore présent

Statut : `OUVERT_BASSE_PRIORITE`

Certains chemins historiques de `NarrativeTurnController` restent présents pour compatibilité.

Action recommandée :

- ne pas le traiter avant la certification live courte;
- ensuite, identifier les consommateurs restants et déprécier ou supprimer proprement.

## Lots recommandés

### I-06ZC — Certification live courte `scene_writer`

Priorité : `HAUTE`

Objectif : vérifier le comportement OpenAI live sans ouvrir de nouvelle capacité.

Sorties attendues :

- matrice `Matrice-certification-live-scene-writer.md`;
- 10 à 12 cas manuels;
- statut `OK`, `A_CORRIGER` ou `BLOQUANT`;
- décisions de correction limitées aux contrats/contexte/validation.

Interdits :

- pas de `mj_planner`;
- pas d'intrigue;
- pas de tactique réel;
- pas de mémoire longue;
- pas d'ajout lexical massif.

### I-06ZD — Amorce de scène jouable dans l'UI

Priorité : `MOYENNE_HAUTE`

Objectif : retirer l'impression prototype du fil visible et démarrer directement dans une scène jouable.

Sorties attendues :

- ouverture de scène issue de `PlayableSceneStateV1`;
- messages système prototype déplacés ou rendus discrets;
- test UI de fil initial.

### I-06ZE — Paquet de scène explicite pour `scene_writer`

Priorité : `MOYENNE`

Objectif : fournir au `scene_writer` une structure de contexte plus nette, afin de réduire les ajouts non supportés sans hard code.

Sorties attendues :

- champs structurés : entités visibles, éléments visibles, faits sensoriels autorisés, interdits dynamiques;
- validation de cohérence avec `factDiscipline`;
- tests sur présence non fournie, événement non fourni et description ciblée.

### A-06 — Nettoyage legacy contrôlé

Priorité : `BASSE`

Objectif : réduire la confusion technique une fois le flux live stabilisé.

Sorties attendues :

- inventaire des chemins legacy;
- commentaires de dépréciation ou suppression;
- tests inchangés.

## Décision de suite

La suite logique est I-06ZC.

Raison : avant d'améliorer l'UI ou le contexte, il faut mesurer le comportement live actuel avec une matrice courte. Si I-06ZC confirme la stabilité, I-06ZD pourra améliorer l'expérience visible. Si I-06ZC révèle des dérives, I-06ZE devra être traité avant l'UI.

`mj_planner`, intrigue dynamique, tactique réel, repos jouable complet et mémoire long terme restent fermés.
