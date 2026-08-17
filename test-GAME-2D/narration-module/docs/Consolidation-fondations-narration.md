# État actuel et feuille de route unique du module narration

Date de référence : 2026-08-17

Statut : `SOURCE_CANONIQUE_ACTIVE`

## Rôle et autorité de ce document

Ce document est l'unique source de vérité pour l'état global, les priorités et
l'ordre des futurs lots du module narration.

Les autres documents ont des rôles distincts :

- le code et les tests exécutables prouvent ce qui fonctionne réellement ;
- les contrats actifs définissent les comportements et autorités ;
- `TASKS.md` est un tableau d'exécution court dérivé de cette feuille de route ;
- les guides expliquent le produit sans autoriser de nouveau développement ;
- les passations, plans, audits et matrices datées sont des archives ou des
  preuves et ne fixent plus l'ordre du travail.

En cas de contradiction :

1. code et tests exécutables ;
2. contrat actif du comportement concerné ;
3. ce document pour l'état et l'ordre des lots ;
4. `TASKS.md` pour le détail immédiat du lot actif.

Un nouveau lot fonctionnel doit être ajouté ici avant son implémentation. Une
mention dans un guide, un scénario ou une archive ne constitue pas une
autorisation de développement.

## Objectif produit

Construire un jeu de rôle narratif solo dans lequel un humain peut :

- s'exprimer librement et être compris sans apprendre des commandes ;
- dialoguer durablement avec plusieurs PNJ cohérents ;
- observer, enquêter, découvrir et revisiter des lieux ;
- gérer ses objets à l'oral sous l'autorité de l'inventaire ;
- recevoir, suivre et résoudre une petite aventure cohérente ;
- voir le monde, les intrigues et les PNJ évoluer sans être leur déclencheur
  unique ;
- créer des relations durables pouvant, dans un lot ultérieur explicitement
  contracté, conduire à un compagnon narratif puis tactique.

Le modèle IA interprète, propose et rédige. Il n'est jamais la base de données,
le moteur de règles, l'autorité d'inventaire, la vérité d'intrigue ou la volonté
d'un PNJ.

## Boucle de fonctionnement cible

```text
entrée libre du joueur
→ interprétation sémantique structurée
→ résolution locale des référents et capacités publiques
→ arbitrage par le domaine propriétaire
→ commit atomique et temps validé si nécessaire
→ rédaction narrative depuis le résultat autorisé
→ validation locale
→ projection visible, mémoire et reprise
```

Un rejet avant commit ne consomme ni état ni temps. Une panne de rédaction après
commit conserve le résultat métier et utilise un rendu déterministe sans rejouer
l'action.

## Invariants non négociables

- Le sens libre vient de l'interprétation sémantique, pas d'une liste de mots
  déclencheurs dans le runtime.
- Seul le domaine propriétaire décide référence, faisabilité, résultat,
  ressource, temps, secret et commit.
- Une parole PNJ reste attribuée ; elle ne devient ni vérité ni engagement
  durable par sa seule formulation.
- Une intrigue committe sa vérité, sa causalité et ses voies d'indice avant sa
  première mise en scène.
- Le wiki contraint les faits établis sans rendre le monde vide lorsque son
  contenu reste silencieux sur un détail ordinaire.
- Une création dynamique est proposée puis validée ; elle ne contourne ni lore,
  topologie, doublon, autorité ou secret.
- Le joueur n'est pas l'unique moteur du monde, des intrigues ou des PNJ.
- Une capacité publique `AVAILABLE` signifie seulement qu'un propriétaire peut
  examiner la demande, jamais qu'elle réussira.
- Une reprise, un double clic ou une réponse IA tardive ne dupliquent jamais un
  effet.
- Le plafond transversal reste de trois appels OpenAI facturés par tour.

## État réellement livré

| Domaine | État | Limite actuelle |
|---|---|---|
| Campagne principale | `LIVRÉ` | davantage de contenu naturel reste nécessaire |
| Persistance et reprise | `LIVRÉ` | migrations futures et charge extrême restent des sujets NFR |
| Intention libre V2–V5 | `LIVRÉ` | ontologie métier encore fermée pour plusieurs commandes génériques |
| Dialogue PNJ | `LIVRÉ` | qualité longue hors Archives à étendre |
| Contexte public joueur | `LIVRÉ_V1` | états observables supplémentaires à ajouter seulement par contrat propriétaire |
| Mémoire et témoignages | `LIVRÉ_DANS_PÉRIMÈTRE` | mémoire sociale longue et mensonge volontaire encore fermés |
| Lieux locaux | `LIVRÉ` | voyage lointain complet absent |
| Contrôles d'accès | `LIVRÉ` | catalogues concrets encore limités |
| Inventaire oral | `PARTIEL` | justificatif d'accès livré ; transactions génériques et commerce absents |
| Mission et relation | `AUTORITÉ_LIVRÉE` | cycle naturel de quête et évolution sociale longue incomplets |
| Intrigue | `NOYAU_LIVRÉ` | génération runtime complète et boucle d'aventure encore absentes |
| Monde vivant | `PARTIEL` | raccord campagne livré ; contenu local naturel à consolider |
| Repos et progression | `LIVRÉ_DANS_PÉRIMÈTRE` | options texte libre volontairement non annoncées |
| Bastion | `LIVRÉ_DANS_PÉRIMÈTRE` | économie de campagne et ordres texte libre absents |
| Tactique | `LIVRÉ_SPÉCIALISÉ` | accès et défense de bastion couverts ; combat générique fermé |
| Compagnon | `NON_OUVERT` | fondations présentes, contrat et parcours jouable absents |

## Dernier point de contrôle livré

Les lots historiques 0 à 9, les contrôles d'accès A à F et la reprise
« Passation 2 » sont fermés dans leur périmètre.

Le build principal sait notamment :

- créer et reprendre une campagne depuis une fiche valide ;
- ouvrir une scène de campagne et conserver son cycle ;
- dialoguer avec un PNJ, changer d'interlocuteur et restaurer le fil ;
- créer ou rejoindre un lieu local compatible ;
- appliquer les approches inventaire, sociale, perception, règles et tactique
  sur des contrôles d'accès propriétaires ;
- avancer et restaurer la simulation de campagne ;
- exposer progression, bastion et défense seulement depuis un état committé ;
- ouvrir `GameBoard`, restaurer un checkpoint et intégrer une issue tactique
  spécialisée une seule fois.

La validation OpenAI du 2026-08-17 certifie :

- Archives → Place des Archives avec trois appels HTTP 200, transition et temps
  uniques, puis reprise sans recréation ;
- quatre échanges avec le clerc, chacun dans l'ordre
  `player_intent_interpreter → mj_planner → npc_performer`, soit douze réponses
  HTTP 200 et quatre paroles restaurées sans alerte ;
- correction du rejeu social après promotion d'un acteur et de la capture de
  témoignage lorsque les identifiants dérivés seraient trop longs.

La première tranche J1 ajoute `player-public-context/1`. Elle reconstruit à
chaque tour le lieu, les personnes visibles, l'équipement visible et les
connaissances acquises du personnage. Elle répond localement aux questions de
lieu, de présence et de connaissance sans commit, sans temps de jeu et sans
exposer les données privées.

## Feuille de route ordonnée vers une petite aventure jouable

Un lot futur est `PLANIFIÉ`, mais pas autorisé à l'implémentation tant que les
critères du lot précédent ne sont pas fermés et que son contrat proche n'est pas
écrit.

### J1 — Fermer la consolidation joueur ↔ MJ

Statut : `ACTIF_AUTORISÉ`

Objectif : rendre la boucle déjà disponible fiable avant d'ajouter un nouveau
domaine joueur.

Travail :

1. créer avec les propriétaires une projection publique typée des connaissances
   et états observables réellement utiles ;
2. répondre sans fuite à « où suis-je ? », « qui est présent ? » et « que sais-je ? » ;
3. auditer les frontières automatiques après action, dialogue, monde, intrigue,
   initiative PNJ, temps, progression, bastion et tactique ;
4. étendre la qualité multi-tours au-delà du pilote Archives ;
5. consolider les événements naturels de la simulation du monde dans une
   campagne, sans fabriquer un signal local artificiel.

Terminé lorsque les régressions déterministes, une recette navigateur
multi-lieux et le build prouvent restitution claire de la main, absence de
double frontière, secrets exclus et reprise stable.

Références :

- [`Contrat-contexte-personnage-interpreteur.md`](Contrat-contexte-personnage-interpreteur.md) ;
- [`Contrat-contexte-public-joueur-J1.md`](Contrat-contexte-public-joueur-J1.md) ;
- [`Contrat-cible-monde-vivant-et-initiative-pnj.md`](Contrat-cible-monde-vivant-et-initiative-pnj.md) ;
- [`Contrat-budget-appels-ia-par-tour.md`](Contrat-budget-appels-ia-par-tour.md).

### J2 — Étendre la verticale jouable NAR-ACC-002

Statut : `PLANIFIÉ_APRÈS_J1`

Objectif : utiliser le parcours officiel des Archives comme intégration unique
de la petite aventure, sans créer une quête produit préécrite concurrente.

La gate doit relier progressivement entrée, observation, plusieurs PNJ,
intrigue contextuelle, enquête, déplacement, conséquence causale, éventuel
handoff tactique, repos, ellipse et retour.

La fixture fixe les intentions et les oracles. Elle ne fixe pas à l'avance les
noms, la vérité, les indices ou l'adversaire que le générateur doit proposer.

Référence : [`Scenarios-acceptation.md`](Scenarios-acceptation.md),
`NAR-ACC-002`.

### J3 — Inventaire oral et transaction propriétaire

Statut : `PLANIFIÉ_CONTRAT_REQUIS`

Objectif : ouvrir une transaction inventaire générique sans donner l'agrégat
privé ou l'autorité au modèle.

Ordre interne :

1. projection publique typée des objets et actions sélectionnables ;
2. sélection exacte d'une instance ou clarification locale ;
3. prendre, déposer, ranger, sortir, équiper, déséquiper, donner et recevoir ;
4. consommation seulement depuis un effet ou une politique propriétaire ;
5. monnaie physique, achat, vente et contreparties atomiques ;
6. apparence visible recalculée depuis l'état autoritaire.

Le contrat doit couvrir quantité, accessibilité, contenants, emplacements,
capacité, monnaie, atomicité, temps et rejeu. Le justificatif d'accès existant
reste un adaptateur spécialisé, pas la transaction générique.

Références :

- [`Contrat-commandes-joueur-domaines-proprietaires.md`](Contrat-commandes-joueur-domaines-proprietaires.md) ;
- [`Contrat-acces-par-inventaire.md`](Contrat-acces-par-inventaire.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-009`.

### J4 — Boucle naturelle mission et relation

Statut : `PLANIFIÉ_CONTRAT_D_ADAPTATION_REQUIS`

Objectif : raccorder les dialogues au registre mission/relation existant sans
faire d'une réplique une acceptation.

Travail :

1. transformer une demande ou proposition validée en engagement `PROPOSED` ;
2. faire produire au domaine propriétaire `ACCEPTED`, `REFUSED`, `CONDITIONAL`
   ou `UNCERTAIN` ;
3. restituer conditions, promesses et conséquences publiques ;
4. raccorder réussite, échec ou abandon d'une mission ;
5. ouvrir seulement par ruleset les axes durables pertinents tels que confiance,
   respect, peur, affection, hostilité et obligation.

Références :

- [`Contrat-autorite-mission-relation.md`](Contrat-autorite-mission-relation.md) ;
- [`Contrat-etat-social-durable-et-initiative-locale.md`](Contrat-etat-social-durable-et-initiative-locale.md) ;
- [`Integration-domaines.md`](Integration-domaines.md).

### J5 — Création et suivi d'intrigue dynamique

Statut : `PLANIFIÉ_SELON_NAR_ACC_006`

Objectif : ouvrir la création runtime sans remplacer le noyau d'intrigue livré
ni introduire une aventure produit préécrite.

Phase A — certification de création :

1. fournir monde, lore, acteurs, complexité et espaces créatifs autorisés ;
2. proposer vérité, causalité, motivations, indices, témoignages et fausse piste ;
3. valider schéma, lore, solvabilité, deux voies indépendantes, réfutation,
   perspectives et secrets ;
4. refuser avant promotion toute intrigue invalide ;
5. committer la vérité et les engagements avant la mise en scène.

Phase B — continuité :

1. exporter une proposition acceptée comme fixture versionnée ;
2. geler vérité, causalité, graphe d'indices et connaissances ;
3. tester découverte, témoignage erroné, hypothèse incorrecte, ellipse,
   évolution hors écran et résolution.

Références :

- [`Contrat-noyau-intrigue-et-revelation-bornee.md`](Contrat-noyau-intrigue-et-revelation-bornee.md) ;
- [`Coherence-intrigues.md`](Coherence-intrigues.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-006`.

### J6 — Exploration locale complète puis voyage

Statut : `PLANIFIÉ_APRÈS_BOUCLE_D_AVENTURE_LOCALE`

Objectif : ne pas retarder la petite aventure locale tout en conservant le
voyage prévu par l'architecture.

Ordre :

1. certifier découverte, création, accès, transition et retour entre plusieurs
   lieux locaux ;
2. contracter puis implémenter `TravelProcess` pour les ancres lointaines ;
3. valider route, segments, durée, ressources, groupe et interruptions ;
4. raccorder les rencontres contextuelles reproductibles sans imposer un
   combat.

Références :

- [`Guide-lieux-connus-crees-et-deplacements.md`](Guide-lieux-connus-crees-et-deplacements.md) ;
- [`Integration-domaines.md`](Integration-domaines.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-010`.

### J7 — Cadrage puis compagnon narratif

Statut : `PLANIFIÉ_NON_AUTORISÉ_AVANT_CONTRAT`

Objectif : faire d'un PNJ durable un compagnon possible sans supprimer sa
volonté propre.

J7 commence obligatoirement par un contrat attribuant :

- la cause de recrutement à mission/relation ;
- l'appartenance et la position du groupe à un propriétaire explicite ;
- les directives et leur acceptation, adaptation, condition ou refus à
  l'autorité du PNJ ;
- les règles de déplacement, séparation, départ et retour ;
- la mémoire, l'initiative et les conséquences à leurs domaines existants.

Le premier vertical est narratif : recrutement autorisé, présence sur plusieurs
scènes, participation bornée, directive refusée ou acceptée, séparation et
reprise. Aucun statut ou schéma technique n'est fixé avant le contrat.

Référence :
[`Guide-pnj-compagnons-et-initiative.md`](Guide-pnj-compagnons-et-initiative.md).

### J8 — Compagnon tactique

Statut : `DIFFÉRÉ_APRÈS_J7`

Objectif : projeter un compagnon narratif validé vers le plateau sans en faire
un personnage d'exemple ou une seconde autorité.

Le lot devra décider contrôle joueur ou autonomie, projection mécanique,
placement, initiative, tour tactique, ressources, blessures, fuite, incapacité
et intégration des conséquences. Les alliés contrôlables restent refusés tant
que `GameBoard` et la graine ne savent pas les représenter complètement.

Références :

- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md) ;
- [`Guide-defense-bastion-et-plateau-tactique.md`](Guide-defense-bastion-et-plateau-tactique.md).

### J9 — Certification de la petite aventure complète

Statut : `GATE_FINALE_PLANIFIÉE`

La certification étend `NAR-ACC-002` et doit prouver :

```text
campagne réelle
→ dialogue multi-PNJ
→ mission ou relation propriétaire
→ intrigue contextuelle validée
→ découverte et revisite de lieux
→ inventaire oral atomique
→ indices, conséquences et évolution hors écran
→ résolution
→ ellipse, sauvegarde et reprise
```

Le compagnon narratif rejoint cette gate après J7 ; le compagnon tactique reste
une extension après J8. Leur absence ne doit pas bloquer la première fermeture
de la petite aventure solo.

## Hors périmètre tant qu'aucun lot ne les ouvre

- mutation d'inventaire générique par le texte ou par l'IA ;
- commerce sans transaction de monnaie propriétaire ;
- génération d'intrigue promue sans validation locale ;
- quête préécrite imposée pour faire passer `NAR-ACC-002` ;
- voyage lointain simulé uniquement par prose ;
- compagnon créé par une promesse prononcée ;
- allié injecté dans `GameBoard` sans projection et règles complètes ;
- combat générique créé uniquement pour satisfaire une gate ;
- vérité, relation ou succès durable décidés par le writer ou le performer.

## Méthode obligatoire pour chaque lot

1. vérifier `git status` et préserver le travail local ;
2. relire ce document, `TASKS.md` et le contrat concerné ;
3. écrire ou ajuster le contrat avant de changer l'architecture ;
4. nommer le domaine propriétaire de chaque décision ;
5. partir d'un comportement joueur et de cas de refus, pas d'une phrase clé ;
6. préparer les effets hors transaction, puis committer atomiquement avec une
   identité stable et un rejeu idempotent ;
7. tester autorité, adaptateur, contrôleur, navigateur et reprise selon le
   risque ;
8. lancer les vérifications ciblées, `npm run build` et `git diff --check` ;
9. mettre à jour ce document seulement si l'état ou l'ordre global change ;
10. garder `TASKS.md` court et ne créer aucun commit sans demande explicite.

## Règles documentaires

- Une seule feuille de route active : ce document.
- `TASKS.md` contient uniquement J1, sa prochaine action et les blocages.
- Un contrat décrit un comportement ; il ne replanifie pas les lots suivants.
- Un guide explique l'expérience ; il ne transforme pas `Prévu` en `Disponible`.
- Une passation est un instantané historique daté et n'est jamais une lecture
  obligatoire durable.
- Une matrice ou recette prouve un état à une date donnée ; elle n'autorise pas
  la suite.
- Les détails des lots terminés restent dans les contrats, guides, tests et
  l'historique Git, pas dans une seconde roadmap.
