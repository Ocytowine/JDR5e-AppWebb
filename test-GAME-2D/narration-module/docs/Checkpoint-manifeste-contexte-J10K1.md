# Checkpoint J10-K1 — manifeste et matrice d'autorité

Statut : `FERMÉ`

Date : 2026-09-01

## Livré

- contrat passif `narrative-context-manifest/1` ;
- constructeur déterministe sans contenu métier ;
- classifications `PUBLIC`, `ROLE_PRIVATE`, `FORBIDDEN_FOR_AI` ;
- cohérences statique, campagne et scène ;
- transports inline, référence seule et interdit ;
- dépendances de projections validées sans cycle ;
- politiques requises, facultatives et interdites par profil ;
- matrice de sept profils pour les rôles actifs de la verticale actuelle ;
- interdiction commune du carnet privé et des secrets MJ ;
- saisie brute réservée à l'interpréteur ;
- gate nominale et négative raccordée à K0 et au build.

## Frontière conservée

Le manifeste n'est appelé par aucun runtime. Il ne contient aucun payload et ne
modifie ni `roleContextPack`, ni `embodiedContext`, ni les appels OpenAI. Il
rend seulement les décisions de K2 et K3 vérifiables avant leur application.

## Vérification

```powershell
npm run narration-module:test:j10k1-context-manifest
```

Résultat : contrat K1, baseline K0, protections G4, dette lexicale et TypeScript
verts sans appel OpenAI live.

## Reprise

J10-K2 peut maintenant créer le manifeste réel de l'interpréteur, sélectionner
une projection incarnée unique et supprimer le doublon résiduel avec une mesure
avant/après. La réduction doit préserver les références et sélecteurs requis
par le profil `player-intent-v8`.
