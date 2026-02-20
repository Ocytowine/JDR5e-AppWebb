# floors

Definitions for floor materials and their texture hints.

- `catalog.ts`: list of floor materials and texture entries.
- `types.ts`: shared types for materials/textures.
- `data/*.json`: data-driven floor material definitions.

Notes:
- Floor IDs are the values stored in the map layer (see `map/draft`).
- `textureId` is optional; rendering can fall back to `fallbackColor`.
- `solidColor` can force a base fill under textures (useful for transparent PNGs).
