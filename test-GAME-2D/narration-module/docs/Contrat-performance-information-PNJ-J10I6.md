# Contrat de performance d'information PNJ J10-I6

Statut : `ACTIF`

Contrat : `npc-information-performer-projection/1`

## But

I6 transforme une décision de divulgation I5 en réplique incarnée sans rendre
le performer propriétaire des faits. La chaîne produit est désormais :

```text
besoin d'information V8
  → lookup campagne/lore
  → connaissance contextuelle du PNJ
  → décision de divulgation
  → projection performer expurgée
  → performance IA ou fallback déterministe
  → témoignage attribué après rendu accepté
```

La composition `createCampaignNpcInformationRuntimeV1` utilise obligatoirement
le lecteur campagne/lore canonique. Elle lit la révision courante, l'ancre de la
scène, les références publiques de l'acteur et les autorités épistémiques avant
de produire la projection.

## Frontière du performer

Le paquet contient uniquement :

- la décision de divulgation ;
- les `authorizedFacts` et leurs références publiques ;
- la couverture `COMPLETE`, `PARTIAL` ou `NONE` et, pour une réponse partielle,
  les références et libellés publics des propriétés manquantes ;
- les alternatives visibles explicitement autorisées ;
- une instruction adaptée à réponse directe, qualification, rétention,
  orientation ou ignorance.

Il ne contient aucun candidat retenu, valeur secrète, preuve privée ou pouvoir
de création. `performerMayCreateFacts` reste `false`, `noCommit` reste `true`.
Une réponse factuelle acceptée doit citer au moins une source d'un fait autorisé
et ne peut révéler aucune autre référence factuelle.

## Fallback

Le fallback local consomme exactement la même projection. Il peut donc répondre
depuis le lore ou un fait de campagne même si le performer échoue. Une croyance
reste qualifiée, une incertitude reste incertaine, un secret est retenu sans
valeur ni référence, une orientation ne nomme que les acteurs fournis et une
ignorance réelle est reconnue simplement.

Depuis J10-J2, une couverture `PARTIAL` formule d'abord les faits autorisés puis
précise uniquement ce qui manque. Le libellé vient du catalogue sémantique et
non d'une analyse locale des mots du joueur. La création reste interdite.

Une erreur de lecture d'une autorité propriétaire n'est pas convertie en
ignorance : le contrôleur coupe le performer factuel et inscrit un échec
`LOOKUP_KNOWLEDGE_DISCLOSURE` dans le diagnostic développeur.

## Témoignage et diagnostic

Le contrôleur conserve la performance effective, y compris le fallback visible,
afin que la projection rendue puisse être capturée. La parole devient un
`testimony-record/1` avec `ATTRIBUTED_SPEECH_ONLY` et
`assertsObjectiveTruth: false`; elle ne crée aucune résolution objective.

Le diagnostic expose séparément les nombres et autorités de lookup, les bases
de connaissance et la cause de divulgation. Il porte
`privateValuesIncluded: false` et reste dans le panneau développeur séparé.

## Limites

I6 ne crée pas un fait manquant, ne certifie pas encore le parcours Chromium et
n'effectue aucun appel OpenAI live. Ces preuves transverses appartiennent à I7.
