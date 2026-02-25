# Narration Module (workspace dédié)

Ce dossier regroupe les artefacts du module narration, séparés du reste du projet.

## Structure

- `docs/`
  - `Matrice-Narration-Globale-v1.md`
  - `Plan-Execution-V1-Narration.md`
  - `Transitions-v1-Quete-Trame-Compagnon-Marchandage.md`
  - `Atelier-Brainstorming-Narration.md`
  - `Atelier-Brainstorming-Lore.md`
  - `Cadre-IA-Lore-Coherence-Originalite.md`

- `runtime/`
  - `Transitions-v1-runtime.schema.json`
  - `Transitions-v1-runtime.example.json`
  - `NarrativeGameState.v1.json` (créé automatiquement par la démo persistée)

- `tools/`
  - `validate-transitions-runtime.ts`

- `src/`
  - `types.ts`
  - `TransitionEngine.ts`
  - `TransitionRepository.ts`
  - `NarrativeRuntime.ts`
  - `ContextPackBuilder.ts`

## Validation runtime (sans dépendance externe)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run validate
```

## Démo technique du module narration

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:narration
```

## Démo runtime (état réel de partie)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime
```

## Démo runtime persistée (load/save)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:persist
```

## Démo runtime service (applyTransitionAndSave)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:service
```

## Démo API métier (GameNarrationAPI)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:api
```

## Démo orchestrateur narratif

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:orchestrator
```

## Démo tick narration (décider + appliquer + sauvegarder)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:tick
```

## Démo tick narration safe (anti-rejouabilité)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:tick:safe
```

## Démo gates de cohérence (pré-publication)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:guards
```

## Démo blocage guards (strict vs non strict)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:guards:block
```

## Démo tick safe + blocage guard strict

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:tick:safe:guard:block
```

## Démo pipeline IA MJ (ContextPack -> génération -> guards -> application)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:ai:pipeline
```

Note:
- la démo ci-dessus utilise un générateur heuristique local (`HeuristicMjNarrationGenerator`) pour être exécutable sans clé.
- un générateur OpenAI réel est aussi disponible (`OpenAIMjNarrationGenerator`) via `OPENAI_API_KEY`.

## Démo mémoire narrative (court terme + long terme + atténuation)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:memory
```

## Démo couverture domaines (quête/trame/compagnon/marchandage)

Depuis `test-GAME-2D/narration-module`:

```powershell
npm run demo:runtime:coverage
```

Alternative manuelle (si besoin):

```powershell
npx tsc tools/validate-transitions-runtime.ts --target ES2020 --module commonjs --esModuleInterop --skipLibCheck --outDir tools/.tmp
node tools/.tmp/validate-transitions-runtime.js
```

Optionnel (fichiers custom):

```powershell
npm run validate -- <schemaPath> <dataPath>
```
