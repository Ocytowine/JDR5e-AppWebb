# Tableau de bord du projet

Dernière mise à jour : 2026-07-31

Ce fichier ne contient que le travail actif, la prochaine décision et les blocages.
L'état détaillé du module narration, ses principes et sa feuille de route sont dans
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).

## Étape active

- [x] Étape 0 — remettre la documentation narration à plat :
  - une seule source de reprise ;
  - un index séparant contrats actifs et archives ;
  - suppression des anciens suivis concurrents ;
  - feuille de route ordonnée et méthode de travail explicite.
- [x] Lot 1 — stabiliser et certifier le parcours sémantique V5 :
  - gate déterministe de huit tours ;
  - focus récent, clarification, changement d'interlocuteur et transition ;
  - recettes OpenAI Archives et arrière-salle ;
  - métriques séparées par rôle et build global validé.
- [x] Lot 2 — générer au build un catalogue lore narratif ciblé :
  - compilation du wiki retirée du navigateur ;
  - provenance, niveaux de connaissance et budget explicites ;
  - dimensions absentes laissées ouvertes à une création compatible ;
  - topologie et commits maintenus sous autorité locale ;
  - configuration `scene_creator` benchmarkée appliquée.
- [x] Lot 3 — étendre les conversations PNJ longues et leur mémoire courte :
  - identité et voix isolées par acteur, sans liste de fixtures ;
  - cinq couples joueur → réponse exacte au maximum par PNJ ;
  - changement d'interlocuteur et sortie-retour de scène validés ;
  - paroles maintenues comme projections attribuées, sans vérité ni engagement
    durable automatique ;
  - métriques OpenAI séparées entre interpréteur, performer et critique.
- [x] Lot 4 — ouvrir une autorité mission/relation bornée :
  - proposition et résolution persistées dans un registre propriétaire ;
  - acceptation, refus, condition et incertitude conservés distinctement ;
  - confirmation émise uniquement par une autorité de quête ou sociale valide ;
  - promotion durable précédée d'une relecture de cette confirmation ;
  - commits atomiques et rejeu idempotent validés.
- [x] Lot 5 — surcharger le lore auteur par l'état validé de campagne :
  - registre propriétaire distinct du catalogue de build ;
  - remplacement et masquage déterministes avec provenance ;
  - lecture historique bornée par la révision de campagne ;
  - même vue effective pour les scènes lore et le `scene_creator` ;
  - immutabilité du catalogue, atomicité et idempotence prouvées.

## Prochain lot narration

- [x] Lot 6 — audit et redécoupage des scénarios 005 à 009 :
  - dépendances confrontées aux runtimes et tests actuels ;
  - repos retenu comme premier vertical ;
  - orchestrateur 005 découpé en hooks sans autorité métier ;
  - social placé avant le noyau d'intrigue et ses événements cachés ;
  - progression puis bastion ordonnés selon leurs propriétaires.
- [x] Sous-lot 6A — raccorder le repos narratif minimal :
  - [x] ouvrir la capacité `rest` sur une intention sémantique explicite,
    seulement lorsqu'un propriétaire est injecté ;
  - [x] persister atomiquement le handoff et son checkpoint segmenté initial ;
  - [x] conserver le type de repos dans le contrat sémantique et poser
    uniquement ce choix lorsqu'il manque ;
  - [x] raccorder le démarrage du propriétaire repos au contrôleur ;
  - [x] raccorder l'avancement segmenté, le temps et la continuation narrative ;
  - [x] maintenir l'achèvement en attente sans bénéfice avant validation
    personnage/inventaire ;
  - [x] couvrir interruption, achèvement, restauration et rejeu dans le
    navigateur.
- [x] Sous-lot 6B — brancher le premier hook de l'orchestrateur sur le résultat
  du repos, sans lui transférer l'autorité métier :
  - [x] enveloppe terminale et tâche d'outbox committées atomiquement ;
  - [x] aucun réveil transversal pendant un segment de repos actif ;
  - [x] routeur déterministe borné à la livraison, sans write métier ;
  - [x] données cachées de sécurité exclues du message ;
  - [x] succès, absence d'abonné, erreur temporaire et reprise couverts.
- [x] Sous-lot 6C — introduire l'état social durable et les connaissances par
  acteur, sans transformer les paroles PNJ en vérité de campagne :
  - [x] persister perspective, connaissances et préoccupations propres ;
  - [x] permettre une première initiative locale structurée à une frontière de
    scène, sans entrée joueur ;
  - [x] prouver que cette initiative peut viser autre chose que le personnage ;
  - [x] conserver une scène calme lorsqu'aucune cause ne justifie d'action ;
  - [x] projeter le signal committé vers un performer borné et le rendu
    narratif, sans lui transmettre l'objectif privé ;
  - [x] raccorder et rejouer cette projection dans la surface navigateur.
- [x] Sous-lot 6D — noyau d'intrigue, évolution autonome et événements cachés :
  - [x] committer la vérité privée et les engagements avant mise en scène ;
  - [x] refuser une révélation indispensable sans deux voies indépendantes et
    une fausse piste sans réfutation ;
  - [x] résoudre hors écran les étapes déjà planifiées lorsque l'horloge
    diégétique les rend exigibles ;
  - [x] classer les effets visibles, inférables, connaissables, cachés ou
    différés dans un `SceneEventBundle` ;
  - [x] committer séparément la révélation, la rendre dans la surface et éviter
    sa répétition après rechargement ;
  - [x] ingérer les événements autoritaires de `world-simulation` sans recréer
    leur décision dans la narration ;
  - [x] composer événements monde et intrigue dans un même bundle causal ;
  - [x] arrêter une avance à une échéance exigeant une décision, mettre en scène
    l'interruption puis restituer la main au joueur.

## Objectif transverse prioritaire — verticale 6V « monde vivant »

- [x] Faire du personnage un participant du monde, pas son déclencheur unique.
- [x] En 6C, ouvrir l'initiative locale des PNJ depuis leur état propre.
- [x] En 6D, faire évoluer événements et intrigues hors écran, puis projeter
  leurs seuls effets perceptibles dans la scène.
- [x] Raccorder les événements autoritaires de `world-simulation` sans dupliquer
  son moteur dans la narration.
- [x] Certifier la gate 6V avant d'ouvrir 6E.

Référence :
[`Contrat-cible-monde-vivant-et-initiative-pnj.md`](test-GAME-2D/narration-module/docs/Contrat-cible-monde-vivant-et-initiative-pnj.md).

## Lots suivants

1. 6E — progression narrative :
   - [x] 6E-A : ouvrir une disponibilité depuis un événement committé et une
     politique de campagne injectée ;
   - [x] 6E-B : conserver les choix joueur puis appliquer atomiquement un
     candidat validé par personnage/ruleset ;
   - [x] 6E-C : projeter le résultat validé vers la narration et restaurer
     l'interface sans duplication.
   - [x] 6E-D : imposer un segment de repos court ou long consacré à la
     progression, puis brancher les gains sur les catalogues personnage
     existants sans fallback inventé.
2. 6F — bastion, après fermeture de 6E-D :
   - [x] 6F-A : auditer les autorités déjà disponibles et figer le premier
     contrat vertical minimal avant toute implémentation ;
   - [x] 6F-B : établir atomiquement un bastion depuis une acquisition
     committée et une politique injectée, puis projeter le résultat sans créer
     de contenu de gestion implicite ;
   - [x] 6F-C : ouvrir un premier ordre de travail catalogué et temporisé,
     sans rendre gratuit un prérequis dont l'autorité manque ;
   - [x] 6F-D : affectations validées et vie autonome des occupants ;
   - [x] 6F-E : incidents, opportunités et défense par handoffs propriétaires.

## Lots 7 et 8 — vertical bastion-tactique

- [x] 7A — boîte de réception tactique du bastion :
  - restaurer une défense active depuis ses événements et agrégats committés ;
  - signaler la défense dans la surface narration ;
  - ouvrir la surface tactique avec la graine persistée ;
  - refuser de présenter un combat manuel comme résultat de campagne ;
  - couvrir la restauration et documenter la frontière.
- [x] 7B — adapter réellement la graine à `GameBoard` :
  - résoudre les projections personnage et adversaires depuis leurs
    propriétaires ;
  - charger carte, zones, positions, équipes, terrain, lumière et dangers ;
  - refuser avant combat toute donnée non représentable ;
  - démarrer sans écran de configuration libre contradictoire.
- [x] 7C — produire et intégrer le retour tactique :
  - [x] 7C-A : journaliser les tours, committer un checkpoint de frontière et
    restaurer réellement le plateau après rechargement ;
  - [x] 7C-B : construire l'outcome depuis l'état terminal réel, le persister
    avec ses candidats non appliqués et revenir à la narration ;
  - [x] 7C-C : faire valider les candidats, intégrer une seule fois les deltas,
    avancer le temps puis reprendre la narration ;
- [x] Lot 8 — alimenter le vertical bastion-tactique depuis une campagne
  jouable, sans amorçage artificiel des Archives :
  - [x] 8A : construire une graine depuis un catalogue de rencontre et les
    agrégats personnage relus, conserver les références nécessaires à 7C et
    utiliser le même catalogue pour résoudre les conditions terminales ;
  - [x] 8B : sélectionner le personnage actif depuis le bootstrap et charger
    un premier catalogue de défense versionné ;
  - [x] 8C : router une cause monde ou intrigue committée vers le bastion, avec
    une frontière calme lorsqu'aucune cause ne le cible ;
  - [x] 8D : certifier le parcours navigateur complet sans fixture de défense.

## Lot 9 — campagne jouable dans le build principal

- [x] 9A — auditer le chemin réel et figer le contrat d'intégration :
  - entrée UI, fiche active, bootstrap, contenu et règles ;
  - identités d'agrégats, cycle de scène et persistance ;
  - raccords repos, progression, bastion, tactique et simulation ;
  - scénarios live et refus protecteurs.
- [x] 9B — remplacer les identités de prototype par des liaisons explicites de
  campagne et activer la première scène de manière idempotente.
- [x] 9C — générer le paquet installé, adapter la fiche active et ouvrir la
  porte d'entrée créer/reprendre/pilote Archives.
- [x] 9D — composer les verticales existantes et leurs disponibilités dans
  l'interface principale.
- [x] 9E — committer les avances de la simulation du monde dans la campagne et
  router leurs événements autoritaires.
- [x] 9F — certifier le parcours complet depuis l'entrée réelle du build et
  publier la recette manuelle française.

## Autres chantiers

- [ ] Audit transverse du pipeline narratif et de la qualité MJ :
  - [x] raccorder la route OpenAI du `mj_planner` dans le pilote Archives et la
    campagne jouable ;
  - [x] transmettre le plan MJ accepté au `scene_writer` et l'inclure dans
    l'identité de son contexte ;
  - [x] retirer l'identité de campagne prototype des appels de rendu d'une
    campagne jouable ;
  - [x] exécuter le bundle causal avant toute initiative PNJ automatique et
    respecter sa décision de restitution de la main ;
  - [x] réconcilier le contrat IA avec le runtime actif sur le caractère
    conditionnel du `scene_writer` et l'absence d'engagement PNJ durable ;
  - [x] restaurer les cinq derniers tours sémantiques et les focus locaux avant
    une reprise de campagne ;
  - [x] fournir à l'interpréteur un manifeste public et fingerprinté des
    capacités disponibles, handoff-only et à déclenchement externe ;
  - [x] aligner les contrats V5, NAR-131 et pipeline IA sur l'entrée réellement
    consommée par `player_intent_interpreter` ;
  - [ ] certifier dans une recette navigateur OpenAI que chaque rôle utile est
    appelé une seule fois et dans l'ordre attendu sur action, dialogue,
    observation, transition et clarification ;
  - [ ] définir avec chaque propriétaire les commandes joueur encore absentes
    de l'ontologie sémantique — inventaire, progression, bastion et tactique
    générique — avant de les annoncer comme déclenchables par texte libre ;
  - [ ] cadrer le contexte public du personnage réellement utile à la
    compréhension, sans transmettre fiche mécanique complète, secrets ou
    inventaire privé à l'interpréteur :
    - [x] projeter identité, langues, actions, sorts et équipement visible,
      fingerprintés, sans disponibilité mécanique ;
    - [x] bloquer localement un alias personnage ambigu et demander une
      clarification sans commit ni temps de jeu ;
    - [x] prouver que l'agrégat privé, les ressources, la biographie et
      l'inventaire non visible ne sont ni lus ni transmis ;
    - [ ] créer avec leurs propriétaires une projection typée des
      connaissances et états observables avant de les exposer ;
  - [ ] auditer les frontières automatiques après chaque type de tour : monde,
    intrigue, initiative PNJ, temps, progression, bastion et tactique ;
  - [ ] étendre la qualité multi-tours au-delà du pilote Archives : continuité
    de scène, variété, rythme, conséquences perceptibles et restitution claire
    de la main :
    - [x] raconter une transition committée comme un cheminement
      `départ → franchissement → arrivée`, transmis au writer sans la fiche
      complète de l'ancienne scène ;
    - [x] empêcher le `scene_creator` de remplacer une destination publique
      demandée par un seuil, un passage ou un lieu intermédiaire ;
    - [ ] introduire avant création une décision structurée de plausibilité
      pour les destinations entièrement proposées par le joueur : création
      locale, clarification, voyage ou contradiction sourcée.
- [ ] Poursuivre la passe de validation manuelle du build principal :
  - [x] raccorder l’accueil sans fiche au créateur existant et revenir aux
    campagnes avec relecture automatique de la fiche active ;
  - [x] normaliser les emplacements d’équipement historiques produits par le
    créateur vers les identifiants d’exemplaires exigés par la campagne ;
  - [x] canonicaliser les conteneurs `storedIn` produits par le créateur et
    migrer seulement les anciens slots qui désignent un contenant unique ;
  - [x] retirer la sous-classe `champion` obsolète du personnage modèle et
    ignorer avec avertissement une sous-classe legacy encore inactive, sans
    relâcher le rejet au niveau où le choix devient mécanique ;
  - [x] conserver l'entrée joueur dans le fil lors d'un échec runtime et
    afficher les issues structurelles bornées de `core.validation.failed`,
    sans exposer les détails privés d'autres erreurs ;
  - [x] borner par empreinte déterministe les identifiants de transition vers
    un lieu dynamique afin qu'une opération joueur valide ne fasse plus rejeter
    la troisième commande et sa causalité par le noyau ;
  - [x] empêcher une destination publique structurée d'être déclassée en
    `move_near_visible_actor`, y compris lorsqu'une amorce spatiale V3–V5
    précède le franchissement ;
  - [x] séparer la scène d'ouverture historique de la scène courante afin
    qu'une transition ne réécrive plus rétroactivement le début du fil ;
  - [x] distinguer un échec d'étape secondaire après commit de l'échec de
    l'action principale, avec notification non dédupliquée et diagnostic sûr ;
  - [ ] rejouer la transition OpenAI vers la Place des Archives et corriger
    l'étape secondaire exacte si son nouveau diagnostic apparaît encore ;
  - [ ] corriger le conflit d'idempotence
    `social.local-initiative-request-conflict` reproduit lorsqu'un acteur de
    scène a été promu puis que la campagne est rechargée ;
  - [x] canonicaliser une composante de parole V3–V5 avant le contrôle
    `kind/dialogueAct`, avec régression sur la demande de registres adressée au
    clerc déjà focalisé ;
  - [x] exposer l'interlocuteur actif à l'interpréteur et refuser localement
    qu'une réponse de contexte importe la prose d'une autre scène ;
  - [x] doter toute présence ciblable d'un profil conversationnel éphémère
    révisé dans le même appel PNJ, sans promotion ni nouvelle autorité durable ;
  - [ ] poursuivre la recette 9F depuis une fiche créée manuellement et
    rejouer le contact avec le clerc, la demande de registres puis quelques
    questions personnelles ou opinions.
- [ ] Consolider la simulation du monde après les objectifs multi-phases, les
  opportunités de faction et les mobiles non-système, puis raccorder ses
  événements autoritaires à la gate 6V.
  Référence :
  [`world-simulation-corrective-roadmap.md`](test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md).

## Blocages et reports explicites

- Les tests de compétence attendent une projection mécanique stable du créateur
  de personnage, sans rendre le noyau narration dépendant de son implémentation.
- La transaction de monnaie et de matériaux de campagne manque encore. Un
  travail de bastion qui l'exige doit rester bloqué, jamais devenir gratuit.
- Le départ d'une défense vers le tactique et l'initialisation de `GameBoard`
  sont contractés et testés. Les compagnons contrôlables et la surprise restent
  refusés tant que le plateau ne sait pas les représenter. Le retour validé est
  intégré. Le profil personnage actif, le catalogue versionné, la politique de
  résolution et le routage d'une cause committée sont raccordés. Le parcours
  complet est certifié dans une campagne navigateur isolée ; son déclenchement
  depuis une campagne du build principal reste à cadrer.
- `npm audit --omit=dev` signale une vulnérabilité transitive existante dans
  `@xmldom/xmldom` via PixiJS ; elle doit être traitée séparément avant une
  livraison publique.

## Dernier point de contrôle

- Le 2026-07-30, 8D certifie dans le navigateur le parcours campagne
  bootstrapée → cause committée → défense → `GameBoard` → checkpoint →
  rechargement → outcome → intégration → continuation narrative unique. La
  donnée privée de la cause ne fuit pas et aucun amorçage n'est ajouté aux
  Archives. Le 9A constate ensuite que le build ouvre encore directement le
  pilote, que le bootstrap de production n'a pas de résolveurs installés et
  que plusieurs runtimes utilisent des identités `PROTOTYPE_*`. Le contrat du
  lot 9 est figé. 9B injecte ensuite les identités propres à une campagne dans
  le contrôleur, les transitions, la création dynamique et les reprises, puis
  committe sa première scène de manière idempotente. 9C installe ensuite le
  paquet contenu/règles du build, valide la fiche active
  avant écriture et expose l'accueil créer/reprendre/pilote. La gate réelle
  prouve création, reprise et refus d'une fiche invalide. La prochaine étape
  9D compose ensuite repos, progression, bastion, catalogue de défense,
  frontières sociales et intrigues dans la campagne réelle. L'interface ne
  montre que les disponibilités committées et le personnage actif remplace un
  slot de catalogue avant toute défense. La prochaine étape est 9E : faire
  entrer les avances et événements autoritaires de la simulation du monde
  dans cette même campagne. 9E raccorde maintenant l'onglet Monde à un port
  de campagne : horloge, curseur et état de simulation sont committés ensemble,
  puis les causes de bastion, signaux locaux et initiatives sociales passent
  par leurs frontières existantes. La prochaine étape est 9F : certifier ce
  parcours depuis l'entrée réelle du build et publier sa recette manuelle.
  9F ferme maintenant cette verticale : la gate réelle couvre création,
  narration et reprise, avance du monde restaurée, disponibilités préparées,
  défense, checkpoint, issue tactique et retour narratif unique. Elle a aussi
  corrigé les identités longues, les valeurs monde non persistables, la
  réservation des positions tactiques et le partage du curseur temporel.
  La prochaine étape n'est pas un nouveau lot implicite : elle doit être
  choisie parmi les chantiers encore ouverts.

## Règle de mise à jour

À la fin d'un lot, remplacer son entrée par le prochain lot concret. Ne pas
accumuler ici le journal des tâches terminées : les contrats, matrices de preuve,
tests et l'historique Git conservent ces informations.

Chaque lot fonctionnel fermé doit aussi laisser un guide en français décrivant
son fonctionnement, des exemples, les tests exécutables et ce qui n'est pas
encore accessible au joueur.
