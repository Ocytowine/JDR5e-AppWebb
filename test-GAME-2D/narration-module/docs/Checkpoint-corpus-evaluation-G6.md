# Checkpoint G6 — corpus d'évaluation sémantique

Date : 2026-08-25  
Statut : `FERMÉ`  
Contrat du corpus : `open-semantic-evaluation-corpus/1`

## Résultat

G6 installe un corpus permanent de 23 entrées naturelles couvrant les 20 axes
prévus : dialogues direct et implicite, perception, voyage, inventaire, repos,
magie, tactique, compagnon autonome, question au MJ, pronoms, ellipses,
négations, citations, conditions, hypothèses, compositions, changement d'avis,
fautes et formulation inédite.

Le corpus évalue des propriétés sémantiques partielles : statut de
compréhension, engagement, ordre, relations, conditions, ambiguïtés, références
publiques, dispositions du plan et frontières de commit. Il ne compare ni la
prose exacte ni le JSON complet. Deux familles de paraphrases vérifient une même
projection structurée sans être ajoutées aux instructions envoyées au modèle.

## Trois surfaces de preuve

1. Les 23 sorties V8 structurées traversent validation, mapping et plan G5 avec
   un contexte de capacités explicite.
2. Cinq cas sensibles traversent le vrai `NarrativeTurnControllerV1` avec un
   fournisseur OpenAI simulé et restent sans mutation ni temps.
3. Cinq cas traversent ce même contrôleur dans Chrome réel. L'absence volontaire
   du runtime de voyage y produit `HANDOFF_ONLY`, ce qui confirme que la
   disponibilité appartient au runtime et non à l'interpréteur.

Le fournisseur simulé est une fixture de test à correspondance exacte. Il ne
fait aucune détection lexicale et n'est importé par aucun code produit. La saisie
sert uniquement à sélectionner la sortie OpenAI pré-écrite du cas. Aucune route
live et aucune dépense distante n'ont été utilisées.

## Gate

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:open-semantic-corpus-g6
```

Résultat : 24 cas structurés, 5 passages contrôleur et 5 passages Chromium
verts. Les gates G2 à G5 et `npm run build` restent également vertes.

## Frontière et reprise

G6 ne bascule pas l'interface produit en V8 et n'accorde aucune autorité au
contrôleur legacy. G7 doit maintenant installer les adaptateurs propriétaires
effectifs dans le chemin du contrôleur, basculer la configuration UI de V7 vers
V8, puis lancer la gate locale complète : schémas, autorités, corpus,
régressions narration, build et parcours Chromium réel. La recette OpenAI live
reste réservée à G8 et exige un nouvel accord explicite sur la dépense.
