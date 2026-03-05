# Auto-Control Local (Single Dev)

## Objectif

Rendre les regressions difficiles a introduire sans verification, meme en solo.

## Mecanisme

- Hook `pre-commit`: execute les tests de contrat narration.
- Hook `pre-push`: execute tests unitaires + contrat + integration narration.

Si un test echoue, commit/push est bloque.

## Installation

Depuis la racine du repo:

```powershell
npm run setup:hooks --prefix .\test-GAME-2D
```

## Verification

```powershell
git config --get core.hooksPath
```

La valeur doit pointer vers `.githooks`.
