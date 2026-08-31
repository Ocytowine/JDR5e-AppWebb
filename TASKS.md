# Tableau d'exécution du projet

Dernière mise à jour : 2026-08-31

Ce fichier reste volontairement court. L'unique état global et feuille de route
du module narration est
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
Les contrats définissent les comportements ; les plans J10 et J10-I conservent
le détail des lots fermés.

## Lot actif — J10-J : résolution institutionnelle et réponses partielles

J1 à J9 sont fermés dans leur périmètre narratif. J10 rend leur verticale
entièrement pilotable dans l'interface sans transformer le jeu en tableau de
gestion. Voir
[`Plan-integration-narrative-immersive-J10.md`](test-GAME-2D/narration-module/docs/Plan-integration-narrative-immersive-J10.md).

Le plan correctif approuvé après la recette G8 est détaillé dans
[`Plan-correction-fiabilite-tour-narratif-J10H.md`](test-GAME-2D/narration-module/docs/Plan-correction-fiabilite-tour-narratif-J10H.md).
Il préserve les autorités des intrigues, missions, compagnons, inventaires,
voyages, repos, monde et tactique.

J10-H est fermé. Le plan officiel J10-I est dans
[`Plan-resolution-factuelle-et-connaissances-PNJ-J10I.md`](test-GAME-2D/narration-module/docs/Plan-resolution-factuelle-et-connaissances-PNJ-J10I.md).
Il sépare existence du fait, connaissance du PNJ et divulgation, puis raccorde
la recherche lore ciblée et les faits de campagne manquants au dialogue.

J10-I est fermé. Le premier test naturel post-certification ouvre J10-J. La
correction doit distinguer portée institutionnelle, fait partiel et identité
manquante sans aucune liste de mots ou de synonymes dans le runtime local.
Le plan officiel est dans
[`Plan-correction-resolution-institutionnelle-J10J.md`](test-GAME-2D/narration-module/docs/Plan-correction-resolution-institutionnelle-J10J.md).

- [x] J10-A — contrats du carnet privé, du récapitulatif public et de
  l'interruption narrative figés ; projections, huit sorties IA, migrations et
  traces UI auditées ; garde-fou exécutable actif.
- [x] J10-B — départ, poursuite, interruption persistée, réponse, reprise et
  arrivée raccordés à la saisie libre ; temps, processus, position et rejeux
  restent autoritaires, sans carte ni commande UI.
- [x] J10-C — politiques de recrutement et d'autonomie installées ; demandes,
  refus, séparation et réunion passent par le dialogue avec le PNJ visible,
  sans panneau de commande, jauge privée ou popup de quête.
- [x] J10-D — carnet privé multi-intercalaires livré dans une base IndexedDB
  séparée, avec autosauvegarde, restauration, conflits de révision et exclusion
  certifiée des autorités de campagne, du MJ et de tous les contextes IA.
- [x] J10-E — récapitulatif public structuré et inventaire personnel compact
  livrés en lecture seule ; projections bornées, statuts épistémiques,
  reconstruction déterministe et absence de secrets certifiés dans Chromium.
- [x] J10-F — traces et diagnostics masqués par défaut, accès développeur
  explicite, surfaces monde/tactique non sollicitées retirées et parcours
  continu certifié dans Chromium depuis les seules interactions joueur.
- [x] J10-G0 — baseline figée, 16 fichiers consommateurs suivis, matrice des
  reprises lexicales publiée et garde anti-augmentation active ; toutes les
  gates ciblées et le build sont verts sauf le défaut antérieur documenté de
  mémoire des conversations longues.
- [x] J10-G1 — OpenAI est l'unique interpréteur du chemin de jeu ; configuration
  absente, panne ou sortie refusée produisent une clarification immersive sans
  domaine, commit ni temps, certifiée dans Chromium sur HTTP 503 simulé.
- [x] J10-G2 — le contrat `ai-intent-semantic/8` transporte le sens global,
  `UNDERSTOOD` ou `NEEDS_CLARIFICATION` et une suite non plafonnée de composantes
  ouvertes ; le schéma serveur ne recanonicalise pas la sortie OpenAI.
- [x] J10-G3 — V8 est conservé intégralement dans l'interprétation runtime sans
  lecture sémantique du texte brut ; clarification et composantes
  `UNDERSTOOD_UNSUPPORTED` restent sans domaine, commit ni temps avant G5.
- [x] J10-G4 — le contexte incarné public V1 réunit profil joueur explicitement
  public, références nommables, connaissances, scène, interlocuteur, focus,
  intentions récentes, compagnons et processus actif, avec bornes et canaris.
- [x] J10-G5 — plan ordonné et ports propriétaires raccordés par identifiants
  exacts de capacités ; prévalidation tardive, arrêts, reçus et rejeux sont
  certifiés sans texte brut ni modification du sens compris.
- [x] J10-G6 — corpus permanent de 24 cas sur 20 axes, fournisseur OpenAI
  simulé réservé aux tests, mapping, contrôleur et cinq cas Chromium certifiés
  sans prose exacte, fallback, commit ni temps indus.
- [x] J10-G7 — adaptateur propriétaire V8 installé sans saisie brute,
  configuration produit basculée vers V8 et gates autorité, corpus, contrôleur,
  build complet et surface React/Chromium certifiées localement.
- [x] J10-G8 — chemin critique OpenAI live validé avec contexte incarné complet
  et routage technique structuré ; la contre-recette composée retourne une
  clarification V8 sûre plutôt que `UNDERSTOOD`. La première observation UI a
  permis de corriger les références des acteurs ambiants et de préserver
  exactement l'approche d'un acteur jusqu'à la narration, sans reprise
  lexicale ni notice technique côté joueur. Le second essai a également corrigé
  la conservation de la cible V8 entre deux tours : une reprise pronominale
  reçoit désormais le focus structuré précédent, tandis que les diagnostics de
  résolution restent hors du fil narratif même avec les options techniques.
  Le diagnostic complet du dernier échange est maintenant consultable et
  copiable dans un panneau séparé. Le PNJ validé par une capacité de dialogue
  est transmis directement au performer OpenAI sans dépendre d'une assignation
  facultative du planner ; les anciennes clarifications restent lisibles sans
  exposer leur diagnostic interne. La micro-séquence sémantique compatible
  « approche puis communication vers le même acteur visible » est maintenant
  exécutée dans un commit local ordonné, y compris lorsque le dialogue est
  propriétaire du domaine social. Une capacité exacte retrouve désormais son
  domaine dans le registre sans être annulée par le `suggestedDomain` redondant
  de l'IA ; les autres compositions multi-domaines ou multi-cibles restent
  suspendues. Le budget du `scene_writer` passe de 1 500 à
  2 500 jetons après observation d'une sortie OpenAI incomplète.
  J10-H0 à H7 ont ensuite remis à niveau les recettes historiques, isolé puis
  corrigé les défauts produit et fermé la verticale dans la vraie UI OpenAI.
- [x] J10-H0 — les trois recettes conversationnelles historiques injectent un
  fournisseur sémantique V8 exact ; la gate locale fige séparément double
  envoi, perte d'interlocuteur actif, timeout planner et contradictions de
  diagnostic sans modifier le comportement produit.
- [x] J10-H1 — un coordinateur synchrone verrouille avant la création du
  `clientRequestId`, persiste le payload pendant le vol et reprend la même
  identité après erreur ou reload ; les cinq scénarios navigateur sont verts.
- [x] J10-H2 — `local-interaction-focus/1` est persistant, public et borné par
  scène ; il restaure l'interlocuteur après reload et ferme proprement sur
  cible, départ, disparition, scène, processus incompatible ou tactique.
- [x] J10-H3 — `open-semantic-fidelity-receipt/1` distingue cadre V8 original
  et projection propriétaire effective ; expression brute, cible validée, acte
  OpenAI, composantes, ordre et provenance traversent désormais le tour sans
  donner le texte brut ni une autorité supplémentaire aux propriétaires.
- [x] J10-H4 — limites planner alignées sur la route, plan V8/G5 non dupliqué,
  séquences distantes bornées à trois, paquet performer mesuré et réduit à cinq
  tours par acteur, fallbacks immersifs fondés sur l'acte et non persistés comme
  performances acceptées.
- [x] J10-H5 — `narrative-technical-diagnostic/1` sépare interprétation,
  routage, résolution et présentation dans le panneau développeur ; les échecs
  sont attribués au rôle et à l'acteur, la télémétrie planner distingue budgets,
  usage réel et plafond, et l'ancienne injection technique dans le fil est
  supprimée.
- [x] J10-H6 — matrice composée dialogue vers inventaire, mission, intrigue,
  voyage et tactique certifiée ; secrets, autonomie, temps, ressources,
  commits, rejeux, idempotence, migrations IndexedDB, Chromium et build global
  sont verts sans appel OpenAI live.
- [x] J10-H7 — recette OpenAI live finale certifiée : approche et salutation,
  reprise pronominale après reload, changement d'interlocuteur et transition
  propriétaire passent sans fallback ni doublon dans le fil joueur.
- [x] Correctif post-J10-H7 — plusieurs actes `scene.visible-dialogue` engagés
  et adressés à un acteur unique forment désormais un groupe social ordonné ou
  atomique ; la cible structurée traverse les composantes, leurs actes restent
  dans la commande et les groupes multi-cibles demeurent suspendus.
- [x] Correctif post-J10-H7 — `rawInputEcho` reste informatif : une correction
  typographique de la saisie par OpenAI ne rejette plus un cadre V8 valide ;
  l'enveloppe d'appel corrèle la réponse et le texte local demeure autoritaire.
- [x] Correctif post-J10-H7 — une hypothèse rhétorique incluse dans une parole
  `committed` reste du contenu social exécutable ; seule une parole réellement
  `conditional` attend encore l'établissement de sa condition.
- [x] J10-I0 — figer le corpus factuel, inventorier les références de
  connaissance réellement consommées et définir les contrats sans modifier le
  performer ni ouvrir de création ; la gate réelle des Archives, quatorze cas
  et le build sont verts.
- [x] J10-I1 — transporter un besoin d'information ouvert dans V8, le plan G5,
  la commande propriétaire et le reçu de fidélité, sans second interpréteur
  lexical ni autorité métier ; schéma serveur, validateurs et corpus sont verts.
- [x] J10-I2 — rechercher les faits par sujet, propriété et relations avec
  priorité aux projections de campagne ; le titre et le siège de Lysenthe sont
  retrouvés depuis les Archives et les `knowledgeRefs` sont raccordables.
- [x] J10-I3 — projeter candidat par candidat les connaissances communes,
  locales, professionnelles et acquises du PNJ, séparément du joueur et de la
  divulgation ; garde, voyageur, archiviste et frontière restreinte sont verts.
- [x] J10-I4 — faits libres de campagne et identité légère écrits atomiquement ;
  cycle assertion/remplacement/invalidation, conflit, cardinalité, idempotence,
  reconstruction, ancres wiki, priorité de lookup, snapshots de révision,
  reload IndexedDB et concurrence sans doublon sont certifiés. Le contrat
  transverse catalogue → propriétaire → lecteur → consommateur est documenté.
- [x] J10-I5 — connaissance et divulgation séparées ; fait public, croyance,
  incertitude, secret protégé, ignorance et orientation crédible possèdent une
  cause structurée sans fuite privée ni refus générique lié au rôle.
- [x] J10-I6 — performer et fallback alimentés par les seuls faits autorisés ;
  témoignage attribué, diagnostic sûr et runtime campagne/wiki branchés dans le
  bootstrap jouable. Une panne performer conserve une réponse locale factuelle.
- [x] J10-I7 — matrice lore/campagne/rôles/rumeurs/secrets/création/remplacement,
  contrôleur réel, rejeu, IndexedDB, migrations, vraie UI Chromium, propriétaires
  J3 à J10-H et build global certifiés sans appel OpenAI live.
- [x] J10-J0 — transporter sujet, portée, propriétés et relations proposées par
  V8 sous forme de références ouvertes validées, sans routeur lexical local.
- [x] J10-J1 — supprimer les heuristiques historiques sur `subjectMention` et
  `requestedDimension`, puis parcourir génériquement le graphe lore depuis les
  références cataloguées, sans vocabulaire codé en dur.
- [x] J10-J2 — transmettre faits connus et dimensions manquantes au performer et
  au fallback pour corriger une prémisse sans fausse ignorance.
- [x] J10-J3 — exécuter la création contrôlée d'une valeur publique manquante
  avec identité légère, commit unique intégré au tour, sélecteurs factuels
  exploitables, budget conditionnel, contrôleur réel, concurrence et reload.
- [ ] J10-J4 — conserver l'acte directeur structuré d'un dialogue composé.
- [ ] J10-J5 — certifier corpus ouvert, vraie UI, IndexedDB, rejeu,
  propriétaires, budgets et build ; live uniquement sur accord explicite.

### Prochaine action concrète

Commencer J10-J4 par l'audit de la composition des actes sociaux afin qu'une
question accompagnée d'une justification conserve `ASK_QUESTION` comme acte
directeur structuré. La correction doit consommer l'ordre V8 sans relire la
prose. Ne lancer aucune recette OpenAI live sans accord explicite. Le plan de reprise est dans
[`Plan-correction-resolution-institutionnelle-J10J.md`](test-GAME-2D/narration-module/docs/Plan-correction-resolution-institutionnelle-J10J.md).

## Dernier point de contrôle

- J1 à J9 sont fermés dans leur périmètre narratif ; la matrice finale distingue
  toujours la verticale narrative du chantier tactique différé.
- J9-C certifie la campagne continue dans Chromium et IndexedDB avec reprise et
  rejeux critiques sans doublon.
- J9-D certifie cinq familles de tours OpenAI live : treize appels HTTP 200,
  ordre canonique, rôles uniques et budget respecté.
- Les régressions ciblées, le build global et `git diff --check` sont verts au
  dernier point de contrôle.
- J10-H0 remet au vert les trois recettes historiques avec une fixture V8
  exacte et ajoute `narration-module:test:j10h0-baseline`.
- J10-H1 ferme la course de soumission UI avec
  `narration-module:test:j10h1-submission` : double clic, Entrée répétée,
  Entrée + clic, reload pendant le vol et reprise après erreur conservent une
  identité unique. À sa fermeture, trois autres défauts restaient mesurés.
- J10-H2 ajoute `narration-module:test:j10h2-focus` : attention, dialogue,
  changement de cible, reload, présence, scène, départ, repos incompatible et
  tactique sont certifiés. J10-H3 ajoute
  `narration-module:test:j10h3-fidelity` : le cadre et la projection sont
  distincts, l'expression brute, la cible, l'acte, l'ordre et la provenance sont
  certifiés. J10-H4 ajoute `narration-module:test:j10h4-resilience` : limites,
  paquets, trois rôles ordinaires ou quatre avec création factuelle propriétaire
  et fallbacks sont certifiés, et la baseline H0 ne mesure
  plus aucun des écarts produit historiques initiaux.
- Le correctif post-J10-H7 regroupe maintenant question et déclaration vers un
  même acteur dans une commande sociale unique ; G5, G7, H3, H4, H5 et le build
  global le certifient sans appel OpenAI réel.
- J10-B certifie Archives → Halles depuis la saisie libre, avec interruption
  restaurée, réponse libre, reprise, arrivée et rejeux sans second temps.
- J10-C installe la verticale J4/J7 dans la composition UI et certifie refus de
  recrutement, recrutement autorisé, autonomie, séparation, réunion et rejeu via
  `npm run narration-module:test:j10c-companions`.
- J10-D certifie opérations, limites, conflits, isolement des portées, réouverture
  IndexedDB et absence de fuite réseau/IA via
  `npm run narration-module:test:j10d-notebook`.
- J10-E certifie projections publiques, statuts des connaissances, exclusion des
  canaris privés, reconstruction locale et inventaire consultatif via
  `npm run narration-module:test:j10e-recap`.
- J10-F certifie dans Chrome réel la création et reprise de campagne, le carnet
  privé, les aides-mémoire, le dialogue et l'autonomie du compagnon, le voyage
  interrompu puis repris et l'arrivée, sans carte, panneau omniscient, popup de
  quête ni appel direct aux pilotes de test, via
  `npm run narration-module:test:j10f-immersive-ui`.
- L'audit pré-UI du 2026-08-25 confirme que le fournisseur local lexical n'est
  pas une gate de compréhension naturelle et que V7 borne encore excessivement
  les compositions. J10-G0 à G7 corrigent ce point avant la recette live G8.
- J10-G1 retire la sélection locale de l'UI et toute valeur lexicale par défaut
  du contrôleur. `narration-module:test:openai-only-g1` certifie panne distante,
  clarification, zéro domaine et zéro mutation dans Chrome réel.
- J10-G2 ajoute le cadre ouvert V8 au schéma Structured Outputs et aux deux
  validateurs. `narration-module:test:open-semantic-frame-g2` certifie les cas
  simple, conditionnel, nié, alternatif, ambigu et une séquence de six
  composantes, sans liste fermée d'actions ni recanonicalisation serveur.
- J10-G3 conserve le cadre V8 comme source primaire dans
  `NarrativeIntentInterpretation`. `narration-module:test:open-semantic-mapping-g3`
  certifie indépendance au texte brut, fidélité des champs, statut déclaré par
  OpenAI, références publiques et absence de domaine, commit ou temps avant G5.
- J10-G4 envoie à V8 un unique `embodiedContext` versionné, borné et inclus dans
  l'empreinte. `narration-module:test:interpreter-embodied-context-g4` certifie
  profil public, contexte récent, processus actif, références nommables et
  exclusion des canaris mécaniques, intrigue, mémoire libre et carnet privé.
- J10-G5 construit `open-semantic-execution-plan/1` depuis les seuls
  identifiants exacts de capacités publiques. La gate
  `narration-module:test:open-semantic-owner-routing-g5` certifie prévalidation
  propriétaire ordonnée, arrêt avant étape ultérieure, intégrité et rejeu sans
  doublon, sans transmettre la saisie brute aux propriétaires.
- J10-G6 installe `open-semantic-evaluation-corpus/1` avec 24 cas couvrant 20
  axes. `narration-module:test:open-semantic-corpus-g6` certifie le mapping, cinq
  passages contrôleur et cinq passages Chrome réel avec fournisseur OpenAI
  simulé, sans appel live ni mutation indue.
- J10-G7 active `ai-intent-semantic/8` dans la configuration produit et projette
  l'unique étape routable vers les propriétaires installés sans leur transmettre
  la saisie brute. `narration-module:test:open-semantic-ui-g7` certifie le pont,
  la suspension sûre des compositions et la vraie surface React dans Chrome.
- J10-G8 a validé en live le dialogue dépendant du contexte public du personnage
  avec `gpt-5.6-luna`. `suggestedAction` reste ouvert et le nouveau
  `suggestedCapabilityId` est borné aux capacités publiées ; le plan G5 ne fait
  aucune déduction lexicale. La seconde recette a exposé une mauvaise continuité
  de l'interlocuteur et une condition trop large ; le prompt et le 24e cas local
  les corrigent. La contre-recette finale choisit une clarification sûre ; une
  observation UI ciblée doit maintenant mesurer si cette prudence reste fluide.

## Blocages et reports explicites

- Les tests de compétence attendent toujours une projection mécanique stable du
  créateur de personnage.
- Les compagnons tactiques et la surprise restent refusés par la projection
  actuelle. Le contrôle direct reste fermé sans capacité mécanique autoritaire.
- La génération de carte, le placement multi-acteurs et la reprise de
  `GameBoard` restent dans le chantier tactique futur décrit par le guide J8.
- La consolidation interne du moteur de simulation reste suivie dans
  [`world-simulation-corrective-roadmap.md`](test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md).
- `npm audit --omit=dev` signale une vulnérabilité transitive existante dans
  `@xmldom/xmldom` via PixiJS, à traiter avant livraison publique.

## Règle de mise à jour

À la fermeture d'une tâche, ne conserver ici que le lot actif, sa prochaine
action et les blocages. Mettre à jour la consolidation seulement si l'état
global, l'ordre des lots ou leurs critères changent. Ne créer aucun commit sans
demande explicite.
