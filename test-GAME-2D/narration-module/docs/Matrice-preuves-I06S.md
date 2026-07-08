# Matrice de preuves I-06S — généralisation légère de scène

Date : 2026-07-08
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06S sort progressivement du cas unique `reference-inn-rain-001` en introduisant un contrat minimal `playable-scene-state/1`. Le lot reste volontairement léger : il ne charge pas le wiki complet, ne crée pas de moteur MJ générique et n'autorise aucune création durable automatique.

## Périmètre livré

- contrat `PlayableSceneStateV1`, version `playable-scene-state/1`;
- éléments visibles, PNJ présents, points d'intérêt, tension courante, faits connus joueur, politique de mémoire courte et politique `scene_writer`;
- fixture migrée `reference-inn-rain-001`;
- deuxième fixture `watchtower-dawn-001`;
- helpers déterministes de localisation, observation, possibilité sociale et ciblage PNJ;
- script `narration-module:test:playable-scene`;
- maintien du scénario vertical I-06Q/I-06R sur la scène de référence.

## Preuves exécutables

| Preuve | Résultat attendu |
|---|---|
| `npm run narration-module:test:playable-scene` | Valide les deux fixtures, la projection publique, le ciblage PNJ et le rejet des créations IA en I-06S. |
| `npm run narration-module:test:vertical-quality` | Confirme que la scène de référence conserve les corrections I-06R. |
| `npm run narration-module:build` | Valide types et exports du module narration. |
| `npm run narration-module:test:narrative-turn-controller` | Confirme que le contrôleur existant reste stable. |
| `npm run narration-module:test:ai-narrative-enhancement` | Confirme que le paquet IA de scène reste compatible. |

## Limites assumées

- La surface applicative utilise encore la scène de référence comme scène active.
- La deuxième scène est une fixture de preuve, pas encore sélectionnable par l'UI.
- Le wiki complet reste fermé jusqu'à I-06T.
- Les créations éphémères restent fermées jusqu'à I-06U.
- Les intrigues dynamiques, le tactique réel et la mémoire sociale générique restent hors périmètre.

## Décision

I-06S est clos dans son périmètre. La prochaine étape naturelle est I-06T : intégration wiki minimale pour transformer un lieu existant en scène jouable, sans révélation de secrets et sans génération dynamique.
