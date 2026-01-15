# action-game

Reference JSON files used by the AI to decide what the player can do during its turn.

Files:
- action-model.json: gabarit to copy when creating new actions.
- actions/index.json: list of available actions (relative paths).
- actions/*.json: examples ready for immediate use.

Notes:
- Keep ids and tags in lowercase with hyphens so the AI can match them easily.
- Conditions and effects stay declarative only; dice rolling or rules resolution happens in code or by the AI, not in these files.
- The front can load `actions/index.json` and hydrate the actions listed inside.
