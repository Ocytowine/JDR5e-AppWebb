# Plan de résolution factuelle et de connaissances PNJ J10-I

Statut : `FERMÉ — J10-I0 À J10-I7 CERTIFIÉS`

Date d'ouverture : 2026-08-27

Autorité : ce document détaille le lot J10-I ouvert dans
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).
La consolidation reste l'unique feuille de route globale. `TASKS.md` porte
uniquement le sous-lot actif et la prochaine action concrète.

## État d'exécution

| Sous-lot | État | Preuve ou prochaine action |
|---|---|---|
| J10-I0 | `FERMÉ` | [`Checkpoint-baseline-resolution-factuelle-J10I0.md`](Checkpoint-baseline-resolution-factuelle-J10I0.md) |
| J10-I1 | `FERMÉ` | [`Checkpoint-besoin-information-V8-J10I1.md`](Checkpoint-besoin-information-V8-J10I1.md) |
| J10-I2 | `FERMÉ` | [`Checkpoint-recherche-factuelle-ciblee-J10I2.md`](Checkpoint-recherche-factuelle-ciblee-J10I2.md) |
| J10-I3 | `FERMÉ` | [`Checkpoint-connaissance-contextuelle-PNJ-J10I3.md`](Checkpoint-connaissance-contextuelle-PNJ-J10I3.md) |
| J10-I4 | `FERMÉ` | [`Checkpoint-faits-libres-identites-J10I4.md`](Checkpoint-faits-libres-identites-J10I4.md) |
| J10-I5 | `FERMÉ` | [`Checkpoint-divulgation-information-PNJ-J10I5.md`](Checkpoint-divulgation-information-PNJ-J10I5.md) |
| J10-I6 | `FERMÉ` | [`Checkpoint-performance-information-PNJ-J10I6.md`](Checkpoint-performance-information-PNJ-J10I6.md) |
| J10-I7 | `FERMÉ` | [`Checkpoint-certification-resolution-factuelle-J10I7.md`](Checkpoint-certification-resolution-factuelle-J10I7.md) |

## Motif d'ouverture

Une recette manuelle aux Archives de Lysenthe a montré qu'un garde local refuse
de répondre à la question « qui dirige la ville ? ». Ce refus n'est pas une
limite crédible du personnage : le lore établit déjà que Lysenthe est un ducat,
que le pouvoir local siège au Château Tharqual et qu'il appartient au Tharque
régent de Lysenthe. Seul le nom personnel du titulaire manque.

Le défaut ne vient pas de l'interprétation V8 ni du routage social. Il apparaît
entre la commande de dialogue acceptée et le `npc_performer` :

1. le paquet de lore précompilé est conçu pour guider une scène ou un lieu, pas
   pour répondre à une question factuelle ciblée ;
2. les références de connaissances portées par une présence ambiante ne sont
   pas intégrées à la connaissance autorisée du performer ;
3. le registre personnel d'un PNJ ne projette pas les connaissances communes,
   locales ou normalement liées à son métier ;
4. le performer ne peut utiliser que les faits explicitement fournis ;
5. `CAMPAIGN_FACT` existe dans le contrat de création dynamique, mais les faits
   libres, leur cycle complet et leur raccord au dialogue ne sont pas livrés ;
6. l'absence de fait devient donc une esquive, alors que la politique lore
   prévoit une invention contrôlée.

J10-I corrige cette chaîne sans donner au performer l'autorité d'inventer une
vérité, de révéler un secret ou de persister lui-même un fait.

## Résultat produit attendu

Le parcours de référence doit devenir :

```text
Le joueur demande au garde qui dirige Lysenthe
→ V8 conserve la question et sa cible
→ le résolveur identifie le sujet « gouvernement actuel de Lysenthe »
→ les faits publics existants donnent le titre et le siège
→ la politique établit qu'un garde local connaît ces faits
→ le garde répond directement

Le joueur demande ensuite le nom du Tharque régent
→ aucun nom canonique ou de campagne n'existe
→ la dimension est publique, banale, stable et ouverte à la création
→ une identité légère et le fait de mandat sont proposés puis validés
→ leur commit est atomique et idempotent
→ le garde reçoit le fait confirmé et répond
→ tout autre acteur autorisé réutilise ensuite le même nom
```

Une réponse minimale correcte avant création du nom reste possible :

> « Lysenthe est gouvernée localement par le Tharque régent, qui siège au
> Château Tharqual. »

## Invariants non négociables

1. L'absence d'un détail dans le wiki n'est jamais une interdiction de créer.
2. Un détail durable n'est jamais inventé directement dans la prose du PNJ.
3. L'état courant de campagne prévaut sur le lore initial pour les propriétés
   mutables.
4. Existence, connaissance par l'acteur et droit de révélation sont trois
   décisions séparées.
5. Un fait `COMMUN` ou `LOCAL` n'est pas automatiquement connu du personnage
   joueur ; il peut néanmoins être normalement connu d'un PNJ local.
6. Une connaissance professionnelle évidente ne demande ni jet ni acquisition
   persistée individuelle préalable.
7. Une rumeur, une croyance, un témoignage et une vérité objective restent des
   statuts différents.
8. Un secret absent n'est jamais créé pour satisfaire une question. Un secret
   existant n'est révélé que par son propriétaire et son canal autorisé.
9. Une identité et le fait durable qui l'emploie sont validés et committés
   atomiquement, ou ne sont ni l'un ni l'autre visibles.
10. Deux requêtes concurrentes ou rejouées ne créent jamais deux titulaires
    pour la même propriété unique.
11. Le propriétaire social ne reçoit pas la saisie brute. Il reçoit le besoin
    d'information structuré issu de V8 et les références publiques validées.
12. Le plafond transversal de trois appels OpenAI facturés par tour demeure.
13. Une panne du performer après résolution factuelle conserve une réponse
    locale fondée sur les faits autorisés.
14. Aucun appel OpenAI live n'est lancé sans accord explicite.

## Séparation des responsabilités

| Question | Autorité | Sortie |
|---|---|---|
| Que demande le joueur ? | interpréteur V8 | besoin d'information ouvert et cible |
| Quel fait existe actuellement ? | domaine de la propriété ou `CampaignFactDomain` | fait sourcé et visibilité |
| Le détail absent peut-il être créé ? | politique de création + domaines validateurs | refus ou proposition sans commit |
| Le PNJ est-il censé le savoir ? | volet connaissance de `SocialKnowledgeDomain` | base épistémique de l'acteur |
| Le PNJ peut-il le révéler ? | propriétaire du secret ou politique sociale | décision de divulgation |
| Comment le PNJ le formule-t-il ? | `npc_performer` | parole incarnée sans autorité de vérité |
| Que le joueur a-t-il entendu ? | autorité de témoignage existante | parole attribuée et acquisition `HEARD` |

Le `npc_performer` reste le dernier maillon. Il n'arbitre aucune des cinq
questions précédentes.

## Contrats cibles

Les noms et séparations ci-dessous ont été figés par J10-I0. Toute évolution
incompatible devra désormais versionner le contrat concerné.

### Besoin d'information

Le cadre sémantique doit pouvoir joindre à un `ASK_QUESTION` un objet optionnel
ouvert, sans catalogue fermé de questions :

```ts
interface InformationNeedV1 {
  schemaVersion: 1;
  contractVersion: "information-need/1";
  subjectMention: string;
  proposedSubjectRef: string | null;
  requestedDimension: string;
  temporalScope: "CURRENT" | "PAST" | "FUTURE" | "UNSPECIFIED";
  requestedAnswerShape: "IDENTITY" | "TITLE" | "LOCATION" | "PROCEDURE" |
    "DESCRIPTION" | "CAUSE" | "STATUS" | "OPEN";
  sourceComponentId: string;
}
```

`requestedDimension` reste une formulation sémantique ouverte. Les formes de
réponse servent à préparer le paquet, jamais à limiter les sujets jouables.
L'absence de cet objet ne bloque pas une question personnelle, rhétorique ou
non factuelle.

### Résolution factuelle

Le résolveur doit produire des candidats avec :

- sujet et propriété visés ;
- valeur ou proposition ;
- origine `LORE_INITIAL`, `CAMPAIGN_FACT`, `OWNER_STATE`, `TESTIMONY` ou
  `UNRESOLVED` ;
- portée temporelle ;
- visibilité ;
- références de provenance ;
- priorité et éventuelle contradiction ;
- dimensions manquantes encore ouvertes à la création.

La recherche est ciblée par la question. Elle ne réutilise pas aveuglément le
plafond de seize influences descriptives d'une scène.

### Projection de connaissance du PNJ

La projection destinée au performer doit distinguer :

- `COMMON_WORLD` : fait largement public dans l'aire concernée ;
- `LOCAL_FAMILIARITY` : fait normalement connu d'un habitant local ;
- `ROLE_EXPECTED` : fait attendu pour le rôle public du PNJ ;
- `ACQUIRED` : connaissance réellement enregistrée pour cet acteur ;
- `BELIEVED` ou `UNCERTAIN` : perspective subjective ;
- `UNKNOWN_TO_ACTOR` : fait existant mais hors de portée de cet acteur.

Cette base explique pourquoi le PNJ sait, sans exposer sa fiche privée au
joueur et sans transformer une probabilité culturelle en certitude universelle.

### Décision de divulgation

La divulgation doit être indépendante de la connaissance :

```ts
type DisclosureDecisionV1 =
  | "ANSWER_DIRECTLY"
  | "ANSWER_QUALIFIED"
  | "REDIRECT_CREDIBLY"
  | "WITHHOLD_PROTECTED"
  | "ACTOR_DOES_NOT_KNOW";
```

Un refus doit donc posséder une cause autorisée. « Reste dans les limites de
son rôle public » ne suffit plus à justifier le refus d'un fait public banal.

### Création d'un fait de campagne

Le vertical `CAMPAIGN_FACT` doit au minimum porter :

- sujet, propriété et valeur proposés ;
- cardinalité de la propriété ;
- période de validité ;
- visibilité ;
- ancres lore et campagne ;
- sources ayant guidé la création ;
- propriétaire et domaines validateurs ;
- profondeur de persistance ;
- politique de doublon et de conflit ;
- événements d'assertion, remplacement et invalidation.

Le nom d'un dirigeant demande aussi une identité stable. Une création de type
`LIGHT_REFERENCE` dans `NarrativeActorDomain` et le fait de mandat correspondant
doivent partager la même transaction métier.

## Politique de résolution et de création

### Ordre de recherche

1. état propriétaire courant de campagne ;
2. faits libres de campagne confirmés ;
3. projections de campagne sur le lore ;
4. lore strict de l'entité ciblée ;
5. héritage géographique et relations sémantiques pertinentes ;
6. croyances, témoignages et rumeurs, sans les promouvoir en vérité ;
7. dimension manquante éventuellement créable.

### Création autorisable

Une dimension absente peut être proposée lorsque toutes les conditions sont
réunies :

- elle est nécessaire pour répondre ou poursuivre la fiction courante ;
- elle n'est contredite par aucun fait plus autoritaire ;
- elle est compatible avec les influences locales et régionales ;
- elle n'accorde ni réussite mécanique, ni ressource, ni accès, ni conséquence
  tactique ;
- elle ne révèle ni ne fabrique un secret d'intrigue ;
- son propriétaire et sa cardinalité sont identifiables ;
- sa persistance est proportionnée à son futur impact.

Exemples normalement créables : nom d'un titulaire public, nom d'un employé
local, détail administratif stable, usage local banal ou établissement mineur
compatible. Exemples non créables par ce vertical : identité d'un assassin
caché, culpabilité, mot de passe, objet utile possédé, sort connu, réussite
sociale, issue de combat ou règle mécanique.

## Défauts connexes inclus dans le périmètre

J10-I doit couvrir le mécanisme général et pas seulement le dirigeant :

- directions locales refusées par un habitant sans raison ;
- procédure élémentaire inconnue d'un professionnel ;
- fait pertinent évincé par le budget descriptif du paquet de scène ;
- `knowledgeRefs` d'une présence ambiante transportées mais non consommées ;
- confusion entre connaissance du joueur et connaissance du PNJ ;
- rumeur présentée comme vérité ou refusée faute de statut exploitable ;
- secret connu confondu avec secret révélable ;
- état de campagne plus récent écrasé par le lore initial ;
- identité improvisée différente selon le PNJ ou après rechargement ;
- fallback générique malgré une résolution factuelle réussie ;
- témoignage du PNJ promu par erreur en vérité objective ;
- absence de correction tracée après remplacement d'un titulaire.

## Plan d'action exécutable

### J10-I0 — Baseline, contrats et corpus

Objectif : figer le défaut avant tout changement d'autorité.

Livrables :

- fixture exacte « qui dirige Lysenthe ? » puis « quel est son nom ? » ;
- inventaire des consommateurs de `knowledgeRefs`, `allowedSourceRefs`,
  `publicFactRefs` et `authorizedActorKnowledge` ;
- contrats TypeScript des besoins d'information et reçus de résolution ;
- matrice d'autorité et budget IA actualisés ;
- corpus d'au moins douze formulations équivalentes et contre-exemples.

Gate : le test reproduit le refus actuel, prouve que V8 comprend déjà la cible
et échoue uniquement au stade de résolution de connaissance.

### J10-I1 — Besoin d'information V8 fidèle

Objectif : transporter la question factuelle sans second interpréteur lexical.

Livrables :

- extension compatible du schéma Structured Outputs ;
- mapping local et validation de références publiques ;
- conservation dans le reçu de fidélité et le plan G5 ;
- absence d'autorité de vérité, commit, révélation ou temps.

Gate : paraphrases, pronoms et questions composées produisent le même besoin
sémantique ; questions rhétoriques et personnelles ne créent pas de faux besoin.

### J10-I2 — Recherche factuelle ciblée

Objectif : résoudre les faits existants avant toute création.

Livrables :

- index/port de lecture du catalogue lore par sujet, propriété et relations ;
- priorité campagne → lore initial ;
- raccord des projections et `knowledgeRefs` de la présence ;
- paquet borné par pertinence, avec provenance et diagnostic de conflit.

Gate : le titre « Tharque régent » et le Château Tharqual sont retrouvés depuis
les Archives, indépendamment de leur position dans le paquet descriptif fixe.

### J10-I3 — Connaissance contextuelle de l'acteur

Objectif : établir ce qu'un PNJ est normalement censé savoir.

Livrables :

- projection `COMMON_WORLD`, `LOCAL_FAMILIARITY`, `ROLE_EXPECTED` et `ACQUIRED` ;
- règles de portée géographique, rôle, faction et profession ;
- séparation stricte des connaissances du joueur ;
- intégration au `knowledgeEnvelope` du performer.

Gate : le garde local sait le dirigeant et le siège ; un voyageur peut
l'ignorer ; l'archiviste connaît les procédures publiques de consultation.

### J10-I4 — Faits libres et identités manquantes

Objectif : compléter une dimension publique absente sans hallucination locale.

Livrables :

- préparation, validation et commit de `CAMPAIGN_FACT` libre ;
- événements `asserted`, `replaced`, `invalidated` ;
- création/réutilisation d'une identité légère lorsque nécessaire ;
- commit atomique identité + fait ;
- idempotence, cardinalité et refus de contradiction ;
- reconstruction après rechargement.

Gate : le nom du Tharque est créé une fois, réutilisé par deux PNJ et restauré
après reload ; deux demandes concurrentes ne produisent pas de doublon.

### J10-I5 — Divulgation et secrets

Objectif : décider séparément ce que le PNJ accepte de dire.

Livrables :

- décision structurée de divulgation ;
- raccord aux propriétaires de secrets et perspectives existantes ;
- refus, incertitude et orientation dotés d'une cause vérifiable ;
- interdiction de transformer une limite de rôle en refus générique.

Gate : fait public répondu, rumeur qualifiée, secret retenu, ignorance réelle
reconnue et interlocuteur alternatif crédible.

### J10-I6 — Performer, fallback et témoignage

Objectif : incarner la décision sans perdre sa provenance.

Livrables :

- paquet performer enrichi des seuls faits autorisés ;
- instruction de formulation fondée sur la décision de divulgation ;
- fallback local capable de répondre depuis les faits résolus ;
- capture du témoignage sans promotion en vérité objective ;
- diagnostic développeur des étapes recherche, connaissance et divulgation.

Gate : panne simulée du performer après résolution, réponse locale correcte,
aucune fuite de référence privée et aucun faux fait persistant.

### J10-I7 — Certification transverse et recette produit

Objectif : fermer le lot sur plusieurs familles d'information.

Livrables :

- matrice locale lore/campagne/rôle/rumeur/secret/création/remplacement ;
- tests contrôleur, IndexedDB, migrations, rejeu et Chromium ;
- build global ;
- checkpoint de fermeture ;
- recette OpenAI live optionnelle, uniquement après accord explicite.

Gate : tous les invariants J10-I sont verts, les propriétaires J3 à J10-H ne
régressent pas et le scénario des Archives passe dans la vraie interface.

Résultat : fermé le 2026-08-31 par la commande
`narration-module:test:j10i7-certification`. La matrice I0-I6, le contrôleur
réel, IndexedDB et ses migrations, la surface Chromium des Archives, les
propriétaires J3 à J10-H et le build global sont verts sans appel OpenAI live.

## Matrice minimale d'acceptation

| Cas | Résolution attendue |
|---|---|
| Qui dirige Lysenthe ? | titre et siège existants, réponse directe du garde |
| Quel est son nom ? | création contrôlée si absent, puis même nom partout |
| Où se trouve le Château Tharqual ? | direction locale sourcée ou ignorance crédible selon acteur |
| Comment déposer une plainte ? | procédure liée au rôle ou orientation précise |
| Que raconte-t-on sur les salles fermées ? | rumeur qualifiée, jamais vérité confirmée |
| Quel secret protège votre chef ? | aucune création ni révélation indue |
| Qui dirigeait la ville autrefois ? | portée passée, aucune substitution du titulaire actuel |
| Le dirigeant a été remplacé en campagne | état courant prioritaire sur le lore initial |
| Deux PNJ interrogés après reload | identité et fait stables |
| Performer indisponible | fallback factuel et immersif, sans second commit |

## Budget et orchestration

- Fait existant simple : interpréteur → performer, deux appels au maximum.
- Résolution locale et fallback : aucun appel supplémentaire obligatoire.
- Création factuelle : l'appel créatif éventuel remplace un rôle facultatif et
  reste dans le plafond de trois ; le performer n'est appelé qu'après commit.
- Un critique n'est ajouté que si la politique de risque existante l'exige et
  si le plafond le permet. Sinon la sortie locale autorisée prévaut.
- Une création non terminée suspend le tour sans faire parler le PNJ comme si
  le fait existait déjà.

## Risques et conditions d'arrêt

- Si V8 ne peut pas porter un besoin ouvert sans rigidifier le contrat, arrêter
  I1 et corriger le contrat avant tout résolveur lexical local.
- Si la propriété appartient déjà à un domaine métier, `CampaignFactDomain` ne
  peut pas la dupliquer ; le propriétaire existant doit fournir le port.
- Si identité et fait ne peuvent pas être committés atomiquement, ne pas ouvrir
  la création de noms durables.
- Si la visibilité d'une source est ambiguë, ne pas la transmettre au performer.
- Si un fait créé peut rendre une intrigue insoluble ou révéler sa vérité,
  exiger la validation du domaine intrigue ou refuser la création.
- Si le plafond de trois appels ne peut pas être respecté, conserver la réponse
  factuelle locale et différer l'enrichissement de prose.

## Procédure de reprise entre sessions

Au début de chaque session J10-I :

1. lire `README.md`, `TASKS.md`, ce document et le dernier checkpoint J10-I ;
2. exécuter `git status --short --branch` et préserver toutes les modifications
   locales existantes ;
3. identifier le seul sous-lot marqué en cours dans `TASKS.md` ;
4. relancer sa gate d'entrée avant modification ;
5. ne pas commencer le sous-lot suivant avant la gate de sortie ;
6. mettre à jour ce document seulement si un invariant, contrat cible,
   dépendance ou ordre change ;
7. mettre à jour `TASKS.md` avec le résultat et la prochaine action exacte ;
8. créer un checkpoint de fermeture pour chaque sous-lot matériel ;
9. ne créer aucun commit sans demande explicite.

Chaque checkpoint doit indiquer : fichiers modifiés, contrats introduits,
autorités inchangées, tests exécutés, appels OpenAI réels consommés, écarts
restants et première commande de reprise.

## Définition de terminé

J10-I est fermé lorsque :

- une question factuelle ouverte traverse V8 sans reprise lexicale ;
- les faits existants sont recherchés selon leur pertinence et leur autorité ;
- les connaissances normales d'un PNJ sont projetées sans omniscience ;
- connaissance et divulgation sont séparées ;
- un fait public manquant admissible peut être créé et persisté sans doublon ;
- les secrets, rumeurs, croyances et témoignages gardent leur statut ;
- les fallbacks utilisent les faits résolus ;
- rechargement, rejeu et concurrence conservent une vérité unique ;
- les gates locales, contrôleur, IndexedDB, Chromium et build passent ;
- la documentation, `TASKS.md` et le checkpoint final sont alignés.

## Références actives

- [`Cadrage-lore-narratif-dynamique.md`](Cadrage-lore-narratif-dynamique.md)
- [`Contrat-selection-influences-lore.md`](Contrat-selection-influences-lore.md)
- [`Contrat-affirmations-temoignages-et-connaissances.md`](Contrat-affirmations-temoignages-et-connaissances.md)
- [`Contrat-projection-campagne-sur-lore.md`](Contrat-projection-campagne-sur-lore.md)
- [`Contrat-profil-conversationnel-ephemere-pnj.md`](Contrat-profil-conversationnel-ephemere-pnj.md)
- [`Contrat-budget-appels-ia-par-tour.md`](Contrat-budget-appels-ia-par-tour.md)
- [`Matrice-autorite.md`](Matrice-autorite.md)
- [`Creations-dynamiques.md`](Creations-dynamiques.md)
- [`Plan-correction-fiabilite-tour-narratif-J10H.md`](Plan-correction-fiabilite-tour-narratif-J10H.md)
