# Certification OpenAI de l'arbitre de destination V1

Date : 2026-08-03

## Périmètre

La commande suivante appelle réellement OpenAI et mesure uniquement le rôle
`destination_arbiter` sous `destination-plausibility-arbitration/1` :

```powershell
npm run narration-module:benchmark:destination-arbiter:openai-live
```

Elle ne crée aucun lieu et ne modifie aucune campagne. Cinq cas couvrent deux
créations locales plausibles, un doublon potentiel avec un lieu connu, une
destination distante et une contradiction de lore qui doit citer ses sources.

La recette navigateur suivante couvre ensuite le parcours complet :

```powershell
npm run narration-module:test:destination-creation:openai-live
```

Elle part des Archives, propose la Cour des Copistes, vérifie l'ordre
interpréteur → planificateur → arbitre → créateur → writer, recharge la campagne
sur le lieu committé, revient aux Archives sans rappeler le créateur, puis
recharge encore la campagne.

## Résultats

La matrice a passé deux fois à 5/5 avec `gpt-5.5/none`, sans retry. La passe
finale mesure :

| Mesure | Résultat |
|---|---:|
| Cas acceptés | 5/5 |
| p50 | 4 994 ms |
| p95 / maximum | 5 962 ms |
| Tokens d'entrée | 33 964 |
| Tokens de sortie | 1 724 |
| Entrée par appel | 6 773 à 6 828 tokens |

Le parcours navigateur complet a passé deux fois, en 80,9 puis 88,9 secondes.
La passe finale a observé les rôles suivants dans l'ordre :

`player_intent_interpreter`, `mj_planner`, `destination_arbiter`,
`scene_creator`, `scene_writer`, puis, au retour,
`player_intent_interpreter`, `mj_planner`, `scene_writer`,
`coherence_critic`.

Une troisième tentative intermédiaire n'a émis aucun appel OpenAI : le test
avait rempli le champ pendant une réinitialisation React et attendu un bouton
désactivé. La recette attend désormais explicitement la stabilité du champ et
du bouton avant chaque envoi.

## Correction issue de la mesure

Le rôle déclarait historiquement 2 000 tokens d'entrée, alors que la métrique
OpenAI inclut également les instructions serveur et le schéma JSON strict. La
mesure réelle était proche de 6 800 tokens. Le budget total du seul
`destination_arbiter` est désormais fixé à 8 000 tokens et protégé par la route
serveur ; la passe finale confirme que chaque appel reste sous ce plafond.

## Conclusion

Le rôle est certifié sur cette matrice et sur le parcours persistant Archives →
Cour des Copistes → Archives. Il n'a aucune autorité de commit, ne peut choisir
qu'un parent autorisé, ne peut citer une source extérieure au brief et ne laisse
atteindre `scene_creator` qu'après `CREATE_LOCAL`.
