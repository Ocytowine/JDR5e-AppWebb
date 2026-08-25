# Durcissement de l'interprétation sémantique avant recette UI

Date : 2026-08-25

Statut : `PLAN_ACTIF`

## Décision produit

La saisie joueur est une expression libre située dans la fiction. Elle ne doit
jamais être comprise par recherche de mots, par liste de formulations admises,
par menu d'actions implicite ou par sélection forcée parmi les seules capacités
d'exécution déjà raccordées.

Le rôle `player_intent_interpreter` reçoit le texte brut et un contexte public
incarné suffisant. Il restitue le sens sans résoudre l'action. Les domaines
propriétaires conservent ensuite l'autorité de vérifier une cible, une ressource,
une règle, un coût, un succès, un effet et le temps de campagne.

Une sortie structurée sert uniquement à transporter et valider le sens. Elle ne
définit pas ce que le joueur a le droit d'essayer.

## Invariants non négociables

- aucune détection lexicale dans le chemin de jeu OpenAI ;
- aucune liste fermée de verbes, sorts, objets, demandes sociales ou actions ;
- aucune réécriture locale du sens à partir du texte brut après interprétation ;
- aucune action transformée en action immédiate lorsqu'elle est conditionnelle,
  hypothétique, citée, niée ou simplement envisagée ;
- aucune perte silencieuse d'une composante quand une phrase contient plusieurs
  intentions ou une séquence ;
- aucune cible choisie arbitrairement lorsqu'un pronom ou une description reste
  ambigu dans le contexte disponible ;
- aucune conséquence, mutation, réussite ou consommation décidée par
  l'interpréteur ;
- en cas d'indisponibilité ou de sortie invalide de l'IA, clarification sûre et
  sans commit, jamais reclassement par mots-clés.

OpenAI est l'unique interpréteur des saisies joueur dans le chemin de jeu. Le
fournisseur local déterministe reste une fixture de tests techniques : il ne
constitue pas un mode de jeu, ne reprend jamais un appel distant en échec et ne
peut produire aucune intention exécutable issue d'une saisie réelle.

## Frontière de confiance

Le runtime fait confiance au sens produit par `player_intent_interpreter`. Il ne
relit pas la phrase avec des règles locales, ne remplace pas une intention par
une catégorie jugée plus pratique et ne corrige pas sémantiquement le modèle.

L'interpréteur doit déclarer explicitement l'état de sa compréhension :

- `UNDERSTOOD` : le sens, l'engagement et les composantes sont suffisamment
  établis pour être transmis aux propriétaires de domaine ;
- `NEEDS_CLARIFICATION` : une ambiguïté pertinente subsiste, accompagnée de la
  question minimale à poser au joueur.

La confiance détaillée et les incertitudes restent observables pour les tests,
mais le statut explicite gouverne le handoff : le runtime ne transforme pas
localement une confiance numérique ou qualitative en une autre interprétation.

Cette confiance s'arrête à la compréhension. Le runtime valide encore sans
réinterpréter : conformité du contrat, références proposées appartenant au
contexte public fourni, cohérence entre statut et clarification, conservation
des conditions et absence d'autorité interdite. Les propriétaires de domaine
décident ensuite possibilité, disponibilité, coût, réussite, conséquence et
temps. Refuser une exécution impossible ne change pas ce que le joueur voulait
faire.

## Contexte nécessaire à chaque tour

L'interpréteur doit recevoir une projection reconstruite depuis l'état courant,
limitée à ce que le personnage et le joueur peuvent légitimement mobiliser :

- identité du personnage et éléments narratifs explicitement renseignés :
  histoire, personnalité, objectifs, défauts et apparence pertinente ;
- capacités nommables : langues, actions, sorts, aptitudes et objets possédés,
  sans préjuger de leur disponibilité mécanique ;
- scène visible, acteurs présents, état perceptible, objets, passages et
  destinations publiques ;
- connaissances acquises avec leur statut épistémique ;
- interlocuteur actif, focus récents et intentions sémantiques récentes ;
- compagnons présents et voyage ou interruption en cours ;
- capacités runtime ouvertes, uniquement comme information de routage après
  compréhension, jamais comme frontière de compréhension.

Les secrets MJ, intentions privées des PNJ, solutions cachées et informations
que le personnage ne possède pas restent exclus.

## Contrat sémantique ouvert attendu

Le prochain contrat ne modélise plus la composition avec quatre gestes
spécialisés. Il transporte :

- le sens global et le but du joueur en langage naturel ;
- l'engagement global et ses conditions ;
- une suite ordonnée de composantes de sens en langage ouvert ;
- pour chaque composante : ce qui est tenté, son engagement propre, ses
  conditions, sa cible mentionnée éventuelle et son lien causal ou temporel ;
- les références proposées uniquement lorsqu'elles viennent du contexte
  public fourni ;
- les ambiguïtés réelles et la clarification minimale nécessaire ;
- des suggestions de domaine et de portée non autoritaires.

Les catégories techniques nécessaires au routage peuvent subsister comme
projections secondaires. Elles ne remplacent jamais le sens ouvert et ne
doivent jamais supprimer une composante inconnue du runtime.

## Plan d'exécution

L'ordre ci-dessous est une dépendance technique. Une étape ne s'ouvre que si la
précédente conserve les régressions existantes et ses invariants d'autorité.

### G0 — Établir la référence avant migration

But : distinguer les défauts déjà présents des régressions introduites par le
nouveau contrat.

- figer la liste des tests actuellement verts et le défaut connu de mémoire des
  conversations longues ;
- inventorier tous les endroits qui lisent directement `rawInput` après le rôle
  OpenAI, ainsi que les canonicalisations qui remplacent sa proposition ;
- classer chaque lecture : validation technique acceptable, interprétation
  lexicale à retirer, ou fixture locale isolée ;
- ajouter une vérification statique empêchant qu'un nouveau détecteur lexical
  entre dans le chemin OpenAI.

Sortie : matrice de migration et baseline reproductible, sans changement de
comportement.

Gate : aucune modification accidentelle des changements J10 déjà présents ;
`git diff --check` et les suites d'intention existantes restent dans leur état
de référence documenté.

### G1 — Rendre le chemin de jeu exclusivement OpenAI

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-OpenAI-seul-interpreteur-G1.md`](Checkpoint-OpenAI-seul-interpreteur-G1.md).

But : supprimer l'ambiguïté entre fixture locale et interpréteur produit.

- configurer le contrôleur UI de jeu avec le fournisseur OpenAI uniquement ;
- retirer le fournisseur lexical des valeurs par défaut utilisables par le jeu,
  tout en le conservant dans les tests qui l'instancient explicitement ;
- transformer panne, timeout, sortie incomplète, rejet de schéma et absence de
  clé en diagnostic `NEEDS_CLARIFICATION` sans commit ni temps ;
- corriger les messages UI qui annoncent encore un fallback local ;
- ne lancer aucun appel réseau automatique pendant les tests locaux.

Gate : un test navigateur avec serveur OpenAI simulé prouve qu'une panne ne
déclenche ni fournisseur local, ni domaine, ni mutation.

### G2 — Introduire le contrat sémantique ouvert

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-cadre-semantique-ouvert-G2.md`](Checkpoint-cadre-semantique-ouvert-G2.md).

- introduire un nouveau contrat suivant V7 sans supprimer immédiatement la
  compatibilité de lecture des anciennes sorties ;
- rendre explicite `UNDERSTOOD` ou `NEEDS_CLARIFICATION`, déclaré par le seul
  interpréteur OpenAI ;
- transporter un `overallMeaning`, l'engagement, les conditions globales et une
  suite ordonnée de composantes sémantiques ouvertes ;
- décrire chaque composante par son sens naturel, son engagement, ses
  conditions, ses cibles mentionnées et son lien avec les autres composantes ;
- conserver négation, citation, alternative, simultanéité et changement d'avis
  sans créer une liste fermée de verbes ou d'actions ;
- maintenir `suggestedDomain` et une famille de routage seulement comme
  projections secondaires proposées par l'IA ;
- mettre le schéma JSON dans Structured Outputs et alléger le prompt de toute
  répétition procédurale inutile.

Gate : le schéma accepte une action simple, une condition, une négation, une
alternative et une séquence dépassant quatre composantes sans perte de sens.

### G3 — Mapper sans réinterpréter

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-mapping-semantique-fidele-G3.md`](Checkpoint-mapping-semantique-fidele-G3.md).

But : faire de la sortie OpenAI la source de vérité sémantique.

- conserver le cadre sémantique complet dans `NarrativeIntentInterpretation` ;
- supprimer les canonicalisations OpenAI fondées sur `rawInput` ;
- ne jamais remplacer localement le but, l'engagement, l'ordre ou les
  conditions ;
- vérifier uniquement corrélation, schéma, références publiques, cohérence du
  statut de compréhension et autorité interdite ;
- transmettre `UNDERSTOOD` aux propriétaires concernés ;
- transmettre `NEEDS_CLARIFICATION` à la narration sans domaine ni mutation ;
- conserver une composante comprise mais non raccordée comme
  `UNDERSTOOD_UNSUPPORTED`, au lieu de la supprimer ou de la déformer.

Gate : des sorties OpenAI simulées volontairement inhabituelles traversent le
mapping sans analyse du texte brut et restent identiques sur les champs de sens.

### G4 — Restaurer le contexte incarné

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-contexte-incarne-public-G4.md`](Checkpoint-contexte-incarne-public-G4.md).

- versionner la projection personnage de l'interpréteur ;
- intégrer identité, histoire, personnalité, objectifs, défauts, apparence et
  historique de personnage explicitement publics ;
- ajouter les références d'aptitudes et capacités nommables sans exposer leurs
  valeurs mécaniques privées ;
- joindre connaissances acquises, scène courante, interlocuteur actif, focus,
  intentions récentes, compagnons présents et processus narratif en cours ;
- conserver les limites, les classifications d'autorité et l'empreinte de
  contexte ;
- borner chaque famille par pertinence et ancienneté plutôt que transmettre la
  fiche ou la campagne complète ;
- certifier qu'aucun secret ni donnée propriétaire d'un autre acteur ne fuit.

Gate : des canaris privés restent absents, tandis que des formulations dépendant
de l'histoire, d'un sort, d'un objet rangé, d'une connaissance acquise et du
dernier interlocuteur sont comprises avec le bon contexte.

### G5 — Raccorder les propriétaires sans leur donner le sens

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-routage-proprietaires-G5.md`](Checkpoint-routage-proprietaires-G5.md).

But : exécuter ce qui est compris sans faire interpréter chaque domaine à son
tour.

- router depuis les projections proposées et le cadre sémantique, jamais depuis
  des mots de la saisie ;
- laisser chaque propriétaire vérifier uniquement ses préconditions : cible,
  possession, ressource, règle, disponibilité et état courant ;
- exécuter les composantes ordonnées une par une avec résultat explicite ;
- arrêter proprement la suite lorsqu'une étape exige un choix, échoue ou rend la
  suite caduque ;
- définir pour chaque arrêt ce qui est déjà committé et ce qui ne l'est pas ;
- rendre toute demande complémentaire dans la narration, sans popup métier.

Gate : une séquence multi-domaines ne commite jamais une étape ultérieure avant
la validation de ses préconditions et un rejeu ne duplique aucune étape.

Le contrat détaillé est
[`Contrat-execution-cadre-semantique-G5.md`](Contrat-execution-cadre-semantique-G5.md).
Le plan route seulement un couple exact `capabilityId`/domaine publié. Une
suggestion ouverte reste comprise mais non exécutable. Les conditions libres,
alternatives et simultanéités sans propriétaire atomique arrêtent la suite.
L'UI est passée en V8 après certification G6/G7 des adaptateurs installés et du
fournisseur simulé.

### G6 — Corpus d'évaluation

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-corpus-evaluation-G6.md`](Checkpoint-corpus-evaluation-G6.md).

Construire un corpus permanent évalué sur la sortie sémantique, et non sur des
mots attendus. Il couvre au minimum : dialogue direct et implicite, perception,
voyage, inventaire, repos, magie, tactique, compagnons autonomes, questions au
MJ, pronoms, ellipses, négations, citations, conditions, hypothèses, actions
composées, changements d'avis, fautes et formulations inédites.

Les paraphrases ne doivent pas être ajoutées au prompt comme exemples à
reconnaître. Elles servent uniquement à mesurer l'invariance du sens.

Le corpus contient trois niveaux :

1. fixtures structurées déterministes pour le validateur et le mapping ;
2. fournisseur OpenAI simulé dans le contrôleur et le navigateur ;
3. corpus OpenAI live, ouvert seulement au dernier jalon.

Les assertions portent sur le statut de compréhension, le sens, l'engagement,
les conditions, l'ordre, les cibles admissibles, les incertitudes et l'absence
de mutation indue. Elles ne comparent ni prose exacte ni JSON complet.

### G7 — Gate locale avant dépense

Statut : `FERMÉ` le 2026-08-25. Preuve :
[`Checkpoint-gate-locale-G7.md`](Checkpoint-gate-locale-G7.md).

- installer dans le contrôleur les adaptateurs propriétaires qui consomment le
  plan G5, sans leur transmettre la saisie brute ni leur faire réinterpréter le
  sens ;
- basculer la configuration UI produit de V7 vers V8 une fois ces adaptateurs
  présents ;
- exécuter les validations de schéma et d'autorité ;
- exécuter le corpus contextuel avec sorties OpenAI simulées ;
- exécuter toutes les régressions narration, le build global et la gate
  Chromium sur le parcours UI réel ;
- corriger séparément le défaut connu d'ordre de mémoire des conversations
  longues s'il reste reproductible ;
- relire `git diff`, les migrations de contrats et les messages visibles.

Gate : zéro mauvais commit, zéro fallback lexical, zéro composante critique
perdue, aucun secret dans le contexte et build complet vert.

### G8 — Gate OpenAI avant UI libre

Statut : `PARTIEL — CLARIFICATION LIVE SÛRE, OBSERVATION UI CIBLÉE`.

La recette UI libre n'est ouverte qu'après :

- zéro engagement aggravé (`none/hypothetical/conditional` vers `committed`) ;
- zéro composante perdue dans le corpus critique ;
- zéro mauvais référent imposé ;
- zéro mauvaise mutation lors d'une ambiguïté ou panne IA ;
- passage du build global et de toutes les régressions narratives ;
- recette OpenAI live courte autorisée explicitement, puis corpus live élargi
  avec budget annoncé.

La première recette live reste courte : contexte simple, ellipse, condition,
séquence, dialogue dépendant du personnage et panne simulée hors réseau. Le
corpus élargi vient ensuite, lorsque le système général est assez robuste pour
que ses résultats soient réellement exploitables.

Le checkpoint du 2026-08-25 valide le contexte simple et le dialogue dépendant
du personnage. La recette suivante a exposé une ellipse sortie de l'échange et
une condition appliquée trop largement. Le prompt et le corpus local corrigent
ces deux portées sans détection lexicale. La contre-recette finale a néanmoins
choisi `NEEDS_CLARIFICATION` pour le tour composé. La suite n'est pas un nouvel
appel automatisé : elle consiste à observer des tours naturels séparés dans la
vraie UI via `Recette-manuelle-UI-post-G8.md`.

## Ordre des modifications dans le dépôt

1. `ai/types.ts` et validation locale : nouveau contrat sans branchement UI ;
2. route serveur : schéma Structured Outputs et instructions spécialisées ;
3. `aiIntentInterpretation.ts` : mapping fidèle et suppression des
   canonicalisations lexicales du chemin OpenAI ;
4. contexte personnage versionné et contexte public ;
5. contrôleur de tour et routage des composantes ;
6. configuration UI OpenAI-only et erreur immersive ;
7. tests unitaires, contrôleur, serveur, navigateur et documentation ;
8. seulement après accord : recette OpenAI live.

Chaque étape conserve la lecture V7 jusqu'à la migration complète des tests et
des campagnes en cours. V7 n'est plus produit par l'UI dès que le nouveau
contrat est certifié, puis sa compatibilité peut être retirée dans un lot
ultérieur distinct.

## Hors périmètre

Ce chantier n'ouvre pas de nouvelle autorité tactique, de contrôle direct des
compagnons, de carte de voyage, de popup de mission ni de mutation décidée par
l'IA. Il améliore la compréhension et la fidélité du handoff ; les propriétaires
de domaine restent responsables de l'exécution.
