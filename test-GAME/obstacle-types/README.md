# obstacle-types

JSON "definitions" for map obstacles (walls, trees, props...).

These files are meant to be data-driven and flexible so maps can be generated randomly:
- `blocking` controls movement / vision / attacks.
- `durability` controls hit points (destructible or not).
- `variants` can expose multiple footprints (1x1, 1x2, 1x3...) for generators.
- `spawnRules` contains optional hints for random placement (weights, clustering...).

Files:
- `obstacle-model.json`: template to copy when creating new obstacles.
- `index.json`: list of available obstacle definitions (relative paths).
- `*.json`: ready-to-use examples.

Notes:
- Keep `id` in lowercase with hyphens.
- Keep `tags` generic and stable; UI and generators can rely on them.

