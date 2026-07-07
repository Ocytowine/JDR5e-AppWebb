# Matrice de preuves I-06C — surface narration applicative

Date : 2026-07-07.

Contrat : [`Contrat-surface-narration-app.md`](Contrat-surface-narration-app.md), version `narrative-app-surface/1`.

Statut : `LIVRE` dans le périmètre I-06C.

## Périmètre vérifié

| Exigence | Preuve | Résultat |
|---|---|---|
| `main.tsx` ne monte plus `GameBoard` directement | test statique sur `src/main.tsx` | OK |
| shell applicatif séparant narration et tactique | `src/App.tsx` | OK |
| surface narration dédiée | `src/narration-ui/NarrativeAppSurface.tsx` | OK |
| `GameBoard.tsx` reste uniquement côté tactique | `App.tsx` monte `GameBoard` seulement dans la surface `Tactique` | OK |
| surface narration sans import de `GameBoard` | test statique | OK |
| surface narration sans réseau ni stockage local | test statique contre `fetch`, routes IA historiques, `localStorage`, `sessionStorage` | OK |
| prototype non autoritaire | les entrées sont affichées comme `RAW_INPUT` + notification système sans commit ni temps | OK |
| composant UI I-06B réutilisé | `NarrativeAppSurface` rend `NarrativeConversationPanel` | OK |

## Fichiers livrés

- `src/App.tsx`;
- `src/main.tsx`;
- `src/narration-ui/NarrativeAppSurface.tsx`;
- `narration-module/tests/scene/verify-narrative-app-surface.ts`;
- script npm `narration-module:test:narrative-app-surface`.

## Commandes exécutées

```powershell
npm run narration-module:build
npm run narration-module:test:narrative-app-surface
```

Les deux commandes passent le 2026-07-07.

## Limites assumées

I-06C ne fournit pas encore l'orchestrateur narratif réel. La surface affiche une projection de bienvenue et reflète les saisies comme entrées brutes de prototype.

Le handoff tactique, l'intégration de campagne, la persistance d'`InteractionLog`, les appels IA et le traitement des clarifications restent hors périmètre.

## Décision de fermeture

I-06C est fermé dans son périmètre : séparation applicative narration/tactique, surface narration dédiée, prototype UI non autoritaire et tests de frontière.

La prochaine étape logique est I-06D : auditer l'orchestrateur applicatif narratif qui transformera une saisie libre en opération durable, puis en projections `DisplayPacketV1`, sans passer par les routes tactiques historiques.
