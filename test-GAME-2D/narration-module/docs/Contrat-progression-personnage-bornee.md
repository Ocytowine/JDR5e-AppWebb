# Contrat de progression personnage bornée

Statut : `STABLE_6E_D`
Lot : `6E`
Contrats cibles : `character-progression-registry/1`,
`character-progression-award/1`, `character-progression-application/1`

## Objectif

Relier un accomplissement validé à une progression de personnage sans laisser
la narration, une IA, un repos ou un routeur transversal accorder directement
un niveau, une capacité ou une ressource.

La fiche du créateur reste une source d'import. L'instance `character.state` de
la campagne et ses projections sont les seules cibles runtime.

## Chaîne d'autorité

```text
événement source committé
  -> politique de progression injectée
  -> disponibilité committée
  -> segment de repos court ou long consacré et committé
  -> choix explicites du joueur si nécessaires
  -> candidat complet préparé par l'adaptateur personnage
  -> validation du ruleset épinglé
  -> commit atomique état + projections + historique
  -> narration du résultat déjà validé
```

Le routeur transporte l'événement source. La politique de campagne décide s'il
constitue un jalon. Le domaine personnage prépare et valide les gains. La
narration ne fait que présenter le résultat public.

## 6E-A — disponibilité

Le premier incrément persiste un registre distinct de progression. Une
disponibilité porte :

- un identifiant stable ;
- le personnage ciblé ;
- l'événement committé qui la justifie ;
- la politique versionnée ayant statué ;
- le type de récompense ;
- son statut `AVAILABLE`, `CHOICE_REQUIRED`, `APPLIED` ou `CANCELLED` ;
- l'instant diégétique de disponibilité ;
- les choix encore requis.

Un même événement source ne peut ouvrir deux fois la même récompense. Une
décision inéligible ne produit ni commit personnage, ni temps de jeu.

Exemple : la fin validée d'une mission peut ouvrir une progression de classe.
Un repos suivant peut constituer un moment pratique pour la présenter, mais le
repos n'est pas sa cause et ne l'accorde pas.

État d'implémentation :

- registre `character.progression-registry` persistant ;
- événement source et opération committée relus avant décision ;
- politique obligatoire et injectée ;
- décisions inéligibles sans commit ;
- récompense avec choix de classe conservée en `CHOICE_REQUIRED` ;
- déduplication par événement source et rejeu idempotent ;
- événements publics expurgés du payload privé de la source ;
- test `narration-module:test:character-progression`.

## 6E-B — choix et application

Une progression nécessitant une classe, une sous-classe, un don, une
amélioration de caractéristique ou un autre choix reste suspendue. L'IA ne
sélectionne jamais à la place du joueur.

L'application future reçoit un candidat complet préparé par un adaptateur du
domaine personnage. Elle doit au minimum vérifier :

- révisions attendues de `character.state` et des deux projections ;
- identité inchangée du personnage ;
- somme des niveaux de classe égale au niveau global ;
- progression monotone et bornée ;
- règles et catalogues épinglés à la campagne ;
- références de gains existantes ;
- choix requis explicitement résolus ;
- projections tactique et narrative recalculées depuis le nouvel état.

Les trois agrégats personnage et le registre de progression sont écrits dans un
seul commit. Un échec ne modifie rien.

État d'implémentation :

- choix requis contrôlés à la frontière et conservés dans l'opération durable ;
- candidat complet fourni par l'adaptateur, sans mutation directe de la fiche
  source du créateur ;
- identité, ruleset, révisions, niveaux de classe, progression monotone et
  cohérence de la projection tactique contrôlés avant validation ;
- validateur personnage/ruleset obligatoire et injecté, avec références de
  décisions de règles persistées ;
- registre, `character.state`, projection tactique et projection narrative
  écrits dans un commit unique ;
- récompense versionnée et datée par l'horloge diégétique lors de l'application ;
- résumé joueur minimal produit par l'autorité personnage, sans données privées
  de l'événement source ;
- rejet sans commit, rejeu idempotent, conflit de requête et rollback sur panne
  injectée couverts par `narration-module:test:character-progression`.

## 6E-C — projection et restauration

La projection consomme uniquement le résumé public déjà validé. Avant tout
rendu, elle relit :

- l'opération `character.progression.apply` achevée et committée ;
- son résultat durable au statut `APPLIED` ;
- l'événement joueur `player_level_changed` issu du même commit ;
- la concordance exacte entre le résumé de l'opération et celui de l'événement.

Le résumé public contient l'identité technique du personnage, son nom
affichable, ses niveaux précédent et nouveau, un libellé public de progression
et les nouveaux acquis montrables. Il ne contient ni candidat complet, ni
calculs privés, ni payload de l'événement ayant ouvert la récompense.

La projection produit un bloc `GM_NARRATION` déterministe, sans appel IA, sans
temps de jeu et sans commit métier. Exemple :

> L'expérience d'Aryn porte ses fruits : le voilà guerrier de niveau 2. Il
> maîtrise désormais Fougue.

Le texte reste une présentation : les libellés viennent du validateur
personnage/ruleset et le gabarit ne crée aucun gain. L'opération de rendu est
idempotente et reconstructible avec le fil narratif existant.

Après rechargement, l'interface relit cette projection. Elle ne rappelle ni le
validateur, ni l'application de progression et ne crée pas un second paquet
d'affichage.

État d'implémentation :

- opération d'application et événement `player_level_changed` relus avant
  présentation ;
- concordance du commit, de la visibilité et du résumé public vérifiée ;
- bloc MJ déterministe construit uniquement depuis les libellés publics validés ;
- projection `PRESENTATION_ONLY`, sans temps de jeu ni commit métier ;
- rejeu de projection idempotent et restauration par le fil narratif commun ;
- données techniques et gains privés absents du texte affiché ;
- preuve domaine dans `narration-module:test:character-progression` ;
- preuve navigateur et rechargement dans
  `narration-module:test:character-progression-ui`.

## Frontière narrative

Avant application, la narration peut seulement dire qu'une progression est
disponible et demander les choix requis. Après application, elle reçoit un
résumé public produit par l'autorité personnage.

Elle ne reçoit pas un cache arbitraire du créateur, ne recalcule aucun gain et
ne transforme pas une suggestion de `scene_writer` en récompense.

## 6E-D — fenêtre de repos et catalogues

La conception produit antérieure impose le repos court ou long comme fenêtre
du passage de niveau. Cette règle est rétablie explicitement :

```text
événement éligible committé
  -> disponibilité de progression en attente
  -> repos court ou long démarré
  -> segment consacré à la progression
  -> segment committé sans interruption
  -> choix structurés du joueur
  -> candidat projeté depuis les catalogues épinglés
  -> validation et application atomique
```

Le repos n'est pas la cause du gain. Il constitue la gate obligatoire de son
application. Une interruption avant la fin du segment conserve la récompense en
attente. Une fois le segment committé, sa preuve reste valable pour la
récompense explicitement désignée.

La progression mécanique et l'évolution personnelle sont deux domaines
distincts :

- niveau global, niveaux de classe, PV, sorts, capacités et ressources suivent
  des règles strictes ;
- confiance, affection, loyauté, convictions, tensions et départ d'un compagnon
  relèvent de l'état social et de la narration causale ;
- une évolution personnelle n'accorde jamais un niveau ou une capacité ;
- un niveau mécanique ne modifie jamais implicitement une relation.

Le candidat mécanique doit être construit depuis les fichiers de classe,
sous-classe, espèce, background, capacités, actions, réactions, sorts et
ressources du package de contenu épinglé. Le runtime ne contient aucune table
spéciale « Guerrier niveau 2 ».

Si un gain, un choix ou une référence manque :

- la récompense reste en attente ;
- aucun agrégat personnage n'est modifié ;
- une notification système identifie la source et la référence manquantes ;
- l'IA et le fallback local n'inventent aucune compensation.

Premier incrément exécutable livré :

- activité `CHARACTER_PROGRESSION` portée par un segment de repos ;
- événement de segment public contenant repos, personnage et récompense ciblés ;
- application 6E-B refusée sans cette preuve committée ;
- segment interrompu refusé ;
- rejeu sans seconde fenêtre ni seconde application ;
- adaptateur de catalogue applicatif lisant les catalogues générés de classes,
  sous-classes, actions, réactions, sorts et capacités ;
- préparateur déterministe construisant le candidat depuis le niveau réellement
  déclaré et les règles épinglées ;
- validateur refusant un gain manquant, supplémentaire ou inconnu sans commit ;
- niveau global, bonus de maîtrise et PV maximum recalculés par le registre de
  règles, pas par une table locale au lot.

Exemple certifié : le passage du guerrier du niveau 1 au niveau 2 lit
`Guerrier/class.json`. Le candidat reçoit donc `action-surge` et
`tactical-mind`. Si le second identifiant est retiré du candidat, la validation
renvoie `FEATURE_GRANT_MISMATCH`, la récompense reste `CHOICE_REQUIRED` et
aucun agrégat n'est écrit.

Les fichiers incomplets restent visibles comme tels. Par exemple, une entrée
`asi-or-feat` ne sera pas interprétée librement : tant que le choix et sa règle
d'application ne sont pas disponibles, le préparateur retourne
`CONTENT_INCOMPLETE`.

## Hors périmètre du premier incrément

- interface complète de choix de classe, sous-classe, don ou caractéristique ;
- progression automatique depuis l'expérience ;
- multiclassage complet ;
- modification directe du fichier source du créateur ;
- attribution rétroactive de gains manquants ;
- prose OpenAI dédiée à la célébration du niveau.

## Preuves attendues

- événement committé exigé avant toute disponibilité ;
- politique absente ou inéligible sans commit ;
- doublon inter-requêtes refusé ou rejoué sans seconde récompense ;
- choix requis conservé sans application implicite ;
- secrets de l'événement source absents de la projection publique ;
- application atomique, revalidation ruleset et rollback prouvés en 6E-B ;
- projection narrative et restauration sans duplication prouvées en 6E-C.
- fenêtre de repos committée et projection de catalogue prouvées en 6E-D.
