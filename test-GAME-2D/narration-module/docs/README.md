# Documentation du module narration

Ce dossier est la source de vérité de conception du futur module narration.
Il décrit la cible avant toute reprise du runtime.

## Documents de référence

- [`Dossier-de-conception.md`](Dossier-de-conception.md) : état courant de la conception produit et technique.
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
