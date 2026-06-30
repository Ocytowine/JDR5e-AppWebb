# Créations dynamiques de l'IA

Dernière mise à jour : `2026-06-30`

Statut : `RETENU` — cycle, règles par type, doublons et corrections validés; schémas techniques reportés aux contrats d'implémentation.

## Objectif

Permettre à l'IA de créer librement des éléments adaptés à la campagne, sans transformer une improvisation en vérité persistante non validée ni saturer la sauvegarde avec chaque détail d'ambiance.

## Deux axes distincts

### État de validation

```text
proposition
→ validation
→ commit ou rejet
```

- `proposition` : contenu structuré sans autorité;
- `validation` : contrôles par les domaines concernés;
- `commit` : création devenue vraie avec identité et provenance;
- `rejet` : aucun effet ni affichage de la version incohérente.

### Profondeur de persistance

```text
éphémère de scène
→ référence persistante légère
→ entité persistante complète
→ archive
```

- `éphémère` : utile seulement dans la scène et sans conséquence durable;
- `référence légère` : identité, première apparition, lieu et faits déjà établis;
- `entité complète` : profil, motivations, relations, connaissances et évolution;
- `archive` : conservée pour historique et rappel ciblé, absente du contexte ordinaire.

Validation et profondeur ne sont pas la même chose. Une référence légère doit être validée; une entité complète peut être enrichie par plusieurs commits successifs.

## Promotion automatique et transparente

La promotion ne demande aucune confirmation technique au joueur. Elle est proposée par l'IA, validée avant affichage durable et tracée en mode développement.

Une création est promue lorsqu'elle :

- reçoit une identité utile à conserver;
- fait l'objet d'une interaction significative;
- porte une relation, connaissance, secret ou objectif;
- influence une règle, ressource ou conséquence;
- doit pouvoir réapparaître;
- devient importante pour le joueur;
- constitue un engagement causal, probatoire ou préparatoire d'une intrigue.

Le dernier critère impose une persistance immédiate même si le joueur n'a pas remarqué le détail.

## Contrat commun d'une proposition

Toute création candidate porte au minimum :

- identifiant de proposition et tour causal;
- type de création;
- profondeur de persistance demandée;
- raison de création;
- ancres de lieu, acteurs, factions ou fils;
- propriétés structurées proposées;
- faits existants utilisés;
- relations avec des entités existantes;
- portée et effets attendus;
- niveau de visibilité;
- engagements narratifs éventuels;
- domaines devant valider.

Le texte destiné au joueur est produit seulement après validation et commit des propriétés durables.

## Contrôles communs

- compatibilité avec le canon épinglé et les faits de campagne;
- existence et disponibilité des ancres;
- cohérence temporelle et géographique;
- droits de création de l'IA pour le tour;
- absence de doublon pertinent;
- compatibilité mécanique;
- provenance suffisante;
- budget de persistance et profondeur proportionnée;
- absence de fuite d'un secret;
- compatibilité avec les engagements d'intrigue.

## PNJ

### Minimum à la création

- raison crédible de présence;
- rôle local;
- identité visible ou désignation stable;
- connaissances compatibles avec son vécu;
- motivation immédiate;
- ancrage de lieu et de temps.

Un figurant non sollicité peut rester éphémère. Une interaction courte peut créer une référence légère. Relation, objectif, secret, effet mécanique ou possibilité de retour justifient un profil complet.

L'IA ne produit pas une biographie exhaustive sans besoin : elle verrouillerait inutilement des espaces de création futurs et augmenterait le contexte.

## Événement

Un événement durable possède :

- cause;
- acteurs ou source;
- lieu et moment;
- portée;
- conséquences possibles;
- signaux perceptibles;
- domaine chargé de valider les effets.

Un événement ne devient pas vrai seulement parce qu'il serait dramatique. Il doit pouvoir être causé par l'état courant, une action, une simulation ou une création validée.

Une ambiance sans conséquence reste éphémère. Blocage, déplacement, dommage, rumeur, avance temporelle ou changement d'acteur imposent un événement persistant.

## Objet

Tout objet interactif possède :

- identité stable;
- type;
- propriétaire ou absence de propriétaire;
- emplacement;
- état;
- fonction connue ou explicitement inconnue;
- définition mécanique référencée ou candidate séparée.

La fonction d'un objet ne peut pas être inventée rétroactivement pour résoudre une situation. Prise, transfert, consommation ou destruction passent par `InventoryRules` et les agrégats propriétaires.

## Mission, intrigue et fil narratif

Toute création porte :

- origine;
- acteurs et ancres;
- enjeu;
- vérité centrale lorsqu'elle est nécessaire;
- évolution possible;
- conséquence d'ignorance;
- engagements initiaux;
- voies de progression cohérentes.

Une mission ou intrigue ne contient pas un script imposant la résolution. Les exigences supplémentaires de causalité, solvabilité et fausses pistes sont définies dans [`Coherence-intrigues.md`](Coherence-intrigues.md).

## Lieux canoniques et lieux de campagne

### Origine

- `canonical` : lieu fourni par le wiki et le contenu épinglé;
- `campaign_generated` : extension validée propre à la campagne.

Une création IA ne modifie jamais le fichier wiki. Les deux origines rejoignent un registre effectif commun de lieux de campagne.

### Autorité

- `ContentDomain` fournit les définitions canoniques initiales;
- `WorldDomain` possède le registre effectif, les relations géographiques et l'état courant;
- l'IA propose les extensions;
- `CampaignFactDomain` porte les faits narratifs durables non modélisés structurellement;
- `SceneDomain` projette le lieu actif sans le posséder.

### Modèle commun minimal

- identifiant et provenance;
- territoire, région, ville et quartier parents;
- type, fonction, taille et importance;
- propriétaire et contrôle politique éventuels;
- population ou clientèle probable;
- accès et sécurité;
- profil architectural, visuel et sonore;
- langues et pratiques sociales;
- connexions avec d'autres lieux;
- état courant;
- date ou mode d'existence.

## Héritage du profil local

Le profil génératif suit la hiérarchie :

```text
monde → territoire → région → ville → quartier → lieu
```

Chaque niveau fournit :

### Invariants

Géographie, gouvernance, factions dominantes, bâtiments canoniques, événements établis et contraintes topologiques. Une création ne peut pas les contredire.

### Normes pondérées

Espèces, métiers, langues, matériaux, richesse, sécurité, pratiques culturelles et types de lieux fréquents. Une exception reste possible si elle possède une justification structurée.

### Variations libres

Nom, propriétaire local, agencement intérieur, histoire mineure, clientèle présente, détails visuels et tensions compatibles.

Ce modèle contraint la cohérence sans transformer la ville en catalogue fermé.

## Mode d'existence d'un lieu généré

- `preexisting_undiscovered` : existait déjà mais n'avait pas été évoqué;
- `newly_established` : vient d'être construit ou ouvert par une cause et une durée validées;
- `temporary` : marché, campement, chantier ou installation provisoire;
- `hidden` : existait mais n'était pas publiquement connu.

Un lieu n'apparaît pas physiquement au moment où une intrigue en a besoin sans mode d'existence et causalité compatibles.

## Flux de création d'un lieu

1. Identifier le besoin narratif ou systémique.
2. Chercher un lieu existant pouvant remplir naturellement le rôle.
3. Choisir ville, quartier et ancrage topologique.
4. Construire le profil local hérité.
5. Faire proposer le lieu structuré par l'IA.
6. Vérifier invariants, normes, densité, doublons et connexions.
7. Valider son mode d'existence.
8. Attribuer une identité et committer le registre effectif.
9. Mettre en scène uniquement la version validée.

## Densité et réutilisation

Le registre suit les lieux existants, fonctions disponibles, densité estimée, doublons, espaces encore indéterminés et possibilités de réutilisation.

Créer un nouveau lieu n'est pas la réponse par défaut. Un lieu existant est préféré lorsqu'il remplit le besoin sans contradiction. Cette règle évite une prolifération de tavernes, temples, boutiques ou passages secrets et renforce la continuité vécue.

## Importance pour les intrigues

Tout lieu, pièce, accès, objet ou détail servant de preuve, d'alibi, de moyen, de contrainte ou de préparation devient un engagement narratif immédiatement persistant.

Sa structure ne peut plus être modifiée silencieusement après exposition ou utilisation. Les espaces encore indéterminés restent libres tant qu'aucun engagement ne les contraint.

## Archivage

Archiver une création réduit sa présence dans le contexte ordinaire sans la supprimer. Son identité, ses faits historiques, ses engagements et ses liens restent disponibles pour rappel, audit ou réactivation.

## Détection des doublons

La recherche de doublon précède toute création persistante. Elle combine :

1. identifiants et références exactes;
2. ancres structurées : parent, lieu, temps, rôle, propriétaire, connexions;
3. noms, alias et propriétés discriminantes;
4. recherche textuelle ou sémantique pour découvrir des candidats supplémentaires.

La similarité ne prouve jamais une identité. Elle produit seulement une liste de candidats à vérifier.

### Décisions possibles

- `reuse` : l'identité existante est certaine et répond au besoin;
- `enrich` : l'entité existe et reçoit de nouvelles propriétés compatibles;
- `create_distinct` : la différence est justifiée et une nouvelle identité est créée;
- `possible_same_as` : l'identité reste incertaine et aucune fusion n'est effectuée;
- `reject` : la proposition duplique ou contredit une entité sans justification.

Une relation `possible_same_as` est un diagnostic ou une incertitude structurée. Elle ne permet pas de mélanger connaissances, relations, inventaires ou événements des deux entités.

## Signaux de doublon par type

| Type | Signaux forts | Signaux insuffisants seuls | Action prudente |
|---|---|---|---|
| PNJ | identifiant, même rôle unique, même présence et historique | même nom, espèce ou profession | comparer ancres et vécu; ne jamais fusionner sur le nom |
| Lieu | même parent, lot ou position, fonction unique, connexions | nom proche ou même catégorie | réutiliser si identité certaine; sinon justifier un lieu distinct |
| Objet | identifiant d'instance, propriétaire, historique de transfert | même définition de catalogue | plusieurs instances restent distinctes |
| Événement | même cause, temps, acteurs et signature métier | même type ou même lieu | relier des événements connexes sans les fusionner |
| Fil narratif | même vérité centrale, mêmes ancres et causalité | thème ou faction commune | relier ou fusionner seulement après validation du graphe |
| Fait | même propriété, sujet et intervalle de validité | formulation textuelle proche | remplacer, confirmer ou signaler une contradiction |

## Correction avant commit

Une proposition partiellement invalide est corrigée au niveau le plus local possible :

1. le validateur retourne des erreurs structurées avec chemins et raisons;
2. les champs valides restent préparés mais non committés;
3. l'IA reçoit uniquement le contexte nécessaire et les champs à corriger;
4. l'ensemble complet est revalidé;
5. aucun texte joueur n'est publié avant succès.

Le MVP autorise par défaut deux tentatives de correction ciblée, valeur configurable pour les tests. Après épuisement :

- une création facultative est abandonnée ou remplacée par une formulation neutre;
- une création indispensable provoque une clarification, un fallback sûr ou l'échec explicite du tour;
- aucune version incohérente n'est committée ou affichée.

Une correction ne peut pas changer silencieusement l'intention principale de la proposition. Un changement de nature exige une nouvelle proposition.

## Correction après commit

Une erreur découverte après commit n'est jamais réparée par modification silencieuse ni masquée automatiquement comme un retournement narratif.

- un fait erroné est invalidé ou remplacé par une opération tracée;
- un doublon persistant est marqué puis réconcilié explicitement;
- une fusion validée choisit une identité canonique de campagne, migre atomiquement les références et conserve les anciens identifiants comme alias historiques;
- les événements originaux restent dans le journal;
- les engagements d'intrigue sont réaudités avant toute réconciliation.

Les outils de diagnostic distinguent erreur technique, mensonge volontaire, croyance erronée et contradiction narrative réelle.

## Matrice de validation par type

| Type | Autorité principale | Validations indispensables | Promotion complète | Événements principaux |
|---|---|---|---|---|
| PNJ | `NarrativeActorDomain` | présence, rôle, connaissances, doublon, compatibilité locale | relation, secret, objectif, mécanique ou retour probable | `npc_promoted`, `npc_profile_changed`, `npc_archived` |
| Événement local | domaine concerné + `CampaignFactDomain` | cause, temps, lieu, acteurs, portée et effets | toute conséquence durable | événement métier et faits produits |
| Événement monde | `WorldDomain` | causalité simulation, temps, cibles et deltas | dès validation | `WorldEvent` versionné |
| Lieu | `WorldDomain` | parent, topologie, profil local, densité, fonction et existence | interaction durable ou engagement | `place_created`, `place_changed`, `place_archived` |
| Objet | agrégat propriétaire + `InventoryRules` | définition, instance, propriétaire, emplacement et effet | dès interaction ou fonction narrative | acquisition, transfert, consommation, destruction |
| Fil narratif | `SceneDomain` / agrégat narratif | origine, ancres, causalité, engagements et solvabilité | dès création validée | création, progression, résolution, abandon |
| Fait | domaine propriétaire / `CampaignFactDomain` | sujet, propriété, validité, provenance et conflit | dès commit | assertion, remplacement, invalidation |

## Préservation de la créativité

Les validateurs contrôlent les invariants, droits et contradictions. Ils ne choisissent pas les noms, dialogues, ambiances, complications ou solutions à la place de l'IA.

Les normes locales restent pondérées et permettent des exceptions justifiées. Les espaces non engagés restent ouverts. La réutilisation d'une entité existante n'impose pas une scène préécrite : elle fournit un ancrage cohérent à une création nouvelle.

## Audit de l'atelier

- Chaque type du scénario MVP possède un contrat conceptuel minimal.
- Validation et profondeur de persistance sont séparées.
- Les promotions vécues et causales sont définies.
- Les lieux canoniques et générés partagent un registre cohérent.
- Les intrigues verrouillent leurs engagements sans verrouiller leurs scènes.
- Les doublons ne sont jamais fusionnés sur simple similarité.
- Les corrections ciblées précèdent l'affichage.
- Les réparations après commit conservent l'historique.
- Les validateurs préservent les espaces de créativité non contraints.

## Points reportés aux contrats et budgets

- budgets de créations légères et complètes;
- schémas exacts des propositions par type;
- seuils chiffrés de densité et de similarité;
- coût maximal des corrections IA;
- interface de diagnostic et de réconciliation.
