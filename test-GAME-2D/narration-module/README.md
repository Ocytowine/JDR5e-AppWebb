# Narration Module

Le module a ete reduit a un perimetre minimal:

- `ui/`: interface de configuration et client front.
- `server/wikiLoreHelper.js`: selection de lore wiki.
- `server/localLoreHelper.js`: selection de lore local.
- `server/narrationHttpApi.js`: facade HTTP stateless qui expose ces helpers a l'UI.

La logique runtime, la memoire persistante, les schemas, les tests et le pipeline narratif historique ont ete retires.
