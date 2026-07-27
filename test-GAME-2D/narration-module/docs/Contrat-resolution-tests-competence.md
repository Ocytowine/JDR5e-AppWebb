# Contrat de résolution des tests de compétence

Statut : `ACTIF — PRÉPARATION POST-RÉSULTAT SANS COMMIT`

Date : 2026-07-23

## Chaîne ouverte

```text
difficulty-assessment/1
  -> bande sélectionnée
  -> RuleRegistry épinglé par la campagne
  -> core.check.difficulty-class@1
  -> DD sourcé
  -> skill-check-resolution/1 avec un d20 fourni
```

Le tour charge le registre intégré uniquement si la campagne déclare `rules.jdr5e` en `rulesetVersion: 2`. Une campagne V1 ou un prototype reçoit `null` et conserve sa bande sans DD; aucune règle actuelle n'est appliquée à sa place.

## Résolution pure

`skill-check-resolution/1` exige :

- une proposition `RULE_RESOLVED`;
- un contexte mécanique de personnage;
- un entier fourni entre 1 et 20;
- aucune politique d'avantage ou désavantage encore ouverte.

Il calcule :

```text
contribution de maîtrise = bonus de maîtrise × rang
modificateur total = caractéristique + contribution de maîtrise
total = d20 + modificateur total
marge = total - DD
succès si marge >= 0
```

Le résultat conserve dé, modificateurs, DD, marge, verdict, sources et règles. Il reste `commitAuthority: false`.

Un 1 ou un 20 naturel est tracé par `naturalResult`, mais n'altère pas le verdict. Une réussite ou un échec automatique exigerait une règle versionnée supplémentaire.

## Lancer persistant

`dice-roll-record/1` ouvre une opération métier séparée :

1. l'empreinte canonique de `SkillCheckProposalV1` est calculée;
2. l'agrégat `rules.dice-roll` dérivé du `checkId` est recherché;
3. s'il existe avec la même empreinte, il est relu sans nouveau tirage;
4. s'il existe avec une autre empreinte, `IDEMPOTENCY_CONFLICT` est retourné;
5. sinon un unique d20 est demandé à la source, résolu, puis committé atomiquement avec l'événement `rules.skill-check.rolled`.

La source de production `CryptoD20SourceV1` utilise Web Crypto et un échantillonnage par rejet, sans biais de modulo. Les tests injectent une source contrôlée. Le commit conserve valeur, modificateurs, DD, marge, verdict, empreinte de proposition, source et références.

Un échec de commit suivi d'un commit concurrent relit l'agrégat gagnant et applique le même contrôle d'empreinte. Un retry, un double clic ou un rejeu ne consomme donc pas un second d20.

## Frontières encore fermées

- aucun avantage ou désavantage;
- aucun test secret;
- aucun commit temporel ou de conséquence;
- aucune politique de répétition;
- aucune interface de lancer.

## Préparation post-résultat

`skill-check-outcome-preparation/1` relie un lancer persisté à une politique fournie
par le domaine propriétaire. Cette politique décrit avant sélection les deux
branches `SUCCESS` et `FAILURE`, avec pour chacune :

- un effet typé appartenant à un domaine ;
- un résumé public perceptible ;
- une durée exacte, éventuellement nulle ;
- une décision de répétition bornée ;
- ses références de règle et de source.

Le préparateur vérifie l'empreinte de la proposition contre
`dice-roll-record/1`, sélectionne exclusivement la branche correspondant au
verdict persisté et produit :

- une conséquence `PREPARED_NOT_COMMITTED` ;
- une proposition temporelle exacte compatible avec `temporal-kernel/1` ;
- un paquet de reprise narrative limité au verdict, au résumé public et au
  temps proposé.

Le paquet de reprise porte `commitAuthority: false`. Il interdit au renderer de
changer le verdict, la durée ou l'effet et ne lui transmet pas les références
privées de la politique.

La prochaine ouverture devra composer cette préparation avec le domaine
propriétaire et le kernel temporel dans un commit atomique, puis seulement
exposer le déclenchement du lancer dans l'interface.

## Commit atomique propriétaire

`skill-check-outcome-commit/1` compose la préparation avec un résultat fourni
par le domaine propriétaire. Ce résultat doit confirmer le `checkId`, le
`rollId`, le type d'effet, l'agrégat cible, sa révision attendue et son prochain
payload. Le compositeur générique n'interprète pas l'effet et ne construit
jamais cette mutation.

Le `CommitRequest` temporel doit être lié à la commande propriétaire par
`COMPOSITE_DOMAIN_COMMIT` et atteindre exactement l'instant préparé. La
transaction finale contient :

- la commande temporelle ;
- la commande propriétaire ;
- les écritures du kernel, dont `world.clock` ;
- une unique écriture d'agrégat propriétaire ;
- l'événement public `rules.skill-check.outcome-committed`.

Une cible déjà écrite par le kernel, une révision incohérente, un verdict
modifié ou une durée différente sont rejetés avant le repository. L'idempotence
du commit reste portée par l'opération, sa clé et son empreinte.

Restent fermés : construction automatique d'une conséquence pour tous les
domaines, intégration au contrôleur de tour, politique complète de répétition et
interface de lancer.

## Premier domaine jouable : Perception

`perception-skill-check-outcome/1` transforme une recherche active en politique
de résultat propriétaire. Une réussite peut révéler uniquement les indices de
la cible marqués à la fois `CHECKED` et `VISIBLE_SIGN`. Les faits
`HIDDEN_FACT`, interprétations et indices d'une autre cible restent exclus, y
compris de la reprise narrative. Un échec ne révèle aucun indice et demande un
changement de contexte avant une nouvelle tentative.

Le contrôleur expose maintenant `pending-narrative-skill-check/1` avec le statut
`AWAITING_SKILL_ROLL` lorsqu'une résolution perceptive retourne
`CHECK_REQUIRED`. Cet état contient la proposition exacte, la scène et
l'opération source, sans autorité de commit. Il est enregistré avec la sortie
durable du tour et restauré par le rejeu de l'opération.

La prochaine ouverture est une commande explicite de reprise qui consommera cet
état, persistera le d20, préparera la branche Perception, puis appellera le
commit atomique existant. Le simple envoi d'un nouveau texte joueur ne doit pas
être interprété implicitement comme un lancer.

## Reprise explicite du lancer

`ResumePendingSkillCheckCommandV1` cite l'opération source et le
`pendingCheckId`. `NarrativeTurnControllerV1.rollPendingSkillCheck` relit la
sortie durable, vérifie que la proposition est prête à lancer et que la scène
active correspond, puis enchaîne :

1. persistance idempotente du d20 ;
2. sélection de la branche Perception ;
3. construction du résultat propriétaire ;
4. préparation du segment temporel ;
5. commit atomique du temps et de la conséquence.

Le `clientRequestId` de la commande dérive les opérations internes stables du
lancer et du résultat. Un double clic, un retry transport ou la reconstruction
du contrôleur relisent donc le même dé et le même commit. La préparation
originale est conservée dans le résultat durable de l'opération de conséquence
afin que le rejeu ne la recalcule pas depuis une horloge déjà avancée.

La saisie narrative ordinaire ne déclenche jamais cette commande. Restent à
ouvrir le paquet d'affichage final et le bouton UI explicite.

## Affichage et commande joueur

La surface React affiche un encart `Test de compétence en attente` avec
l'objectif, la caractéristique, la compétence, le modificateur, le DD et les
enjeux. La saisie d'une nouvelle intention est désactivée tant que ce test est
en attente.

Le bouton `Lancer le dé` appelle exclusivement
`rollPendingSkillCheck`. Il est désactivé pendant l'exécution et tant que la
proposition ne contient pas à la fois un DD résolu et un contexte mécanique de
personnage. Aucun lancer incomplet n'est donc remplacé silencieusement par un
modificateur de prototype.

Après commit, un paquet durable affiche :

- la reprise narrative publique ;
- le d20, le modificateur, le total, le DD et la marge ;
- le verdict et les secondes consommées ;
- les références du lancer et du commit.

Les opérations de conséquence conservent ce paquet. Le rechargement restaure les
résultats déjà affichés et ne restaure comme actionnable qu'un test sans agrégat
de résultat.
