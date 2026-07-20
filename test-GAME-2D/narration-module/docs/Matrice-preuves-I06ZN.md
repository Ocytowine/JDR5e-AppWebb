# Matrice de preuves I-06ZN — Commandes de domaine typées

Date : 2026-07-17

Statut : `TERMINE_DANS_PERIMETRE`

## Objectif

Séparer formellement l'intention comprise, la décision de routage et la requête transmise au propriétaire du domaine.

## Contrat livré

Le contrat applicatif `narrative-domain-command/1` définit une enveloppe locale contenant :

- corrélation vers `intentId`;
- domaine retenu par `runtimeDecision`;
- type de commande borné;
- famille et objectif sémantiques;
- références cibles validées;
- politique de commit;
- `commitAuthority=false`;
- provenance `LOCAL_COMMAND_BUILDER`.

Les variantes minimales sont :

- `SCENE_SPEECH_REQUEST`;
- `SCENE_INTERACTION_REQUEST`;
- `PERCEPTION_REQUEST`;
- `DOMAIN_HANDOFF_REQUEST`.

## Autorité

La commande est construite localement après validation de l'intention et de `runtimeDecision`. Le `mj_planner` la reçoit comme contexte mais ne la crée pas comme autorité et ne l'exécute pas.

La commande reste une requête : elle ne contient aucun succès, résultat, secret, création ou avance temporelle. Seul le propriétaire du domaine peut valider un effet et effectuer un commit.

## Preuves

| Exigence | Preuve |
|---|---|
| enveloppe distincte | `NarrativeDomainCommandV1` séparé des contrats IA et d'interprétation |
| construction locale | `source=LOCAL_COMMAND_BUILDER` |
| aucune autorité directe | `commitAuthority=false` imposé par type et validateur |
| corrélation sémantique | validation de `intentId`, `semanticKind` et `semanticGoal` |
| routage cohérent | validation du domaine contre `runtimeDecision.requiredDomain` |
| domaine fermé | commande `DOMAIN_HANDOFF_REQUEST`, politique `FORBIDDEN` |
| effet committable traçable | `sourceCommandId` obligatoire sur les effets parole et interaction |
| commit sémantique | l'agrégat cite le `semanticGoal` et l'identifiant de commande |
| altération refusée | une commande au `semanticGoal` modifié échoue à la validation |

## Vérifications exécutées

```text
npm run narration-module:test:ai-intent-interpretation  OK
npm run narration-module:test:narrative-resolution       OK
npm run narration-module:test:narrative-turn-controller  OK
npm run narration-module:test:playable-scene              OK
npm run narration-module:test:vertical-quality            OK
npm run narration-module:test:narrative-openai-route      OK
npm run narration-module:test:ai-pipeline                 OK
npm run narration-module:build                            OK
npm run build                                             OK
```

## Limites conservées

Le sous-type exact d'une interaction locale utilise encore la projection legacy `action` à l'intérieur du resolver existant. La sélection de la famille de commande, le domaine et la politique de commit n'en dépendent plus. Le retrait des dernières décisions lexicales et de cette projection appartient à I-06ZO.

Les commandes inventaire, tactique, repos et monde restent des demandes de handoff; leurs moteurs ne sont pas ouverts.

## Gate de sortie

I-06ZN est terminé dans son périmètre. La prochaine étape autorisée est I-06ZO : inventorier puis retirer progressivement la réinterprétation lexicale du flux actif.
