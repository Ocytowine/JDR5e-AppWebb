# Matrice de preuves I-06M — scène narrative jouable de référence

Date : 2026-07-07  
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06M consolide la surface narration autour d'une scène concrète et testable, afin d'éviter les réponses génériques du MJ prototype et de disposer d'un support stable pour les prochains tests IA.

Le lot ne crée pas encore un moteur de scène complet. Il fournit une scène de référence déterministe, affichable et vérifiable, sans branchement au module tactique réel.

## Périmètre livré

- scène de référence `reference-inn-rain-001`, contrat `reference-playable-scene/1`;
- contexte fictionnel minimal : auberge, pluie, garde blessé, serveuse nerveuse, porte du fond;
- blocs `GM_NARRATION` concrets pour les observations/actions narratives;
- bloc `NPC_SPEECH` attribué au garde blessé pour une intention de parole bornée;
- maintien des réponses méta, questions de possibilité et clarifications hors fiction;
- conservation du dernier bloc système historique pour compatibilité avec la surface prototype;
- références de reconstruction enrichies par `reference-scene:reference-inn-rain-001`;
- absence de dépendance à `GameBoard.tsx`, `localStorage`, `/api/narration` ou au module tactique réel.

## Contrats concernés

| Contrat | Effet I-06M |
|---|---|
| `narrative-turn-controller/1` | Le tour libre produit désormais un paquet visible rattaché à la scène de référence. |
| `intent-clarification/1` | L'intention `je demande au garde...` est reconnue comme parole, pas comme ambiguïté. |
| `narrative-resolution/1` | Les commits bornés peuvent alimenter une réponse visible concrète sans autorité IA métier. |
| `scene-social-ui/1` | Les blocs typés `GM_NARRATION` et `NPC_SPEECH` sont utilisés pour rendre une scène lisible. |

## Preuves exécutables

| Preuve | Attendu |
|---|---|
| `npm run narration-module:test:narrative-turn-controller` | Valide scène, non-fiction méta/possibilité, parole PNJ et compatibilité no-commit. |
| `npm run narration-module:build` | Valide les types du module narration. |

## Cas couverts

| Cas | Résultat attendu |
|---|---|
| `je regarde autour de moi` | Narration concrète : auberge, pluie, garde blessé, porte du fond. |
| `quelle temps fait il ?` ou demande d'information méta | Pas de fiction ajoutée, pas de commit métier. |
| `est-ce que je peux voler le garde ?` | Réponse de possibilité hors fiction, sans action déclenchée. |
| `je demande au garde ce qu'il cherche` | Commit parole borné puis réponse attribuée au garde blessé. |

## Limites assumées

- la scène n'est pas encore un agrégat persistant propriétaire;
- l'état interne de la scène ne progresse pas encore dynamiquement;
- l'IA OpenAI ne reçoit pas encore un paquet de rôle riche dérivé de cette scène;
- les PNJ ne possèdent pas encore de mémoire sociale ou d'objectifs durables;
- aucun combat réel, plateau tactique, repos jouable ou génération de carte n'est introduit par ce lot.

## Suite logique

Ouvrir I-06N : construire le paquet de contexte IA de scène et le contrat de rôle `scene_writer` pour que l'IA produise une belle narration ancrée dans la scène de référence, sans devenir autorité métier.
