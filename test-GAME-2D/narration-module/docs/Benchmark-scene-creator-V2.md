# Benchmark live du `scene_creator` V2

## Protocole

La commande `npm run narration-module:benchmark:scene-creator-v2:openai-live` mesure uniquement `scene_creator` sous le contrat `lore-guided-place-candidate/2`. Elle ne crée aucun lieu, ne prépare aucun commit et ne modifie aucune campagne.

Trois demandes utilisent le même paquet d'influences des Archives de Lysenthe :

1. un perron extérieur d'attente ;
2. une venelle de transport administratif ;
3. un petit parvis vers l'activité publique.

La gate vérifie :

- sortie fournisseur acceptée ;
- absence de topologie IA en V2 ;
- profondeur et parent autorisés ;
- références structurées ;
- matière perceptible, normes et engagements présents ;
- rôles de population courts, ciblables et sans phrase d'action.

Le rapport expose la latence fournisseur, les tokens, les retries, les contrôles structurels et un extrait créatif de chaque candidat.

## Comparaison du 2026-07-23

| Configuration | Accepté | Gate complète | p50 | p95/max | Tokens entrée/sortie | Retry |
|---|---:|---:|---:|---:|---:|---:|
| `gpt-5.5/low` | 3/3 | 3/3 après correction d'un faux rejet du banc | 20,855 s | 21,154 s | 14 732 / 2 635 | 0 |
| `gpt-5.6-luna/none` | 3/3 | 3/3 | 5,514 s | 5,723 s | 14 837 / 2 138 | 0 |

Deux répétitions Luna supplémentaires donnent également 3/3 puis 3/3 :

| Passage Luna | Qualité | p50 | p95/max | Tokens entrée/sortie |
|---|---:|---:|---:|---:|
| 1 | 3/3 | 5,514 s | 5,723 s | 14 837 / 2 138 |
| 2 | 3/3 | 5,626 s | 14,198 s | 14 837 / 2 074 |
| 3 | 3/3 | 5,281 s | 7,023 s | 14 837 / 1 993 |

Agrégat Luna : 9/9 sans retry, p50 5,514 s, maximum 14,198 s, 44 511 tokens d'entrée et 6 205 tokens de sortie. Même le pic isolé de 14,198 s reste inférieur à la meilleure latence `gpt-5.5` observée sur ce banc (15,915 s).

Le premier rapport `gpt-5.5` affichait artificiellement 1/3 parce que la regex locale du banc était plus stricte que le contrat V2 de production pour `proposedPlaceRef` et `arrivalSceneId`. Les trois candidats avaient pourtant été validés par le pipeline de production. Le banc utilise désormais la même frontière structurelle et expose les références pour audit.

## Analyse

`gpt-5.6-luna/none` réduit la p50 d'environ 73,6 % et la p95 d'environ 72,9 %. Il utilise environ 18,9 % de tokens de sortie en moins, pour un volume d'entrée quasi identique. Les trois créations restent cohérentes avec les Archives, conservent les contraintes de parent et de profondeur, n'émettent aucune topologie et produisent des rôles courts.

`gpt-5.5/low` fournit des descriptions un peu plus développées, mais cet avantage n'est pas nécessaire au contrat de création : la scène conserve suffisamment de traits perceptibles avec Luna, tandis que le gain de 15 secondes environ est directement visible pour le joueur.

## Décision recommandée

Adopter `gpt-5.6-luna` avec `NARRATION_OPENAI_SCENE_CREATOR_REASONING_EFFORT=none` pour `scene_creator`. La gate de trois triplets consécutifs est satisfaite à 9/9 sans retry. Conserver `gpt-5.5/low` comme baseline qualitative et solution de repli.

Le serveur utilisé après le benchmark a été restauré sur la configuration `.env` existante ; aucun changement de modèle n'a été appliqué silencieusement.
