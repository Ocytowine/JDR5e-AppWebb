# Checkpoint G5 — routage vers les propriétaires

Date : 2026-08-25  
Statut : `FERMÉ`

## Résultat

G5 livre `open-semantic-execution-plan/1` et son exécuteur ordonné :

- le sens V8 reste intact et primaire ;
- une capacité n'est routable que par correspondance exacte entre
  `suggestedCapabilityId`, `suggestedDomain` et le manifeste public ;
- aucun texte brut n'entre dans un port propriétaire ;
- chaque propriétaire effectue son `preflight` juste avant son étape ;
- un arrêt conserve les reçus précédents et interdit toute prévalidation ou
  mutation ultérieure ;
- le rejeu saute les reçus déjà acquis ;
- un plan altéré est refusé avant le premier propriétaire.

Les formulations ou actions que le runtime ne connaît pas restent comprises
mais non exécutables. Il n'existe aucun dictionnaire, rapprochement lexical ou
domaine par défaut.

## Périmètre de migration

Le chemin V8 du contrôleur construit le plan G5. La configuration UI reste en
V7 jusqu'à G6/G7 : ces lots injecteront les adaptateurs propriétaires installés,
le fournisseur OpenAI simulé et le corpus contextuel avant toute bascule du
joueur réel. Cette séparation évite de substituer les anciens parseurs métier
au nouveau port.

## Preuves

```text
npm run narration-module:test:open-semantic-owner-routing-g5
npm run narration-module:test:open-semantic-mapping-g3
npm run narration-module:test:open-semantic-frame-g2
npm run narration-module:test:interpreter-embodied-context-g4
```

Aucun appel OpenAI réel et aucune dépense distante ne font partie de G5.
