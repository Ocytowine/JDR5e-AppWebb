# Documentation du module narration

Ce dossier est la source de vérité de conception du futur module narration.
Il décrit la cible avant toute reprise du runtime.

## Documents de référence

- [`Dossier-de-conception.md`](Dossier-de-conception.md) : état courant de la conception produit et technique.
- [`Matrice-autorite.md`](Matrice-autorite.md) : propriétaires, lecteurs, propositions, validations, mutations et événements du MVP.
- [`Modele-persistant.md`](Modele-persistant.md) : chronologie, sauvegarde, commits, snapshots et futurs agrégats de campagne.
- [`Exemple-sauvegarde-mvp.json`](Exemple-sauvegarde-mvp.json) : exemple parseable et non contractuel du modèle persistant.
- [`Coherence-intrigues.md`](Coherence-intrigues.md) : engagements narratifs, vérité cachée, indices et contrôles des intrigues dynamiques.
- [`Creations-dynamiques.md`](Creations-dynamiques.md) : cycles, promotions et règles de création des PNJ, événements, objets, fils et lieux.
- [`Memoire-et-rappel.md`](Memoire-et-rappel.md) : conservation, cycles de rappel, oubli subjectif et futures projections contextuelles.
- [`Snapshot-et-contextes.md`](Snapshot-et-contextes.md) : photographie immuable d'un tour et paquets spécialisés par rôle IA.
- [`Exemple-role-context-pack.json`](Exemple-role-context-pack.json) : exemple parseable d'un paquet spécialisé et de sa trace de sélection.
- [`Pipeline-et-contrats-IA.md`](Pipeline-et-contrats-IA.md) : enchaînement des rôles IA, validations, commits et rédaction visible.
- [`Exemple-pipeline-tour.json`](Exemple-pipeline-tour.json) : trace parseable d'un tour avec arbitrage temporel, commit et contrôle d'affichage.
- [`Integration-domaines.md`](Integration-domaines.md) : transactions et transferts de contrôle entre narration, règles et moteurs propriétaires.
- [`Regles-et-arbitrages.md`](Regles-et-arbitrages.md) : gouvernance des règles maison, versions, conflits et arbitrages IA.
- [`Exemple-integration-domaines.json`](Exemple-integration-domaines.json) : transaction multidomaine parseable avec commit, projections et reprise.
- [`Temps-et-monde-vivant.md`](Temps-et-monde-vivant.md) : horloge précise, avances segmentées et articulation avec la simulation mondiale.
- [`Exemple-chronologie-causale.json`](Exemple-chronologie-causale.json) : interruption temporelle, tick mondial, visibilité et reprise idempotente.
- [`Resilience-securite-diagnostic.md`](Resilience-securite-diagnostic.md) : confinement des erreurs, sécurité des données et traces exploitables.
- [`Exigences-non-fonctionnelles.md`](Exigences-non-fonctionnelles.md) : objectifs mesurables de latence, coût, qualité et capacité.
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md) : corpus observable, granularité et oracles du scénario vertical et des cas limites.
- [`Matrice-tracabilite-acceptation.md`](Matrice-tracabilite-acceptation.md) : liens entre exigences P0, décisions, contrats, scénarios et résultats observables.
- [`Plan-de-consolidation.md`](Plan-de-consolidation.md) : ateliers, checklist anti-oubli, critères de sortie et journal d'avancement.
- [`Journal-des-decisions.md`](Journal-des-decisions.md) : décisions structurantes, raisons et conséquences.
- [`../Idée de base.md`](../Idée%20de%20base.md) : texte d'intention initial; il reste une source d'idées, pas un contrat actif.

Les anciens documents supprimés ne redeviennent pas des références par défaut. Une idée historique ne peut être reprise qu'après comparaison avec le code actuel et inscription dans le journal des décisions.

## Statuts utilisés

- `PROPOSITION` : piste à discuter, sans valeur contractuelle.
- `RETENU` : direction validée, détails encore modifiables.
- `FIGE` : contrat suffisamment précis pour guider une implémentation.
- `REMPLACE` : décision conservée pour l'historique, mais devenue inactive.

Un principe `FIGE` peut évoluer. La modification doit alors être expliquée dans le journal et les sections dépendantes doivent être relues.

## Méthode de mise à jour

1. Modifier d'abord le dossier de conception pour exprimer le comportement attendu.
2. Ajouter ou modifier une décision lorsque l'autorité d'un système, un contrat ou une contrainte structurante change.
3. Vérifier les impacts sur l'IA, la mémoire, le monde, les personnages, la tactique, la sauvegarde et l'interface.
4. Ajouter un scénario d'acceptation avant de transformer une section en contrat d'implémentation.
5. Mettre à jour `TASKS.md` avec la prochaine décision concrète, sans y recopier l'analyse détaillée.
6. Mettre à jour le tableau de bord et le journal du plan de consolidation à la fin de chaque atelier.

## Règles de cohérence documentaire

- Une information normative ne doit avoir qu'un seul emplacement principal.
- Le journal explique pourquoi; le dossier décrit ce qui est vrai actuellement.
- Les schémas JSON futurs seront versionnés et validables. Les exemples ne feront pas office de schémas.
- Les incertitudes restent explicitement marquées; elles ne doivent pas être comblées implicitement pendant le codage.
- Aucun runtime narratif ne doit être développé tant que le scénario vertical MVP et ses contrats essentiels ne sont pas `FIGE`.
