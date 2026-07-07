# Matrice de preuves I-06N — contexte IA de scène ancré

Date : 2026-07-07  
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06N donne au rôle `scene_writer` un vrai paquet de contexte de scène au lieu d'un objet vide. Le but est de permettre une narration IA ancrée dans `reference-inn-rain-001`, sans lui donner d'autorité métier.

## Périmètre livré

- contrat interne `reference-scene-writer-context/1`;
- construction d'un `RoleContextPackV1` pour `scene_writer`;
- contexte concret : Auberge du Seuil, pluie, garde blessé, serveuse nerveuse, porte du fond;
- contraintes explicites : présentation seule, pas de temps, pas de mutation, pas de secret, pas de combat/repos résolu;
- fingerprint `sha256:*` stable utilisé comme `contextFingerprint` de l'appel IA;
- task structurée avec `allowedGrounding` limité à `resolution:*` et `reference-scene:*`;
- validation applicative des blocs IA : tout `groundedIn` doit appartenir aux références autorisées;
- fallback local UI remplacé par une narration déterministe ancrée dans la scène de référence.

## Contrats concernés

| Contrat | Effet I-06N |
|---|---|
| `narrative-ai-resolution/1` | Le `scene_writer` reçoit un paquet de rôle exploitable et borné. |
| `reference-playable-scene/1` | La scène I-06M devient la source concrète du contexte IA. |
| `scene-social-ui/1` | Les blocs IA restent de simples blocs visibles, sans autorité métier. |
| `memory-context/1` | Le paquet respecte la structure `RoleContextPackV1` et ses références mémoire. |

## Preuves exécutables

| Preuve | Attendu |
|---|---|
| `npm run narration-module:test:ai-narrative-enhancement` | Inspecte la requête `scene_writer`, le pack, les références autorisées et la reconstruction. |
| `npm run narration-module:build` | Valide les types du contexte IA et du fallback local. |

## Cas couverts

| Cas | Résultat attendu |
|---|---|
| Parole committée au garde | Appel `scene_writer` avec pack de scène et narration ancrée. |
| Sortie IA avec promesse ajoutée | Rejet/fallback déterministe conservé. |
| Sortie IA qui annonce un succès | Bloc refusé, pas d'autorité métier accordée. |
| Question méta ou informative sans matière fictionnelle | `scene_writer` non appelé. |
| Mode local UI | Narration fallback mentionnant la scène au lieu d'une formule abstraite. |

## Limites assumées

- le pack reste basé sur la scène de référence, pas sur un agrégat de scène persistant;
- aucun état de scène dynamique n'est encore modifié;
- les PNJ ne possèdent pas encore de mémoire courte;
- l'IA ne peut pas créer ni promouvoir d'information durable;
- aucun branchement tactique réel n'est introduit.

## Suite logique

- I-06O : état de scène minimal persistant, pour faire évoluer les éléments visibles sans dépendre du texte libre.
- I-06P : mémoire courte de scène et continuité PNJ, pour éviter les oublis immédiats dans les dialogues.
