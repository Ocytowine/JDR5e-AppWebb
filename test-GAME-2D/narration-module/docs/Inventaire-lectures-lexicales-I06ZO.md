# Inventaire des lectures lexicales — I-06ZO

Date : 2026-07-17  
Statut : inventaire normatif du flux actif

## Règle de revue

Une lecture de `rawInput`, `coreMeaning`, une regex ou une liste de synonymes ne peut jamais décider d'un domaine, d'un commit, d'une commande, d'une cible canonique ou d'une mutation durable. Ces décisions consomment exclusivement `semanticIntent`, `runtimeDecision`, `referentResolution` et `domainCommand` validés.

Toute nouvelle lecture textuelle doit être classée dans une des exceptions ci-dessous, ne produire que la sortie annoncée et porter une condition de retrait. Un correctif métier qui ajoute un verbe ou un synonyme au resolver est refusé en revue.

## Inventaire et classement

| Zone | Classe | Usage autorisé | Autorité métier | Condition de retrait |
|---|---|---|---|---|
| `intentClarification.ts` | compatibilité legacy | interpréteur déterministe historique quand aucun interpréteur IA n'est configuré | aucune dans le chemin IA produit; le résultat passe encore les validateurs locaux | supprimer quand le mode local utilisera un fournisseur sémantique contractuel |
| `LocalPlayerIntentInterpreterProviderV1` dans `aiIntentInterpretation.ts` | fournisseur local de test | fabriquer une sortie `ai-intent-interpretation/1` reproductible sans réseau | limitée à ce faux fournisseur; le mapper aval ne relit plus le texte pour corriger le sens | remplacer avec le fournisseur local sémantique ou des fixtures contractuelles lors d'I-06ZR |
| `committedActionReferentClarification` et `buildReferentResolution` | compatibilité/référent | vérifier ambiguïté et compatibilité d'une référence proposée; visibilité déléguée au registre depuis I-06ZP | peut clarifier, jamais router ni committer | retirer les derniers champs legacy lors d'I-06ZR |
| `referenceScene.ts` (`observationNarration`, sujets météo/lieu/possibilité, variantes) | rendu prototype | choisir une prose de présentation après la décision métier | aucune; le résultat et les effets sont déjà fixés | remplacer par des données de scène et le writer générique après I-06ZP/I-06ZR |
| `normalizeCharacterExpression` | rendu | transformer le texte joueur en bloc d'expression | aucune | retirer quand l'expression structurée sera produite en amont |
| validateurs/enrichisseurs IA (`forbidden outcome`, balises et secrets) | sécurité | défense en profondeur sur une sortie textuelle | rejet uniquement; aucun sens positif n'est inféré | conserver jusqu'à un mécanisme de sécurité équivalent, avec tests dédiés |
| adaptateurs garde/serveuse du rendu et de l'état de référence | rendu fixture | présenter et muter la démonstration de l'auberge après résolution générique | aucune autorité de canonicalisation dans l'interpréteur ou le resolver | remplacer avec le rendu multi-scènes ou retirer lors d'I-06ZR |

## Lectures retirées du flux de décision

- le resolver ne classe plus `rawInput` en tactique, repos, inventaire ou création;
- le commit local ne dépend plus de `action=open|force` ni d'un verbe dans `coreMeaning`;
- le positionnement PNJ dépend de `semanticIntent.kind=nonverbal_signal` et de la cible structurée;
- la mutation `playerLookedAround` dépend de `semanticIntent.kind=observe_environment`;
- la cible de parole et la mémoire courte ne sont plus reconstruites depuis le texte;
- le mapper IA ne transforme plus une phrase reconnue comme « approche » en intention non verbale et ne rejette plus une possibilité selon sa ponctuation ou ses synonymes.

## Limite assumée

I-06ZO ne rend pas le fournisseur local intelligent sans lexique et ne généralise pas les références de l'auberge. Il établit une frontière : le texte peut encore produire ou embellir une proposition, mais une fois la sortie sémantique reçue, il ne peut plus en changer le routage ni l'exécution. La généralisation des références est la gate I-06ZP.
