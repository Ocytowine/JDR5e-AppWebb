# Templates lore V1

Ces fichiers sont les modèles d'auteur de `lore-authoring/1`. Ils restent hors de `wiki/lore/` afin de ne jamais être importés comme de vraies entités.

## Règles communes

- Copier le template approprié sous `wiki/lore/`, puis remplacer toutes les valeurs d'exemple.
- Utiliser un `id` stable en minuscules ASCII avec underscores.
- Ne jamais déduire l'identité du nom de fichier.
- Référencer les autres entités par leur `id`, pas par leur nom affiché.
- Mettre les règles et statistiques dans les catalogues mécaniques; le wiki les référence sans les recopier.
- Employer `lieu_initial`, `objectifs_initiaux` et autres champs initiaux pour les valeurs qui pourront changer en campagne.
- Placer les informations sélectionnables séparément dans `informations`.
- Préfixer chaque section Markdown indexable par son niveau, par exemple `## [LOCAL] Traditions observées`.
- Ne jamais présenter une rumeur, une croyance ou une cause contestée comme une vérité certaine.

## Niveaux de connaissance

- `COMMUN` : savoir général.
- `LOCAL` : savoir courant dans une zone ou une communauté liée.
- `SPECIALISE` : savoir de métier, d'étude, de religion ou de faction.
- `RESTREINT` : nécessite une acquisition ou une permission explicite.
- `MJ_SECRET` : réservé aux perspectives système privées pertinentes.

Les champs vides facultatifs peuvent être supprimés. Une clé non prévue par le contrat est interdite; faire évoluer le schéma avant de l'ajouter.

Un texte Markdown non classifié est conservé comme source, mais n'est pas indexé et produit un avertissement.

## Modèles disponibles

- `royaume.md`
- `territoire.md`
- `region.md`
- `ville.md`
- `quartier.md`
- `batiment.md`
- `faction.md`
- `meta.md`
- `espece.md`
- `culture.md`
- `pnj.md`
- `periode_historique.md`
- `evenement_historique.md`
