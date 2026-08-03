# Contrat des affirmations, témoignages et connaissances

Statut : `CHAINE_EPISTEMIQUE_RUNTIME_IMPLEMENTEE_HORS_ACCES_ET_MENSONGE`

## Objectif

Faire circuler une information entre le monde, les acteurs et le personnage
sans transformer une parole, une croyance ou une rumeur en vérité objective.
Le contrat est générique : il s'applique aux lieux, acteurs, événements,
histoires, intrigues et objets.

## Séparation obligatoire

Le runtime distingue toujours :

1. la vérité possédée par le domaine du sujet ;
2. la perspective privée d'un acteur ;
3. le témoignage effectivement prononcé ;
4. ce qu'un autre acteur a entendu, observé, confirmé ou réfuté ;
5. la présentation visible de ces informations.

Une répétition ne change pas d'autorité. Trois témoignages concordants restent
trois sources attribuées et ne confirment pas automatiquement leur contenu.

## Contrats V1

### Affirmation

`knowledge-claim/1` représente une proposition portant sur un sujet canonique.
Elle est volontairement neutre quant à sa vérité. L'absence de résolution
objective signifie que le système ne sait pas encore, ou n'a pas encore le
droit d'exposer, si elle est vraie.

### Perspective

`actor-claim-perspective/1` appartient au domaine de connaissance de l'acteur.
Une perspective est `KNOWN`, `BELIEVED`, `UNCERTAIN` ou
`INTENDS_TO_DECEIVE`. Elle reste privée. Une tromperie intentionnelle exige une
vérité privée de référence et une cause de tromperie ; elle ne peut pas être
produite comme simple variation de dialogue.

### Témoignage

`testimony-record/1` conserve le locuteur, les destinataires, la réplique et les
affirmations transmises. Son autorité est exclusivement
`ATTRIBUTED_SPEECH_ONLY`. Le dossier privé peut relier le témoignage à la
perspective du locuteur, mais la projection joueur n'expose jamais si le
locuteur se trompe ou ment.

### Acquisition

`actor-knowledge-acquisition/1` conserve ce qu'un acteur a appris par un canal.
Les statuts sont `HEARD`, `OBSERVED`, `CONFIRMED` et `REFUTED`. Un témoignage
peut produire `HEARD`, jamais directement `CONFIRMED` ou `REFUTED`.

### Résolution objective

`objective-claim-resolution/1` est la seule résolution vraie ou fausse. Elle
doit provenir du domaine propriétaire du fait et citer ses références. Sa
visibilité peut rester privée ; le personnage ne gagne pas automatiquement
cette connaissance.

## Confirmations et réfutations actives

L'autorité `knowledgeResolutionAuthority` persiste maintenant les résolutions
objectives dans `narrative.claim-resolution-registry`. Elle n'accepte pas la
seule déclaration d'un nom de domaine : un port propriétaire doit retourner une
attestation `CLAIM_OWNER_DOMAIN` correspondant exactement à l'opération source,
au domaine, à la proposition, au résultat, aux références factuelles et à la
visibilité demandée.

La résolution et les acquisitions des destinataires autorisés sont committées
atomiquement. Une confirmation crée `CONFIRMED`, une réfutation crée `REFUTED` ;
un acteur absent des destinataires n'apprend rien. Une résolution
`SYSTEM_PRIVATE` ne peut mettre à jour aucun acteur.

Une résolution opposée sur la même proposition est refusée. Le système ne
réécrit donc jamais silencieusement la vérité : une proposition temporelle ou
révisée doit recevoir une nouvelle identité explicite.

La projection `npc_performer` charge ces acquisitions. `CONFIRMED` devient une
proposition connue. `REFUTED` signifie que le PNJ sait que la proposition est
fausse et doit la nier ou la corriger. L'ancienne croyance portant sur la même
proposition est retirée de la projection, mais son témoignage historique reste
intact.

## Persistance propriétaire active

Une commande validée peut maintenant enregistrer atomiquement :

- l'affirmation neutre et le témoignage dans le registre de témoignages ;
- la perspective dans le registre privé du locuteur ;
- une acquisition `HEARD` dans le registre de chaque auditeur.

Le rejeu est idempotent. Un acteur absent de l'audience n'apprend rien. La
projection destinée à un acteur expose la proposition, son statut et les
locuteurs attribués, mais jamais la perspective privée. L'événement de campagne
ne recopie ni la proposition ni la réplique.

Cette autorité reçoit des données déjà structurées. Elle ne tente pas de
transformer seule le texte en vérité. Le `npc_performer` déjà utilisé classe
maintenant le sujet de chaque assertion comme référence connue, mention
hypothétique ou sujet non résolu. Le runtime réutilise les alias d'un dossier
hypothétique avant d'en créer un nouveau. Un sujet non résolu n'est pas
persisté.

Après enregistrement du rendu final, le runtime vérifie que la phrase visible
correspond encore à la performance structurée. Il sauvegarde ensuite le dossier,
la perspective, le témoignage et `HEARD`. Une réécriture divergente est refusée
afin de ne jamais mémoriser une parole différente de celle affichée.

## Projection privée vers le PNJ active

Avant l'appel `npc_performer` déjà prévu pour le dialogue, le runtime charge
maintenant une projection strictement limitée à l'acteur concerné. Elle réunit :

- les références de faits que le registre social marque comme connus ;
- les propositions du nouveau registre de perspectives avec un niveau imposé
  `known`, `believed` ou `uncertain` ;
- les anciennes croyances durables du registre social, toujours présentées
  comme `believed`.

Ces références sont ajoutées aux sources autorisées du même appel. La validation
locale et la route OpenAI refusent qu'une croyance ou une incertitude soit
surclassée en fait connu. `mayBeFalse` reste une précaution privée et ne doit
jamais être annoncé au joueur.

La projection exclut les relations, préoccupations, objectifs privés,
contraintes de visibilité, références de vérité secrète, causes de tromperie et
preuves privées. Les perspectives `INTENDS_TO_DECEIVE` sont entièrement retirées
tant que le mensonge intentionnel n'est pas ouvert dans le performer. Le
contrat impose donc explicitement `intentionalDeceptionAllowed=false`.

Cette projection est construite localement : elle n'ajoute aucun appel IA et
reste comprise dans le plafond de trois appels facturés du tour.

## Contexte séparé du créateur de lieu actif

L'appel `scene_creator` existant reçoit maintenant un contexte épistémique en
trois sections distinctes :

- `authoritativeTruths` contient uniquement le canon strict effectif ;
- `campaignCommitments` contient les projections de campagne déjà engagées ;
- `attributedTestimonies` contient au plus huit témoignages persistants que le
  personnage actif a réellement entendus.

La projection des témoignages conserve le locuteur, la scène, la réplique, la
proposition et son mode public, avec `assertsObjectiveTruth=false`. Elle retire
la perspective privée, ses preuves, son éventuelle vérité secrète et sa cause
de tromperie. Une conversation dont le personnage n'était pas destinataire
n'est pas transmise au créateur.

Le créateur peut utiliser une rumeur comme contrainte de cohérence ou proposer
de matérialiser un élément compatible. Cette proposition reste soumise aux
validations et au commit du runtime : elle ne confirme jamais rétroactivement
le témoignage. Cette projection est locale et n'ajoute aucun appel IA.

## Raccords runtime encore requis

- raccorder progressivement les résultats jouables concrets des domaines
  social, inventaire, perception, règles et tactique à l'autorisation
  `ACCESS_OWNER_DOMAIN` déjà certifiée ; un simple indice IA ou une phrase du
  joueur restent volontairement insuffisants.
- ouvrir le mensonge intentionnel seulement avec une vérité privée, une cause
  et une politique de révélation/réfutation complètes.

## Accès distinct de l'existence

Une condition d'accès ne décide pas de l'existence du lieu. La décision de
destination doit déterminer si le lieu est connu, matérialisable, ambigu,
lointain ou contradictoire. Une décision distincte décrit ensuite l'accès comme
ouvert, contrôlé, bloqué ou inconnu.

Le personnage peut atteindre un seuil contrôlé sans pouvoir entrer. La
présentation d'un mandat, la négociation, la recherche d'un autre passage ou la
force appartiennent ensuite à leurs domaines propriétaires.

`access-control/1` et son registre de campagne persistent désormais cet état,
ses exigences, leur visibilité et les domaines d'approche. La transition de
scène consulte le registre : un contrôle actif arrête le personnage au seuil,
n'émet aucune commande de déplacement et ne projette jamais une exigence
`SYSTEM_PRIVATE`. La liste des approches reste explicitement non exhaustive.
Un changement d'état exige une autorisation `ACCESS_OWNER_DOMAIN` et un commit
atomique ; aucune prose et aucun indice de l'arbitre ne peuvent ouvrir seuls le
passage. Cette logique locale n'ajoute aucun appel IA.

## Preuves disponibles

`npm run narration-module:test:access-control` et
`npm run narration-module:test:scene-transition` vérifient la persistance,
l'autorisation propriétaire, le seuil sans déplacement, la confidentialité des
exigences et le routage libre vers social, inventaire, perception, règles,
tactique ou monde.

`npm run narration-module:test:transverse-testimony-place-access` certifie en
plus trois témoins jusqu'à la matérialisation atomique d'un lieu contrôlé, son
ouverture autorisée, la confirmation ou réfutation des affirmations et leur
rechargement. Les paroles historiques restent inchangées.

`npm run narration-module:test:knowledge-claims` vérifie :

- une affirmation sans statut de vérité implicite ;
- trois perspectives différentes sur le même sujet ;
- trois témoignages conservés comme trois sources ;
- une acquisition `HEARD` par témoignage ;
- le refus de promouvoir un témoignage en confirmation ;
- le refus d'un mensonge intentionnel sans vérité privée ;
- une résolution objective réservée à un domaine propriétaire.
- le refus d'une attestation forgée ou d'une résolution objective
  contradictoire ;
- le commit atomique des résolutions `CONFIRMED` et `REFUTED` avec les
  acquisitions des seuls acteurs autorisés ;
- la substitution d'une croyance par la résolution apprise dans le contexte
  privé du PNJ.

Le même script vérifie aussi :

- le commit atomique du témoignage, de la perspective et de `HEARD` ;
- trois témoins conservés comme trois sources d'une même affirmation ;
- l'isolation d'un acteur qui n'était pas présent ;
- le rechargement des registres et le rejeu sans duplication ;
- l'absence de perspective privée dans la projection acteur ;
- l'absence de texte sensible dans l'événement de campagne.
- la réutilisation du même dossier malgré les différences d'accents et de
  casse ;
- le refus de capturer une phrase visible différente de la performance
  structurée.
- la projection de faits, croyances et incertitudes vers le seul PNJ concerné ;
- l'exclusion d'une tromperie, de sa vérité privée, de sa cause et des autres
  données sociales sensibles ;
- le refus de présenter une croyance autorisée avec `epistemicBasis=known`.
- la séparation canon strict, engagements de campagne et témoignages entendus
  dans le contexte du créateur ;
- l'exclusion des témoignages privés et de toute référence de perspective
  privée dans cette projection.
