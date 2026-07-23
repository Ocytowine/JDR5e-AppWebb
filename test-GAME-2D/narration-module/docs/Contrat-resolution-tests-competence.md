# Contrat de résolution des tests de compétence

Statut : `ACTIF — LANCER PERSISTANT SANS CONSÉQUENCE`

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
- aucun coût temporel;
- aucune conséquence de succès ou d'échec;
- aucune politique de répétition;
- aucune interface de lancer.

La prochaine ouverture doit relier le résultat persisté aux conséquences préparées, au temps et à une reprise narrative, sans permettre au renderer de modifier le verdict.
