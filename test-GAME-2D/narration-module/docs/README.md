# Documentation du module narration

Ce dossier est la source de vérité de conception et de suivi du module narration.
Il distingue la cible complète du runtime de campagne et les capacités déjà livrées progressivement. La surface narration prototype, la bascule OpenAI opt-in, l'enregistrement durable des projections de rendu, la reconstruction du fil visible, la scène narrative de référence I-06M, le paquet IA de scène I-06N, l'état de scène minimal I-06O, la mémoire courte PNJ I-06P, le scénario vertical I-06Q, les corrections qualité I-06R, le contrat de scène jouable I-06S, l'intégration wiki minimale de lieux I-06T, les créations éphémères contrôlées I-06U, la gate de préparation intrigue I-06V, le socle contractuel I-07A des handoffs tactique/repos, leur raccord temporel I-07B, le repos segmenté propriétaire I-07C et le placeholder tactique contractuel I-07D existent; le MJ complet, la mémoire sociale générique, les handoffs jouables branchés aux moteurs propriétaires et le lecteur UX d'historique complet restent à ouvrir par contrats dédiés.

## Documents de référence

- [`Dossier-de-conception.md`](Dossier-de-conception.md) : état courant de la conception produit et technique.
- [`Matrice-autorite.md`](Matrice-autorite.md) : propriétaires, lecteurs, propositions, validations, mutations et événements du MVP.
- [`Modele-persistant.md`](Modele-persistant.md) : chronologie, sauvegarde, commits, snapshots et futurs agrégats de campagne.
- [`Exemple-sauvegarde-mvp.json`](Exemple-sauvegarde-mvp.json) : exemple parseable et non contractuel du modèle persistant.
- [`Coherence-intrigues.md`](Coherence-intrigues.md) : engagements narratifs, vérité cachée, indices et contrôles des intrigues dynamiques.
- [`Creations-dynamiques.md`](Creations-dynamiques.md) : cycles, promotions et règles de création des PNJ, événements, objets, fils et lieux.
- [`Memoire-et-rappel.md`](Memoire-et-rappel.md) : conservation, cycles de rappel, oubli subjectif et futures projections contextuelles.
- [`Snapshot-et-contextes.md`](Snapshot-et-contextes.md) : photographie immuable d'un tour et paquets spécialisés par rôle IA.
- [`Contrat-memoire-snapshot.md`](Contrat-memoire-snapshot.md) : contrat `FIGE` I-04 `memory-context/1`, mémoire, snapshot, contexte, budget et obsolescence.
- [`Contrat-pipeline-ia-creations.md`](Contrat-pipeline-ia-creations.md) : contrat `FIGE` I-05A `ai-pipeline/1`, faux fournisseur, rôles IA, sorties, retries, incidents et créations.
- [`Contrat-fournisseur-ia-openai.md`](Contrat-fournisseur-ia-openai.md) : contrat `FIGE` I-05B `ai-provider-openai/1`, OpenAI côté serveur, clé, schémas stricts, retries et test live optionnel.
- [`Contrat-scene-social-ui.md`](Contrat-scene-social-ui.md) : contrat `FIGE` I-06A `scene-social-ui/1`, scène, social, transcript, blocs visibles et attribution accessible.
- [`Contrat-interface-narrative-react.md`](Contrat-interface-narrative-react.md) : contrat `FIGE` I-06B `narrative-react-ui/1`, composants React purs, saisie libre et absence d'appel fournisseur navigateur.
- [`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md) : contrat `FIGE` I-06C `narrative-app-surface/1`, surface narration dédiée distincte du tactique.
- [`Contrat-controleur-tour-narratif.md`](Contrat-controleur-tour-narratif.md) : contrat `FIGE` I-06D `narrative-turn-controller/1`, saisie libre vers opération durable sans commit métier.
- [`Contrat-interpretation-clarification.md`](Contrat-interpretation-clarification.md) : contrat `FIGE` I-06E `intent-clarification/1`, interprétation conservatrice et clarification sans mutation.
- [`Contrat-resolution-narrative.md`](Contrat-resolution-narrative.md) : contrat `FIGE` I-06F `narrative-resolution/1`, résolution bornée, reformulation PJ, commit validé et handoffs.
- [`Contrat-resolution-ia-bornee.md`](Contrat-resolution-ia-bornee.md) : contrat `FIGE` I-06G `narrative-ai-resolution/1`, embellissement IA sans autorité métier.
- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md) : contrat `FIGE` I-07 `tactical-rest-handoff/1`, seeds, processus, outcomes, intégration et signaux de repos.
- [`Exemple-role-context-pack.json`](Exemple-role-context-pack.json) : exemple parseable d'un paquet spécialisé et de sa trace de sélection.
- [`Pipeline-et-contrats-IA.md`](Pipeline-et-contrats-IA.md) : enchaînement des rôles IA, validations, commits et rédaction visible.
- [`Exemple-pipeline-tour.json`](Exemple-pipeline-tour.json) : trace parseable d'un tour avec arbitrage temporel, commit et contrôle d'affichage.
- [`Integration-domaines.md`](Integration-domaines.md) : transactions et transferts de contrôle entre narration, règles et moteurs propriétaires.
- [`Regles-et-arbitrages.md`](Regles-et-arbitrages.md) : gouvernance des règles maison, versions, conflits et arbitrages IA.
- [`Exemple-integration-domaines.json`](Exemple-integration-domaines.json) : transaction multidomaine parseable avec commit, projections et reprise.
- [`Temps-et-monde-vivant.md`](Temps-et-monde-vivant.md) : horloge précise, avances segmentées et articulation avec la simulation mondiale.
- [`Contrat-temps-processus.md`](Contrat-temps-processus.md) : contrat exécutable `temporal-kernel/1`, sous-lots I-03 et frontière avec `map-module`.
- [`Handoff-I03D.md`](Handoff-I03D.md) : point de reprise opérationnel, fichiers clés, invariants et plan du dernier sous-lot I-03.
- [`Matrice-preuves-I03.md`](Matrice-preuves-I03.md) : revue exécutable de la gate I-03 et limites avant mémoire/snapshot.
- [`Matrice-preuves-I04.md`](Matrice-preuves-I04.md) : preuves du socle mémoire, snapshot, contexte, budget et obsolescence.
- [`Matrice-preuves-I05.md`](Matrice-preuves-I05.md) : preuves du socle pipeline IA contractuel et créations dynamiques I-05A.
- [`Matrice-preuves-I05B.md`](Matrice-preuves-I05B.md) : preuves de l'adaptateur fournisseur OpenAI I-05B.
- [`Matrice-preuves-I06A.md`](Matrice-preuves-I06A.md) : preuves du socle scène, social, transcript et affichage typé.
- [`Matrice-preuves-I06B.md`](Matrice-preuves-I06B.md) : preuves de l'interface narrative React pure.
- [`Matrice-preuves-I06C.md`](Matrice-preuves-I06C.md) : preuves de la surface narration applicative dédiée.
- [`Matrice-preuves-I06D.md`](Matrice-preuves-I06D.md) : preuves du contrôleur de tour narratif prototype.
- [`Matrice-preuves-I06E.md`](Matrice-preuves-I06E.md) : preuves de l'interprétation conservatrice et de la clarification.
- [`Matrice-preuves-I06F.md`](Matrice-preuves-I06F.md) : preuves de la résolution narrative bornée, du commit speech et des handoffs.
- [`Matrice-preuves-I06G.md`](Matrice-preuves-I06G.md) : preuves de l'enrichissement IA borné et du fallback déterministe.
- [`Matrice-preuves-I06H.md`](Matrice-preuves-I06H.md) : preuves du branchement UI enrichi et du fournisseur OpenAI contrôlé.
- [`Matrice-preuves-I06I.md`](Matrice-preuves-I06I.md) : preuves de la route serveur OpenAI narrative opt-in.
- [`Matrice-preuves-I06J.md`](Matrice-preuves-I06J.md) : preuves de la bascule UI OpenAI opt-in avec fallback local.
- [`Matrice-preuves-I06K.md`](Matrice-preuves-I06K.md) : preuves de la persistance des projections de rendu et incidents IA expurgés.
- [`Matrice-preuves-I06L.md`](Matrice-preuves-I06L.md) : preuves de la reconstruction du fil visible depuis les projections persistées.
- [`Matrice-preuves-I06M.md`](Matrice-preuves-I06M.md) : preuves de la scène narrative de référence et des blocs visibles concrets.
- [`Matrice-preuves-I06N.md`](Matrice-preuves-I06N.md) : preuves du paquet IA `scene_writer` ancré dans la scène de référence.
- [`Matrice-preuves-I06O.md`](Matrice-preuves-I06O.md) : preuves de l'état de scène minimal persistant.
- [`Matrice-preuves-I06P.md`](Matrice-preuves-I06P.md) : preuves de la mémoire courte PNJ et de la continuité de scène.
- [`Matrice-preuves-I06Q.md`](Matrice-preuves-I06Q.md) : preuves du scénario vertical qualité Locale/OpenAI-compatible sur la scène de référence.
- [`Matrice-preuves-I06R.md`](Matrice-preuves-I06R.md) : preuves des corrections qualité issues du scénario vertical I-06Q.
- [`Matrice-preuves-I06S.md`](Matrice-preuves-I06S.md) : preuves de la généralisation légère `playable-scene-state/1`.
- [`Matrice-preuves-I06T.md`](Matrice-preuves-I06T.md) : preuves de l'intégration wiki minimale d'un lieu en scène jouable.
- [`Matrice-preuves-I06U.md`](Matrice-preuves-I06U.md) : preuves des créations éphémères contrôlées de scène.
- [`Matrice-preuves-I06V.md`](Matrice-preuves-I06V.md) : preuves de la gate de préparation intrigue sans création d'intrigue.
- [`Suivi-prochains-lots-narration.md`](Suivi-prochains-lots-narration.md) : feuille de suivi des lots I-06Q et suivants avant généralisation.
- [`Matrice-preuves-I07-audit.md`](Matrice-preuves-I07-audit.md) : audit tactique/repos, résolution AF-R13/AF-R14 et autorisation limitée I-07A.
- [`Matrice-preuves-I07A.md`](Matrice-preuves-I07A.md) : preuves I-07A, types, validateurs, fixtures et intégration idempotente simulée.
- [`Matrice-preuves-I07B.md`](Matrice-preuves-I07B.md) : preuves I-07B, intégration temporelle des outcomes tactique/repos par `world.clock`.
- [`Matrice-preuves-I07C.md`](Matrice-preuves-I07C.md) : preuves I-07C, repos segmenté, checkpoints et interruptions déterministes.
- [`Matrice-preuves-I07D.md`](Matrice-preuves-I07D.md) : preuves I-07D, placeholder tactique et outcomes typés.
- [`Handoff-I06J-retour-live.md`](Handoff-I06J-retour-live.md) : retour des premiers tests OpenAI live, cap produit et prochain micro-lot recommandé.
- [`Exemple-chronologie-causale.json`](Exemple-chronologie-causale.json) : interruption temporelle, tick mondial, visibilité et reprise idempotente.
- [`Resilience-securite-diagnostic.md`](Resilience-securite-diagnostic.md) : confinement des erreurs, sécurité des données et traces exploitables.
- [`Exigences-non-fonctionnelles.md`](Exigences-non-fonctionnelles.md) : objectifs mesurables de latence, coût, qualité et capacité.
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md) : corpus observable, granularité et oracles du scénario vertical et des cas limites.
- [`Matrice-tracabilite-acceptation.md`](Matrice-tracabilite-acceptation.md) : liens entre exigences P0, décisions, contrats, scénarios et résultats observables.
- [`Matrice-couverture-scenarios.md`](Matrice-couverture-scenarios.md) : couverture actuelle des scénarios NAR-ACC, manques et lots responsables sans modifier la roadmap.
- [`Audit-final.md`](Audit-final.md) : contradictions, reports, contrats à figer et décision progressive d'autorisation de coder.
- [`Contrat-noyau-campagne.md`](Contrat-noyau-campagne.md) : contrat `FIGE` du premier lot, opérations, commits, événements, horloge, outbox et repository.
- [`Contrat-persistance-indexeddb.md`](Contrat-persistance-indexeddb.md) : contrat `FIGE` d'I-01, stores, index, transactions, générations, migrations et tests navigateur.
- [`Contrat-bootstrap-campagne.md`](Contrat-bootstrap-campagne.md) : contrat `FIGE` d'I-02, paquets immuables, ingestion wiki, import personnage et `RuleRegistry` MVP.
- [`Matrice-preuves-I02.md`](Matrice-preuves-I02.md) : revue exécutable de la gate I-02 et réserve de parité tactique différée.
- [`Contrat-contenu-lore.md`](Contrat-contenu-lore.md) : contrat `FIGE` `lore-authoring/1`, types auteur, niveaux de connaissance, relations et fragmentation déterministe.
- [`Plan-implementation-narration.md`](Plan-implementation-narration.md) : lots I-00 à I-08, prérequis, scénarios et gates de livraison.
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
