# Contract Tests

## Commande

```powershell
npm run narration-module:test:contracts --prefix .\test-GAME-2D
```

## Ce que couvre la suite v1

- validation minimale du contrat d'entree
- validation minimale du contrat de sortie
- regle DoD `clarification => runtime_actions vide`
- regle DoD `pas de leak truth_view` dans la sortie joueur
- validation JSON Schema stricte (Ajv)

## Limites actuelles

- validation semantique avancee encore partielle (le runtime metier continue d'etre enrichi)

## CI

Workflow GitHub Actions:

- `.github/workflows/narration-module-ci.yml`

Le workflow execute automatiquement:

- `npm run narration-module:test:contracts`
- `npm run narration-module:test:unit`
- `npm run narration-module:test:integration`
