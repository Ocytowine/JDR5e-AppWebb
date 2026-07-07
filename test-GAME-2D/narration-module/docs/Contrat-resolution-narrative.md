# Contrat resolution narrative bornee

Statut : `FIGE`

Version : `narrative-resolution/1`

Lot : I-06F

Date : 2026-07-07

## Objectif

I-06F introduit la premiere resolution narrative reelle apres l'interpretation conservatrice d'I-06E.

Le but n'est pas encore de livrer un MJ complet. Le but est de figer la frontiere qui permet a une intention joueur explicite d'etre resolue sans retomber dans les erreurs precedentes :

- une question ne devient jamais une action;
- une prose visible ne devient jamais une mutation;
- une reformulation RP ne change pas le choix du joueur;
- une sortie IA ne committe rien directement;
- une creation narrative reste une proposition tant que son domaine ne l'a pas promue;
- le temps, le tactique, le repos et les regles restent sous leurs proprietaires.

## Entrees autorisees

Le resolver recoit uniquement une operation deja creee par `NarrativeTurnControllerV1` et une interpretation issue de `intent-clarification/1`.

Entrees minimales :

- `CampaignId`, `OperationId`, `clientRequestId` et revision observee;
- texte brut joueur;
- `NarrativeIntentInterpretationV1`;
- snapshot ou contexte de role disponible lorsque le sous-lot l'active;
- politique de resolution developpeur;
- horloge et identifiants injectes pour les tests.

Une resolution ne doit jamais relire directement l'UI, le transcript cache, `localStorage`, `GameBoard.tsx` ou une route tactique historique.

## Sorties autorisees

Le resolver produit une enveloppe explicite, jamais du texte seul.

Types de sortie autorises :

- `NO_COMMIT_RESPONSE` : reponse informative, meta ou refus de resolution sans mutation;
- `CLARIFICATION_REQUIRED` : intention suspendue, sans temps et sans mutation;
- `RESOLUTION_PROPOSED` : proposition structuree non committable telle quelle;
- `COMMIT_PREPARED` : commandes metier preparees et validees localement, pretes pour `CampaignRepository.commit`;
- `COMMIT_APPLIED` : commit confirme, puis rendu visible;
- `HANDOFF_REQUIRED` : passage a un domaine proprietaire non encore ouvert dans I-06F, par exemple tactique ou repos.

Une sortie visible de type `DisplayPacketV1` est toujours derivee de l'enveloppe et des sources autorisees. Elle ne peut pas ajouter d'effet metier absent du commit ou de la suspension.

## Ordre obligatoire du tour resolu

Le pipeline I-06F suit cet ordre strict :

1. charger ou retrouver l'operation idempotente;
2. verifier que l'interpretation est compatible avec le texte initial;
3. arreter immediatement si l'intention est meta, possibilite ou ambiguite;
4. construire une demande de resolution bornee pour les intentions action, parole ou mixte;
5. separer reformulation, adjudication, propositions de creation et effets metier;
6. valider les references, la perspective, les secrets, les regles et les proprietaires;
7. refuser ou suspendre toute sortie qui exige un domaine non ouvert;
8. preparer les commandes metier autorisees;
9. committer atomiquement avant toute narration finale;
10. produire le `DisplayPacketV1` depuis le resultat confirme;
11. completer l'operation avec le resultat technique et les references du commit.

La narration finale intervient apres validation. Elle ne sert jamais a deviner ce qui doit etre commite.

## Reformulation du personnage joueur

La reformulation RP est autorisee uniquement comme mise en forme de l'intention du joueur.

Elle peut :

- corriger le style, la grammaire et le registre;
- adapter la formulation aux traits, capacites sociales, fatigue, equipement visible et contexte;
- rendre une parole concise plus incarnée;
- rendre une action plus claire dans la scene.

Elle ne peut pas :

- ajouter un objectif non exprime;
- augmenter le risque accepte;
- inventer une information connue par le personnage;
- promettre, menacer, attaquer, voler ou mentir si le joueur ne l'a pas engage;
- transformer une question en action;
- compenser une faiblesse mecanique par une elegance de joueur;
- punir une faute de frappe comme une faiblesse du personnage.

La sortie doit conserver une trace entre `rawPlayerText`, `interpretedIntent` et `characterExpression`.

## Resolution des paroles

Une parole joueur peut produire :

- un acte de parole durable;
- une reaction sociale;
- une information revelee par un PNJ;
- une modification de connaissance subjective;
- une demande de clarification;
- un point d'arret donnant la main au joueur.

Elle ne peut pas produire directement :

- une verite objective non validee;
- une promesse d'un PNJ sans autorite sur ce PNJ;
- une baisse ou hausse mecanique de relation sans validation du domaine social;
- un secret revele sans verification de perspective;
- une avance temporelle implicite non justifiee.

Le texte exact d'une replique PNJ validee doit rester distinct de la narration MJ.

## Resolution des actions

Une action joueur peut produire :

- une observation;
- une tentative resolue sans mecanique lourde;
- une demande de jet ou d'arbitrage de regle;
- une preparation de commit;
- un handoff vers tactique, repos ou autre domaine;
- une clarification si l'engagement ou la cible reste douteux.

Elle ne peut pas produire dans I-06F :

- un combat jouable;
- un repos jouable;
- une progression de personnage;
- un inventaire completement mute sans domaine proprietaire;
- une creation persistante de PNJ, lieu, intrigue ou objet sans promotion dediee;
- un effet qui depend d'une regle maison non exposee au resolver.

## Limites de creation IA

I-06F autorise la creation descriptive ephemere lorsqu'elle sert la scene immediate.

Exemples autorises :

- un detail d'ambiance;
- une posture de garde;
- une rumeur non confirmee;
- une micro-reaction sociale;
- un objet banal non revendique comme ressource.

Exemples non autorises sans promotion ulterieure :

- nouveau PNJ persistant;
- nouveau lieu important;
- nouvelle intrigue;
- indice critique;
- objet utile ou revendicable;
- evenement mondial;
- verite secrete;
- consequence mecanique durable.

Toute creation candidate qui pourrait revenir plus tard doit sortir comme proposition non autoritaire et citer ses raisons de promotion, ses sources et ses limites.

## Temps et rythme

Le temps ne progresse pas pour :

- une question meta;
- une question de possibilite;
- une clarification;
- une erreur d'interpretation refusee;
- une information hors narration.

Le temps peut etre propose pour :

- dialogue en jeu;
- commerce;
- recherche locale;
- micro-deplacement;
- observation prolongee;
- action physique.

La duree reste une proposition validee par le domaine temporel. I-06F ne cree pas de seconde horloge.

## Handoffs obligatoires

Le resolver doit rendre `HANDOFF_REQUIRED` au lieu de resoudre localement lorsque :

- le conflit doit basculer en tactique;
- un repos commence;
- une regle maison exige un moteur specialise;
- une action modifie l'inventaire de maniere durable;
- une creation doit devenir persistante;
- une intrigue doit etre engagee;
- une consequence demande la simulation monde.

Le handoff contient le contexte minimal, les references et l'intention. Il ne contient pas un resultat deja decide.

## Politique d'erreur

Toute sortie invalide doit aboutir a un etat explicite :

- clarification;
- suspension;
- reponse de non-commit;
- incident expurge;
- handoff refuse.

Un echec de generation visible apres commit ne rejoue pas le commit. Le fallback rend un message sobre base sur les evenements confirmes.

## Tests obligatoires avant fermeture I-06F

Le sous-lot d'implementation devra prouver au minimum :

- action explicite resolue ou suspendue sans mutation cachee;
- parole joueur reformulee sans changement d'intention;
- question de possibilite toujours non executee;
- creation persistante refusee ou emise comme proposition;
- handoff tactique detecte sans combat simule par narration;
- temps nul pour meta, possibilite et clarification;
- commit avant rendu final lorsque commit il y a;
- idempotence du meme `clientRequestId`;
- conflit d'idempotence detecte;
- absence d'appel direct a `GameBoard.tsx`, `localStorage` et routes IA tactiques historiques.

## Autorisation d'implementation

I-06F est autorise uniquement pour construire cette frontiere de resolution bornee.

Restent fermes :

- orchestration IA complete de MJ;
- streaming fournisseur vers l'UI;
- tactique jouable;
- repos jouable;
- progression de personnage;
- economie complete;
- creation persistante automatique;
- intrigue dynamique committable;
- certification UX et qualite fournisseur.
