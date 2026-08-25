# Checkpoint G2 — cadre sémantique ouvert

Date : 2026-08-25  
Statut : `FERMÉ`

## Résultat

Le contrat `ai-intent-semantic/8` est disponible après V7 sans retirer la
compatibilité de lecture des versions précédentes. Il représente la compréhension
d'OpenAI sans imposer une liste d'actions ou de domaines métier :

- `UNDERSTOOD` ou `NEEDS_CLARIFICATION` est déclaré explicitement ;
- `overallMeaning`, l'engagement et les conditions globales conservent le sens
  du tour entier ;
- `components` transporte une suite ordonnée sans plafond applicatif ;
- chaque composante conserve son sens naturel, son engagement, ses conditions,
  ses mentions de cibles et ses relations avec les autres composantes ;
- négation, citation, alternative, simultanéité, dépendance et correction sont
  représentables sans détection lexicale ;
- `suggestedAction` et `suggestedDomain` sont des chaînes ouvertes et restent
  des suggestions sans autorité d'exécution.
- `suggestedCapabilityId` reste nullable et ne peut recopier qu'un identifiant
  publié par le runtime ; il borne le routage technique sans fermer le sens.

Le schéma JSON strict est fourni à Structured Outputs. Le prompt V8 se concentre
sur la fidélité sémantique et les limites d'autorité, sans recopier le détail du
schéma ni les catégories procédurales V7.

## Frontière volontaire

V8 n'est pas encore le contrat actif de l'interface. G2 installe et valide le
langage d'échange ; G3 doit encore le mapper vers `NarrativeIntentInterpretation`
sans relire le texte joueur, puis gérer `UNDERSTOOD_UNSUPPORTED`. Ce découpage
évite d'activer un contrat que le runtime ne saurait pas encore transmettre
fidèlement aux propriétaires de domaine.

La normalisation serveur historique ne traite que V3 à V7. Une enveloppe V8
validée est donc rendue inchangée : elle n'est ni réduite à une intention
principale ni reconstruite depuis une composition fermée.

## Preuves exécutables

Commande dédiée :

```text
npm run narration-module:test:open-semantic-frame-g2
```

Elle vérifie : action simple, condition, négation, alternative, clarification et
une séquence de six composantes comprenant citation, simultanéité et correction.
Elle contrôle aussi l'absence de `maxItems`, l'ouverture des suggestions d'action
et de domaine, et l'absence de recanonicalisation serveur.

Vérifications de non-régression passées :

```text
npm run narration-module:test:narrative-openai-route
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:openai-intent-lexical-debt
npm run narration-module:build
```

Aucun appel OpenAI réel n'a été exécuté et aucune dépense distante n'a été
engagée.
