# Narration Module

## Structure

- `docs/`: vision, specs, architecture, roadmap, operations
- `schemas/`: contrats JSON versionnes (input/output/plan/memory/runtime)
- `src/`: code source (domain/application/adapters/infrastructure)
- `tests/`: unit, integration, contract, fixtures
- `tools/`: scripts utilitaires

## Regles

- Toute evolution de contrat passe par `schemas/` + tests de contrat.
- Toute regle metier vit dans `src/domain`.
- Toute integration externe vit dans `src/adapters`.
- Toute modification majeure met a jour la DoD et la roadmap dans `docs/03-roadmap`.

## Commandes utiles

- `npm run narration-module:test:unit --prefix .\test-GAME-2D`
- `npm run narration-module:test:contracts --prefix .\test-GAME-2D`
- `npm run narration-module:test:integration --prefix .\test-GAME-2D`
- `npm run narration-module:demo:trace --prefix .\test-GAME-2D`
- `npm run setup:hooks --prefix .\test-GAME-2D`

## Capacites implementees

- plan avant commande + enforcement runtime
- event trigger obligatoire (`createEvent`)
- scenarios canon d'integration
- memoire persistante de campagne (JSON store)
- projection de verite `local > partie > wiki`
- event engine lifecycle (`actif/pertinent/dormant/archive`) + fragments (`ponctuel/persistant/evolutif`)
- validation JSON Schema stricte (Ajv) sur input/output au runtime
