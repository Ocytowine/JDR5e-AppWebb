# Matrice de preuves I-06P — mémoire courte de scène et continuité PNJ

Date : 2026-07-07  
Statut : `LIVRE_DANS_PERIMETRE`

## Objectif du lot

I-06P ajoute une mémoire courte bornée à l'état de scène `reference-inn-rain-001`, afin que les PNJ tiennent compte des derniers échanges sans ouvrir encore un moteur PNJ complet ni une mémoire long terme.

## Périmètre livré

- champ `shortTermNpcMemory` dans `reference-scene-state/1`;
- mémoire bornée aux 5 derniers éléments;
- enregistrement déterministe d'un résumé de continuité lors d'une parole committée au garde;
- réponse du garde qui évite de répéter mécaniquement la première explication;
- transmission de la mémoire courte au paquet IA `scene_writer`;
- libération du writer lease après commit, nécessaire pour permettre plusieurs paroles committées dans la même scène;
- tests de non-régression sur observation sans commit, première parole, deuxième parole et paquet IA.

## Contrats concernés

| Contrat | Effet I-06P |
|---|---|
| `reference-scene-state/1` | Ajoute une mémoire courte PNJ bornée à l'état de scène. |
| `narrative-resolution/1` | Plusieurs commits parole successifs peuvent s'enchaîner sans writer lease bloquant. |
| `narrative-ai-resolution/1` | Le paquet `scene_writer` reçoit les derniers éléments de continuité PNJ. |
| `scene-social-ui/1` | Le rendu visible utilise la continuité sans modifier l'autorité métier. |

## Preuves exécutables

| Preuve | Attendu |
|---|---|
| `npm run narration-module:test:narrative-turn-controller` | Vérifie mémoire courte créée, deuxième parole non répétitive et absence de mutation sur observation. |
| `npm run narration-module:test:ai-narrative-enhancement` | Vérifie que le pack IA contient la mémoire courte PNJ. |
| `npm run narration-module:build` | Valide types et contrats applicatifs. |

## Cas couverts

| Cas | Résultat attendu |
|---|---|
| Première parole au garde | `shortTermNpcMemory` contient un résumé visible de continuité. |
| Observation après parole | Utilise `scene.state` sans créer de nouveau commit. |
| Deuxième parole au garde | Le PNJ répond en tenant compte du fait qu'il a déjà orienté vers la porte du fond. |
| Appel `scene_writer` | Le contexte IA contient `Mémoire courte PNJ`. |

## Limites assumées

- la mémoire courte reste spécifique à la scène de référence;
- elle n'est pas encore une mémoire sociale générique multi-PNJ;
- elle ne remplace pas la future mémoire long terme I-04;
- elle ne crée pas d'objectifs PNJ autonomes;
- elle ne permet pas encore de résumer automatiquement un long fil.

## Suite logique

Ouvrir I-06Q : scénario vertical de test qualité Locale/OpenAI sur 10 à 15 entrées joueur, avec critères observables sur ancrage, non-répétition, méta hors fiction et absence de mutation indue.
