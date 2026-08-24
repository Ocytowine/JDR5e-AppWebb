# Matrice de certification finale de la narration J9

Statut : `J9-A/J9-B/J9-C/J9-D FERMÉS — J1 À J9 TERMINÉS`

Date : 2026-08-24

## Objet

Cette matrice définit ce que J9 doit encore composer pour fermer le cycle
narration J1 à J9. Elle ne crée aucune nouvelle autorité et ne remplace pas les
contrats des domaines.

La certification finale comporte deux ensembles explicitement distincts :

1. une verticale narrative continue dans une même campagne réelle, objet de
   J9-B et J9-C ;
2. les preuves tactiques spécialisées existantes, conservées comme régressions
   séparées jusqu'à la future reprise de `GameBoard`.

J9 ne force aucun combat et n'injecte aucun compagnon dans le plateau.

## État de composition par lot

| Lot | Capacité livrée | Autorité principale | Preuves actuelles | État dans la campagne réelle continue | Travail J9-B |
|---|---|---|---|---|---|
| J1 | contexte public, frontières automatiques, qualité multi-tours, signal monde naturel | contexte public et domaines propriétaires de chaque frontière | `player-public-context`, `automatic-boundaries`, `npc-return-ui`, `world-event-ui` | base réelle disponible ; plusieurs preuves restent séparées | réutiliser lieu, présences, reprise et absence de double frontière comme invariants transverses |
| J2 | entrée réelle, Archives, deux PNJ, accès privé, boucle locale, reprise | campagne, scène, social et transition | `campaign-adventure-j2`, recettes OpenAI Archives ciblées | `COUVERT_CONTINU` ; cette gate constitue le socle de J9 | prolonger la même campagne au lieu de créer un second pilote |
| J3 | gestion, transferts et commerce physique | inventaire personnage et propriétaires externes | `inventory-commerce-j3` ; gestion et transferts déjà inclus dans `campaign-adventure-j2` | `COUVERT_CONTINU_PARTIEL` ; commerce reste surtout ciblé | conserver au moins une transaction personnelle et une transaction externe dans le parcours final |
| J4 | proposition, décision, reconsidération et issue de mission/relation | `mission-relation.registry`, puis autorité sociale pour les conséquences | `mission-dialogue-j4`, `mission-relation-authority` | runtime installé dans le bootstrap réel, mais pas encore certifié dans la gate continue | produire depuis un dialogue une cause durable utilisable par J7, sans appel direct de test au registre |
| J5 | création, vérité privée, indices, hypothèse, évolution hors écran et résolution | `plot.registry` et domaines de connaissance | `plot-candidate-j5`, `plot-authority`, `plot-evolution-ui`, `player-plot-j9` | fournisseur déterministe injecté au port normal ; création et rejeu certifiés depuis une recherche joueur | prolonger la même intrigue dans la gate complète jusqu'aux indices, à l'évolution et à la conclusion |
| J6 | exploration locale et voyage lointain avec temps, ressources et groupe | monde, `TravelProcess`, inventaire et horloge | `local-exploration-j6`, `time:travel`, `player-travel-j9` | départ, segment, arrivée, position, scène et rejeu composés dans le contrôleur et le bootstrap | réunir ce trajet avec les checkpoints J2/J3 et certifier une reprise globale |
| J7 | recrutement propriétaire, appartenance, autonomie, directive, séparation et reprise | mission/relation, PNJ durable, social et `companion.party-registry` | `companion-j7`, `companion-j7-ui` | le contrôleur expose les opérations, mais la recette UI prépare directement relation, promotion et recrutement avant le premier tour | ouvrir un recrutement naturel depuis une cause J4 réellement committée, puis certifier une directive libre et la photographie de groupe sans bootstrap métier artificiel |
| J8 | frontière future du compagnon tactique | narration, campagne et tactique restent séparés | contrat et guide validés | fermé sans code | maintenir tous les refus tactiques existants ; aucun travail `GameBoard` dans J9 |

## Delta réel à implémenter en J9-B

J9-B est un travail de composition, avec trois raccords fonctionnels encore
réels :

1. rendre le voyage J6 accessible depuis le contrôleur et le bootstrap de la
   campagne principale ;
2. faire suivre une cause mission/relation J4 par la promotion et le recrutement
   J7 via un chemin joueur ou propriétaire normal, au lieu du préamorçage de la
   recette J7 ;
3. fournir à la gate locale un générateur d'intrigue déterministe passant par le
   port, les validations et `plot.registry`, sans précommitter une intrigue.

Les autres capacités doivent être réutilisées, pas réimplémentées.

### Point d'avancement J9-B du 2026-08-24

- le bootstrap accepte désormais un fournisseur J5 déterministe par le port
  normal, sans embarquer de fixture dans la production ;
- une demande `FOLLOW` peut produire, après fermeture transactionnelle du tour,
  une cause J4 acceptée, une promotion durable puis un recrutement J7. La
  politique d'autonomie reste obligatoire et propriétaire ;
- le test `narration-module:test:companion-recruitment-j9` certifie ce chemin
  naturel et son registre durable ;
- un catalogue de trajet urbain Archives ↔ Halles est installé. Le contrôleur
  reconnaît la destination et persiste le départ J6 au lieu de l'envoyer à la
  transition locale ;
- l'avancement J6 committe ensemble horloge, checkpoint, position et cycle de
  scène ; l'arrivée déplace ensuite le groupe par une opération propriétaire
  idempotente, une fois le verrou du voyage libéré ;
- `player-plot-j9` certifie la proposition déterministe J5, ses validations,
  son registre et l'absence de doublon au rejeu ;
- `j9b-continuous` compose dans une même campagne la cause J4, le recrutement
  J7, l'intrigue J5, la photographie de groupe J7 dans le voyage J6, l'arrivée
  et le rejeu de chaque requête après déplacement ;
- `j9b-full-local` ferme la composition locale sur une campagne créée par le
  bootstrap installé : deux PNJ distincts, transactions personnelle et externe,
  recrutement issu de J4, refus autonome J7, deux indices J5, hypothèse fausse,
  évolution hors écran, conclusion soutenue, voyage J6 avec photographie du
  groupe, arrivée, reconstruction du contrôleur et rejeux sans doublon ;
- la résolution V6 accepte désormais une cible d'inventaire seulement si sa
  référence appartient au contexte personnage projeté ; l'autorité inventaire
  reste seule capable de valider et committer la transaction ;
- J9-B est fermé par la gate locale ; la fermeture navigateur correspondante est
  consignée ci-dessous.

### Fermeture J9-C du 2026-08-24

- `narration-module:test:j9c-browser` crée la campagne depuis l'entrée React et
  conserve toutes les écritures dans la base IndexedDB installée ;
- deux dialogues et les transactions d'inventaire personnelle/externe passent
  par la saisie UI ; un pilote déterministe de test injecte seulement les ports
  IA et politiques nécessaires à J4–J7 dans le contrôleur de production ;
- après arrivée aux Halles et rechargement, la recette relit la scène, les
  1 800 secondes écoulées, le compagnon déplacé, son refus autonome, l'intrigue
  résolue, ses indices et hypothèses, ainsi que les inventaires restaurés ;
- les requêtes critiques de recrutement, refus et voyage sont rejouées sans
  nouvelle conséquence, puis un second rechargement confirme l'absence de
  doublon visible et d'erreur de page ;
- l'identifiant persistant du processus de voyage est désormais normalisé et
  borné à 128 caractères, avec une régression métier dédiée ;
- aucun appel OpenAI live et aucune modification de `GameBoard` ne font partie
  de cette gate. J9-C est fermé ; J9-D attend un accord explicite.

## Parcours continu attendu de J9-B/J9-C

La formulation exacte et la prose restent variables. Les oracles portent sur
les autorités et les résultats committés.

### Checkpoint A — entrée et continuité J1–J2

1. créer une fiche valide depuis l'entrée réelle ;
2. créer la campagne et entrer aux Archives ;
3. observer, demander le contexte et parler à deux PNJ ;
4. changer d'écran, revenir et recharger ;
5. retrouver une seule fois chaque entrée et chaque réponse, avec temps stable
   pour les questions sans activité fictionnelle.

### Checkpoint B — inventaire et relation J3–J4

6. exécuter une transaction sur un exemplaire réellement possédé ;
7. proposer une action ou relation à un PNJ visible ;
8. obtenir une décision propriétaire acceptée, adaptée, conditionnelle ou
   refusée avant sa formulation narrative ;
9. conserver l'engagement et la transaction après rechargement.

### Checkpoint C — compagnon narratif J7

10. promouvoir le même acteur durable uniquement depuis la confirmation J4 ;
11. recruter ce PNJ depuis cette cause et sa présence réelle ;
12. lui adresser une demande libre acceptée ou adaptée et une demande qu'il
    refuse ou conditionne ;
13. vérifier qu'aucune directive acceptée n'est présentée comme réussite de
    l'action demandée ;
14. recharger et retrouver une seule appartenance et une seule décision par
    requête.

### Checkpoint D — intrigue J5

15. déclencher une recherche suffisamment profonde pour demander une
    proposition au générateur déterministe de certification ;
16. valider puis committer vérité, causalité et voies d'indice avant le premier
    signe visible ;
17. enregistrer au moins une découverte et une hypothèse sans modifier la
    vérité ;
18. faire évoluer l'intrigue par une frontière temporelle puis résoudre une
    conclusion soutenue par les preuves propriétaires.

### Checkpoint E — exploration et voyage J6

19. découvrir ou revisiter plusieurs lieux par les transitions existantes ;
20. démarrer un trajet fondé sur une route réelle du monde ;
21. relire la photographie versionnée incluant le compagnon `ACTIVE` ;
22. avancer temps, position, checkpoint et ressources dans les commits prévus ;
23. restaurer une arrivée ou une interruption sans recalcul ni consommation
    doublée.

### Checkpoint F — fermeture et reprise

24. projeter les seules conséquences perceptibles des domaines ;
25. rendre clairement la main au joueur après chaque étape ;
26. effectuer un dernier rechargement et vérifier identités, temps, position,
    inventaire, mission, intrigue, groupe et fil narratif ;
27. rejouer une requête critique de chaque famille et obtenir une restauration,
    jamais un second effet.

## Règles de fixture

La gate peut remplacer un fournisseur IA par une sortie déterministe certifiée
pour obtenir une preuve locale reproductible. Cette sortie reste une
proposition et doit traverser les mêmes schémas, validateurs et autorités que la
route OpenAI.

La gate ne peut pas :

- écrire directement un engagement accepté, une intrigue, un compagnon, une
  position ou un événement monde ;
- appeler une méthode d'autorité depuis le test pour sauter une intention joueur
  lorsque le comportement prétend être disponible en jeu ;
- choisir une prose exacte comme oracle métier ;
- fabriquer un combat, un repos ou une rencontre pour cocher une étape ;
- exposer une vérité privée dans l'interface ou l'inspection navigateur.

Les helpers d'inspection peuvent lire les agrégats et opérations pour les
assertions. Ils ne doivent pas les modifier.

## Preuves tactiques maintenues séparément

| Frontière | Commande de preuve | Ce qu'elle garantit |
|---|---|---|
| graine vers plateau | `npm run narration-module:test:game-board-handoff` | validation des projections, carte, équipes et positions du modèle actuel |
| checkpoint et outcome | `npm run narration-module:test:tactical-checkpoint` | reprise de frontière de tour, outcome terminal et intégration idempotente |
| accès vers tactique | `npm run narration-module:test:campaign-access-lot-e` | intention hostile, handoff, résultat autoritaire et retour d'accès |
| défense complète | `npm run narration-module:test:bastion-vertical-8d` | campagne, `GameBoard`, rechargement, outcome et reprise narrative unique |

Ces preuves couvrent le personnage unique actuellement représentable. Elles ne
certifient ni allié, ni compagnon, ni génération générale de carte.

## Commandes de régression J1–J7

Depuis `test-GAME-2D/` :

```text
npm run narration-module:test:player-public-context
npm run narration-module:test:automatic-boundaries
npm run narration-module:test:npc-return-ui
npm run narration-module:test:world-event-ui
npm run narration-module:test:campaign-adventure-j2
npm run narration-module:test:inventory-commerce-j3
npm run narration-module:test:mission-dialogue-j4
npm run narration-module:test:plot-candidate-j5
npm run narration-module:test:plot-evolution-ui
npm run narration-module:test:local-exploration-j6
npm run narration-module:test:time:travel
npm run narration-module:test:companion-j7
npm run narration-module:test:companion-j7-ui
npm run narration-module:test:j9-local-ports
npm run narration-module:test:j9b-continuous
npm run narration-module:test:j9b-full-local
npm run narration-module:test:j9c-browser
npm run build
```

Les recettes OpenAI live ne sont pas des prérequis de J9-B. J9-D ne les lance
qu'après passage local, disponibilité du quota et accord explicite sur la
dépense.

### Point de contrôle J9-A du 2026-08-24

Les treize commandes J1 à J7 listées ci-dessus, hors `npm run build`, ont été
réexécutées après rédaction de la matrice et passent toutes. Les cinq recettes
Playwright concernées (`npc-return-ui`, `world-event-ui`,
`campaign-adventure-j2`, `plot-evolution-ui` et `companion-j7-ui`) sont vertes.
Les avertissements de proxy du module carte observés pendant certaines recettes
n'ont produit ni erreur de page ni échec d'assertion ; aucun appel OpenAI live
n'a été émis.

## Critères de fermeture

- J9-A : la présente matrice est validée et les trois raccords J9-B sont
  identifiés sans ambiguïté ;
- J9-B : fermé par `j9b-full-local`, avec refus, reconstruction et rejeux ;
- J9-C : le même parcours passe depuis l'entrée navigateur réelle ;
- J9-D : la recette OpenAI autorisée et la matrice de résultats sont publiées,
  ou l'absence d'autorisation live est explicitement reportée sans masquer la
  certification locale.

## Fermeture J9-D du 2026-08-24

Commande exécutée après accord explicite :

```text
npm run narration-module:test:narrative-pipeline-roles:openai-live
```

Résultat : `PASS` en 1,7 minute. Les treize appels ont répondu en HTTP 200 :

| Tour | Rôles observés | Appels |
|---|---|---:|
| clarification | `player_intent_interpreter` | 1 |
| action | `player_intent_interpreter → mj_planner → scene_writer` | 3 |
| dialogue | `player_intent_interpreter → mj_planner → npc_performer` | 3 |
| observation | `player_intent_interpreter → mj_planner → scene_writer` | 3 |
| transition | `player_intent_interpreter → mj_planner → scene_writer` | 3 |

La limite de trois appels par tour, l'unicité et l'ordre canonique des rôles,
les effets déterministes protégés et l'absence d'incident UI sont validés. La
clé est restée confinée au serveur. J9-D et le cycle narratif J1 à J9 sont
fermés ; aucun élargissement tactique n'est impliqué.
