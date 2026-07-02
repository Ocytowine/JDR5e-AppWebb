# Scénarios d'acceptation du module narration

Statut : `RETENU` — atelier 12 bouclé; fixtures exécutables à produire avec le futur runtime.

## Objectif

Transformer les décisions du dossier de conception en comportements observables sans imposer une prose, une intrigue ou une solution préécrites à l'IA.

Un scénario vérifie un risque précis ou un parcours cohérent. Il n'est ni un dialogue écrit à l'avance, ni une sauvegarde de démonstration destinée à devenir canonique.

## Unité d'échange

Un échange commence par une entrée du joueur et se termine par une sortie finale validée ou une demande de clarification. Les appels internes, corrections et validations ne créent pas d'échanges supplémentaires.

Une réponse du joueur à une clarification ouvre un nouvel échange. La reprise qui suit appartient à cet échange et doit conserver l'intention suspendue sans la déformer.

## Granularité

| Classe | Échanges actifs | Usage |
|---|---:|---|
| Atomique | 1 à 3 | une règle ou un risque isolé |
| Séquence fonctionnelle | 4 à 8 | interaction et conséquences proches |
| Parcours vertical | 12 à 20 | boucle MVP entre plusieurs domaines |
| Mémoire longue | 3 à 6 sur historique préparé | rappel après ellipse sans rejouer des centaines de tours |

Un scénario automatisé est limité à 20 échanges. Un parcours plus long devient une suite de scénarios reliés par des checkpoints validés afin de localiser les échecs et de maîtriser coût et non-déterminisme.

## Contrat d'un scénario

Chaque scénario possède :

- un identifiant stable, un titre et le risque couvert;
- les contrats et décisions auxquels il renvoie;
- une fixture versionnée et ses préconditions;
- les faits autoritaires, secrets et perspectives initiales;
- les entrées joueur et variantes autorisées;
- l'interprétation attendue et les points d'arrêt permis;
- les commandes, événements, mutations et avances temporelles obligatoires ou interdites;
- les contraintes de contexte et de sortie visible;
- les checkpoints et l'état final attendu;
- les incidents ou traces diagnostiques attendus;
- les assertions déterministes, sémantiques et qualitatives.

## Trois niveaux d'oracle

### Déterministe

État, événements, temps, inventaire, règles, autorités, visibilité et idempotence sont comparés exactement selon leur contrat.

### Sémantique

Intention, agence, connaissances, engagements et absence de contradiction sont évalués par assertions structurées et cas annotés. Une formulation différente reste valide si elle préserve ces contraintes.

### Qualitatif

Mise en scène, lisibilité, rythme et voix sont évalués par la grille humaine versionnée. Ils ne peuvent rendre acceptable un échec déterministe ou sémantique.

## NAR-ACC-001 — Question hypothétique face au garde

### Risque

Transformer une demande d'information en action du personnage.

### État initial

Le personnage se trouve face à un garde dont les clés sont perceptibles. Aucune tentative de vol n'est engagée et le garde ne soupçonne rien.

### Entrée principale

`Est-ce que je pourrais lui voler ses clés ?`

### Résultats obligatoires

- classifier l'entrée comme question hypothétique ou demander une clarification sans risque;
- ne produire aucune commande de vol, aucun jet, aucune réaction du garde et aucune mutation d'inventaire;
- ne pas avancer l'horloge de campagne si l'échange reste méta;
- répondre sur la possibilité ou reprendre après clarification selon l'intention confirmée.

### Résultats interdits

- mettre en scène une main tendue vers les clés;
- rendre le garde méfiant;
- déclencher un conflit;
- mémoriser une tentative de vol inexistante.

### Longueur

Un échange si la question est comprise sans ambiguïté. Jusqu'à trois si le système suspend, demande confirmation puis reprend l'intention confirmée.

La prose exacte n'appartient pas à l'oracle.

## NAR-ACC-002 — Parcours vertical nominal aux Archives de Lysenthe

### Risques couverts

Vérifier qu'une même campagne traverse création contextuelle, dialogues multiples, résolution sociale, intrigue dynamique, temps, tactique, repos, sauvegarde et rappel tardif sans perte d'autorité ni quête préécrite.

### Fixture

- personnage valide importé depuis l'éditeur existant;
- ville `lysenthe` et bâtiment `archives_de_lysenthe` issus du wiki;
- Archives privées, contrôlées par le Collegium, en bon état et de niveau de sécurité élevé;
- aucun PNJ, intrigue ou adversaire concret imposé au générateur en dehors des contraintes du lieu;
- horloge, versions de règles et graine de fixture connues.

Le scénario comporte 18 échanges actifs et quatre checkpoints. Les intentions joueur sont fixées par la fixture; leurs formulations peuvent varier dans les variantes du corpus.

### Checkpoint A — Entrée en scène, échanges 1 à 4

1. importer le personnage et ouvrir la campagne;
2. entrer aux Archives et construire la scène depuis le lore validé;
3. observer librement le lieu;
4. poser une question méta au MJ.

Assertions principales : identité distincte entre fiche source et personnage de campagne, caractéristiques visibles pertinentes, accès privé et contexte local respectés, aucune invention mécanique, aucun temps de campagne consommé par l'échange méta.

### Checkpoint B — PNJ et intrigue, échanges 5 à 9

5. rencontrer un figurant compatible avec les profils du lieu;
6. lui adresser une réponse brève que l'adaptateur peut mettre en rôle sans changer son sens;
7. faire intervenir un second PNJ possédant une perspective distincte;
8. tenter une résolution sociale pour accéder à une information ou une zone privée;
9. percevoir l'existence d'une intrigue contextuelle sans menu de choix direct.

Assertions principales : paroles attribuées visuellement au bon acteur, aucune connaissance partagée sans cause, résolution sociale issue du domaine propriétaire, promotion du figurant seulement si son importance le justifie, intrigue ancrée dans le lieu et solvable sans contenu entièrement prédéfini.

### Checkpoint C — Conséquences et tactique, échanges 10 à 14

10. choisir de poursuivre la situation créée;
11. enquêter ou se déplacer avec une durée arbitrée puis validée;
12. recevoir une conséquence causale combinant intrigue et état du monde;
13. atteindre une confrontation qui ne peut plus être résolue en un échange narratif;
14. transférer le contrôle au tactique, résoudre le combat puis intégrer son résultat une fois.

Assertions principales : chronologie avancée uniquement par activités fictionnelles, confrontation justifiée par les choix et non forcée par le test, handoff complet, résultat tactique autoritaire, aucun double commit au retour.

### Checkpoint D — Repos et continuité, échanges 15 à 18

15. produire la scène de continuation depuis le résultat committé;
16. démarrer un repos avec signal UX et questions issues des règles;
17. terminer ou interrompre le repos, sauvegarder puis recharger la campagne;
18. appliquer une longue ellipse et revenir aux Archives.

Assertions principales : effets du repos issus du moteur, popup déclenchée par les événements committés, reprise au dernier checkpoint, PNJ et relation retrouvés, lieu actuel comparé à la dernière perception, souvenirs utiles rappelés sans historique complet.

### Libertés obligatoires

Noms, voix, motivation précise, contenu de l'intrigue, indices, nature de la confrontation et prose demeurent variables. Ils doivent respecter lore, vérités créées, autorités et contraintes du scénario. Une variante valide peut échouer à la tentative sociale ou interrompre le repos si la suite causale reste couverte par un checkpoint adapté.

### Résultats interdits

- transformer le parcours en liste de choix proposée au joueur;
- créer un combat sans cause pour satisfaire l'étape tactique;
- faire des paroles d'un PNJ une vérité objective sans validation;
- perdre ou recréer sous une autre identité un PNJ promu;
- restaurer un ancien état de la chronologie lors du rechargement;
- révéler au retour des changements que le personnage ne peut pas connaître.

## NAR-ACC-003 — Création, promotion et réapparition d'un PNJ

Sur environ six échanges séparés par une ellipse, l'IA crée un figurant compatible avec le lieu, puis le promeut seulement après une interaction qui justifie sa persistance. Après sauvegarde et avance temporelle, le même identifiant doit retrouver identité, perspective, connaissances acquises et relation, sans être recréé ni connaître des événements hors de sa portée.

L'oracle accepte une évolution causée par le monde ou le temps. Il refuse le gel artificiel du PNJ comme la modification sans événement de ses traits stables.

## NAR-ACC-004 — Souvenir ancien évoqué par paraphrase

Une fixture contient un événement ancien et plusieurs souvenirs voisins. En trois à quatre échanges actifs, le joueur l'évoque sans reprendre ses mots ni ses identifiants, par exemple à partir d'une odeur et de registres humides.

Le souvenir pertinent doit être retrouvé par sens, contexte et relations. Les souvenirs voisins non utiles restent hors du contexte, les éléments oubliés par le personnage ne sont pas restitués comme certains et le texte complet de l'ancien échange n'est pas requis.

## NAR-ACC-005 — Retour dans un lieu transformé

Après plusieurs mois simulés, quatre à six échanges vérifient le retour aux Archives. L'état actuel est reconstruit depuis le lieu, les événements et le monde; la mise en scène s'appuie sur la dernière perception du personnage.

Le lieu conserve son identité malgré ses changements. Seuls les effets actuellement perceptibles ou appris sont révélés : causes secrètes, événements invisibles et ancien état système jamais observé restent absents de la narration visible.

## NAR-ACC-006 — Intrigue cohérente, témoignage et fausse piste

Sur huit à douze échanges, une intrigue générée doit établir une vérité cachée, une causalité, des indices compatibles, un témoignage incomplet ou erroné, une fausse piste réfutable et des connaissances distinctes par acteur.

Après validation, ces éléments deviennent des engagements persistants. La suite vérifie stabilité des détails structurants, solvabilité, absence de fuite, distinction entre témoignage et vérité et impossibilité pour une hypothèse du joueur de modifier le réel.

Le test distingue la capacité de générer une intrigue conforme de la capacité à respecter une intrigue déjà gelée. Le protocole détaillé de cette double méthode doit être validé avant de figer la fixture.

## NAR-ACC-007 — Événement ignoré évoluant hors écran

Le joueur observe une situation puis choisit de ne pas intervenir. Après simulation hors écran, cinq à huit échanges au total vérifient que l'événement a évolué selon ses acteurs, son urgence et les systèmes propriétaires.

Le retour expose uniquement les conséquences perceptibles. L'événement ne reste pas figé pour attendre le joueur, mais une intrigue critique ne peut pas être résolue arbitrairement par un niveau de simulation abstrait incapable de préserver ses engagements.

## Protocole en deux phases des intrigues

Le scénario `NAR-ACC-006` sépare obligatoirement deux capacités.

### Phase A — Certification de la création

Le générateur reçoit état du monde, lore, acteurs, complexité et espaces créatifs autorisés, sans coupable, solution ou indices imposés. Sa proposition doit fournir vérité cachée, causalité, acteurs, motivations, connaissances, indices, témoignages qualifiés, fausse piste réfutable, chemins de résolution et conséquences possibles.

Schéma, lore, causalité, solvabilité, absence de dépendance circulaire, séparation des perspectives et protections de secrets sont validés avant promotion. Une intrigue invalide n'entre jamais dans la campagne pour être « réparée plus tard ».

### Phase B — Régression de continuité

Une proposition acceptée est exportée comme fixture versionnée. Sont gelés identifiants, vérité, causalité, graphe d'indices, connaissances, fiabilités, conditions de révélation et engagements; la prose ne l'est pas.

Des scènes successives couvrent indice découvert, témoignage erroné, hypothèse incorrecte du joueur, ellipse, évolution hors écran, nouvel indice et tentative de résolution. Chaque checkpoint vérifie stabilité de la vérité, connaissances par acteur, statut des témoignages, absence de révélation prématurée et solvabilité restante.

Le corpus conserve plusieurs formes d'intrigue afin d'éviter l'optimisation sur un seul cas. Une fixture n'est jamais remplacée automatiquement par la sortie d'un nouveau modèle : modification, revue et version sont explicites.

Les certifications avec fournisseur réel évaluent la phase A à intervalles contrôlés. Les régressions de phase B peuvent utiliser des sorties de rôles contrôlées pour isoler rapidement les contrats applicatifs, complétées par des exécutions intégrées avant livraison.

## NAR-ACC-008 — Action mécaniquement impossible

En un à trois échanges, le joueur tente une action interdite par l'état ou emploie une capacité absente de sa fiche. Le domaine propriétaire refuse avant commit. Aucun jet ne rend possible une impossibilité établie, aucune ressource n'est consommée et la prose se limite à expliquer ou mettre en scène le résultat validé.

Une difficulté élevée mais possible appartient à une variante distincte afin de vérifier que le système ne confond pas impossibilité et faible probabilité.

## NAR-ACC-009 — Inventaire, apparence et commerce

Sur quatre à six échanges, une transaction mobilise monnaie physique, conteneur, objet et emplacement visible. L'état de la tenue et la propreté peuvent contribuer à l'évaluation sociale sans modifier la caractéristique de Charisme.

Objet, monnaie et stockage sont committés atomiquement. Une capacité insuffisante, un contenant inaccessible ou une rupture de précondition annule toute la transaction. La narration ne décrit comme porté ou visible que ce que la projection autoritaire expose.

## NAR-ACC-010 — Voyage et rencontre contextuelle

Sur quatre à huit échanges, une route et sa durée validée font avancer l'horloge. Dangerosité, environnement, situation mondiale et hasard contrôlé peuvent produire une rencontre hostile, étrange ou sociale.

La rencontre n'impose ni interaction ni menu de choix. L'observation, l'évitement et l'approche libre restent possibles. Rejouer le même batch temporel ne crée pas une seconde rencontre.

## NAR-ACC-011 — Passage tactique et retour

Quatre à huit échanges narratifs encadrent une fixture tactique. Le handoff contient cause, acteurs, positions, état, objectifs et identités stables. Le module tactique devient propriétaire de la résolution jusqu'à son checkpoint final.

Blessures, morts, ressources, objets, temps et autres conséquences validées sont intégrés une seule fois. Une panne de rédaction après retour utilise le résultat committé; elle ne rejoue ni combat ni récompense.

## NAR-ACC-012 — Repos interrompu

Sur quatre à six échanges, le repos débute par un événement committé puis un signal UX. Les questions et choix proviennent des règles applicables. Une interruption à un instant précis segmente l'avance temporelle et interdit les bénéfices dont l'échéance n'est pas atteinte.

Fin et interruption produisent des signaux distincts. Un popup anticipé ou un avantage accordé par la prose constitue un échec.

## NAR-ACC-013 — Sauvegarde et migration

Deux à quatre échanges sont entourés d'une fermeture, d'un redémarrage et d'une migration. La transformation opère sur une copie, vérifie versions, références, événements et checksums, puis bascule seulement après validation.

La reprise continue depuis le dernier checkpoint committé sans choix d'un état antérieur. Une migration échouée ou une archive future inconnue ne modifie jamais la campagne active.

## NAR-ACC-014 — Panne IA avant et après commit

La variante pré-commit provoque timeout ou sortie invalide avant la transaction : aucune mutation ou avance temporelle n'est visible. La variante post-commit fait échouer la rédaction : un rendu déterministe restitue le résultat sans répéter l'opération métier.

Une réponse tardive issue d'une tentative remplacée est conservée au diagnostic puis ignorée par le pipeline actif.

Les variantes fournisseur couvrent également : timeout transitoire avec reprises bornées sous la même identité d'opération, quota épuisé sans mutation, ouverture du circuit après le seuil configuré et fallback uniquement vers un modèle certifié pour le même rôle. Sans fallback certifié, le rôle critique se suspend au lieu d'élargir ses permissions.

## NAR-ACC-015 — Contexte supérieur au budget

Dans une première variante, décoration, répétitions et souvenirs secondaires sont réduits dans l'ordre prévu tandis que le socle obligatoire reste intact. Dans une seconde, le socle dépasse à lui seul l'enveloppe : aucun appel incomplet n'est lancé et l'opération échoue ou se découpe explicitement.

Le diagnostic conserve sélection, exclusions, budget et motif sans recopier les secrets.

## NAR-ACC-016 — Création contradictoire ou doublon

En trois à cinq échanges, une proposition correspond fortement à une entité ou un événement existant. Identifiants, ancres, traits stables et relations sont comparés avant promotion.

Le système réutilise, fusionne uniquement les champs compatibles ou rejette puis régénère. Créer une seconde identité pour contourner la contradiction, écraser une vérité ou fusionner deux entités seulement homonymes est interdit.

## NAR-ACC-017 — Reformulation fidèle et affichage multi-acteur

En deux à quatre échanges, un personnage intelligent mais peu charismatique répond brièvement et avec maladresse. L'adaptateur peut développer la forme selon ses traits sans ajouter information, objectif, consentement, action ou assurance absents de l'entrée.

L'interface distingue texte saisi, expression mise en scène, narration et répliques de plusieurs PNJ par des repères autres que la couleur seule. Une attribution ambiguë, une correction de fond ou une parole ajoutée au personnage constitue un échec.

## NAR-ACC-018 — Double soumission et écrivains concurrents

Deux variantes simulent un double clic avec le même `clientRequestId`, puis deux onglets portant des intentions différentes depuis la même version.

Le doublon retourne l'opération existante. Dans le conflit multi-onglets, un seul fencing token peut committer; l'autre intention devient `STALE` ou rencontre `CAMPAIGN_BUSY`, reste traçable et n'est jamais rejouée automatiquement. Temps, ressources et événements ne sont appliqués qu'une fois.

## NAR-ACC-019 — Contenu hostile, import et secret

Entrée joueur, fragment de wiki et mémoire générée contiennent des instructions visant à changer de rôle ou révéler une vérité privée. Une archive contient en plus des clés de prototype interdites et un nom comportant du HTML actif.

Tous les textes restent des données, les clés dangereuses font rejeter l'import, le nom est rendu comme texte et aucun secret, prompt ou détail fournisseur n'atteint sortie, diagnostic ou export. L'opération saine peut continuer après confinement de l'élément fautif.

## NAR-ACC-020 — Échéances simultanées et frontière temporelle

Un bénéfice de repos, un événement mondial et une conséquence différée deviennent exigibles à la même seconde. Le scénario fixe leurs priorités, frontières inclusives ou exclusives et identités d'échéance.

L'ordonnanceur produit le même ordre à chaque exécution. Une interruption antérieure dans cet ordre peut empêcher le bénéfice ultérieur. Rejouer le `TemporalBatch` retourne le commit existant sans second tick, seconde rencontre ou double consommation.

## NAR-ACC-021 — Règle maison et arbitrage ouvert

Une règle maison versionnée contredit la connaissance générique du modèle : la règle du `RuleRegistry` prévaut et sa version apparaît dans la justification. Une seconde variante présente un cas réellement non couvert.

Le `rules_adjudicator` peut alors proposer une analogie ou un arbitrage ponctuel fondé sur les sources reçues. L'acceptation produit un `AdjudicationRecord`, jamais une nouvelle règle officielle ni une mutation directe par l'IA.

## NFR-ACC-001 — Campagne synthétique de résistance

Le benchmark non conversationnel construit 10 000 tours, 2 000 scènes, 2 000 PNJ, 1 000 lieux, 200 000 événements, 50 000 mémoires et 500 Mo hors médias.

Il mesure ouverture, recherches, snapshot, tours, stockage et export; provoque fermeture brutale et reprise; importe puis migre une version antérieure. Il vérifie seuils de [`Exigences-non-fonctionnelles.md`](Exigences-non-fonctionnelles.md), absence de parcours global sur le chemin critique, perte, duplication et fuite technique.

Les coûts monétaires et enveloppes par modèle restent mesurés dans le profil fournisseur avant implémentation finale, conformément au report accepté de l'atelier 11.

## Lots du corpus

- [x] Lot 1 — Format, niveaux d'oracle et granularité.
- [x] Lot 2 — Parcours vertical nominal.
- [x] Lot 3 — Mémoire longue, intrigue et monde vivant.
- [x] Lot 4 — Domaines propriétaires, sauvegarde et résilience.
- [x] Lot 5 — Matrice de couverture et audit du corpus.

La traçabilité complète est tenue dans [`Matrice-tracabilite-acceptation.md`](Matrice-tracabilite-acceptation.md).
