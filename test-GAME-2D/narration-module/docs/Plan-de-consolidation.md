# Plan de consolidation du cahier des charges

Dernière mise à jour : `2026-06-29`

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
| 1 | Boucle joueur et périmètre MVP | `EN_COURS` | Parcours complet d'un tour et limites MVP | 0 |
| 2 | Autorité des systèmes | `EN_COURS` | Matrice lecture/proposition/validation/mutation | 1 |
| 3 | Modèle persistant de campagne | `A_FAIRE` | Modèle conceptuel et invariants | 2 |
| 4 | Créations dynamiques de l'IA | `A_FAIRE` | Cycles de vie par type de création | 3 |
| 5 | Mémoire et rappel | `A_FAIRE` | Pipeline de conservation, recherche et projection | 3, 4 |
| 6 | Snapshot et dossier de scène | `A_FAIRE` | Contrat d'entrée conceptuel versionné | 2, 5 |
| 7 | Pipeline et contrats IA | `A_FAIRE` | Séquence des appels et contrats de sortie | 4, 6 |
| 8 | Intégration des moteurs | `A_FAIRE` | Contrats narration ↔ domaines propriétaires | 2, 7 |
| 9 | Temps et monde vivant | `A_FAIRE` | Contrat temporel et articulation des événements | 5, 8 |
| 10 | Résilience, sécurité et diagnostic | `A_FAIRE` | Catalogue des échecs et comportements attendus | 7, 8 |
| 11 | Exigences non fonctionnelles | `A_FAIRE` | Budgets et objectifs mesurables | 5, 7, 10 |
| 12 | Scénarios d'acceptation | `A_FAIRE` | Corpus fonctionnel et cas limites | 1 à 11 |
| 13 | Audit final et plan d'implémentation | `A_FAIRE` | Rapport de cohérence et lots techniques | 12 |

Les ateliers 1 et 2 sont marqués `EN_COURS` car leurs principes existent déjà, mais leurs livrables détaillés ne sont pas encore complets.

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
- [ ] Définir ce qui constitue une scène et une transition de scène.
- [x] Définir les usages respectifs de la saisie libre, des suggestions et des clarifications.
- [ ] Définir les types de messages visibles et leur ordre d'affichage.
- [ ] Définir la place des dialogues multiples et des interruptions.
- [ ] Définir les limites fonctionnelles du premier scénario vertical.
- [ ] Lister explicitement le hors-périmètre MVP.

### Livrables

- Parcours nominal du joueur.
- Variantes importantes du parcours.
- Périmètre et hors-périmètre du MVP.

### Avancement détaillé

- [x] Lot 1 — Unité de tour, entrées composées, gestes implicites, points d'arrêt, clarification et atomicité.
- [x] Lot 2 — Formes de saisie, dialogues, suggestions et politique complète de clarification.
- [ ] Lot 3 — Définition et transitions d'une scène.
- [ ] Lot 4 — Parcours MVP, types de messages et interruptions.
- [ ] Lot 5 — Périmètre, hors-périmètre et validation finale de l'atelier.

### Critère de sortie

Il est possible de raconter précisément une session MVP sans supposer un comportement absent du cahier des charges.

## Atelier 2 — Autorité des systèmes

### Questions à résoudre

- [ ] Inventorier tous les domaines de données.
- [ ] Désigner l'autorité de lecture et de mutation de chaque domaine.
- [ ] Distinguer proposition, validation, exécution et notification.
- [ ] Identifier les données encore sans propriétaire dans l'application actuelle.
- [ ] Définir les règles de conflit entre état local, campagne et canon.
- [ ] Confirmer l'autorité unique de l'horloge.

### Livrable

Une matrice comportant pour chaque donnée : propriétaire, lecteurs, auteurs de proposition, validateur, mutation autorisée et événements émis.

### Critère de sortie

Aucune donnée persistante du MVP ne possède deux autorités concurrentes ou aucune autorité.

## Atelier 3 — Modèle persistant de campagne

### Questions à résoudre

- [ ] Définir identité et relations entre campagne, sauvegarde, scène, tour et snapshot.
- [ ] Définir faits, événements, commandes et mutations.
- [ ] Définir PNJ, relations, connaissances, croyances, secrets et fils narratifs.
- [ ] Définir provenance, temporalité, validité et remplacement d'un fait.
- [ ] Définir les invariants transactionnels et l'idempotence.
- [ ] Définir versionnement et migrations de sauvegarde.
- [ ] Séparer modèle conceptuel et choix de technologie de stockage.

### Livrables

- Modèle conceptuel des entités.
- Invariants de persistance.
- Exemple complet d'une sauvegarde minimale, non contractuel dans un premier temps.

### Critère de sortie

Le scénario MVP peut être sauvegardé, rechargé et poursuivi sans utiliser la conversation comme source de vérité.

## Atelier 4 — Créations dynamiques de l'IA

### Questions à résoudre

- [ ] Définir les cycles éphémère, candidat, validé, persistant et archivé.
- [ ] Définir les règles propres aux PNJ, événements, lieux, objets, missions et intrigues.
- [ ] Définir les seuils de promotion vers la persistance.
- [ ] Définir la gestion des doublons et créations contradictoires.
- [ ] Définir ce qui peut être corrigé, refusé ou régénéré.
- [ ] Préserver la créativité sans introduire des catalogues narratifs fermés.

### Critère de sortie

Toute création du scénario MVP possède un parcours explicite depuis sa première évocation jusqu'à sa persistance éventuelle.

## Atelier 5 — Mémoire et rappel

### Questions à résoudre

- [ ] Définir ce qui est conservé intégralement, condensé ou dérivé.
- [ ] Définir les états `active`, `relevant`, `dormant` et `archived`.
- [ ] Définir les déclencheurs de rappel.
- [ ] Définir recherche structurée, textuelle et sémantique.
- [ ] Définir validation, classement, déduplication et condensation.
- [ ] Définir les perspectives et droits de révélation.
- [ ] Définir les budgets de mémoire projetée.
- [ ] Définir la traçabilité des inclusions et exclusions.

### Critère de sortie

Le retour dans un lieu après plusieurs mois de jeu rappelle les faits utiles sans injecter toute la campagne ni révéler un secret inaccessible.

## Atelier 6 — Snapshot et dossier de scène

### Questions à résoudre

- [ ] Définir les sections obligatoires et facultatives.
- [ ] Définir identifiants, versions et provenance.
- [ ] Distinguer vérité, perception, connaissance, croyance et secret.
- [ ] Définir les libertés et interdictions créatives du tour.
- [ ] Définir les règles de réduction en cas de dépassement du budget.
- [ ] Définir la détection d'un snapshot devenu obsolète.

### Critère de sortie

Deux exécutions recevant le même snapshot disposent des mêmes faits autoritaires, même si leur prose diffère.

## Atelier 7 — Pipeline et contrats IA

### Questions à résoudre

- [ ] Séparer interprétation, création, résolution et rédaction.
- [ ] Décider quels rôles nécessitent un appel distinct.
- [ ] Définir les propositions structurées et sorties visibles.
- [ ] Définir schémas, versions et validation.
- [ ] Définir clarification, correction ciblée et régénération.
- [ ] Définir ce qui peut être traité sans appel IA.
- [ ] Définir les informations interdites dans la réponse joueur.

### Critère de sortie

Chaque donnée produite par l'IA a une destination, une validation et un comportement d'échec explicites.

## Atelier 8 — Intégration des moteurs

### Frontières à traiter

- [ ] Narration ↔ personnage et progression.
- [ ] Narration ↔ inventaire et économie.
- [ ] Narration ↔ déplacement et carte.
- [ ] Narration ↔ résolution sociale.
- [ ] Narration ↔ tactique.
- [ ] Narration ↔ repos.
- [ ] Narration ↔ monde et factions.
- [ ] Narration ↔ sauvegarde.

### Critère de sortie

Chaque passage possède une requête, une validation, un résultat, des événements et une stratégie d'échec.

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
