# Pipeline et contrats IA

Statut : `ACTIF` — pipeline, contrats structurés, validation locale et routes
d'exécution intégrés dans le build principal.

## Objectif

Organiser les appels IA pour que la création reste libre sans confondre interprétation, proposition, résolution, persistance et texte affiché au joueur.

## Règle fondamentale

Aucune sortie produite par une IA n'est affichée ni appliquée comme un fait de campagne avant la fin de sa chaîne de validation.

Une validation complète signifie que tous les contrôles applicables ont réussi. Elle ne constitue pas une promesse mathématique d'absence d'incohérence sémantique : les invariants formalisables sont contrôlés de manière déterministe et les risques narratifs non formalisables passent par une critique ciblée.

## Pipeline conceptuel

```text
entrée joueur
  -> construction du TurnSnapshot
  -> interprétation structurée
  -> clarification éventuelle
  -> planification créative éventuelle
  -> propositions de commandes et créations
  -> validations et résolutions des domaines propriétaires
  -> préparation des dialogues et réactions nécessaires
  -> validation finale et commit atomique
  -> rédaction visible
  -> contrôle de la rédaction
  -> affichage
```

Le pipeline est adaptatif : les phases inutiles sont omises, mais aucun raccourci ne contourne une validation requise.

### Parcours d'information

Une question méta ou une demande de possibilité n'exécute aucune action, ne fait pas avancer le temps de jeu et ne nécessite pas de planification narrative si les sources autoritaires suffisent à répondre.

### Parcours de clarification

Une ambiguïté significative suspend l'intention. La question de clarification ne fait pas progresser le monde. La réponse du joueur déclenche un nouveau snapshot et reprend depuis l'interprétation avec la référence de l'intention suspendue.

### Parcours narratif

Une action ou parole engagée peut nécessiter planification, création, résolution, réactions d'acteurs et rédaction. Chaque résultat intermédiaire possède un contrat structuré et n'est pas directement visible.

## Catégories de sorties IA

Chaque sortie appartient à une seule catégorie principale :

- interprétation structurée;
- proposition créative;
- proposition de dialogue ou réaction d'acteur;
- critique ciblée;
- rédaction visible candidate.

Une même sortie ne peut pas servir simultanément de proposition, de décision autoritaire et de message affiché.

## Profils d'exécution initiaux

### Parcours court

Interprétation, récupération d'une réponse autoritaire, rédaction éventuelle, contrôle et affichage. Il couvre notamment les questions méta et informations sans mutation.

### Parcours standard

Interprétation, planification, validation/résolution, commit, rédaction, contrôle et affichage.

### Parcours sensible

Le parcours standard ajoute les performances d'acteurs séparées et/ou une critique de cohérence. Il s'applique notamment aux intrigues, révélations, créations durables, engagements importants et scènes à perspectives multiples.

Ces profils configurent un minimum de contrôles; l'orchestrateur peut renforcer le parcours selon le risque, mais jamais le réduire sous le minimum applicable.

## Rôles et déclenchement

### `intent_interpreter`

Appel obligatoire pour toute saisie libre du joueur. Il classe l'entrée, extrait ses intentions, distingue question et engagement, détecte les ambiguïtés et produit une enveloppe sémantique. Il ne résout rien et aucun de ses textes n'est affiché directement.

Une commande technique explicite émise par une interface de confiance peut contourner ce rôle si elle possède déjà un contrat structuré complet.

### `mj_planner`

Appel obligatoire dès que le monde narratif progresse. Il propose les mouvements de scène, commandes, créations candidates, réactions attendues, révélations et condition de restitution de la main.

Il n'est pas appelé pour une pure question méta, une clarification suspendue ou une opération technique sans effet narratif.

Dans le build principal, le mode OpenAI configure explicitement sa route
serveur. Le plan accepté est transmis aux performances PNJ et au
`scene_writer`. Ces consommateurs peuvent suivre ses rythmes, assignations et
conditions de restitution de la main, mais ils ne peuvent ni exécuter ses
propositions de commandes ni élargir l'autorité de rendu. En cas d'échec, le
plan local déterministe conserve l'orchestration et l'incident reste visible
dans le diagnostic du tour.

### `player_expression_adapter`

Appel conditionnel chargé de mettre en scène l'action ou la parole du personnage joueur selon ses traits, compétences et registre. Il reçoit une enveloppe sémantique fermée et ne peut ajouter ni objectif, ni consentement, ni information, ni prise de risque absents de l'intention interprétée.

Il est utilisé lorsqu'une reformulation apporte une valeur de jeu de rôle. Le texte exact du joueur peut être conservé lorsqu'il est déjà adapté ou lorsqu'une transformation créerait un risque inutile.

### `npc_performer`

Un appel distinct est effectué pour chaque PNJ important qui parle, choisit ou réagit de manière significative. Le paquet adopte exclusivement la perspective de ce PNJ.

Les PNJ significatifs sont traités séquentiellement lorsque la parole de l'un devient perceptible par le suivant. Des appels peuvent être parallélisés seulement si leurs décisions sont indépendantes et si aucun ne doit connaître la sortie de l'autre.

Les figurants peuvent partager une performance groupée uniquement pour des réactions décoratives qui ne créent aucune information, décision, action, identité ou relation durable.

### `coherence_critic`

Appel conditionnel obligatoire lorsque le risque sémantique est élevé, notamment :

- création ou modification d'un engagement d'intrigue;
- révélation, indice ou information contradictoire potentielle;
- création durable importante;
- conséquence irréversible ou fortement structurante;
- scène à plusieurs acteurs avec connaissances différentes;
- reformulation sensible de la parole ou de l'action du joueur;
- proposition que les validateurs déterministes ne peuvent pas qualifier seuls.

Il produit une critique structurée et ne corrige ni ne committe directement.

Le parcours court ne lance pas automatiquement ce second appel pour une
observation générale limitée aux présences déjà visibles, ni pour un
positionnement réversible près d'un acteur visible. La frontière positive, le
schéma et la discipline factuelle du `scene_writer` restent obligatoires. Une
observation focalisée, une manipulation d'objet, une révélation, une
conséquence ou tout autre risque sémantique élevé conserve le critique.

### `rules_adjudicator`

Appel conditionnel lorsqu'une situation fictionnelle ne peut pas être entièrement transformée en paramètres par des règles calculables. Il reçoit les règles pertinentes, leur version, les faits du cas et les précédents comparables.

Il peut proposer une durée, une difficulté, des facteurs de situation, une règle applicable par analogie ou un arbitrage ponctuel. Il ne lance pas les dés, ne modifie pas les ressources et ne committe pas sa décision.

Sa sortie distingue règle directement applicable, interprétation d'une règle existante, estimation ouverte et arbitrage ad hoc faute de règle suffisante. Un arbitrage ad hoc ne devient jamais une règle officielle. Il peut produire un `AdjudicationRecord` consultable pour conserver une cohérence de campagne.

### `scene_writer`

Dans le parcours IA nominal, l'appel est conditionnel à une matière narrative
autorisée qui bénéficie réellement d'une rédaction de scène. Il rédige les
blocs de narration qui entourent l'expression validée du personnage, les
dialogues validés et les résultats committés. Il ne réécrit pas les répliques
et ne décide plus du contenu sémantique de la scène.

Il est omis lorsqu'une orientation immédiate vers une présence déjà visible,
une clarification ou une réplique PNJ validée forme déjà une réponse complète.
Le rendu déterministe de sécurité utilisé lorsque ce rôle est indisponible
n'est pas un appel créatif.

Son paquet contient le plan MJ accepté lorsqu'il existe, en plus de la scène
visible, de la résolution autorisée et de l'historique court. Le fingerprint du
contexte couvre aussi ce plan : deux planifications différentes ne partagent
pas silencieusement la même identité de contexte.

### Contrôles sans rôle créatif

Le validateur de sortie est toujours exécuté avant affichage. Schémas, autorités, versions, visibilité, invariants formels et commit restent sous contrôle logiciel. Cela n'interdit pas à l'IA d'interpréter une règle ou une situation ouverte : sa proposition devient autoritaire uniquement après acceptation par le domaine propriétaire.

## Préparation puis commit

Les appels de performance ont besoin de connaître le résultat d'une action sans que celui-ci soit déjà définitif. Les domaines produisent donc un `PreparedTurnResult` temporaire et non visible :

```text
interprétation
  -> planification
  -> validation et résolution provisoire
  -> PreparedTurnResult
  -> expression du joueur et performances des PNJ
  -> validation des paroles, connaissances et engagements
  -> critique requise
  -> contrôle d'obsolescence
  -> commit atomique
  -> CommittedTurnResult
  -> rédaction et contrôle final
```

Le `PreparedTurnResult` ne peut pas être utilisé comme souvenir, vérité de campagne ou texte joueur. Il expire si ses dépendances deviennent obsolètes.

### Dialogues et engagements verbaux

Dans le mini-runtime actif, le `npc_performer` intervient après la résolution
locale ou le commit éventuel du domaine. Sa sortie distingue la formulation
visible de ses actes de parole structurés et reste une projection attribuée à
ce PNJ. Elle ne peut contenir ni engagement durable, ni fait de campagne, ni
révélation non préalablement autorisée.

Une future parole qui promet, menace, accepte une mission ou modifie une
relation devra suivre un autre parcours : préparation par le PNJ, validation
par l'autorité mission/relation ou sociale, puis commit atomique avant
projection. Ce parcours cible ne doit pas être présenté comme déjà livré.

Le `scene_writer` peut mettre en rythme une réplique validée, mais il ne peut pas lui ajouter une promesse, une information ou une implication nouvelle.

## Enveloppe commune des sorties IA

Chaque appel retourne un unique document JSON conforme au schéma exact du rôle, sans Markdown ni prose extérieure au document :

```text
contractVersion
callId
packId
snapshotId
role
status
payload
diagnostics
```

- `contractVersion` sélectionne un schéma immuable et connu;
- `callId`, `packId` et `snapshotId` assurent la corrélation et l'obsolescence;
- `role` doit correspondre au paquet demandé;
- `status` appartient à une énumération fermée comme `OK`, `NEEDS_CLARIFICATION` ou `CANNOT_COMPLY`;
- `payload` porte uniquement la sortie autorisée du rôle;
- `diagnostics` expose incertitudes et limites sans leur donner d'autorité.

Le parseur applique un schéma strict : champ obligatoire absent, champ inconnu, type incorrect, énumération inconnue, identifiant non résolvable ou version non supportée provoquent le rejet de la sortie complète. Le système ne tente pas d'extraire approximativement un JSON depuis une réponse libre.

Une confiance déclarée par le modèle ne remplace jamais une validation. Une confiance faible peut renforcer le contrôle ou provoquer une clarification.

## Contrat de l'interpréteur

Le contrat actif V5 porte une intention principale structurée `intent`, avec
des composantes ordonnées pour les micro-actions sociales bornées. Il ne porte
pas `intents[]`. Le contrat V1 historique utilisait une autre projection et
reste accepté uniquement pour compatibilité.

L'intention indique au minimum :

- `intentId` et ordre;
- famille sémantique, portée et objectif joueur complet ;
- niveau d'engagement : aucun, hypothétique, conditionnel ou engagé;
- mention de cible, lien contextuel et référence proposée ;
- sens central et résultat souhaité, sans le confondre avec un résultat acquis;
- détails imposés par le joueur;
- détails laissés ouverts à la mise en scène;
- ajouts interdits;
- ambiguïtés et champ minimal à clarifier;
- perception, acte de dialogue et composantes ordonnées lorsque pertinents.

Le paquet d'entrée contient seulement la scène et les référents publics, la
projection minimale `interpreter-character-context/1`, la mémoire sémantique
courte restaurable, l'interlocuteur actif et le manifeste
`interpreter-runtime-context/1`. La projection personnage exclut la fiche
mécanique, les ressources, l'inventaire non visible, les textes biographiques
et les secrets. Une ambiguïté d'alias non levée est refusée par une garde locale
après l'appel IA. Le manifeste runtime décrit les raccords disponibles, les
handoffs et les déclenchements externes ; aucun de ces contextes ne permet à
l'interpréteur d'autoriser une fonctionnalité.

Exemple conceptuel :

```json
{
  "intentType": "possibility_query",
  "commitment": "none",
  "targets": ["guard-01"],
  "coreMeaning": "Demander si un vol est envisageable",
  "requiresClarification": false,
  "forbiddenInterpretations": ["attempt_theft"]
}
```

## Contrat du planificateur MJ

Le planificateur retourne un plan structuré, jamais la prose finale :

- `sceneBeats[]` ordonnés avec préconditions et condition d'arrêt;
- `commandProposals[]` destinées aux domaines propriétaires;
- `creationProposals[]` avec profondeur de persistance demandée;
- `actorAssignments[]` indiquant quels interprètes sont requis;
- `revealPlan` séparant révélation, indice et information retenue;
- `timeAdvanceProposal`, toujours soumis au domaine temporel;
- `playerHandoff`, qui décrit pourquoi et quand rendre la main;
- `riskFlags[]` déclenchant les contrôles renforcés;
- références des engagements et contraintes respectés.

Une phrase décorative présente dans ce contrat ne serait ni affichable ni autoritaire.

## Contrat de reformulation du personnage joueur

La sortie contient :

- `intentId` source;
- `expressionKind` : parole, geste ou mise en scène d'action;
- `renderedExpression` candidate;
- `meaningCovered[]`;
- `addedMeaning[]` et `omittedMeaning[]`;
- `styleChoices[]` reliés aux traits pertinents;
- `safeToUse` ou un refus de reformuler sans risque.

Les champs d'autoévaluation du modèle aident le diagnostic mais ne prouvent rien. Un contrôle indépendant compare la sortie à l'enveloppe sémantique et rejette notamment tout ajout d'objectif, consentement, connaissance, certitude, risque ou action.

L'entrée brute du joueur reste conservée dans le transcript. Si la reformulation est validée et prononcée, son texte exact et ses actes de parole deviennent la version vécue dans la scène.

## Contrat d'un interprète PNJ

La sortie distingue forme visible et portée structurée :

- `actorId` et destinataires perceptibles;
- `utterances[]` avec texte exact et ordre;
- `speechActs[]` : affirmation, question, promesse, menace, ordre, refus, mensonge intentionnel ou révélation;
- pour chaque proposition exprimée, sa base épistémique : connue, crue, déduite, incertaine ou fabriquée;
- `nonVerbalReactions[]` autorisées;
- engagements durables et références révélées;
- `knowledgeUsed[]` pour le contrôle de perspective.

Exemple conceptuel :

```json
{
  "speakerId": "guard-01",
  "text": "Ce registre n'a jamais existé.",
  "speechActs": [
    {
      "type": "assertion",
      "content": "Le registre n'existe pas",
      "epistemicBasis": "intentional_lie",
      "audience": ["player-character"]
    }
  ]
}
```

Le fait historique « le garde a prononcé cette phrase » peut être committé. Le contenu de la phrase reste une affirmation du garde et ne devient pas une vérité objective.

## Contrat du critique

Le critique retourne :

- un verdict `PASS`, `REVISE` ou `REJECT`;
- des constats identifiés et classés par gravité;
- les sorties, règles, sources ou engagements concernés;
- la nature du conflit;
- les contraintes d'une correction ciblée.

Il ne fournit pas silencieusement une proposition de remplacement, afin de ne pas devenir une seconde autorité créative non tracée.

## Contrat d'arbitrage des règles

Le `rules_adjudicator` retourne :

- domaine concerné et question à trancher;
- faits de situation considérés;
- références et versions des règles pertinentes;
- références des précédents comparables;
- proposition structurée, valeur recommandée et plage plausible si applicable;
- facteurs augmentant ou réduisant la valeur;
- catégorie d'arbitrage et portée;
- incertitudes importantes et besoin éventuel de critique.

Exemple pour une durée ouverte :

```json
{
  "recommendedDurationSeconds": 240,
  "plausibleRangeSeconds": [120, 480],
  "factors": [
    "fouille méthodique",
    "bureau de petite taille",
    "éclairage correct"
  ],
  "appliedRuleRefs": ["search.activity.general"],
  "adjudicationKind": "AD_HOC_RULING"
}
```

Le domaine temporel vérifie ensuite chronologie, limites, conflits et politiques applicables avant de retenir puis committer une durée.

## Contrat de rédaction visible

Le rédacteur reçoit un `RenderPlan` post-commit avec des emplacements déjà typés. Il produit uniquement les blocs narratifs autorisés, chacun relié aux faits, résultats ou textures qui le fondent.

Les blocs suivants restent séparés et sont assemblés selon leur ordre validé :

- narration du MJ;
- expression exacte validée du personnage joueur;
- répliques exactes validées des PNJ;
- notifications système éventuelles.

Le rédacteur ne reformule pas les dialogues validés. L'interface conserve ainsi l'identité du locuteur et le contrôle final peut comparer séparément chaque bloc à sa source.

## Destination des sorties

| Sortie | Destination | Visible directement | Peut muter directement |
|---|---|---:|---:|
| interprétation | orchestrateur et planificateur | non | non |
| plan MJ | validateurs et domaines | non | non |
| arbitrage de règle | domaine propriétaire | non | non |
| expression joueur | validateur sémantique puis commit | après validation et commit | non |
| performance PNJ | validateur de perspective puis commit | après validation et commit | non |
| critique | orchestrateur de correction | non | non |
| blocs narratifs | validateur de sortie puis interface | après validation | non |

## Taxonomie des échecs

Chaque échec est classé avant toute nouvelle tentative :

| Catégorie | Exemple | Reprise autorisée |
|---|---|---|
| `TRANSPORT_FAILURE` | délai fournisseur, connexion interrompue | nouvelle tentative technique idempotente |
| `INVALID_ENVELOPE` | JSON illisible, version ou corrélation incorrecte | correction de format puis régénération complète |
| `SCHEMA_VIOLATION` | champ absent, type ou énumération invalide | correction ciblée du même rôle |
| `REFERENCE_VIOLATION` | identifiant inconnu ou inaccessible | correction si la source autorisée existe, sinon replanification |
| `AUTHORITY_VIOLATION` | commande ou révélation hors périmètre | correction ciblée ou rejet selon la gravité |
| `SEMANTIC_CONFLICT` | intention déformée, connaissance indue, intrigue contradictoire | critique puis correction ou replanification |
| `STALE_CONTEXT` | scène, cible ou précondition modifiée | nouveau snapshot et reprise depuis l'étape dépendante |
| `PROVIDER_REFUSAL` | refus ou sortie inutilisable du fournisseur | autre tentative autorisée ou comportement dégradé |

Un échec ne doit jamais être converti silencieusement en succès partiel.

## Protocole de correction

La correction est adressée au rôle qui a produit la sortie fautive. Elle reçoit :

- l'identifiant de la sortie rejetée;
- les constats structurés et codes d'erreur;
- les champs ou décisions déjà verrouillés;
- les contraintes de correction;
- le même paquet autorisé ou un nouveau paquet reconstruit par l'orchestrateur.

Le rôle retourne une sortie complète portant `supersedesOutputId`. Le système ne fusionne pas un fragment JSON arbitraire avec l'ancienne sortie.

Les messages de correction sont construits par le système et ne recopient pas aveuglément du texte non fiable dans les instructions. Une demande du modèle pour obtenir plus de contexte, de secrets ou d'autorité reste une proposition soumise aux politiques normales.

### Décision du critique

- `PASS` poursuit le pipeline;
- `REVISE` renvoie au rôle responsable avec des contraintes ciblées;
- `REJECT` abandonne la proposition et reprend depuis le dernier point sûr, généralement la planification;
- un contexte obsolète ignore ces verdicts et impose une reconstruction depuis l'état courant.

Le critique ne corrige pas lui-même la proposition.

## Limites de reprise

Pour un même échec sémantique ou contractuel, la séquence de référence est :

```text
sortie initiale
  -> une correction ciblée
  -> une régénération complète
  -> arrêt sécurisé ou rendu dégradé
```

Les seuils deviennent configurables et mesurables lors des exigences non fonctionnelles, mais aucune boucle n'est illimitée. Les reprises techniques du fournisseur utilisent un compteur distinct et une clé d'idempotence commune à l'opération logique.

Chaque tentative possède son propre `attemptId`; toutes partagent un `operationId`. Une seule sortie peut être acceptée pour cette opération.

## Échec avant commit

Un échec épuisant les reprises avant commit ne produit aucune mutation. L'intention reste suspendue avec un état technique réessayable.

Le joueur n'est pas invité à reformuler pour compenser une panne interne. Une question lui est posée seulement si une ambiguïté réelle de son intention empêche la poursuite. Sinon, l'interface expose un échec technique et permet une reprise de la même intention.

## Échec après commit

Une erreur de rédaction après commit ne relance ni planification, ni résolution, ni performance des acteurs. Seul le rendu est corrigé.

Après épuisement des reprises, un générateur déterministe construit un rendu sécurisé depuis le `CommittedTurnResult` :

- action ou parole validée du personnage;
- résultat et changements perceptibles;
- temps écoulé;
- expressions et dialogues exacts déjà validés;
- notifications système nécessaires.

Ce rendu ne crée aucune texture, transition ou interprétation nouvelle. Il est marqué comme dégradé dans le diagnostic, pas nécessairement dans la fiction affichée. Une fois affiché et journalisé, il n'est pas remplacé silencieusement par une prose ultérieure.

## Idempotence des corrections

1. Une correction remplace une sortie candidate, jamais un événement committé.
2. Une régénération réutilise l'opération logique mais possède une tentative distincte.
3. Le commit refuse un `operationId` déjà committé.
4. Un rendu de secours lit le commit existant sans produire de commande.
5. Une reprise depuis un nouveau snapshot conserve la référence de l'intention initiale mais crée une nouvelle opération de résolution si l'ancienne n'a jamais été committée.

## Trois niveaux de traitement des règles

### Calcul logiciel

Le logiciel traite les règles dont les paramètres et l'algorithme sont suffisamment définis : durée fixe d'un repos, rounds de combat, ressources, distance et vitesse connues, inventaire, économie, topologie, jets et préconditions formelles.

### Interprétation assistée par IA

L'IA transforme une situation libre en facteurs structurés et propose l'application des règles pertinentes. Cela couvre notamment durée d'une activité décrite naturellement, difficulté contextuelle, intention sociale, portée d'une méthode improvisée ou conséquences plausibles non entièrement chiffrées.

Le logiciel valide ce qu'il peut prouver : contrat, sources, plage autorisée, préconditions, invariants et absence de conflit. Une critique sémantique intervient pour les arbitrages sensibles.

### Arbitrage ad hoc

Lorsqu'aucune règle ne couvre suffisamment le cas, l'IA exerce une délégation de jugement de MJ. La décision est étiquetée, sourcée, limitée au cas ou à la campagne et acceptée par le domaine propriétaire avant application.

Le précédent peut être rappelé lors d'un cas comparable, mais il ne modifie ni le corpus de règles ni les autres campagnes.

## Traitements sans appel IA

Restent entièrement logiciels lorsqu'aucune interprétation ouverte n'est nécessaire :

- validation de schéma, corrélation et références;
- contrôle des autorités, perspectives et secrets;
- calcul mécanique sur paramètres connus;
- génération et journalisation des jets;
- contrôle de ressources, inventaire et préconditions;
- commit, idempotence, versionnement et obsolescence;
- assemblage des blocs validés dans l'interface;
- sélection des souvenirs obligatoires et vérification de provenance;
- rendu sécurisé post-commit.

Une question factuelle peut être répondue depuis ces données sans IA. Une rédaction IA reste facultative si elle améliore la présentation sans altérer le contenu.

## Sécurité des sorties visibles

Le `RenderPlan` constitue une liste positive de ce qui peut apparaître. Le contrôle ne repose pas sur une liste de mots interdits.

Chaque bloc narratif contient `groundedIn[]`, qui référence ses faits perceptibles, résultats committés, dialogues validés ou permissions de texture. Le validateur vérifie que ces sources existent, sont dans la bonne version et sont révélables à la perspective joueur.

Une texture sensorielle sans fait durable utilise une permission précise du `creativeScope`; elle ne peut pas créer un objet, une sortie, une preuve ou une présence réutilisable.

Sont interdits dans la sortie joueur :

- vérité MJ, secret, intrigue ou conséquence future non révélés;
- pensée, motivation ou connaissance privée d'un PNJ;
- difficulté cachée, jet secret ou résultat non perceptible;
- proposition rejetée, valeur provisoire ou hypothèse présentée comme acquise;
- croyance du joueur ou d'un acteur reformulée comme vérité objective;
- fait, entité, possibilité ou engagement ajouté par le rédacteur;
- identifiant interne, prompt, score, diagnostic ou métadonnée fournisseur;
- raisonnement interne du modèle ou instruction de contrôle.

Le contrôle combine vérification structurelle et des références, droits de révélation déterministes, comparaison des affirmations avec leurs sources et critique sémantique ciblée pour les risques de paraphrase ou de fuite indirecte.

Le texte du joueur, le lore récupéré et les sorties précédentes sont traités comme des données non fiables, jamais comme des instructions capables d'élargir les permissions.

L'exemple [`Exemple-pipeline-tour.json`](Exemple-pipeline-tour.json) illustre un parcours complet et parseable. Il reste non contractuel tant que les schémas d'implémentation ne sont pas figés.

## Validation en couches

Avant mutation :

1. validation syntaxique et version du contrat;
2. validation du périmètre créatif et des autorités;
3. validation des références, préconditions et connaissances;
4. résolution par les domaines propriétaires;
5. contrôle de cohérence narrative lorsque le risque le demande;
6. contrôle d'obsolescence des dépendances;
7. commit atomique.

Avant affichage :

1. conformité au contrat de rédaction;
2. fidélité aux résultats committés;
3. respect de l'intention et de l'agence du joueur;
4. absence de révélation interdite;
5. absence de fait, conséquence, objet ou possibilité non autorisés;
6. cohérence des locuteurs et de leurs connaissances.

Un échec avant commit ne produit aucune mutation. Un échec après commit empêche seulement l'affichage de la rédaction candidate : le résultat committé reste valide et une correction ciblée de la forme est demandée.

## Invariants initiaux

1. Le texte final n'est jamais la source d'un résultat mécanique.
2. Un commit réussi précède toujours la rédaction d'une conséquence narrative.
3. Une rédaction rejetée ne rejoue pas la résolution et ne crée pas un second commit.
4. Une question méta ou une clarification ne fait pas avancer le temps diégétique.
5. Toute sortie IA peut être reliée à son paquet de contexte, son contrat et son résultat de validation.
6. Le coût et la latence peuvent être optimisés uniquement après les garanties de cohérence.

## Points à traiter

- frontières exactes et caractère obligatoire ou conditionnel de chaque rôle : traités;
- contrats de sortie structurés : traités;
- dialogue exact, reformulation du personnage joueur et engagements verbaux : traités;
- corrections ciblées, nouvelles tentatives et limites de reprise : traitées;
- traitements entièrement déterministes et arbitrages assistés : traités;
- contrôle des messages visibles et informations interdites : traités.
