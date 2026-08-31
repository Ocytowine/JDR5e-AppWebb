# Checkpoint réponse partielle d'information J10-J2

Statut : `FERMÉ`

Date : 2026-08-31

## Résultat

Une résolution factuelle peut désormais transporter simultanément une ou
plusieurs valeurs autorisées et la présentation publique des propriétés qui
restent absentes. Le performer reçoit un `answerCoverage` explicite :

- `COMPLETE` lorsque tous les éléments recherchés sont disponibles ;
- `PARTIAL` lorsqu'au moins un fait est autorisé et qu'une propriété de
  complétude reste absente ;
- `NONE` lorsqu'aucun fait ne peut être formulé.

Les propriétés manquantes sont identifiées par leur référence canonique et le
libellé public déclaré dans le catalogue de lore. Leur valeur absente n'est ni
inventée ni déduite. Le fallback déterministe donne d'abord les faits établis,
puis limite son incertitude aux seuls libellés manquants. Une réponse partielle
ne peut donc plus tomber dans le fallback global « Je ne sais pas ».

## Frontières conservées

- aucune lecture de `subjectMention`, `requestedDimension` ou de la saisie
  joueur n'a été ajoutée au lookup, à la divulgation ou au performer ;
- aucun mot lié à un type de régime, de titre ou d'institution ne pilote le
  comportement ;
- seuls les faits passés par `authorizedFacts` sont formulables ;
- les références privées restent exclues ;
- `performerMayCreateFacts=false`, `noCommit=true` : J10-J2 n'écrit aucun fait ;
- la création éventuelle d'une valeur appartient toujours à J10-J3.

## Preuve

La recette emploie des descriptions opaques (`Q-17`, `Q-18`) et des sélecteurs
canoniques. Depuis les Archives, le garde reçoit le titre public établi pour
Astryade et l'absence déclarée de l'identité personnelle. Une panne simulée du
performer produit une réponse contenant le titre connu et qualifiant uniquement
l'identité absente. La validation confirme que toutes les références utilisées
appartiennent à la projection autorisée.

```text
npm run narration-module:test:j10j2-partial-answer
```

Cette gate régénère le catalogue, vérifie le graphe J10-J1, la chaîne
lookup/connaissance/divulgation/performance, le fallback en panne IA, la garde
anti-dette lexicale et le build TypeScript du module. Elle ne réalise aucun
appel OpenAI live.

