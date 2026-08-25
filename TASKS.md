# Tableau d'exécution du projet

Dernière mise à jour : 2026-08-25

Ce fichier reste volontairement court. L'unique état global et feuille de route
du module narration est
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
Les contrats définissent les comportements ; le plan J10 porte le détail du lot.

## Lot actif — J10 : intégration narrative immersive

J1 à J9 sont fermés dans leur périmètre narratif. J10 rend leur verticale
entièrement pilotable dans l'interface sans transformer le jeu en tableau de
gestion. Voir
[`Plan-integration-narrative-immersive-J10.md`](test-GAME-2D/narration-module/docs/Plan-integration-narrative-immersive-J10.md).

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
- [ ] J10-G8 — chemin critique OpenAI live validé avec contexte incarné complet
  et routage technique structuré ; la contre-recette composée retourne une
  clarification V8 sûre plutôt que `UNDERSTOOD`. La première observation UI a
  permis de corriger les références des acteurs ambiants et de préserver
  exactement l'approche d'un acteur jusqu'à la narration, sans reprise
  lexicale ni notice technique côté joueur. Le second essai a également corrigé
  la conservation de la cible V8 entre deux tours : une reprise pronominale
  reçoit désormais le focus structuré précédent, tandis que les diagnostics de
  résolution restent hors du fil narratif même avec les options techniques.
  Les corrections locales sont vertes ; la fluidité doit continuer à être
  observée dans la vraie UI.

### Prochaine action concrète

Rejouer « je m'approche du clerc » puis une adresse pronominale telle que
« je lui demande où trouver des documents importants » aux Archives, avant de
poursuivre la recette manuelle ciblée
[`Recette-manuelle-UI-post-G8.md`](test-GAME-2D/narration-module/docs/Recette-manuelle-UI-post-G8.md)
depuis le build complet, puis classer les observations entre clarification sûre,
défaut de continuité contextuelle et limite connue du coordinateur multi-domaines.
Le checkpoint partiel est dans
[`Checkpoint-recette-OpenAI-live-G8.md`](test-GAME-2D/narration-module/docs/Checkpoint-recette-OpenAI-live-G8.md).
La preuve G7 reste dans
[`Checkpoint-gate-locale-G7.md`](test-GAME-2D/narration-module/docs/Checkpoint-gate-locale-G7.md).
La preuve G6 reste dans
[`Checkpoint-corpus-evaluation-G6.md`](test-GAME-2D/narration-module/docs/Checkpoint-corpus-evaluation-G6.md).
La preuve G5 reste dans
[`Checkpoint-routage-proprietaires-G5.md`](test-GAME-2D/narration-module/docs/Checkpoint-routage-proprietaires-G5.md).
La preuve G4 reste dans
[`Checkpoint-contexte-incarne-public-G4.md`](test-GAME-2D/narration-module/docs/Checkpoint-contexte-incarne-public-G4.md).
La preuve G3 reste dans
[`Checkpoint-mapping-semantique-fidele-G3.md`](test-GAME-2D/narration-module/docs/Checkpoint-mapping-semantique-fidele-G3.md).
La preuve G2 reste dans
[`Checkpoint-cadre-semantique-ouvert-G2.md`](test-GAME-2D/narration-module/docs/Checkpoint-cadre-semantique-ouvert-G2.md).
La preuve G1 reste dans
[`Checkpoint-OpenAI-seul-interpreteur-G1.md`](test-GAME-2D/narration-module/docs/Checkpoint-OpenAI-seul-interpreteur-G1.md).
Les plafonds G8 de six, trois puis un appel ont été consommés et respectés ;
aucun nouvel appel automatisé ne doit partir sans accord explicite.

## Dernier point de contrôle

- J1 à J9 sont fermés dans leur périmètre narratif ; la matrice finale distingue
  toujours la verticale narrative du chantier tactique différé.
- J9-C certifie la campagne continue dans Chromium et IndexedDB avec reprise et
  rejeux critiques sans doublon.
- J9-D certifie cinq familles de tours OpenAI live : treize appels HTTP 200,
  ordre canonique, rôles uniques et budget respecté.
- Les régressions ciblées, le build global et `git diff --check` sont verts au
  dernier point de contrôle.
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
