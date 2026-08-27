# Checkpoint G3 — mapping sémantique fidèle

Date : 2026-08-25  
Statut : `FERMÉ`

## Résultat

`ai-intent-semantic/8` traverse désormais le pipeline d'interprétation et est
conservé intégralement dans `NarrativeIntentInterpretation.openSemanticFrame`.
Ce cadre devient la source sémantique primaire pour une sortie V8.

Le mapper G3 :

- utilise l'enveloppe locale d'appel pour corréler la réponse, valide le contrat
  et les références proposées dans le contexte public de scène ;
- conserve `rawInputEcho` comme diagnostic informatif seulement : une
  normalisation typographique par le modèle ne remplace jamais la saisie locale
  et ne fait plus rejeter un cadre autrement valide ;
- ne recherche aucun mot, motif, verbe ou domaine dans le texte joueur ;
- ne trie, ne fusionne et ne supprime aucune composante ;
- conserve exactement sens global, engagement, conditions, ordre, relations,
  négation, citation, alternatives, ambiguïtés et suggestions ouvertes ;
- suit `understandingStatus`, y compris lorsque `confidence=low`, sans produire
  une seconde interprétation locale ;
- transmet `NEEDS_CLARIFICATION` avec la question OpenAI, sans domaine, commit
  ni temps ;
- marque chaque composante comprise `UNDERSTOOD_UNSUPPORTED` tant que G5 n'a
  pas raccordé son propriétaire.

## Compatibilité et autorité

L'ancien `semanticIntent` reste présent parce que plusieurs consommateurs
historiques l'exigent encore. Pour V8, il est explicitement une projection de
compatibilité non autoritaire : aucune cible, action ou famille métier n'y est
sélectionnée. `semanticSource=OPEN_SEMANTIC_FRAME_V8` indique au validateur
d'autorité d'appliquer les invariants V8 plutôt que les cohérences canoniques
V7.

Avant G5, toute sortie V8 comprise reçoit `UNSUPPORTED_DOMAIN` sans
`requiredDomain`. Une tentative d'injecter localement un domaine ou un droit de
commit est rejetée. L'UI conserve donc provisoirement V7 ; V8 ne deviendra le
contrat produit par l'interface qu'avec le raccordement capable de respecter ses
composantes ouvertes.

## Preuve exécutable

```text
npm run narration-module:test:open-semantic-mapping-g3
```

La gate emploie deux textes bruts volontairement incompatibles avec les
catégories historiques pour une même sortie OpenAI simulée. Elle vérifie que le
cadre final reste identique, qu'une citation menaçante n'est pas exécutée, que
la confiance ne remplace pas le statut déclaré et qu'une référence absente du
contexte public est refusée. Elle couvre aussi une correction d'accent dans
`rawInputEcho` et prouve que la saisie locale reste autoritaire sans invalider
la sortie sémantique.

Régressions passées :

```text
npm run narration-module:test:open-semantic-frame-g2
npm run narration-module:test:intent-authority
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:narrative-resolution
npm run narration-module:test:openai-intent-lexical-debt
npm run narration-module:test:narrative-openai-route
npm run narration-module:build
```

Le test historique `narration-module:test:narrative-turn-controller` retrouve
son défaut antérieur à G3 : l'assertion de performance PNJ attend une sortie non
nulle à la ligne 213. Aucun fichier de cette performance n'est modifié par G3.

Aucun appel OpenAI réel n'a été exécuté et aucune dépense distante n'a été
engagée.
