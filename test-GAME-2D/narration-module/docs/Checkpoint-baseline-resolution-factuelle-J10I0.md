# Checkpoint — baseline de résolution factuelle J10-I0

Date : 2026-08-27

Statut : `J10-I0 FERMÉ — DÉFAUT REPRODUIT, CONTRATS PASSIFS FIGÉS`

## Objet

J10-I0 devait isoler le refus factuel du garde sans corriger le comportement
produit, ouvrir une création ou modifier le prompt du performer. La gate utilise
la vraie scène lore compilée des Archives de Lysenthe, un cadre V8 exact écrit
par le test et le performer local existant.

## Résultat de la baseline

Le scénario « je lui demande qui dirige Lysenthe » confirme successivement :

1. V8 comprend `ASK_QUESTION` et résout le garde ambiant exact ;
2. G5 route `scene.visible-dialogue` vers le domaine social ;
3. la parole joueur est committée sans temps de jeu ;
4. le performer est effectivement appelé ;
5. le garde visible porte des `knowledgeRefs` issues des fragments locaux ;
6. aucune de ces références n'entre dans `allowedSourceRefs` ;
7. `publicFactRefs` ne contient que la référence générique de la scène ;
8. le registre autorisé propre à ce garde ambiant ne contient aucun fait connu ;
9. le performer ne reçoit donc ni « Tharque régent » ni « Château Tharqual » et
   produit l'esquive factuelle existante.

Le défaut est ainsi attribué à la construction de l'enveloppe de connaissance,
après compréhension et routage, avant incarnation. Aucun second interpréteur
lexical n'est nécessaire pour le reproduire.

## Inventaire exécutable

La gate fige le chemin suivant :

| Étape | Fichier | État J10-I0 |
|---|---|---|
| production depuis les fragments visibles | `lorePlayableScene.ts` | `knowledgeRefs` produites |
| portage par la présence ambiante | `ambientScenePresence.ts` | références conservées |
| acteur visible du performer | `npcPerforming.ts` | références encore observables |
| sources de parole autorisées | `npcPerforming.ts` | références locales non fusionnées |
| faits publics | `npcPerforming.ts` | référence de scène seule |
| connaissance privée de l'acteur | `npcKnowledgeContext.ts` | acquisitions explicites seulement |
| schéma et prompt performer | `narrativeOpenAiEnhancementRoute.js` | assertions bornées aux sources autorisées |

Les assertions lisent également les producteurs et consommateurs afin qu'un
changement silencieux du raccord fasse échouer la baseline.

## Contrats passifs

`npcInformationResolution.ts` introduit sans consommateur produit :

- `information-need/1`, besoin factuel ouvert portant sujet, dimension, portée
  temporelle, forme de réponse et composante V8 source ;
- `npc-information-resolution/1`, reçu séparant candidats factuels,
  connaissance de l'acteur, décision de divulgation et état de création ;
- des validateurs locaux qui refusent versions, références, sélections,
  autorités ou tentatives d'autorité du performer invalides.

`requestedDimension` reste du texte sémantique ouvert. Les formes de réponse ne
constituent pas un catalogue de sujets. `performerMayCreateFacts=false` est
imposé par validation.

## Corpus figé

Le corpus J10-I0 contient quatorze formulations :

- titre et titulaire actuel de Lysenthe ;
- paraphrase contextuelle de la même question ;
- nom personnel manquant ;
- siège du pouvoir ;
- procédure de signalement et consultation d'archives ;
- direction locale ;
- rumeur ;
- secret protégé ;
- titulaire passé ;
- quatre contre-exemples non factuels : état personnel, défi rhétorique,
  demande d'action et parole future conditionnelle.

Il couvre les chemins `EXISTING_PUBLIC`, `MISSING_CREATABLE`, `ROLE_EXPECTED`,
`TESTIMONY_QUALIFIED`, `PROTECTED`, `ACTOR_MAY_NOT_KNOW` et `NON_FACTUAL`.
Cette fixture n'est importable que par les tests et n'interprète aucun texte.

## Fichiers du sous-lot

- `narration-module/src/application/npcInformationResolution.ts` ;
- `narration-module/src/application/index.ts` ;
- `narration-module/tests/fixtures/npc-information-corpus-j10i0.ts` ;
- `narration-module/tests/scene/verify-npc-factual-knowledge-baseline-j10i0.ts` ;
- `package.json` ;
- documentation J10-I et suivi du projet.

## Vérifications

```text
npm run narration-module:test:j10i0-baseline
npm run build
git diff --check
```

La gate ciblée passe. Le build compile 1 593 modules et passe. Aucun appel
OpenAI réel n'a été exécuté.

## Autorités inchangées

- V8 reste l'unique source de compréhension en production ;
- le domaine social garde le commit de la parole ;
- les domaines de faits et de connaissances ne sont pas encore raccordés ;
- le performer ne gagne aucune autorité de création, vérité ou divulgation ;
- aucun nouveau fait, acteur, temps ou secret n'est persisté.

## Reprise J10-I1

Première commande :

```text
npm run narration-module:test:j10i0-baseline
```

Puis étendre de manière compatible chaque composante de parole V8 avec un
`informationNeed` nullable. Le schéma serveur, les types IA, les validateurs,
le mapping G3, le reçu de fidélité et les fixtures devront évoluer ensemble.
Une question non factuelle doit conserver `informationNeed=null`. J10-I1 ne
doit encore effectuer aucune recherche de lore et ne doit pas modifier le
performer.

