# État actuel et feuille de route unique du module narration

Date de référence : 2026-08-26

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
- gérer ses objets par une volonté écrite sous l'autorité de l'inventaire ;
- recevoir, suivre et résoudre un parcours de jeu cohérent, guidé par ses
  volontés écrites ;
- voir le monde, les intrigues et les PNJ évoluer sans être leur déclencheur
  unique ;
- créer des relations durables pouvant conduire à un compagnon narratif doté
  d'une volonté propre, puis préparer sa future projection tactique sans
  l'implémenter dans le cycle narration J1 à J9.

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
| Intention libre V2–V6 | `LIVRÉ` | V6 ajoute seulement la demande structurée aux compagnons actifs ; plusieurs commandes génériques restent fermées |
| Dialogue PNJ | `LIVRÉ` | variété de contenu et mémoire sociale longue à étendre |
| Contexte public joueur | `LIVRÉ_V1` | états observables supplémentaires à ajouter seulement par contrat propriétaire |
| Mémoire et témoignages | `LIVRÉ_DANS_PÉRIMÈTRE` | mémoire sociale longue et mensonge volontaire encore fermés |
| Lieux et voyage | `LIVRÉ_J6` | branchement dans la gate complète réservé à J9 |
| Contrôles d'accès | `LIVRÉ` | catalogues concrets encore limités |
| Inventaire par volonté écrite | `LIVRÉ` | gestion, transferts, propriétaires externes et commerce physique certifiés |
| Mission et relation | `LIVRÉ_J4` | variété de missions et évolution sociale longue à étendre avec les futurs contenus |
| Intrigue | `LIVRÉ_J5` | variété des intrigues à étendre avec les futurs contenus |
| Monde vivant | `LIVRÉ_DANS_PÉRIMÈTRE` | raccord campagne et première preuve locale naturelle livrés ; variété de contenu à étendre avec les futurs lots |
| Repos et progression | `LIVRÉ_DANS_PÉRIMÈTRE` | options texte libre volontairement non annoncées |
| Bastion | `LIVRÉ_DANS_PÉRIMÈTRE` | économie de campagne et ordres texte libre absents |
| Tactique | `LIVRÉ_SPÉCIALISÉ` | accès et défense de bastion couverts ; combat générique fermé |
| Compagnon | `LIVRÉ_J7_NARRATIF` | autonomie narrative certifiée ; frontière tactique J8 documentée, projection `GameBoard` différée |

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

La seconde tranche J1 livre l'orchestration commune des réactions automatiques.
L'avance naturelle du monde, les transitions de scène, les segments de repos,
l'intégration tactique et la reprise passent maintenant par cet ordre unique.
Les tests certifient l'ordre, l'interruption et l'absence de second affichage
après rechargement.

La troisième tranche J1 renforce la recette `npc-return-ui`, située hors du
pilote Archives. Elle certifie quatre échanges avec le même PNJ, au moins trois
formulations distinctes, exactement une réponse par intention, la sortie et le
retour entre deux scènes, les arrivées visibles, la mémoire conversationnelle
et sa reprise depuis le stockage navigateur. La saisie est rendue au joueur
après chaque tour. La variation locale utilise la révision conversationnelle
déjà existante et n'ajoute aucun fait ni engagement durable.

La quatrième tranche J1 remplace le signal monde fabriqué de la recette
`world-event-ui` par une vraie heure exécutée par le moteur de simulation déjà
existant. Un signal religieux produit naturellement aux docks est projeté dans
le récit sans révéler la faction ou l'action interne. La demande rejouée et le
rechargement ne créent aucun second affichage. Une campagne sans système de
bastion actif ignore proprement cette branche optionnelle au lieu de bloquer les
autres réactions du monde.

## Feuille de route ordonnée vers un parcours de jeu complet

Un lot futur est `PLANIFIÉ`, mais pas autorisé à l'implémentation tant que les
critères du lot précédent ne sont pas fermés et que son contrat proche n'est pas
écrit.

### J1 — Fermer la consolidation joueur ↔ MJ

Statut : `LIVRÉ`

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

Statut : `LIVRÉ_DANS_PÉRIMÈTRE`

Objectif : utiliser le parcours officiel des Archives comme intégration unique
d'un parcours dirigé par les volontés écrites du joueur, sans créer une quête
préécrite concurrente.

La gate doit relier progressivement entrée, observation, plusieurs PNJ,
intrigue contextuelle, enquête, déplacement, conséquence causale, éventuel
handoff tactique, repos, ellipse et retour.

La fixture fixe les intentions et les oracles. Elle ne fixe pas à l'avance les
noms, la vérité, les indices ou l'adversaire que le générateur doit proposer.

J2 n'annonce pas que les dix-huit échanges de `NAR-ACC-002` sont déjà
jouables. Il ouvre une gate continue dans le build principal, puis y raccorde
uniquement les capacités déjà livrées ou les adaptations de contenu qui
emploient leurs autorités existantes. Les futurs lots étendront cette même
gate ; ils ne créeront pas une seconde aventure de démonstration.

#### Briques vérifiées avant développement

| Partie du parcours | État au début de J2 | Décision J2 |
|---|---|---|
| Fiche, création/reprise de campagne et entrée aux Archives | livré dans le build principal | réutiliser sans nouveau bootstrap |
| Observation libre, question de contexte et question méta sans temps | livré | réunir dans le même parcours navigateur |
| Archiviste, clerc et garde ambiants | produits depuis le profil de présence du lore | dialoguer avec deux acteurs sans imposer de noms |
| Dialogue durable et reprise | livré | vérifier attribution, perspectives distinctes et absence de doublon |
| Accès social propriétaire | moteur livré, contenu concret actuellement certifié hors Archives | ajouter seulement un contrôle des Archives sourcé par leur accès privé ; ne pas créer une nouvelle règle sociale |
| Déplacement Archives ↔ Place des Archives | livré | raccorder aller, retour et temps validé au même fil |
| Simulation du monde et réactions automatiques | livrées | vérifier la continuité ; ne pas inventer un signal local aux Archives |
| Intrigue prévalidée et évolution hors écran | noyau livré dans une preuve séparée | ne pas fabriquer d'intrigue J2 ; attendre la création runtime de J5 |
| Mission/relation naturelle | boucle J4 livrée après ce cadrage | réutiliser sans l'étendre dans J2 |
| Inventaire générique et commerce | livrés | transaction J3 propriétaire |
| Repos et tactique | parcours spécialisés livrés, aucune cause naturelle garantie aux Archives | ne pas forcer leur apparition ; extension ultérieure de la gate |
| Ellipse, rappel tardif et résolution d'aventure | socles séparés seulement | certification progressive, fermeture complète en J9 |

#### Étapes de J2

1. créer une seule gate navigateur `NAR-ACC-002` depuis l'entrée réelle du
   build, avec une campagne persistante et sans écriture directe d'événement
   métier par le test ;
2. y certifier le checkpoint A : création, entrée aux Archives, observation,
   question de contexte, question méta, temps inchangé et reprise ;
3. poursuivre dans la même campagne avec deux PNJ ambiants : paroles attribuées,
   perspectives distinctes, changement d'interlocuteur et restauration ;
4. raccorder l'accès privé des Archives au moteur social existant, avec succès,
   échec ou clarification décidés par ce propriétaire et jamais par la prose ;
5. enchaîner déplacement vers la Place des Archives, avance réelle du temps,
   retour aux Archives et rechargement, sans perdre les acteurs ni doubler les
   réactions ;
6. publier dans la gate les étapes encore fermées comme attentes explicites de
   J3 à J9, sans fixture qui les ferait passer artificiellement.

#### Avancement vérifié

- La gate navigateur `campaign-adventure-j2` part de l'entrée réelle du build
  et crée une campagne sans injecter d'événement métier.
- Le checkpoint A est vert en mode local : entrée aux Archives, observation
  libre des présences, question sur le lieu, question méta, temps inchangé,
  aller-retour par l'écran du monde et reprise après rechargement.
- La gate vérifie qu'un échange restauré n'est pas dupliqué. Elle a aussi borné
  l'ancienne variation de texte de l'Auberge du Seuil à cette seule scène de
  démonstration, afin qu'elle ne remplace plus le texte d'une campagne active.
- L'étape 3 est verte dans la même campagne : le joueur s'adresse d'abord à
  l'archiviste, puis au clerc ; les deux réponses portent le bon interlocuteur,
  restent distinctes et sont restaurées une seule fois après rechargement.
- L'étape 4 est verte : une demande explicite d'accès aux fonds réservés est
  décidée par `SOCIAL_ACCESS_DOMAIN`. L'archiviste exige le mandat de haut rang
  déjà mentionné par le lore ; l'accès reste `CONTROLLED`, aucun jet n'est
  inventé et le temps ne bouge pas. Une simple salutation reste un dialogue
  normal et ne déclenche pas ce contrôle.
- L'étape 5 est verte dans la recette OpenAI ciblée existante : la Place des
  Archives est créée et atteinte une seule fois en 8 secondes, puis le retour
  réutilise localement la route persistée et ramène la campagne aux Archives à
  16 secondes. Le rechargement conserve la scène, le temps et les deux
  transitions sans rappeler `scene_creator`.
- La recette ciblée observe trois appels HTTP 200 dans l'ordre
  `player_intent_interpreter → scene_creator → scene_writer`. Si le writer
  dépasse son budget de sortie, le texte local validé est conservé sans perdre
  le commit de création ou de déplacement.
- Les attentes J3 à J9 restent fermées dans cette gate. J2 ne revendique donc
  toujours pas les dix-huit échanges complets de `NAR-ACC-002`.

J2 est terminé lorsque ce parcours continu passe en mode local déterministe et
dans une recette OpenAI ciblée, sans menu de choix, sans quête préécrite, sans
événement métier injecté par le test et sans régression du build. Cette
fermeture reste une extension partielle de `NAR-ACC-002`, pas la certification
du parcours jouable complet réservé à J9.

Référence : [`Scenarios-acceptation.md`](Scenarios-acceptation.md),
`NAR-ACC-002`.

### J3 — Inventaire par volonté écrite et transaction propriétaire

Statut : `FERMÉ — GESTION, TRANSFERTS ET COMMERCE LIVRÉS`

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

#### Avancement vérifié

- `inventory-transaction/1` relit les exemplaires de `character.state` et
  valide rangement, sortie, équipement et déséquipement sans autorité de l'IA.
- Le contexte d'interprétation projette désormais chaque objet possédé avec
  quantité et état `EQUIPPED`, `DIRECT` ou `STORED`, sans exposer les secrets
  mécaniques ni les inventaires externes.
- Une réussite synchronise dans un seul commit l'inventaire, les emplacements,
  la projection tactique et l'équipement visible de la projection narrative.
- `inventory.external-ownership` conserve les possessions du lieu et des PNJ.
  Déposer puis prendre transfère le même exemplaire sans création narrative.
- La gate continue vérifie pièces d'or ↔ bourse, épée déséquipée puis équipée,
  refus sans mutation, temps inchangé et reprise exacte après rechargement.
- Donner et recevoir relisent le PNJ présent, sa politique durable et
  l'accessibilité de l'exemplaire. Acheter et vendre relisent une offre active,
  le prix du catalogue et les pièces physiques des deux propriétaires.
- Le marchand existant des Halles propose la plume et l'encre à une pièce d'or.
  La transaction est certifiée sans ouvrir artificiellement une route lointaine.

Références :

- [`Contrat-transactions-inventaire-J3.md`](Contrat-transactions-inventaire-J3.md) ;
- [`Contrat-commandes-joueur-domaines-proprietaires.md`](Contrat-commandes-joueur-domaines-proprietaires.md) ;
- [`Contrat-acces-par-inventaire.md`](Contrat-acces-par-inventaire.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-009`.

### J4 — Boucle naturelle mission et relation

Statut : `FERMÉ — BOUCLE PROPRIÉTAIRE ET RESTITUTION NARRATIVE LIVRÉES`

Objectif : raccorder les dialogues au registre mission/relation existant sans
faire d'une réplique une acceptation.

Travail :

1. transformer une demande ou proposition validée en engagement `PROPOSED` ;
2. faire produire au domaine propriétaire `ACCEPTED`, `REFUSED`, `CONDITIONAL`
   ou `UNCERTAIN` ;
3. restituer conditions, promesses et conséquences publiques ;
4. raccorder réussite, échec ou abandon d'une mission ;
5. ouvrir seulement les axes durables déjà définis par le domaine social :
   `trust`, `affinity`, `fear` et `debt`.

Avancement : une demande d'action adressée à un PNJ visible crée un engagement
persistant. La politique propriétaire décide ensuite acceptation, refus,
condition ou hésitation avant que l'IA formule la réplique. Une condition ou
une hésitation peut recevoir une nouvelle décision ; une acceptation ou un
refus reste final. Si l'IA n'est pas disponible ou si sa réponse est rejetée,
un texte local naturel exprime la même décision sans état technique visible.

Réussite, échec et abandon sont enregistrés comme fins durables d'une mission
acceptée. Leurs effets sociaux éventuels passent par l'autorité sociale déjà
existante et uniquement par ses quatre axes. Un nouvel appel identique restaure
le résultat et peut terminer un effet social interrompu sans doubler la mission.

Références :

- [`Contrat-autorite-mission-relation.md`](Contrat-autorite-mission-relation.md) ;
- [`Contrat-etat-social-durable-et-initiative-locale.md`](Contrat-etat-social-durable-et-initiative-locale.md) ;
- [`Integration-domaines.md`](Integration-domaines.md).

### J5 — Création et suivi d'intrigue dynamique

Statut : `LIVRÉ`

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

Avancement : `plot-candidate/1` fournit désormais à l'IA le contexte public
autorisé du monde, du lore, des acteurs et de la scène. Une proposition sans
deux pistes indépendantes, utilisant un acteur inconnu, formant une causalité
circulaire ou révélant sa vérité dans un signe public est refusée avant commit.
Une proposition valide est promue par `plot-registry/1`, sans second moteur.
Les causalités, perspectives d'acteur et détails de pistes sont conservés ; une
piste réellement révélée devient une découverte sans modifier la vérité.

Cette création est maintenant déclenchable dans le build OpenAI uniquement par
une recherche écrite et approfondie du joueur. Une observation rapide ne crée
rien ; une intrigue active empêche une seconde création et une panne de l'IA
laisse la campagne sans nouvelle intrigue plutôt que charger une aventure
locale préécrite. Une proposition acceptée est maintenant gelée dans une
fixture versionnée. La preuve ciblée conserve une hypothèse incorrecte sans
changer la vérité, révèle un témoignage erroné, maintient une voie de
réfutation et fait évoluer l'intrigue hors écran. Le PNJ ne reçoit que sa propre
perspective : le clerc peut croire que le registre a été mal rangé sans
apprendre que cette croyance est fausse ni accéder au savoir de l'archiviste.
Lorsqu'une proposition est acceptée, le premier signe immédiatement accessible
est restitué dans le même tour de recherche, sans exposer le commit ni la
vérité cachée.

Chaque acteur causal possède maintenant une motivation sourcée et liée à ses
propres étapes. Un contrôle sémantique séparé refuse avant promotion une
motivation contradictoire, sans rapport avec l'action ou fondée sur un savoir
que l'acteur ne possède pas.

La fixture déroule dix échanges narratifs : recherche, deux pistes
indépendantes, témoignage, fausse hypothèse, ellipse, évolution hors écran,
réfutation puis conclusion. `plot-resolution/1` ne ferme l'intrigue qu'après le
contrôle sémantique de la conclusion et la vérification locale des découvertes.
La fausse hypothèse devient réfutée, la conclusion devient soutenue et la
vérité cachée reste stable pendant tout le parcours.

Références :

- [`Contrat-noyau-intrigue-et-revelation-bornee.md`](Contrat-noyau-intrigue-et-revelation-bornee.md) ;
- [`Contrat-generation-intrigue-J5.md`](Contrat-generation-intrigue-J5.md) ;
- [`Coherence-intrigues.md`](Coherence-intrigues.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-006`.

### J6 — Exploration locale complète puis voyage

Statut : `FERMÉ — EXPLORATION ET VOYAGE DE CAMPAGNE LIVRÉS`

Objectif : ne pas retarder le parcours de jeu local tout en conservant le voyage
prévu par l'architecture.

Ordre :

1. certifier découverte, création, accès, transition et retour entre plusieurs
   lieux locaux ;
2. contracter puis implémenter `TravelProcess` pour les ancres lointaines ;
3. valider route, segments, durée, ressources, groupe et interruptions ;
4. raccorder les rencontres contextuelles reproductibles sans imposer un
   combat.

Avancement : la première preuve locale réutilise les autorités existantes et
couvre trois lieux, un passage contrôlé, quatre transitions, le retour au lieu
initial et un rejeu stable. La création de lieu reste celle déjà validée par le
contrat de création atomique ; J6 n'ajoute aucun second registre.

Le premier raccord lointain transforme désormais un catalogue de routes du
monde en `TravelProcess`. Il choisit le trajet valide le plus court pour le mode
demandé, refuse les routes ou modes absents et corrige la position conservée
entre deux étapes.

Le raccord campagne persiste désormais le départ puis relit avant chaque segment
la position, la photographie versionnée du groupe et les ressources fournies par
l'inventaire. L'horloge, le checkpoint, la position et la consommation préparée
par le propriétaire sont réunis dans un seul commit. Le calcul cumulé empêche le
découpage d'un trajet de doubler les provisions. Une frontière mondiale, une
interruption ou une rencontre arrête le segment ; une rencontre conserve les
approches du joueur et n'impose aucun combat. Un processus planifié, actif ou
interrompu peut être restauré sans recalculer sa décision.

Références :

- [`Guide-lieux-connus-crees-et-deplacements.md`](Guide-lieux-connus-crees-et-deplacements.md) ;
- [`Contrat-voyage-campagne-J6.md`](Contrat-voyage-campagne-J6.md) ;
- [`Integration-domaines.md`](Integration-domaines.md) ;
- [`Scenarios-acceptation.md`](Scenarios-acceptation.md), `NAR-ACC-010`.

### J7 — Cadrage puis compagnon narratif

Statut : `FERMÉ — COMPAGNON NARRATIF CERTIFIÉ`

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

Le contrat J7 attribue désormais la cause au registre mission/relation,
l'identité durable au registre de PNJ, la volonté et l'initiative au domaine
social, et la seule appartenance au groupe à `companion.party-registry`. Il
interdit toute projection tactique et toute réussite d'action déduite d'une
directive acceptée.

Le noyau `companion.party-registry/1` est maintenant livré. Il vérifie
l'engagement accepté et le même PNJ de campagne avant recrutement, conserve une
politique d'autonomie sourcée, décide acceptation, adaptation, condition ou
refus, et sépare toujours décision et réussite d'action. Les membres actifs sont
projetables dans plusieurs scènes et forment la photographie versionnée lue par
le voyage J6. Séparation, réunion, départ définitif et rejeu sont persistants.
Le contrat `ai-intent-semantic/6` reçoit uniquement les références des
compagnons actifs de la scène et classe la demande libre sans mots-clés métier.
La décision est persistée dans le même tour narratif, puis le `npc_performer`
l'incarne sans pouvoir la changer ni annoncer une réussite. Le fallback reste
narratif si la sortie IA est indisponible. Une recette navigateur certifie
acceptation, refus et restauration après rechargement. Une préoccupation
sociale persistée certifie aussi l'initiative bornée du compagnon, avec les
mêmes délais, cibles présentes et possibilité `CALM` que les autres PNJ.

Référence :
[`Contrat-compagnon-narratif-J7.md`](Contrat-compagnon-narratif-J7.md),
[`Guide-pnj-compagnons-et-initiative.md`](Guide-pnj-compagnons-et-initiative.md).

### J8 — Compagnon tactique

Statut : `FERMÉ — FRONTIÈRE VALIDÉE, AUCUN CODE GAMEBOARD`

Objectif : figer la frontière qui permettra plus tard de projeter un compagnon
narratif validé vers le plateau, sans ouvrir maintenant la refonte tactique.

Décision propriétaire : un compagnon est autonome par défaut. Le joueur ne peut
le contrôler directement que si une capacité mécanique autoritaire réellement
active — par exemple un effet magique valide — produit ce droit, sa durée et ses
limites. Une relation, une directive acceptée ou une phrase de l'IA ne créent
jamais ce contrôle.

J8 attribue projection, autonomie, carte, placement, initiative, tour,
ressources, blessures, fuite, incapacité et retour narratif à leurs futurs
propriétaires. Il maintient le refus actuel des alliés dans `GameBoard` et
publie le guide de reprise tactique. Le cadrage propriétaire a été validé le
2026-08-24 et J8 est fermé sans implémentation d'un compagnon tactique.

Références :

- [`Contrat-frontiere-compagnon-tactique-J8.md`](Contrat-frontiere-compagnon-tactique-J8.md) ;
- [`Guide-reprise-future-module-tactique.md`](Guide-reprise-future-module-tactique.md) ;
- [`Contrat-handoffs-tactique-repos.md`](Contrat-handoffs-tactique-repos.md) ;
- [`Guide-defense-bastion-et-plateau-tactique.md`](Guide-defense-bastion-et-plateau-tactique.md).

### J9 — Certification du parcours narratif complet

Statut : `J9-A/J9-B/J9-C/J9-D FERMÉS — CYCLE J1 À J9 TERMINÉ`

J9 ferme le cycle narration J1 à J9. Il compose dans une même campagne réelle
les capacités déjà livrées, sans élargir le moteur tactique :

```text
campagne réelle
→ dialogue multi-PNJ
→ mission ou relation propriétaire
→ recrutement d'un compagnon narratif et décision autonome
→ intrigue contextuelle validée
→ découverte et revisite de lieux
→ inventaire par volonté écrite, avec transaction atomique
→ voyage avec photographie versionnée du groupe
→ indices, conséquences et évolution hors écran
→ résolution
→ ellipse, sauvegarde et reprise
```

Plan de reprise J9 :

1. composer une gate déterministe unique depuis l'entrée réelle du build ;
2. réutiliser les autorités et catalogues J1 à J7 sans événement métier
   artificiel destiné à forcer le scénario ;
3. prouver recrutement, directive acceptée ou adaptée, déplacement du groupe,
   inventaire, mission, intrigue, temps, reprise et absence de doublon ;
4. conserver les handoffs tactiques spécialisés déjà certifiés comme preuves
   séparées, sans imposer un combat ni un compagnon tactique à la gate ;
5. exécuter une recette OpenAI ciblée uniquement après passage local et accord
   sur la dépense ;
6. publier la matrice finale J9, mettre à jour l'état global et fermer J1 à J9.

J9-A est fermé par
[`Matrice-certification-finale-narration-J9.md`](Matrice-certification-finale-narration-J9.md).
Les trois raccords fonctionnels identifiés sont désormais livrés : départ et
arrivée J6 depuis le contrôleur réel, recrutement J7 issu d'une confirmation J4,
et génération J5 locale par un fournisseur déterministe passant par les ports et
autorités normaux. La preuve `j9b-continuous` les compose dans une même campagne
et rejoue leurs requêtes après l'arrivée. `j9b-full-local` ferme ensuite J9-B
depuis le bootstrap installé : deux PNJ, inventaire personnel et externe,
acceptation puis refus autonome, intrigue créée, découverte, hypothèse, évolution
et résolution, voyage, reconstruction globale et rejeux stables. La gate
`j9c-browser` ferme J9-C dans Chromium : création par l'interface réelle,
dialogues et inventaire depuis la saisie UI, composition J4–J7 par le contrôleur
installé sur la même base IndexedDB, arrivée aux Halles, rechargements,
inspection des autorités durables et rejeux critiques sans doublon. Le pilote
déterministe reste une dépendance de test et aucune fixture n'entre en production.

J9-D est fermé le 2026-08-24 après accord explicite. La gate
`narrative-pipeline-roles:openai-live` a exécuté cinq familles de tours et treize
appels réels, tous en HTTP 200. Aucun tour n'a dépassé trois appels, aucun rôle
n'a été dupliqué et leur ordre canonique a été respecté. La clé est restée côté
serveur. Le cycle J1 à J9 est terminé dans son périmètre narratif.

Tout prochain développement exige maintenant l'ouverture explicite d'un nouveau
lot. La reprise tactique reste régie par le guide J8 et commence par le cadrage
de la carte, du placement multi-acteurs et des responsabilités, sans modifier
opportunément `GameBoard`.

### J10 — Intégration narrative immersive

Statut : `J10-A À J10-I FERMÉS — J10-J OUVERT`

J10 rend la verticale J1 à J9 entièrement
pilotable depuis la saisie narrative sans carte de voyage, panneau de commande
du groupe, jauge relationnelle ou popup de quête. Le moteur de voyage, les
autorités du groupe, les missions, les intrigues et l'inventaire restent actifs
sous la surface : la prose ne remplace jamais leurs commits.

Le lot ajoute également un carnet multi-intercalaires strictement privé au
joueur, un inventaire compact en lecture seule et un récapitulatif de reprise
composé uniquement depuis les connaissances et engagements publics. Les traces
techniques sont masquées par défaut mais restent accessibles en mode
développeur. L'ordre, les refus et les critères complets sont définis dans
[`Plan-integration-narrative-immersive-J10.md`](Plan-integration-narrative-immersive-J10.md).

J10 ne rouvre pas le chantier tactique J8. J10-A est fermé par les trois
contrats J10, l'audit des projections, des huit sorties IA et des traces UI,
l'exclusion explicite du carnet dans `PlayerPublicContextV1` et la commande
`narration-module:test:j10a-boundaries`. Aucun composant React ou schéma
IndexedDB n'a été modifié. J10-B raccorde ensuite le voyage actif à la saisie
libre, ajoute la résolution idempotente de la décision pendante, sa projection
publique et l'interruption installée Archives → Halles. La gate locale
`narration-module:test:j10b-travel` couvre rechargement et rejeux sans second
temps. Aucun composant de carte ou bouton de trajet n'a été ajouté. J10-C
installe ensuite hors tests les politiques de recrutement et d'autonomie,
active le contrat sémantique V7 et certifie refus, recrutement, demande risquée,
séparation, réunion et rejeu depuis le seul dialogue. J10-D ferme ensuite le
carnet privé multi-intercalaires : base IndexedDB dédiée,
port extérieur au `CampaignRepository`, autosauvegarde sérialisée, réouverture,
conflits de révision et canari absent des appels IA et du noyau narratif.
J10-E ferme ensuite les aides-mémoire publiques : cinq projections propriétaires
bornées, un compositeur déterministe, une chronique issue des seuls blocs rendus
et un inventaire personnel compact en lecture seule. Le panneau installé ne
crée aucun stockage, commit, temps de jeu ou appel IA ; les sentinelles de vérité
cachée, pression sociale, autonomie, inventaire tiers et carnet restent absentes.
La gate `narration-module:test:j10e-recap` couvre le contrat et Chromium. J10-F
ferme ensuite la surface immersive : diagnostics et contrôles IA sont cachés par
défaut derrière un mode développeur explicite, les entrées Monde et Tactique ne
sont plus proposées hors handoff réel et la présentation propriétaire du voyage
reste intacte. La gate Chrome
`narration-module:test:j10f-immersive-ui`, pilotée uniquement par l'interface,
couvre une même campagne depuis sa création jusqu'à l'arrivée après interruption
et rechargement, avec carnet, récapitulatif, inventaire et compagnon autonome.
J10-G0 fige ensuite la baseline et les seize consommateurs lexicaux. J10-G1
rend OpenAI obligatoire pour interpréter une saisie réelle : l'interface ne
propose plus de mode lexical, le contrôleur n'en installe plus par défaut et
une panne devient une clarification immersive sans domaine, commit ni temps.
La fixture lexicale ne subsiste que par injection explicite dans les tests.
G2 ouvre désormais le contrat `ai-intent-semantic/8` au-delà des catégories V7 :
statut de compréhension explicite, sens global et composantes ordonnées sans
plafond ni catalogue fermé. Le schéma Structured Outputs, les validations locale
et serveur et l'absence de recanonicalisation sont certifiés par la gate G2.
G3 conserve désormais ce cadre intégral dans `NarrativeIntentInterpretation`.
La projection canonique historique est explicitement non autoritaire pour V8 ;
une clarification reste sans domaine et chaque composante comprise conservait
son statut technique avant le raccordement G5. La gate G3 prouve que deux
textes bruts trompeurs ne changent pas un même cadre fourni par OpenAI, que les
références proposées restent publiques et qu'aucun commit ni temps n'est ouvert.
G4 réunit désormais dans `interpreter-embodied-public-context/1` le profil
joueur explicitement public, les références nommables, les connaissances
acquises, la scène, l'interlocuteur, les focus et intentions récents, les
compagnons présents, les capacités et le processus actif. Pour V8, cet objet
unique remplace les blocs historiques dupliqués et entre dans l'empreinte de
contexte. Les champs sont bornés et les canaris privés sont absents de la
requête. G5 livre désormais `open-semantic-execution-plan/1` : seules les
correspondances exactes entre capacité et domaine publics deviennent routables,
chaque propriétaire prévalide son étape sans recevoir la saisie brute, et tout
arrêt interdit les étapes suivantes tout en conservant les reçus antérieurs.
Les conditions, alternatives et simultanéités sans propriétaire atomique restent
en attente. G6 installe désormais un corpus permanent de 24 cas sur 20 axes,
évalué sur des propriétés sémantiques partielles et non sur des mots attendus.
Son fournisseur OpenAI simulé reste une fixture exacte réservée aux tests ; cinq
cas traversent le contrôleur et cinq traversent Chrome réel sans mutation ni
temps. G7 installe désormais l'adaptateur propriétaire V8 : une unique étape
routable est projetée sans saisie brute vers le domaine exact, tandis que les
compositions sans coordinateur natif restent suspendues sans mutation. L'UI
produit utilise V8 et la surface React/Chrome ainsi que le build complet sont
verts. G8 valide désormais en live le dialogue dépendant du contexte incarné
public complet. La recette a séparé l'action naturelle ouverte du nouvel
`suggestedCapabilityId`, borné aux capacités publiées et seul utilisé par G5.
Les plafonds autorisés de six puis trois appels sont consommés. La seconde
recette a exposé une ellipse sortie de l'échange actif et une condition étendue
à une composante antérieure ; les instructions et le 24e cas local corrigent
ces portées. La contre-recette finale retourne une clarification V8 sûre ; la
fluidité des tours naturels doit maintenant être évaluée dans la vraie UI sans
attendre l'exécution du coordinateur multi-domaines encore absent.

J10-H est ouvert le 2026-08-26 après l'analyse approfondie des premiers tours
manuels G8. Il traite dans cet ordre la baseline de tests, le verrou de
soumission UI, un focus local persistant et borné, la fidélité du cadre V8
jusqu'aux reçus propriétaires, la résilience des rôles OpenAI, l'exactitude des
diagnostics puis la certification transverse. Le focus aide l'interpréteur à
comprendre un pronom ou une ellipse, mais ne décide jamais d'un transfert
d'inventaire, d'un engagement social, d'une vérité d'intrigue, d'un temps de
voyage ou d'un handoff tactique. Les domaines J3 à J8 conservent intégralement
leurs autorités et doivent tous rester verts avant une nouvelle recette live.
Le détail approuvé, les dépendances et la matrice d'impact sont dans
[`Plan-correction-fiabilite-tour-narratif-J10H.md`](Plan-correction-fiabilite-tour-narratif-J10H.md).
J10-H0 à J10-H7 sont fermés : les recettes V8 sont fiables, la soumission UI
est idempotente et `local-interaction-focus/1` conserve explicitement une
attention ou conversation locale après reload. Le focus est public, borné par
scène et sans autorité métier. Le reçu de fidélité distingue désormais le cadre
V8 original de la projection propriétaire, conserve expression brute, cible,
acte, ordre et provenance, sans transmettre le texte brut aux propriétaires.
L'orchestration V8 évite désormais le planner redondant, reste sous trois rôles
ordinaires et n'ouvre un quatrième rôle que pour une création factuelle
explicitement autorisée par le propriétaire,
mesure le paquet performer et conserve un fallback immersif séparé de toute
performance acceptée. Le diagnostic développeur distingue interprétation,
routage, résolution et présentation, attribue les échecs et expose les budgets
et usages réels sans polluer le fil fictionnel. La certification transverse
réunit désormais dialogue, intrigue, mission, compagnon, inventaire, voyage,
repos, monde et tactique ; Chromium, IndexedDB, migrations, rejeux et build sont
verts. La recette OpenAI live finale certifie approche et salutation, focus
pronominal après reload, changement d'interlocuteur et transition propriétaire.
Elle a fermé les derniers écarts de performer, diagnostic, orientation et
doublon de rendu ; les preuves sont dans
[`Checkpoint-recette-OpenAI-live-J10H7.md`](Checkpoint-recette-OpenAI-live-J10H7.md).

J10-I a été ouvert le 2026-08-27 après une recette factuelle avec le garde des
Archives. Il sépare désormais le chantier à conduire en trois décisions : fait
existant ou créable, connaissance normale de l'acteur, puis droit de
divulgation. Le lot doit d'abord acheminer les faits publics déjà présents dans
le lore, puis livrer le cycle `CAMPAIGN_FACT` libre et la création atomique
d'une identité légère lorsqu'un détail public stable manque. Le performer reste
sans autorité de vérité ou de commit. L'ordre I0 à I7, les contrats cibles, les
conditions d'arrêt et la procédure de reprise sont fixés dans
[`Plan-resolution-factuelle-et-connaissances-PNJ-J10I.md`](Plan-resolution-factuelle-et-connaissances-PNJ-J10I.md).
J10-I0 est fermé : la vraie scène des Archives prouve que les références
locales du garde restent visibles sur l'acteur mais ne rejoignent ni ses sources
de parole autorisées ni ses faits connus. Les contrats passifs et le corpus de
quatorze cas sont figés. J10-I1 est également fermé : le besoin d'information
nullable traverse le contrat V8, le schéma serveur, les validateurs, G3, G5, la
commande propriétaire et le reçu de fidélité sans recherche, création ni
nouvelle autorité. J10-I2 est fermé : le catalogue expose les champs publics de gouvernance avec
leur niveau, et un port de lecture borné suit sujet, propriété et relations en
donnant priorité aux projections de campagne. Depuis les Archives il retrouve
le Tharque régent et le Château Tharqual sans dépendre du paquet descriptif.
J10-I3 est fermé : chaque candidat reçoit maintenant un statut acteur fondé sur
`COMMON_WORLD`, `LOCAL_FAMILIARITY`, `ROLE_EXPECTED` ou `ACQUIRED`. La localité
n'est jamais déduite de la simple présence momentanée, les faits acquis restent
issus du registre social propriétaire, et un rôle public n'ouvre pas un fait
restreint. Le reçu I2-I3 conserve la divulgation non résolue. J10-I4 est fermé :
les registres `campaign-fact-registry/1` et `narrative-actor-registry/1`
committent atomiquement une dimension publique manquante et son identité
`LIGHT_REFERENCE`. Cardinalité simple, contradiction, rejeu, remplacement,
invalidation, reconstruction et concurrence sans doublon sont certifiés.
Le correctif d'intégration I4 raccorde aussi le registre au lookup ciblé,
valide ses ancres contre le catalogue wiki, respecte les snapshots de révision
et prouve fermeture/réouverture IndexedDB dans Chromium. Le contrat transverse
`Contrat-integration-autorite-persistante-et-catalogues.md` rend cette chaîne
obligatoire pour les prochains propriétaires. J10-I5 est fermé : la projection
`npc-information-disclosure/1` distingue fait public, croyance, incertitude,
secret propriétaire, ignorance et orientation exacte. Elle ne transporte
aucune valeur ni preuve privée pour un secret retenu, et une limite de rôle ne
peut plus produire un refus générique. J10-I6 est fermé : le runtime produit
compose lookup campagne/lore, connaissance et divulgation avant de transmettre
au performer les seuls faits autorisés. Le même paquet alimente un fallback
factuel, la parole visible reste un témoignage attribué sans vérité objective et
le diagnostic développeur expose les trois étapes sans valeur privée. J10-I7
ferme le lot le 2026-08-31 : la matrice lore/campagne/rôle/rumeur/secret,
création et remplacement passe dans le contrôleur réel, IndexedDB et ses
migrations, puis dans la vraie surface Chromium des Archives avec restauration
du fil. Les propriétaires J3 à J10-H et le build global restent verts, sans
appel OpenAI live. La preuve finale est dans
[`Checkpoint-certification-resolution-factuelle-J10I7.md`](Checkpoint-certification-resolution-factuelle-J10I7.md).

J10-J est ouvert le 2026-08-31 après le premier test naturel post-I7. Il traite
les prémisses institutionnelles approximatives, les réponses partiellement
connues, la création effective d'une identité publique manquante et l'acte
directeur des dialogues composés. Toute reconnaissance locale par mots ou
synonymes est interdite. J10-J0 est fermé : `information-need/2` transporte les
portées, propriétés, relations et dimensions de complétude sous forme de
références canoniques ouvertes ; les portées non publiques sont rejetées et la
gate anti-dette lexicale reste stable. J10-J1 est également fermé : les
relations et propriétés ouvertes sont déclarées dans le lore, publiées sans
leurs valeurs dans un catalogue V8 borné, revalidées avant G5 puis parcourues
exactement par le lookup. Sa dette lexicale historique tombe à zéro. J10-J2 est
également fermé : `answerCoverage` transporte les faits autorisés et les
propriétés publiques manquantes jusqu'au performer et au fallback, qui ne
convertit plus une réponse partielle en ignorance globale. J10-J3 est fermé :
une politique de lore explicite autorise une proposition créative sans commit,
puis le propriétaire `CAMPAIGN_FACT` intègre atomiquement valeur et identité au
commit du tour, sans opération imbriquée ni relâchement du verrou. Les besoins
factuels compris exigent désormais des sélecteurs exploitables, la verticale
réelle « Qui est le roi ? », le quatrième rôle seulement conditionnel, deux PNJ,
concurrence, replay, IndexedDB et reload sont couverts. J10-J4
ouvre l'acte directeur composé. Le plan et l'ordre des corrections sont fixés dans
[`Plan-correction-resolution-institutionnelle-J10J.md`](Plan-correction-resolution-institutionnelle-J10J.md).

Le compagnon tactique, la génération de carte et le placement multi-acteurs
appartiennent au futur chantier tactique décrit par le guide J8. Leur absence ne
bloque pas la fermeture narrative J9.

J9 ne prétend donc pas fermer seul l'intégralité historique de `NAR-ACC-002`,
dont le checkpoint C exige un combat continu dans le même scénario. Sa matrice
finale distingue explicitement la verticale narrative continue J1 à J7 de la
preuve tactique spécialisée déjà certifiée. La réunion de ces deux preuves dans
un unique parcours avec compagnon actif appartient à la reprise tactique future.

## Hors périmètre tant qu'aucun lot ne les ouvre

- mutation d'inventaire générique par le texte ou par l'IA ;
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
- `TASKS.md` contient uniquement le lot actif, sa prochaine action et les
  blocages.
- Un contrat décrit un comportement ; il ne replanifie pas les lots suivants.
- Un guide explique l'expérience ; il ne transforme pas `Prévu` en `Disponible`.
- Une passation est un instantané historique daté et n'est jamais une lecture
  obligatoire durable.
- Une matrice ou recette prouve un état à une date donnée ; elle n'autorise pas
  la suite.
- Les détails des lots terminés restent dans les contrats, guides, tests et
  l'historique Git, pas dans une seconde roadmap.
