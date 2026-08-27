# Checkpoint J10-H0 — baseline de fiabilité du tour narratif

Date : 2026-08-26

Statut : `FERMÉ`

## Résultat

Les trois recettes conversationnelles devenues rouges après le passage produit
à OpenAI seul injectent désormais explicitement un fournisseur sémantique V8
simulé à correspondance exacte. Cette fixture ne contient aucune détection
lexicale : chaque test fournit le cadre OpenAI attendu pour sa saisie.

Les preuves restaurées couvrent :

- treize tours, deux PNJ, changement d'interlocuteur, mémoire bornée et handoff ;
- profil conversationnel éphémère, rejet d'une promotion durable et isolation
  par acteur ;
- persistance de la réplique réellement affichée et reconstruction après rendu.

## Écarts produit figés

À la fermeture de H0, la gate certifiait la présence de quatre écarts connus,
afin que les lots suivants les corrigent un par un sans les confondre :

1. la soumission UI dépend encore d'un `pending` appliqué au rendu suivant et
   peut fabriquer deux identifiants pour deux événements synchrones ;
2. la requête du planner impose une seconde alors que la route produit en
   annonce trente ;
3. après rechargement, le référent du garde revient dans `recentFocus`, mais
   aucun `activeInterlocutor` explicite n'est reconstruit pour V8 ;
4. un dialogue V8 committé conserve encore une projection canonique
   `unclear_intent`, une expression issue du résumé IA et une cible d'effet de
   scène générique.

La perte de nature d'une salutation sous l'acte historique `OTHER` est également
visible dans la recette longue. Elle sera traitée avec la fidélité et les
fallbacks en H3/H4.

Évolution : H1 a fermé la course UI et H2 la perte de conversation active. La
gate H0 reste réutilisée et mesure désormais les deux écarts encore ouverts
sans réintroduire artificiellement les défauts historiques.

## Preuve exécutable

```powershell
npm run narration-module:test:j10h0-baseline
```

La gate exécute le contrôle de non-augmentation de la dette lexicale, la
projection de rendu, les conversations complètes, le profil conversationnel,
le routage G5, l'adaptateur G7 et les reproductions H0. Elle passe sans appel
OpenAI réel.

## Frontière

H0 ne modifie aucun comportement produit. Il ne corrige ni verrou UI, ni focus,
ni timeout, ni rendu. La prochaine étape autorisée est J10-H1, limitée à
l'idempotence de la soumission UI.
