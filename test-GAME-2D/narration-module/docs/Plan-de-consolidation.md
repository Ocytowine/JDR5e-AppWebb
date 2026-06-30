# Plan de consolidation du cahier des charges

Dernière mise à jour : `2026-06-30`

Statut global : `EN_COURS`

Ce document pilote la conception du module narration jusqu'à son autorisation d'implémentation. Il sert de checklist anti-oubli et de journal d'avancement. Les règles actives restent décrites dans `Dossier-de-conception.md`; les raisons des choix structurants restent dans `Journal-des-decisions.md`.

## États de suivi

- `A_FAIRE` : atelier non commencé.
- `EN_COURS` : questions en cours d'analyse.
- `A_VALIDER` : proposition complète, en attente de validation globale.
- `BOUCLE` : livrables produits, décisions prises et contrôles passés.
- `BLOQUE` : décision externe indispensable.

Un atelier n'est `BOUCLE` que si ses décisions sont écrites, ses incertitudes classées et ses impacts transversaux contrôlés.

## Tableau de bord

| Ordre | Atelier | État | Livrable principal | Dépend de |
|---:|---|---|---|---|
| 0 | Gouvernance documentaire | `BOUCLE` | Index, dossier canonique, journal des décisions et présent plan | — |
| 1 | Boucle joueur et périmètre MVP | `BOUCLE` | Parcours complet d'un tour et limites MVP | 0 |
| 2 | Autorité des systèmes | `BOUCLE` | Matrice lecture/proposition/validation/mutation | 1 |
| 3 | Modèle persistant de campagne | `BOUCLE` | Modèle conceptuel et invariants | 2 |
| 4 | Créations dynamiques de l'IA | `BOUCLE` | Cycles de vie par type de création | 3 |
| 5 | Mémoire et rappel | `BOUCLE` | Pipeline de conservation, recherche et projection | 3, 4 |
| 6 | Snapshot et dossier de scène | `BOUCLE` | Contrat d'entrée conceptuel versionné | 2, 5 |
| 7 | Pipeline et contrats IA | `BOUCLE` | Séquence des appels et contrats de sortie | 4, 6 |
| 8 | Intégration des moteurs | `EN_COURS` | Contrats narration ↔ domaines propriétaires | 2, 7 |
| 9 | Temps et monde vivant | `A_FAIRE` | Contrat temporel et articulation des événements | 5, 8 |
| 10 | Résilience, sécurité et diagnostic | `A_FAIRE` | Catalogue des échecs et comportements attendus | 7, 8 |
| 11 | Exigences non fonctionnelles | `A_FAIRE` | Budgets et objectifs mesurables | 5, 7, 10 |
| 12 | Scénarios d'acceptation | `A_FAIRE` | Corpus fonctionnel et cas limites | 1 à 11 |
| 13 | Audit final et plan d'implémentation | `A_FAIRE` | Rapport de cohérence et lots techniques | 12 |

Les ateliers 1 à 7 sont bouclés. L'atelier 8 sur l'intégration des moteurs est maintenant actif.

## Atelier 0 — Gouvernance documentaire

### Checklist

- [x] Désigner une source de vérité courante.
- [x] Séparer comportement actuel et historique des décisions.
- [x] Définir les statuts documentaires.
- [x] Créer une feuille de route suivie.
- [x] Relier la conception au suivi racine `TASKS.md`.

### Critère de sortie

Une décision ne peut plus être perdue ou remplacée implicitement par une ancienne note.

## Atelier 1 — Boucle joueur et périmètre MVP

### Questions à résoudre

- [x] Décrire le début, le déroulement et la fin d'un tour narratif.
- [x] Définir ce qui constitue une scène et une transition de scène.
- [x] Définir les usages respectifs de la saisie libre, des suggestions et des clarifications.
- [x] Définir les types de messages visibles et leur ordre d'affichage.
- [x] Définir la place des dialogues multiples et des interruptions.
- [x] Définir les limites fonctionnelles du premier scénario vertical.
- [x] Lister explicitement le hors-périmètre MVP.

### Livrables

- Parcours nominal du joueur.
- Variantes importantes du parcours.
- Périmètre et hors-périmètre du MVP.

### Avancement détaillé

- [x] Lot 1 — Unité de tour, entrées composées, gestes implicites, points d'arrêt, clarification et atomicité.
- [x] Lot 2 — Formes de saisie, dialogues, suggestions et politique complète de clarification.
- [x] Lot 3 — Définition et transitions d'une scène.
- [x] Lot 4 — Parcours MVP, types de messages et interruptions.
- [x] Lot 5 — Périmètre, hors-périmètre et validation finale de l'atelier.

### Critère de sortie

Il est possible de raconter précisément une session MVP sans supposer un comportement absent du cahier des charges.

## Atelier 2 — Autorité des systèmes

### Questions à résoudre

- [x] Inventorier tous les domaines de données.
- [x] Désigner l'autorité de lecture et de mutation de chaque domaine.
- [x] Distinguer proposition, validation, exécution et notification.
- [x] Identifier les données encore sans propriétaire dans l'application actuelle.
- [x] Définir les règles de conflit entre état local, campagne et canon.
- [x] Confirmer l'autorité unique de l'horloge.

### Livrable

Une matrice comportant pour chaque donnée : propriétaire, lecteurs, auteurs de proposition, validateur, mutation autorisée et événements émis.

### Avancement détaillé

- [x] Lot 1 — Canon, campagne, personnage joueur, projections PNJ et rôle de l'orchestrateur.
- [x] Lot 2 — Protocole proposition, validation, exécution et événement.
- [x] Lot 3 — Propriétaires secondaires, conflits et données orphelines.
- [x] Lot 4 — Matrice complète et audit de l'atelier.

### Critère de sortie

Aucune donnée persistante du MVP ne possède deux autorités concurrentes ou aucune autorité.

## Atelier 3 — Modèle persistant de campagne

### Questions à résoudre

- [x] Définir identité et relations entre campagne, sauvegarde, scène, tour et snapshot.
- [x] Définir faits, événements, commandes et mutations.
- [x] Définir PNJ, relations, connaissances, croyances, secrets et fils narratifs.
- [x] Définir provenance, temporalité, validité et remplacement d'un fait.
- [x] Définir les invariants transactionnels et l'idempotence.
- [x] Définir versionnement et migrations de sauvegarde.
- [x] Séparer modèle conceptuel et choix de technologie de stockage.

### Livrables

- Modèle conceptuel des entités.
- Invariants de persistance.
- Exemple complet d'une sauvegarde minimale, non contractuel dans un premier temps.

### Avancement détaillé

- [x] Lot 1 — Chronologie linéaire, commits, snapshots, checkpoints et politique de reprise.
- [x] Lot 2 — Identités, agrégats et relations structurelles de la campagne.
- [x] Lot 3 — Faits, événements, commandes, provenance et temporalité.
- [x] Lot 4 — Invariants, idempotence, transcript et intentions suspendues.
- [x] Lot 5 — Versionnement, migrations, exemple de sauvegarde et audit.

### Critère de sortie

Le scénario MVP peut être sauvegardé, rechargé et poursuivi sans utiliser la conversation comme source de vérité.

## Atelier 4 — Créations dynamiques de l'IA

### Questions à résoudre

- [x] Définir les cycles éphémère, candidat, validé, persistant et archivé.
- [x] Définir les règles propres aux PNJ, événements, lieux, objets, missions et intrigues.
- [x] Définir les seuils de promotion vers la persistance.
- [x] Définir la gestion des doublons et créations contradictoires.
- [x] Définir ce qui peut être corrigé, refusé ou régénéré.
- [x] Préserver la créativité sans introduire des catalogues narratifs fermés.

### Critère de sortie

Toute création du scénario MVP possède un parcours explicite depuis sa première évocation jusqu'à sa persistance éventuelle.

### Avancement détaillé

- [x] Lot 1 — Niveaux éphémère, référence légère, entité complète et archive.
- [x] Lot 2 — Engagements narratifs et noyau cohérent des intrigues.
- [x] Lot 3 — Règles propres aux PNJ, événements, lieux, objets et fils narratifs.
- [x] Lot 4 — Doublons, contradictions, correction et régénération ciblée.
- [x] Lot 5 — Matrice des créations et audit de l'atelier.

## Fil transversal — Cohérence des intrigues

- [x] Créer une référence documentaire dédiée.
- [x] Définir l'engagement narratif et sa persistance immédiate.
- [x] Séparer vérité, preuve, indice, témoignage, croyance et fausse piste.
- [x] Atelier 4 : figer le cycle de création et les invariants initiaux.
- [x] Atelier 5 : définir conservation, rappel et réactivation des engagements.
- [ ] Atelier 6 : définir la projection du sous-graphe pertinent dans une scène.
- [ ] Atelier 7 : définir contrats IA et contrôle sémantique complémentaire.
- [ ] Atelier 9 : définir chronologie et évolution hors écran.
- [ ] Atelier 10 : définir correction et diagnostic sans retcon silencieux.
- [ ] Atelier 12 : couvrir intrigue longue, indices, fausses pistes et contradictions.

## Atelier 5 — Mémoire et rappel

### Questions à résoudre

- [x] Définir ce qui est conservé intégralement, condensé ou dérivé.
- [x] Définir les états `active`, `relevant`, `dormant` et `archived`.
- [x] Définir les déclencheurs de rappel.
- [x] Définir recherche structurée, textuelle et sémantique.
- [x] Définir validation, classement, déduplication et condensation.
- [x] Définir les perspectives et droits de révélation.
- [x] Définir les budgets de mémoire projetée.
- [x] Définir la traçabilité des inclusions et exclusions.

### Critère de sortie

Le retour dans un lieu après plusieurs mois de jeu rappelle les faits utiles sans injecter toute la campagne ni révéler un secret inaccessible.

### Avancement détaillé

- [x] Lot 1 — Conservation, données dérivées, cycle de rappel et oubli subjectif.
- [x] Lot 2 — Unités de mémoire, index et déclencheurs de rappel.
- [x] Lot 3 — Recherche structurée, textuelle et sémantique.
- [x] Lot 4 — Classement, déduplication, condensation et perspectives.
- [x] Lot 5 — Budgets, traçabilité, cas de retour tardif et audit.

## Atelier 6 — Snapshot et dossier de scène

### Questions à résoudre

- [x] Définir les sections obligatoires et facultatives.
- [x] Définir identifiants, versions et provenance.
- [x] Distinguer vérité, perception, connaissance, croyance et secret.
- [x] Définir les libertés et interdictions créatives du tour.
- [x] Définir les règles de réduction en cas de dépassement du budget.
- [x] Définir la détection d'un snapshot devenu obsolète.

### Critère de sortie

Deux exécutions recevant le même snapshot disposent des mêmes faits autoritaires, même si leur prose diffère.

### Avancement détaillé

- [x] Lot 1 — Distinction `CampaignSnapshot`, `TurnSnapshot`, `RoleContextPack` et résultat committé.
- [x] Lot 2 — Sections communes, identifiants, versions et provenance.
- [x] Lot 3 — Sections et perspectives propres à chaque rôle.
- [x] Lot 4 — Permissions créatives, budgets et réduction.
- [x] Lot 5 — Obsolescence, trace, exemple parseable et audit.

## Atelier 7 — Pipeline et contrats IA

### Questions à résoudre

- [x] Séparer interprétation, création, résolution et rédaction.
- [x] Décider quels rôles nécessitent un appel distinct.
- [x] Définir les propositions structurées et sorties visibles.
- [x] Définir schémas, versions et validation.
- [x] Définir clarification, correction ciblée et régénération.
- [x] Définir ce qui peut être traité sans appel IA.
- [x] Définir les informations interdites dans la réponse joueur.

### Critère de sortie

Chaque donnée produite par l'IA a une destination, une validation et un comportement d'échec explicites.

### Avancement détaillé

- [x] Lot 1 — Squelette adaptatif, profils d'exécution et validation avant commit puis avant affichage.
- [x] Lot 2 — Frontières et déclenchement des rôles IA.
- [x] Lot 3 — Contrats structurés et engagements verbaux.
- [x] Lot 4 — Validation, critique, correction ciblée et régénération.
- [x] Lot 5 — Parcours sans IA, sécurité de sortie, exemple parseable et audit.

## Atelier 8 — Intégration des moteurs

### Frontières à traiter

- [x] Narration ↔ personnage et progression.
- [x] Narration ↔ inventaire et économie.
- [ ] Narration ↔ déplacement et carte.
- [ ] Narration ↔ résolution sociale.
- [ ] Narration ↔ tactique.
- [ ] Narration ↔ repos.
- [ ] Narration ↔ monde et factions.
- [ ] Narration ↔ sauvegarde.

### Critère de sortie

Chaque passage possède une requête, une validation, un résultat, des événements et une stratégie d'échec.

### Avancement détaillé

- [x] Lot 1 — Protocole commun, transaction courte et `ProcessHandoff` sauvegardable.
- [x] Lot 2 — Personnage et progression.
- [x] Lot 3 — Inventaire et économie.
- [ ] Lot 4 — Déplacement, carte et monde.
- [ ] Lot 5 — Résolution sociale.
- [ ] Lot 6 — Handoff tactique et retour des conséquences.
- [ ] Lot 7 — Repos narratif et moteur de règles.
- [ ] Lot 8 — Persistance, coordination, exemple parseable et audit.

## Atelier 9 — Temps et monde vivant

### Questions à résoudre

- [ ] Définir comment la narration demande une avance temporelle.
- [ ] Distinguer événement créé par l'IA et événement produit par la simulation.
- [ ] Définir leur fusion éventuelle dans une scène.
- [ ] Définir l'évolution hors écran.
- [ ] Définir retour tardif, absence prolongée et conséquences différées.
- [ ] Éviter toute horloge ou chronologie concurrente.

### Critère de sortie

Chaque événement du scénario peut être replacé sur une chronologie unique avec sa cause et ses conséquences.

## Atelier 10 — Résilience, sécurité et diagnostic

### Cas à couvrir

- [ ] Timeout ou indisponibilité IA.
- [ ] Sortie invalide ou incomplète.
- [ ] Contradiction avec le contexte.
- [ ] Double soumission d'un tour.
- [ ] Échec partiel d'un moteur propriétaire.
- [ ] Sauvegarde ou reprise pendant une erreur.
- [ ] Contenu lore ou joueur tentant de détourner les instructions.
- [ ] Fuite d'un secret MJ vers le joueur.
- [ ] Diagnostic suffisamment riche sans polluer l'expérience.

### Critère de sortie

Aucun échec prévisible ne corrompt silencieusement la campagne ou ne produit une mutation non traçable.

## Atelier 11 — Exigences non fonctionnelles

### Mesures à fixer

- [ ] Latence cible et maximale d'un tour.
- [ ] Coût moyen et plafond par tour ou session.
- [ ] Taille globale et budgets par section du contexte.
- [ ] Taux accepté de réponses invalides.
- [ ] Qualité minimale du rappel.
- [ ] Taux de contradictions et de répétitions.
- [ ] Durée et volume de campagne supportés.
- [ ] Compatibilité et migration des sauvegardes.
- [ ] Niveau de journalisation et conservation des traces.

### Critère de sortie

Les qualités essentielles sont mesurables ou explicitement reportées avec un risque accepté.

## Atelier 12 — Scénarios d'acceptation

### Corpus minimal

- [ ] Parcours nominal du scénario vertical.
- [ ] Création puis réapparition d'un PNJ.
- [ ] Souvenir ancien évoqué avec une formulation différente.
- [ ] Retour dans un lieu transformé.
- [ ] Secret connu du MJ mais pas d'un interlocuteur.
- [ ] Action mécaniquement impossible.
- [ ] Transition vers le tactique et retour.
- [ ] Événement ignoré évoluant hors écran.
- [ ] Sauvegarde, rechargement et migration.
- [ ] Panne IA sans mutation partielle.
- [ ] Contexte dépassant son budget.
- [ ] Création contradictoire ou doublon.

### Critère de sortie

Chaque exigence P0 est couverte par au moins un scénario observable et chaque scénario renvoie aux contrats concernés.

## Atelier 13 — Audit final et autorisation de coder

### Contrôles finaux

- [ ] Rechercher les contradictions entre documents.
- [ ] Vérifier la traçabilité exigence → décision → contrat → scénario.
- [ ] Vérifier que toutes les données possèdent une autorité.
- [ ] Vérifier que les questions restantes sont non bloquantes.
- [ ] Vérifier coût, latence, sécurité, reprise et migration.
- [ ] Revalider le scénario vertical de bout en bout.
- [ ] Découper l'implémentation en lots verticaux testables.
- [ ] Mettre à jour `TASKS.md` avec le premier lot autorisé.

### Définition de cahier des charges bouclé

- Tous les ateliers 1 à 12 sont `BOUCLE`.
- Toutes les exigences P0 ont une décision et un critère d'acceptation.
- Les contrats nécessaires au premier lot sont `FIGE`.
- Aucune donnée persistante n'a une autorité ambiguë.
- Le modèle de sauvegarde et sa stratégie de migration sont définis.
- Les comportements d'échec et de reprise sont spécifiés.
- Les budgets de contexte, coût et latence sont décidés.
- Les questions restantes sont documentées comme non bloquantes.
- L'audit de cohérence ne relève aucun conflit non résolu.

## Contrôle transversal après chaque atelier

Avant de marquer un atelier `BOUCLE`, vérifier son impact sur :

- expérience joueur et liberté d'action;
- autorité créative de l'IA;
- règles mécaniques;
- données et sauvegarde;
- mémoire et contexte;
- monde et temporalité;
- personnages et perspectives;
- tactique;
- interface;
- coût, latence et sécurité;
- tests et diagnostic.

## Journal d'avancement

### 2026-06-29 — Mise en place du suivi

- Travail réalisé : création du dossier canonique, du journal des décisions et du plan de consolidation.
- Décisions acquises : positionnement IA, séparation création/autorité, snapshot figé, persistance progressive, mémoire projetée, recherche hybride et horloge unique.
- Point actif : compléter la boucle joueur et la matrice d'autorité, puis ouvrir le modèle persistant.
- Blocage : aucun.
- Prochaine action : formaliser le parcours nominal d'un tour narratif et ses variantes MVP.

### 2026-06-29 — Atelier 1, lot 1

- Travail réalisé : définition de l'unité de tour, des actions composées, des gestes implicites et des points d'arrêt.
- Décision : l'IA décide narrativement de poursuivre ou rendre la main avec des critères fournis; l'orchestrateur conserve un veto technique.
- Clarification : l'intention est suspendue sans mutation, puis complétée et recontextualisée sur un état autoritaire vérifié.
- Distinction : une réaction du monde demandant une nouvelle décision clôt le tour au lieu de prolonger artificiellement une transaction.
- Blocage : aucun.
- Prochaine action : traiter les formes de saisie, les dialogues, les suggestions et la politique de clarification.

### 2026-06-29 — Atelier 1, lot 2

- Travail réalisé : définition de la saisie naturelle, du degré d'engagement et de la reformulation théâtrale du personnage.
- Décision : une question de possibilité n'exécute jamais l'action évoquée; en cas de doute significatif, l'IA clarifie.
- Décision : l'IA adapte l'expression aux traits du personnage sans modifier le sens ni les engagements du joueur.
- Décision : les capacités influencent forme et efficacité; seul un manque concret peut bloquer ou altérer l'expression.
- Décision : aucune suggestion directe en jeu normal; les possibilités sont rendues perceptibles par la mise en scène.
- Blocage : aucun.
- Prochaine action : définir l'identité, la continuité et les transitions d'une scène.

### 2026-06-29 — Atelier 1, lot 3

- Travail réalisé : définition d'une scène, de ses transitions géographiques et temporelles et de sa continuation après combat.
- Décision : la transition dépend d'une rupture significative de contexte, pas de chaque déplacement physique.
- Décision : l'IA propose le rythme et la transition; l'orchestrateur valide les changements autoritaires.
- Complément : le repos devient une sous-couche de règles spécialisée, entièrement vécue dans le flux narratif côté joueur.
- Blocage : aucun.
- Prochaine action : définir les types de messages, leur affichage, les dialogues multiples et les interruptions.

### 2026-06-29 — Atelier 1, lot 4

- Travail réalisé : définition du flux typé, de l'identification des locuteurs, des dialogues multiples et des interruptions.
- Décision : la réalisation mise en scène est prioritaire dans le fil; l'entrée brute reste consultable.
- Décision : couleur, nom et marqueur de rôle distinguent les locuteurs sans dépendre uniquement de la couleur.
- Décision : les échanges automatiques entre PNJ sont autorisés jusqu'au prochain choix significatif du joueur.
- Complément : une politique de rythme configurable permettra de régler l'équilibre entre autonomie de la scène et implication du joueur sans modifier les faits.
- Blocage : aucun.
- Prochaine action : fixer le périmètre et le hors-périmètre du scénario vertical MVP, puis auditer l'atelier 1.

### 2026-06-29 — Atelier 1, lot 5 et clôture

- Travail réalisé : validation du périmètre MVP et audit des actifs réels du wiki et de l'éditeur de personnage.
- Décision : le scénario vertical couvre création dynamique, résolution sociale, temps, tactique, repos minimal, sauvegarde et rappel tardif.
- Constat : le wiki fournit des données structurées utiles, mais nécessite normalisation, validation et projection sourcée.
- Constat : la fiche existante est riche, mais nécessite une projection narrative versionnée séparée des caches UI et données dérivées.
- Hors périmètre : multijoueur, voix, bastion complet, progression complète, économie avancée et génération mondiale illimitée.
- Audit transversal : aucune contradiction bloquante relevée; les frontières de données sont transférées à l'atelier 2.
- État : atelier 1 `BOUCLE`.
- Prochaine action : construire la matrice d'autorité des systèmes.

### 2026-06-29 — Atelier 2, lot 1

- Travail réalisé : première matrice d'autorité pour le canon, la campagne, le PJ, les PNJ et l'orchestrateur.
- Décision : la fiche de création est importée; son instance de campagne devient ensuite la source de vérité du personnage joué.
- Décision : l'autorité est attribuée par propriété; les représentations monde, tactique et UI restent des projections liées par identité stable.
- Décision : l'orchestrateur coordonne sans posséder de copies concurrentes des domaines.
- Blocage : aucun.
- Prochaine action : formaliser le protocole proposition, validation, exécution et émission d'événements.

### 2026-06-29 — Atelier 2, lot 2

- Travail réalisé : formalisation du protocole proposition, validation, exécution atomique, événement et narration.
- Décision : l'IA propose une commande sans affirmer son résultat mécanique.
- Décision : chaque domaine propriétaire valide et restitue état, événements et vues autorisées.
- Décision : la prose visible est générée seulement après confirmation et ne peut ajouter de mutation.
- Blocage : aucun.
- Prochaine action : attribuer les propriétaires secondaires et résoudre les conflits de vérité restants.

### 2026-06-30 — Atelier 2, lot 3

- Travail réalisé : choix de la forme d'architecture, attribution des propriétaires secondaires et inventaire des lacunes actuelles.
- Décision : monolithe modulaire avec sauvegarde de campagne unifiée; frontières logiques sans microservices prématurés.
- Décision : relations et connaissances sont séparées conceptuellement; l'économie complète est reportée.
- Décision : l'état courant de l'unique propriétaire est autoritaire; canon et fiche fournissent les valeurs initiales; la scène reste une projection.
- Garde-fou : deux propriétaires concurrents constituent une erreur explicite, jamais une priorité implicite.
- Blocage : aucun.
- Prochaine action : compléter la matrice lecture/proposition/validation/mutation/événements et auditer l'atelier 2.

### 2026-06-30 — Atelier 2, lot 4 et clôture

- Travail réalisé : création de `Matrice-autorite.md` et audit contre le wiki, le personnage, le monde, la tactique et le serveur actuels.
- Correction : ajout du `CampaignFactDomain` pour les faits objectifs et overrides persistants.
- Résultat : chaque donnée persistante du scénario MVP possède une autorité, des lecteurs, des proposants, un validateur et des événements attendus.
- Écarts : les runtimes campagne, PNJ, social, connaissance, scène et repos restent à construire; ce sont des lacunes d'implémentation, pas des autorités ambiguës.
- Audit transversal : aucun conflit d'autorité non résolu.
- État : atelier 2 `BOUCLE`.
- Prochaine action : définir les agrégats et invariants du modèle persistant de campagne.

### 2026-06-30 — Atelier 3, lot 1

- Travail réalisé : définition de la chronologie, des commits, snapshots, checkpoints et mécanismes de reprise.
- Décision : une seule chronologie active, sans branche ni chargement d'une version antérieure par le joueur.
- Décision : chaque échange validé est durable; les snapshots complets restent espacés et configurables.
- Décision : une correction produit un nouvel événement; elle ne réécrit pas silencieusement le passé.
- Sécurité : checkpoints et copies pré-migration restent internes au diagnostic et à la récupération.
- Blocage : aucun.
- Prochaine action : définir les identités, agrégats et relations structurelles de la campagne.

### 2026-06-30 — Atelier 3, lot 2a

- Travail réalisé : distinction entre fiche source et identité du personnage réellement joué.
- Décision : une instance de personnage appartient à une seule campagne et une seule chronologie.
- Décision : réutiliser une fiche nécessite un clonage explicite produisant une autre identité.
- Décision : les conséquences de campagne ne modifient jamais rétroactivement la fiche source.
- Blocage : aucun.
- Prochaine action : définir les agrégats persistants de la campagne et leurs références.

### 2026-06-30 — Atelier 3, lot 2b

- Travail réalisé : définition des agrégats de campagne, de leurs identifiants et de leurs relations.
- Décision : les agrégats se référencent sans recopier les profils complets appartenant à un autre propriétaire.
- Décision : le transcript complet est conservé dans un `InteractionLog` séparé, paginable et archivable.
- Garde-fou : le transcript est consultable mais ne constitue jamais une source de vérité ni un paquet IA implicite.
- Blocage : aucun.
- Prochaine action : définir faits, commandes, mutations, événements, provenance et temporalité.

### 2026-06-30 — Atelier 3, lot 3

- Travail réalisé : définition des commandes, mutations préparées, événements, faits, provenance et temporalité.
- Décision : un fait remplacé reste historique et pointe vers la nouvelle assertion courante.
- Décision : les agrégats structurés conservent leurs données métier; `CampaignFacts` ne duplique pas toutes les valeurs du jeu.
- Décision : vérité, connaissance, croyance et hypothèse joueur sont séparées.
- Garde-fou : une erreur du joueur n'influence le monde que par une action validée et n'est jamais injectée comme vérité IA.
- Blocage : aucun.
- Prochaine action : finaliser invariants, idempotence, transcript et reprise des intentions suspendues.

### 2026-06-30 — Atelier 3, lot 4

- Travail réalisé : définition du cycle persistant d'un tour, de l'idempotence, des intentions suspendues et du processus principal.
- Décision : une requête ne peut produire qu'un seul commit; une reprise retourne le résultat existant.
- Décision : une clarification conserve les données minimales et reconstruit son contexte avant reprise.
- Décision : dialogue, commerce et micro-déplacement font avancer le temps de jeu; échanges méta et attente réelle restent à durée nulle.
- Décision : les événements autonomes du monde sont déclenchés uniquement par une avance validée de l'horloge.
- Blocage : aucun.
- Prochaine action : définir versionnement, migrations et exemple complet de sauvegarde, puis auditer l'atelier 3.

### 2026-06-30 — Atelier 3, lot 5 et clôture

- Travail réalisé : versionnement, contenu épinglé, pipeline de migration et exemple parseable de sauvegarde MVP.
- Décision : aucune mise à jour silencieuse du wiki, des catalogues ou des règles dans une campagne existante.
- Décision : migrations séquentielles, déterministes, sans IA, validées avant remplacement atomique.
- Exemple : `Exemple-sauvegarde-mvp.json` relie personnage, monde, fait, PNJ, relation, connaissance, croyance, fil, scène, événements et transcript.
- Audit transversal : chaque agrégat possède une autorité et la reprise ne dépend pas de la conversation.
- État : atelier 3 `BOUCLE`.
- Prochaine action : définir le cycle de vie des créations dynamiques de l'IA.

### 2026-06-30 — Atelier 4, lots 1 et amorce du lot 2

- Travail réalisé : formalisation des profondeurs de persistance et création du dossier transversal de cohérence des intrigues.
- Décision : persistance éphémère, référence légère, entité complète puis archive selon importance.
- Décision : toute importance causale, probatoire ou préparatoire déclenche une persistance immédiate.
- Décision : vérité centrale et engagements d'une intrigue sont committés avant mise en scène; aucune vérité rétroactive selon les choix du joueur.
- Traçabilité : les travaux intrigue sont maintenant suivis dans les ateliers 4, 5, 6, 7, 9, 10 et 12.
- Blocage : aucun.
- Prochaine action : définir le niveau minimal de préparation et les garanties de solvabilité d'une intrigue.

### 2026-06-30 — Atelier 4, lot 2

- Travail réalisé : garanties de solvabilité, voies indépendantes, traitement des échecs et fausses pistes.
- Décision : deux voies indépendantes au minimum vers chaque révélation indispensable.
- Décision : un échec système ne ferme pas toute progression; les actions ou l'inaction du joueur peuvent en revanche produire une insolvabilité causale.
- Décision : toute fausse piste engagée possède des conditions de réfutation accessibles.
- Décision : une intrigue ignorée continue d'évoluer avec le monde.
- Blocage : aucun.
- Prochaine action : définir les règles de création propres aux PNJ, événements, lieux, objets et fils narratifs.

### 2026-06-30 — Atelier 4, lot 3

- Travail réalisé : création du dossier `Creations-dynamiques.md` et définition des règles par type.
- Décision : validation et profondeur de persistance sont deux axes séparés.
- Décision : lieux canoniques et générés partagent un registre effectif avec provenance distincte.
- Décision : un profil hiérarchique fournit invariants, normes pondérées et variations libres à toute création locale.
- Décision : le système recherche la réutilisation avant création et contrôle densité et doublons fonctionnels.
- Blocage : aucun.
- Prochaine action : définir fusion des doublons, contradictions et correction ciblée des propositions.

### 2026-06-30 — Atelier 4, lots 4 à 5 et clôture

- Travail réalisé : politique de doublons, correction ciblée, réparation après commit et matrice de validation par type.
- Décision : aucune fusion persistante sur simple similarité; l'incertitude reste structurée sans mélanger les entités.
- Décision : deux corrections ciblées par défaut avant fallback sûr, valeur configurable en développement.
- Décision : une réparation post-commit conserve événements, alias et causalité.
- Audit transversal : chaque création du scénario MVP possède un parcours explicite et des validations sans catalogue narratif fermé.
- État : atelier 4 `BOUCLE`.
- Prochaine action : définir conservation, cycle de vie, recherche et rappel de la mémoire.

### 2026-06-30 — Atelier 5, lot 1

- Travail réalisé : distinction entre mémoire système, mémoire vécue et mémoire projetée; définition du cycle de rappel.
- Décision : archivage et validité sont indépendants; un fait archivé peut rester vrai et appliqué.
- Décision : l'oubli d'un acteur modifie sa connaissance subjective sans supprimer l'historique système.
- Décision : faits, événements, engagements et changements durables ne sont jamais supprimés automatiquement.
- Correction documentaire : la scène est réaffirmée comme projection et non comme couche d'autorité.
- Blocage : aucun.
- Prochaine action : définir unités de mémoire, index et déclencheurs de rappel.

### 2026-06-30 — Atelier 5, lot 2

- Travail réalisé : définition des unités indexées, index reconstruisibles et déclencheurs de rappel.
- Décision : les index stockent des références, jamais une copie autoritaire du contenu.
- Décision : retour de lieu, réapparition, fil actif, mention explicite et engagement sont des déclencheurs forts.
- Décision : similarité, thème et proximité proposent seulement des candidats secondaires.
- Cas de référence : un retour compare état connu, changements survenus et état actuel sans révéler les secrets inaccessibles.
- Blocage : aucun.
- Prochaine action : formaliser les rôles respectifs des recherches structurée, textuelle et sémantique.

### 2026-06-30 — Atelier 5, lot 3

- Travail réalisé : définition du pipeline hybride, des canaux, quotas, filtres et niveaux de priorité.
- Décision : éléments obligatoires hors compétition, puis recherches structurée, graphe, texte et sémantique bornées.
- Décision : tous les candidats sont validés contre source, version, temporalité et perspective.
- Décision : le canal sémantique est facultatif, dérivé et ne prouve jamais identité ou vérité.
- Résilience : la mémoire structurée continue de fonctionner sans index sémantique.
- Blocage : aucun.
- Prochaine action : définir classement interne, diversité, déduplication, condensation et perspectives.

### 2026-06-30 — Atelier 5, lot 4

- Travail réalisé : classement interne, déduplication, diversité, capsules et projections par perspective.
- Décision : les perspectives portant sur un même sujet restent distinctes et liées, jamais fusionnées.
- Décision : les capsules sont structurées, sourcées et vérifiables; leur formulation courte reste dérivée.
- Décision : vues MJ, PJ, PNJ, méta et diagnostic sont séparées avec contrôle des droits à chaque étape.
- Garde-fou : une donnée interdite ne peut pas réapparaître lors de la condensation.
- Blocage : aucun.
- Prochaine action : définir budgets, traces de sélection et valider le cas de retour tardif.

### 2026-06-30 — Atelier 5, lot 5 et clôture

- Travail réalisé : budget de projection, ordre de réduction, trace complète et cas d'acceptation du retour tardif.
- Décision : budgets configurables par modèle et rôle; aucun seuil universel prématuré.
- Décision : les éléments obligatoires ne sont jamais tronqués silencieusement; dépassement explicite ou tâche fractionnée.
- Décision : chaque inclusion, exclusion et condensation importante est traçable.
- Cas validé : retour après plusieurs mois sans transcript complet, oubli durable ni fuite de secret.
- Audit transversal : engagements d'intrigue récupérables et projections séparées par perspective.
- État : atelier 5 `BOUCLE`.
- Prochaine action : formaliser le snapshot immuable et le dossier de scène transmis aux différents rôles IA.

### 2026-06-30 — Atelier 6, lot 1

- Travail réalisé : clarification du périmètre de l'atelier et création de `Snapshot-et-contextes.md`.
- Décision : distinction entre snapshot persistant de campagne et vue immuable de début de tour.
- Décision : chaque rôle IA reçoit une projection spécialisée issue des mêmes sources versionnées.
- Décision : les conséquences du tour arrivent par un résultat committé, sans modifier rétroactivement le snapshot initial.
- Blocage : aucun.
- Prochaine action : définir les sections communes, identifiants, versions et provenance du `TurnSnapshot`.

### 2026-06-30 — Atelier 6, lot 2

- Travail réalisé : enveloppe commune, manifeste des sources, sections partagées et provenance des blocs.
- Décision : versions globales et par agrégat accompagnent chaque photographie de tour.
- Décision : manifeste ordonné et empreinte déterministe rendent la construction vérifiable.
- Décision : données incorporées et références sont explicitement distinguées; aucune référence opaque n'est laissée à inventer par l'IA.
- Reproductibilité : mêmes versions, politique, perspective et but produisent les mêmes blocs structurés obligatoires.
- Blocage : aucun.
- Prochaine action : définir les sections et droits propres à chaque rôle IA.

### 2026-06-30 — Atelier 6, lot 3

- Travail réalisé : matrice des rôles, sections indispensables, exclusions et finalités.
- Décision : planification secrète et rédaction visible utilisent des paquets séparés.
- Décision : le rédacteur reçoit une enveloppe `reveal`, `hint`, `withhold`, jamais toute la vérité cachée brute.
- Décision : vérité, perception, connaissance, croyance, secret, dérivé et inconnu restent explicitement typés.
- Garde-fou : règles, mutations, droits, budgets et validation demeurent déterministes.
- Blocage : aucun.
- Prochaine action : définir permissions créatives et réduction budgétaire propre à chaque rôle.

### 2026-06-30 — Atelier 6, lot 4

- Travail réalisé : contrat `creativeScope`, permissions par rôle, priorités budgétaires et ordre de réduction.
- Décision : un rôle peut créer une forme ou proposer une entité uniquement dans son périmètre explicite; il ne peut jamais étendre lui-même son autorité.
- Garde-fou : aucune contrainte obligatoire, perspective, permission, révélation autorisée ou dépendance critique n'est tronquée silencieusement.
- Prochaine action : définir la détection et le traitement des snapshots obsolètes, puis produire la trace et l'exemple parseable.

### 2026-06-30 — Atelier 6, lot 5 et clôture

- Travail réalisé : contrôle d'obsolescence par dépendances, règles de reprise, trace de construction et exemple JSON parseable.
- Décision : une hausse de version globale n'invalide pas seule un résultat; seules les dépendances effectivement lues déterminent s'il peut être poursuivi, reprojeté, revalidé ou abandonné.
- Garde-fou : aucune mutation ne peut provenir d'un contexte obsolète et la narration finale dépend toujours du résultat post-commit.
- Audit transversal : autorité, mémoire, secrets, créations dynamiques, intrigue, temps et persistance restent séparés dans les projections.
- Résultat : atelier 6 `BOUCLE`.
- Prochaine action : atelier 7, définir le pipeline d'appels et les contrats de sortie IA.

### 2026-06-30 — Atelier 7, lot 1

- Travail réalisé : pipeline adaptatif, profils court, standard et sensible, puis contrôles distincts avant commit et avant affichage.
- Décision : la fiabilité prime sur la latence; aucun texte IA n'est soumis au joueur avant validation de son contenu visible.
- Nuance : la validation couvre exhaustivement les contrôles définis, sans prétendre prouver mathématiquement toute la cohérence narrative.
- Garde-fou : une rédaction rejetée après commit est corrigée sans rejouer la résolution ni créer un second commit.
- Prochaine action : décider quels rôles ont leur propre appel et dans quels cas ils deviennent obligatoires.

### 2026-06-30 — Atelier 7, lot 2

- Travail réalisé : déclenchement des interprète, planificateur, adaptateur d'expression joueur, interprètes PNJ, critique et rédacteur final.
- Décision : un PNJ significatif dispose de son propre appel et de sa propre perspective; les figurants ne peuvent être groupés que pour une réaction sans portée durable.
- Décision : les dialogues et engagements verbaux sont préparés puis validés avant le commit atomique.
- Garde-fou : le `PreparedTurnResult` permet aux interprètes de réagir au résultat provisoire sans devenir une vérité persistante.
- Prochaine action : définir les contrats structurés exacts, en particulier l'enveloppe sémantique du joueur et les actes de parole.

### 2026-06-30 — Atelier 7, lot 3

- Travail réalisé : enveloppe commune stricte et contrats conceptuels de l'interpréteur, du planificateur, des interprètes, du critique et du rédacteur.
- Décision : les dialogues exacts restent des blocs séparés; le rédacteur final ne peut pas les réécrire.
- Décision : une affirmation prononcée est un événement historique, mais son contenu ne devient pas automatiquement un fait objectif.
- Garde-fou : les autoévaluations de l'IA ne valent pas validation; l'équivalence sémantique est contrôlée indépendamment.
- Prochaine action : préciser versions de schéma, correction ciblée, limites de reprise et comportements d'échec.

### 2026-06-30 — Atelier 7, lot 4

- Travail réalisé : taxonomie des échecs, protocole de correction, limites de reprise, comportements avant et après commit.
- Décision : une sortie corrigée remplace intégralement la candidate fautive et référence celle-ci; aucun patch partiel produit par l'IA n'est fusionné.
- Décision : après un commit, seul le rendu peut être repris; un rendu déterministe sécurisé prend le relais si la rédaction échoue durablement.
- Garde-fou : `operationId` empêche tout double commit et les tentatives possèdent des identifiants distincts.
- Prochaine action : identifier les parcours sans IA, interdire les fuites dans les sorties visibles et auditer l'atelier avec un exemple parseable.

### 2026-06-30 — Atelier 7, lot 5 et clôture

- Travail réalisé : séparation calcul/interprétation/arbitrage, rôle `rules_adjudicator`, sécurité positive des sorties et exemple complet parseable.
- Décision : « sans IA » signifie sans besoin d'interprétation ouverte; l'IA peut arbitrer un cas non prévu, mais le domaine propriétaire conserve l'autorité et le commit.
- Décision : les blocs visibles sont fondés sur des sources révélables; une recherche par mots-clés ne constitue pas un contrôle suffisant.
- Garde-fou : un arbitrage accepté peut devenir un précédent de campagne, jamais une règle officielle implicite.
- Audit transversal : chaque sortie possède un rôle, une destination, une validation, un comportement d'échec et une visibilité définis.
- Résultat : atelier 7 `BOUCLE`.
- Prochaine action : atelier 8, formaliser les contrats entre narration et domaines propriétaires.

### 2026-06-30 — Atelier 8, lot 1

- Travail réalisé : audit des fondations existantes, protocole commun de commande et distinction avec les transferts de contrôle longs.
- Décision : tactique, repos complexe et futurs processus interactifs utilisent un `ProcessHandoff` sauvegardable plutôt qu'une transaction synchrone ordinaire.
- Décision : la simulation mondiale demeure l'autorité macroscopique; ses événements committés sont projetés vers la narration selon leur portée locale.
- Garde-fou : tout retour de processus reconstruit un snapshot après commit complet des conséquences.
- Prochaine action : définir le contrat personnage et progression.

### 2026-06-30 — Atelier 8, lot 2

- Travail réalisé : couches du personnage de campagne, projection narrative, commandes, progression et cycle des évolutions identitaires.
- Décision : l'IA peut proposer un jalon ou un arc de personnage; règles et joueur conservent respectivement l'autorité mécanique et identitaire.
- Garde-fou : une réaction contextuelle, une observation et un trait durable sont trois états distincts.
- Prochaine action : définir inventaire, possessions, monnaie, commerce et transactions économiques.

### 2026-06-30 — Atelier 8, lot 3

- Travail réalisé : analyse de la fiche prête à jouer, contrat d'import normalisé, compatibilité tactique, placements d'instances, monnaie physique, présentation et commerce.
- Décision : la fiche de création est importée puis normalisée; elle n'est pas l'état de campagne directement muté par tous les moteurs.
- Décision : les objets et contenants utilisent des références d'instance; les pièces physiques sont autoritaires et le résumé `argent` devient dérivé ou legacy.
- Décision : vêtements, équipement visible et propreté produisent des facteurs sociaux contextuels sans modifier le Charisme de base.
- Garde-fou : les projections tactiques maintiennent la compatibilité sans permettre au tactique d'écraser l'agrégat de campagne.
- Prochaine action : définir déplacement, carte et monde.
