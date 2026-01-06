# map-patterns

Pattern JSON for hand-made sub layouts (houses, furniture sets, alleys...).

Files:
- index.json: list of pattern files.
- *.json: individual patterns.
- map-pattern.schema.json: optional JSON schema.

Notes:
- typeId must match obstacle-types ids.
- x,y are relative to the pattern top-left.
- anchor picks which pattern cell is aligned on the map.
- rotation in degrees (0/90/180/270).
- patterns can be mirrored or rotated at placement time.
- Keep ids lowercase with hyphens.
