# Journal des décisions — module narration

Ce journal conserve les décisions structurantes et leur justification. Le comportement courant reste décrit dans `Dossier-de-conception.md`.

## Format

- Identifiant et date
- Statut : `RETENU`, `FIGE` ou `REMPLACE`
- Décision
- Raisons
- Conséquences

## NAR-001 — Positionnement du module

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le module narration est un moteur de JDR piloté créativement par l'IA, et non un moteur classique de quêtes préécrites dont l'IA reformule les textes.

### Raisons

La valeur du produit repose sur la liberté d'action, la création contextuelle et des personnages capables de réagir au vécu de la campagne.

### Conséquences

Les contrats devront transmettre des contraintes et une vérité exploitable sans prédéterminer tout le contenu narratif.

## NAR-002 — Séparation création et autorité

Date : `2026-06-29`

Statut : `RETENU`

### Décision

L'IA possède l'initiative créative. Le logiciel possède l'autorité transactionnelle sur les états persistants et les résolutions mécaniques.

### Raisons

Une IA trop bridée ne joue plus le rôle de MJ; une IA autorisée à écrire directement l'état rend les règles, la sauvegarde et la continuité non fiables.

### Conséquences

Les sorties devront distinguer prose, propositions de commandes et propositions de créations persistantes.

## NAR-003 — Contexte de tour figé

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Chaque tour s'appuie sur un snapshot structuré, versionné et immuable de la situation. Un résumé conversationnel ne constitue pas le contexte autoritaire.

### Raisons

Les essais précédents perdaient la mise en scène et fournissaient un contexte insuffisant ou approximatif à l'IA.

### Conséquences

Le futur contrat d'entrée devra expliciter scène, perspectives, règles, mémoire rappelée, lore sourcé et libertés créatives.

## NAR-004 — Persistance progressive des créations

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Les créations commencent comme éléments éphémères. Elles sont proposées à la persistance lorsqu'elles acquièrent une identité, une interaction significative, un effet mécanique, une possibilité de retour ou une importance pour le joueur.

### Raisons

Tout persister ferait croître la campagne sans contrôle; ne rien persister rendrait le monde amnésique.

### Conséquences

Le modèle devra prendre en charge la promotion d'une création et conserver le lien entre sa première apparition et son entité persistante.

## NAR-005 — Mémoire complète distincte du contexte

Date : `2026-06-29`

Statut : `RETENU`

### Décision

La campagne conserve une mémoire longue durée structurée. L'IA reçoit seulement une projection bornée et justifiée pour le tour courant.

### Raisons

La continuité exige de conserver des faits anciens, mais l'envoi de toute la campagne dégraderait coût, latence et attention du modèle.

### Conséquences

Le système devra gérer cycle de vie, provenance, relations, rappel, condensation et budgets de contexte.

## NAR-006 — Recherche hybride, vérité structurée

Date : `2026-06-29`

Statut : `RETENU`

### Décision

La recherche structurée fournit les ancres certaines. Une recherche textuelle ou sémantique peut découvrir des candidats, mais seuls les identifiants, la provenance et les règles établissent leur validité.

### Raisons

Les mots-clés seuls ne retrouvent pas correctement le contexte; la similarité seule ne garantit ni vérité ni pertinence.

### Conséquences

Chaque fragment injecté dans le contexte devra rester traçable jusqu'à sa source.

## NAR-007 — Horloge unique

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le futur module narration ne maintient pas une horloge parallèle. Il utilise l'horloge autoritaire du monde et lui soumet les demandes d'avance temporelle.

### Raisons

Le `map-module` possède déjà une horloge et des effets de simulation dépendants du temps.

### Conséquences

Le contrat narration-monde devra définir demande, résultat, événements produits et projection locale mise à jour.

## NAR-008 — Décision IA et points d'arrêt d'un tour

Date : `2026-06-29`

Statut : `RETENU`

### Décision

L'IA décompose les entrées composées, complète uniquement les gestes ordinaires implicites et choisit si elle poursuit, demande une clarification ou rend la main. L'orchestrateur fournit les critères et conserve un veto technique; il ne remplace pas cette décision par un parcours préécrit.

Une clarification indispensable suspend l'intention sans mutation. La réponse du joueur complète l'intention, puis le contexte est reconstruit et sa version vérifiée avant reprise. Une réaction du monde exigeant une nouvelle décision termine au contraire le tour courant et ouvre un nouveau tour.

### Raisons

Le rythme doit rester naturel et piloté par l'IA sans lui permettre de poursuivre au-delà de l'intention du joueur ou de s'appuyer sur un contexte devenu périmé.

### Conséquences

Le futur contrat devra exprimer la cause du point d'arrêt et les données minimales d'une intention en attente. Le runtime devra distinguer clarification sans mutation, restitution de la main après mutation et transition vers un moteur propriétaire.

## NAR-009 — Saisie naturelle et interprétation théâtrale

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le joueur dispose d'un champ libre unique, sans séparation obligatoire entre parler, agir et questionner le MJ. L'IA distingue la nature de l'entrée et ne transforme jamais une question de possibilité en action exécutée. En cas de doute significatif sur l'engagement du joueur, elle demande une clarification.

L'IA peut reformuler et mettre en scène une parole ou une action selon les traits et capacités du personnage, à condition de préserver son sens, son objectif, ses engagements et son niveau de risque. Une capacité faible modifie prioritairement la forme et l'efficacité; elle ne bloque l'expression que lorsqu'une capacité concrète manque.

Les suggestions directes d'actions sont écartées du jeu normal. Les possibilités sont rendues perceptibles par une mise en scène discrète et cohérente.

### Raisons

La liberté d'un JDR sur table suppose de pouvoir agir, parler ou interroger le MJ naturellement. La reformulation aide aussi un joueur à incarner des capacités différentes des siennes sans abandonner l'autorité sur les choix de son personnage.

### Conséquences

Le contrat d'interprétation devra représenter séparément nature de l'entrée, degré d'engagement et contenu sémantique invariant. Le contexte devra exposer les traits utiles du personnage sans autoriser l'IA à inventer ses intentions.

## NAR-010 — Identité et transitions des scènes

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Une scène est définie par la continuité significative de sa situation, de son espace, de son temps, de ses acteurs et de ses enjeux. Un déplacement mineur ne crée pas automatiquement une scène; une rupture substantielle de contexte en crée une nouvelle.

L'IA propose les transitions. L'orchestrateur les valide ou les impose lorsqu'un changement autoritaire de lieu, de temps ou de moteur le requiert. Après un passage tactique, une nouvelle scène de continuation est reconstruite depuis les résultats réels.

### Raisons

Des scènes limitées à des coordonnées fragmenteraient artificiellement la narration. À l'inverse, réutiliser un contexte antérieur après une rupture importante produirait des incohérences de mise en scène.

### Conséquences

Le modèle devra relier scènes précédentes, scènes de continuation, transitions et séquences tactiques sans confondre leurs contextes.

## NAR-011 — Repos intégré à la narration

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le repos est une sous-couche spécialisée de règles reliée au module narration. Son moteur valide phases, activités et effets mécaniques; la narration porte les questions, choix, interactions et conséquences dans le flux conversationnel normal.

### Raisons

Le repos doit conserver la rigueur d'une mécanique de jeu tout en restant un moment vécu de l'aventure, sans rupture d'interface ou transformation en écran administratif séparé.

### Conséquences

L'ancienne piste d'un panneau principal de repos séparé n'est plus la cible active. Un contrat narration-repos devra être conçu lors de l'atelier d'intégration des moteurs.

## NAR-012 — Flux typé et rythme narratif configurable

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le fil conversationnel présente une séquence ordonnée de messages typés. Le MJ, le personnage joueur, chaque PNJ et les notifications système sont clairement distingués. La réalisation mise en scène de l'entrée joueur devient l'affichage principal; l'entrée brute reste consultable.

Les échanges automatiques entre PNJ sont autorisés jusqu'au prochain choix significatif du joueur. Leur longueur et le seuil de restitution de la main sont réglables pendant le développement par une politique de rythme indépendante de la vérité et des règles.

### Raisons

Une scène vivante exige plusieurs voix et des échanges autonomes. Leur lisibilité et leur durée doivent toutefois préserver l'implication du joueur et pouvoir être réglées à partir d'essais réels.

### Conséquences

Les messages devront porter type, ordre et identité stable du locuteur. L'accessibilité ne pourra pas reposer seulement sur la couleur. Le diagnostic devra expliquer les points d'arrêt liés au rythme.

## NAR-013 — Périmètre du scénario vertical MVP

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le MVP valide une campagne solo autour d'un personnage créé par l'éditeur existant, d'un lieu principal issu du wiki et de son contexte immédiat. Il couvre création dynamique, persistance, dialogue, résolution sociale, temps mondial, passage tactique, repos minimal, sauvegarde et rappel tardif.

Le scénario est une épreuve reproductible de l'architecture; son intrigue et ses PNJ ne sont pas préécrits.

### Raisons

Cette coupe traverse les risques essentiels du produit sans exiger l'implémentation immédiate de tous les systèmes futurs. Le wiki et la création de personnage apportent déjà des données utiles qui doivent être adaptées plutôt que recréées.

### Conséquences

Le multijoueur, la voix, le bastion complet, la progression complète, l'économie avancée et la génération mondiale sans limite sont reportés. Les contrats du MVP ne doivent toutefois pas empêcher leur ajout ultérieur.

## NAR-014 — Autorité par propriété et instance de personnage

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Le wiki fournit le canon initial; la campagne porte ses overrides et créations. L'éditeur produit la fiche initiale, puis l'instance importée dans la campagne devient le personnage réellement joué. Un même PNJ peut être projeté dans la narration, le monde, la tactique et l'interface, avec une autorité distincte par propriété.

L'orchestrateur coordonne les domaines sans devenir propriétaire de toutes leurs données.

### Raisons

Les copies concurrentes de la fiche, d'un PNJ ou du monde produiraient des divergences silencieuses. Une autorité par propriété permet les intégrations nécessaires tout en conservant une identité commune.

### Conséquences

Les futures sauvegardes devront distinguer fiche source, instance de campagne et données dérivées. Les projections inter-modules devront référencer des identifiants stables et restituer leurs résultats aux propriétaires persistants.

## NAR-015 — Protocole de mutation et narration post-validation

Date : `2026-06-29`

Statut : `RETENU`

### Décision

Toute mutation suit le protocole proposition IA, contrôle de contrat, validation des propriétaires, exécution atomique, émission d'événements puis narration. L'IA ne déclare pas un résultat mécanique dans sa proposition et la prose finale ne peut ajouter aucune mutation.

### Raisons

La causalité et la sauvegarde deviennent non fiables si le moteur doit interpréter la narration pour déterminer ce qui s'est produit ou si une partie des changements est enregistrée avant l'échec d'une étape indispensable.

### Conséquences

Les futurs contrats devront séparer propositions, résultats de validation, événements, projections publiques et données privées. La génération visible interviendra seulement après confirmation des résultats.

## NAR-016 — Monolithe modulaire et résolution des conflits de vérité

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le MVP utilise un monolithe modulaire et une sauvegarde de campagne unifiée. Les domaines possèdent les règles et propriétés métier; le stockage assure persistance et atomicité sans devenir une autorité décisionnelle.

Pour une propriété, l'état courant de son unique domaine propriétaire est autoritaire. Le canon ou la fiche importée fournit seulement l'état initial. Une scène est une projection sans droit d'override. Deux autorités concurrentes constituent une erreur à signaler, pas un conflit à masquer par une priorité implicite.

Les relations et connaissances restent des sous-domaines conceptuellement séparés dans la campagne. Un domaine économique complet est reporté; les transactions du MVP utilisent les états d'acteurs, les faits du monde et des règles communes d'inventaire.

### Raisons

Un module narration propriétaire de tout reproduirait les couplages des essais précédents. Des microservices seraient disproportionnés pour l'application actuelle et compliqueraient inutilement l'atomicité.

### Conséquences

La matrice finale devra attribuer chaque propriété du MVP à un domaine unique. Le futur stockage de campagne pourra réunir leurs données physiquement sans supprimer leurs frontières logiques.

## NAR-017 — Matrice d'autorité complète du MVP

Date : `2026-06-30`

Statut : `RETENU`

### Décision

La matrice `Matrice-autorite.md` devient la référence détaillée des propriétaires, lecteurs, proposants, validateurs, mutations et événements du scénario MVP.

Un `CampaignFactDomain` est ajouté pour porter les faits objectifs et overrides de partie qui n'appartiennent ni au transcript d'une scène ni aux connaissances subjectives d'un acteur.

### Raisons

Sans domaine de faits, une création durable de l'IA risquerait d'être stockée dans la prose ou dans une mémoire subjective. L'audit devait aussi distinguer les absences de runtime des ambiguïtés d'autorité.

### Conséquences

L'atelier sur le modèle persistant devra traduire cette matrice en agrégats et invariants. Toute nouvelle donnée du MVP devra être ajoutée à la matrice avant son implémentation.

## NAR-018 — Chronologie linéaire sans retour joueur

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Une campagne possède une chronologie unique. Chaque échange validé est committé durablement, tandis que les snapshots complets sont créés selon une politique technique configurable.

Le joueur reprend toujours la dernière version cohérente. Il ne peut ni charger un checkpoint antérieur, ni annuler un choix, ni créer une branche. Les checkpoints, copies de sécurité et restaurations restent des mécanismes internes de reprise, migration ou diagnostic.

### Raisons

Les conséquences doivent être assumées et conserver leur poids. Confondre durabilité de chaque échange et snapshot complet rendrait aussi la sauvegarde inutilement lourde.

### Conséquences

Le store devra journaliser chaque commit, produire des snapshots espacés et garantir l'idempotence. Une correction ou une réparation dans le jeu produira un nouvel événement au lieu de réécrire l'histoire.

## NAR-019 — Fiche source et identité du personnage de campagne

Date : `2026-06-30`

Statut : `RETENU`

### Décision

L'import d'une fiche source crée une instance de personnage appartenant exclusivement à une campagne et à sa chronologie. Les conséquences ne remontent pas vers la fiche source.

Réutiliser la même fiche exige un clonage explicite qui produit une nouvelle identité et un autre personnage. Ce mécanisme ne constitue jamais une branche de la campagne originale.

### Raisons

La fiche doit rester réutilisable pour les tests et la création, sans devenir une voie détournée permettant de rejouer les choix d'un même personnage.

### Conséquences

La sauvegarde conservera l'identifiant et la version de la fiche importée pour provenance, ainsi qu'un identifiant distinct pour le personnage réellement joué.

## NAR-020 — Agrégats de campagne et transcript séparé

Date : `2026-06-30`

Statut : `RETENU`

### Décision

La campagne est composée d'agrégats logiques reliés par identifiants stables, et non d'un graphe de copies imbriquées. Le transcript complet est conservé dans un `InteractionLog` paginable et archivable, séparé des faits et états métier.

Le transcript reste consultable par le joueur et utile au diagnostic, mais il n'est ni une source de vérité ni un contexte envoyé intégralement à l'IA.

### Raisons

Cette séparation préserve l'histoire lisible sans faire dépendre la continuité du texte généré. Les agrégats limitent aussi les divergences lorsque le même acteur est projeté dans la scène, le monde et le combat.

### Conséquences

Chaque message, tour et événement devra porter des références croisées. Le futur store pourra conserver les agrégats dans un même support physique sans supprimer leurs validations indépendantes.

## NAR-021 — Séparation commande, événement, fait et croyance

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les commandes expriment une demande, les mutations préparent un changement, les événements décrivent un résultat confirmé et les faits représentent une vérité durable courante. Les faits sont remplacés par de nouvelles assertions reliées, jamais écrasés silencieusement.

La vérité objective, la connaissance d'un acteur, sa croyance et l'hypothèse du joueur sont des données distinctes. Une erreur du joueur ne devient jamais une vérité et n'est présentée à l'IA que sous une étiquette subjective explicite.

### Raisons

Sans cette séparation, une question, une rumeur ou une note erronée pourrait contaminer la vérité de campagne. À l'inverse, supprimer toute trace des croyances empêcherait de jouer correctement les malentendus et leurs conséquences.

### Conséquences

Les données durables devront porter provenance, temps de jeu, date technique, validité et liens de remplacement. Une erreur pourra influencer le monde seulement par les actions qu'elle provoque, pas par sa simple formulation.

## NAR-022 — Reprise idempotente et temps diégétique

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque échange possède un identifiant idempotent et ne peut produire qu'un commit. Une clarification conserve une intention minimale sans mutation ni ancien contexte complet. La campagne possède un seul processus interactif principal, auquel une question en attente peut être rattachée.

Le temps réel d'attente n'a aucun effet. Les dialogues en jeu, commerces, micro-déplacements et autres activités diégétiques produisent une durée proposée par la narration et validée par le `WorldDomain`. Les échanges méta, rappels et clarifications pré-exécution ont une durée nulle.

### Raisons

La reprise réseau ou applicative ne doit jamais doubler les effets. Par ailleurs, figer le temps pendant tous les dialogues rendrait le monde incohérent, tandis que le lier au temps réel pénaliserait le joueur et empêcherait une reprise déterministe.

### Conséquences

Les commits devront porter leurs durées et clés idempotentes. Les événements autonomes du monde seront produits seulement lorsqu'une avance de temps de jeu les déclenche.

## NAR-023 — Contenu épinglé et migrations déterministes

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque campagne épingle ses versions de schéma, contenu et règles. Une mise à jour du wiki ou des catalogues ne modifie jamais automatiquement une campagne existante.

Toute évolution passe par une migration explicite, séquentielle, déterministe, validée sur une copie puis remplacée atomiquement. Une migration ne fait aucun appel IA et conserve la sauvegarde originale en cas d'échec.

### Raisons

Une campagne longue doit rester reproductible malgré l'évolution de l'application. Une modification silencieuse du canon pourrait invalider des lieux, personnages ou conséquences déjà établis.

### Conséquences

Le futur runtime devra résoudre la version de contenu épinglée ou demander une migration. Les faits canoniques matérialisés conserveront leur valeur et leur empreinte de source.

## NAR-024 — Engagements narratifs des intrigues

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Tout détail ayant une importance causale, probatoire ou préparatoire pour une intrigue devient persistant immédiatement, indépendamment de sa visibilité et de l'attention du joueur.

Une intrigue commit sa vérité centrale, sa causalité, ses invariants et ses premiers engagements avant leur mise en scène. Les preuves, indices, témoignages, croyances et fausses pistes restent des catégories distinctes. La vérité ne peut pas être choisie rétroactivement pour s'adapter aux actions du joueur.

### Raisons

Une cohérence locale de chaque scène ne suffit pas à garantir une intrigue cohérente sur la durée. Les contradictions subtiles apparaissent lorsque chronologie, accès, connaissances et indices ne partagent pas un même graphe causal persistant.

### Conséquences

La cohérence des intrigues devient un fil transversal des ateliers 4, 5, 6, 7, 9, 10 et 12. Un document dédié fixe les engagements à préserver et les contrôles à concevoir.

## NAR-025 — Solvabilité et équité des intrigues

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque révélation indispensable d'une intrigue possède au moins deux voies d'accès indépendantes. Un échec peut fermer une voie ou augmenter son coût, mais le système ne supprime pas silencieusement toute progression.

Une fausse piste doit être réfutable par des faits accessibles. Une intrigue ignorée peut évoluer ou se résoudre sans le joueur. Une insolvabilité provoquée par une action volontaire ou une longue inaction reste possible comme conséquence causale tracée.

### Raisons

La difficulté doit provenir des choix, risques et raisonnements du joueur, pas d'un graphe généré incomplet ou d'un indice unique perdu arbitrairement.

### Conséquences

La création et la validation d'une intrigue devront contrôler l'indépendance des voies, la réfutabilité des fausses pistes et les effets de la perte d'un indice.

## NAR-026 — Registre effectif et profil génératif des lieux

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les lieux canoniques et les lieux générés rejoignent un registre effectif commun dans la campagne, avec une provenance distincte. Un lieu généré hérite des invariants, normes pondérées et espaces de variation de sa hiérarchie géographique.

Chaque création précise si le lieu était préexistant mais inconnu, nouvellement établi, temporaire ou caché. Le système recherche d'abord un lieu existant adapté et contrôle densité, doublons, politique, société, style et topologie avant commit.

Les PNJ, événements, objets et fils narratifs possèdent également des minimums structurés propres à leur type avant toute mise en scène durable.

### Raisons

Une ville doit pouvoir s'enrichir dynamiquement sans perdre sa trame visuelle, sociale et politique ni faire apparaître des bâtiments uniquement pour résoudre les besoins immédiats de l'intrigue.

### Conséquences

Le `WorldDomain` devra exposer un profil génératif hiérarchique et un registre des fonctions déjà présentes. Les créations liées à une intrigue deviennent des engagements persistants dès leur validation.

## NAR-027 — Doublons et corrections ciblées

Date : `2026-06-30`

Statut : `RETENU`

### Décision

La similarité sert uniquement à découvrir des doublons possibles. Une identité persistante n'est jamais fusionnée automatiquement en cas d'incertitude. Le système choisit explicitement réutilisation, enrichissement, création distincte, relation d'incertitude ou rejet.

Avant commit, une proposition partiellement invalide reçoit au maximum deux corrections ciblées par défaut, configurables en développement. Après commit, toute correction ou fusion est atomique, tracée et conserve les anciens événements et identifiants.

### Raisons

Une fusion abusive corromprait relations, connaissances, inventaires et causalité. Une régénération totale gaspillerait à l'inverse les parties valides et augmenterait coût, latence et variation narrative.

### Conséquences

Les validateurs devront produire des erreurs localisées et des candidats de doublons structurés. Aucune correction ne sera réalisée en analysant ou réécrivant silencieusement la prose déjà affichée.

## NAR-028 — Archivage système et oubli subjectif

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le cycle `active`, `relevant`, `dormant`, `archived` contrôle le rappel et la projection, jamais la vérité ou la conservation. Les faits, événements, engagements et changements durables ne sont pas supprimés automatiquement.

L'oubli d'un personnage est une évolution de sa connaissance subjective. Le système conserve la vérité, la connaissance antérieure et la cause de l'oubli ou du rappel.

### Raisons

Une campagne longue doit réduire ses contextes sans devenir amnésique. Confondre archivage, invalidation et oubli ferait disparaître des causes ou attribuerait des connaissances incorrectes aux acteurs.

### Conséquences

Validité, importance systémique, importance narrative, cycle de rappel et pertinence courante seront des axes séparés. Les engagements d'intrigue resteront récupérables tant qu'ils peuvent affecter la cohérence ou la solvabilité.

## NAR-029 — Index reconstruisibles et déclencheurs de rappel

Date : `2026-06-30`

Statut : `RETENU`

### Décision

La mémoire est indexée par identités, lieux, objets, factions, fils, faits, événements, relations, temps et alias connus. Les index contiennent des références et restent entièrement reconstruisibles depuis les sources autoritaires.

Retour dans un lieu, réapparition d'un acteur, reprise d'un fil, mention explicite et engagement d'intrigue sont des déclencheurs forts. Similarité, thème et proximité fournissent seulement des candidats secondaires.

### Raisons

Les rappels importants doivent fonctionner même après plusieurs mois de jeu et malgré une formulation différente. Un index dérivé ne doit cependant jamais devenir la seule copie d'une information ou une preuve d'identité.

### Conséquences

Le rappel d'un lieu comparera état connu et état actuel, en respectant connaissances et secrets. Une ambiguïté d'identité significative provoquera une clarification plutôt qu'une fusion approximative.

## NAR-030 — Recherche mémoire hybride par niveaux

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le rappel charge d'abord les éléments obligatoires, puis interroge en parallèle des canaux structurés, graphe borné, textuels et sémantiques avec quotas. Tous les candidats sont filtrés par perspective, validés contre leurs sources et classés par niveaux explicables.

La recherche sémantique est dérivée, facultative et limitée à la découverte de candidats. Son indisponibilité ne bloque pas la mémoire structurée et sa similarité ne prouve ni identité, ni vérité, ni droit de révélation.

### Raisons

Une recherche uniquement structurée manque les reformulations anciennes; une recherche uniquement sémantique produit des rapprochements plausibles mais non fiables. Un score global opaque pourrait aussi faire disparaître un élément obligatoire au profit d'un souvenir superficiellement similaire.

### Conséquences

Les index porteront des métadonnées de campagne, version et visibilité. Le diagnostic devra exposer canal, niveau et raison de sélection de chaque résultat.

## NAR-031 — Capsules et projections mémoire séparées

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les résultats mémoire sont dédupliqués sans fusionner les perspectives, puis condensés en capsules structurées et sourcées. Le sélecteur préserve une diversité utile sans ajouter de contenu artificiel.

Des projections distinctes sont construites pour le MJ système, le personnage joueur, chaque PNJ, le joueur en mode méta et le diagnostic. Les droits sont vérifiés à chaque étape et une donnée interdite ne peut pas réapparaître dans un résumé.

### Raisons

Un paquet dominé par des répétitions gaspillerait le contexte, tandis qu'une fusion de perspectives transformerait facilement croyances et rumeurs en vérité. Une séparation tardive des secrets serait également trop fragile.

### Conséquences

Chaque capsule portera source, perspective, validité et raison d'inclusion. Les futurs contrats IA recevront uniquement la projection correspondant à leur rôle précis.

## NAR-032 — Budget mémoire configurable et traçable

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le budget mémoire dépend du modèle et du rôle de l'appel. Instructions, sortie, entrée actuelle et éléments obligatoires sont réservés avant la sélection mémoire. Les catégories utilisent des minima et plafonds configurables, sans pourcentages universels.

La réduction retire d'abord doublons et candidats faibles, puis condense les capsules secondaires. Si les éléments obligatoires dépassent encore la capacité, le pipeline échoue explicitement ou fractionne la tâche; il ne tronque rien silencieusement.

Chaque projection produit une trace détaillant déclencheurs, canaux, candidats, droits, inclusions, exclusions, condensation et coût.

### Raisons

Les capacités varient selon les modèles et les rôles. Des seuils figés maintenant seraient arbitraires, tandis qu'une réduction non tracée rendrait les oublis impossibles à diagnostiquer.

### Conséquences

Les seuils chiffrés seront calibrés lors des exigences non fonctionnelles. Le retour tardif devient le cas de référence pour mesurer rappel, confidentialité et respect du budget.

## NAR-033 — TurnSnapshot et paquets spécialisés

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le `CampaignSnapshot` de sauvegarde est distinct du `TurnSnapshot`, vue interne immuable des sources nécessaires au début d'un tour. Chaque tâche IA reçoit ensuite un `RoleContextPack` spécialisé par rôle et perspective.

Après commit, la narration reçoit le snapshot initial complété par un `CommittedTurnResult` ou une projection post-commit versionnée. Aucun paquet n'est reconstruit depuis la prose ou depuis un autre paquet considéré comme autoritaire.

### Raisons

Les anciens essais perdaient la mise en scène ou envoyaient un contexte trop générique. Une photographie commune garantit la cohérence, tandis que les paquets spécialisés limitent coût et fuite de secrets.

### Conséquences

Les futurs contrats devront versionner snapshot, résultats et paquets, puis définir précisément les sections nécessaires aux rôles d'interprétation, création, dialogue, cohérence, narration et clarification.

## NAR-034 — Enveloppe et provenance du TurnSnapshot

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque `TurnSnapshot` porte les identifiants de campagne, tour, requête, scène et processus, les versions des agrégats, contenu, règles et politique, ainsi qu'un manifeste ordonné et une empreinte déterministe.

Les sections communes distinguent entrée, continuité de scène, monde, personnage, acteurs, processus, contraintes obligatoires et ancres de rappel. Chaque bloc projeté conserve source, version, validité, perspective et nature de vérité.

### Raisons

Sans manifeste, un contexte apparemment cohérent peut mélanger des versions incompatibles. Sans provenance par bloc, une condensation ou un extrait pourrait devenir impossible à vérifier.

### Conséquences

Les futurs schémas devront ordonner leur sérialisation, distinguer données incorporées et références, puis vérifier l'intégrité et les versions avant toute validation de commande.

## NAR-035 — Séparation planification secrète et rédaction visible

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les rôles d'interprétation, planification MJ, performance PNJ, critique de cohérence, rédaction de scène et clarification reçoivent des paquets distincts. Le planificateur peut consulter les secrets nécessaires; le rédacteur visible reçoit uniquement une enveloppe `reveal`, `hint`, `withhold` déjà autorisée.

Les informations sont étiquetées comme vérité objective, perception, connaissance, croyance, secret, dérivé ou inconnue. Validation, règles, mutations, droits et budgets restent déterministes.

### Raisons

Un rédacteur recevant toute la vérité cachée risque de la révéler involontairement. À l'inverse, un PNJ sans sa perspective propre peut parler avec le savoir du MJ.

### Conséquences

Les contrats devront filtrer les données avant construction de chaque paquet et empêcher une instruction de style d'élargir les droits de révélation.

## NAR-036 — Permissions créatives et budgets par rôle

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque contexte de rôle porte un `creativeScope` non extensible par le modèle. Les budgets sont configurés par modèle et rôle, avec un ordre de priorité et de réduction contractuel. Les informations obligatoires ne sont jamais tronquées silencieusement.

### Raisons

La présence d'une information dans le contexte ne doit pas devenir une autorisation implicite de la modifier ou de la révéler. Sous contrainte de taille, une perte silencieuse d'invariant produirait une cohérence seulement apparente.

### Conséquences

L'orchestrateur calcule permissions, enveloppe de révélation et réduction avant chaque appel. Un socle obligatoire trop volumineux provoque un échec explicite ou un découpage en appels spécialisés.

## NAR-037 — Obsolescence évaluée par dépendances

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque paquet conserve la version globale de départ et les versions précises des données réellement lues. Au retour, l'orchestrateur classe la sortie comme courante, à reprojeter, à revalider ou obsolète selon ces dépendances.

### Raisons

Accepter une sortie fondée sur une scène ou une cible périmée corromprait la causalité. À l'inverse, invalider tous les appels au moindre changement global provoquerait des relances inutiles et rendrait une future exécution parallèle fragile.

### Conséquences

Aucune mutation ne peut être committée depuis un paquet obsolète. Une clarification reconstruit un snapshot, les sorties parallèles sont contrôlées séparément et la narration visible se fonde sur la version post-commit.

## NAR-038 — Validation avant commit et avant affichage

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le pipeline sépare interprétation, proposition, résolution, commit et rédaction. Toute proposition est validée avant mutation et toute rédaction candidate est contrôlée avant affichage. La fiabilité prime sur la latence.

### Raisons

Valider uniquement les commandes ne suffit pas : un rédacteur peut encore inventer une conséquence, déformer l'intention du joueur ou révéler un secret. À l'inverse, rejouer toute la résolution à cause d'un défaut de prose créerait un risque de double effet.

### Conséquences

Un rejet avant commit ne modifie rien. Un rejet de rédaction après commit déclenche une correction ciblée de la forme à partir du même résultat autoritaire, sans nouvelle résolution ni second commit.

## NAR-039 — Appels spécialisés et performances avant commit

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Toute saisie libre passe par l'interprète et toute progression narrative par le planificateur. La reformulation du personnage joueur possède un rôle isolé. Chaque PNJ significatif reçoit un appel depuis sa propre perspective. Les paroles et engagements sont validés sur un résultat provisoire avant le commit atomique; le rédacteur final intervient ensuite.

### Raisons

La séparation empêche le rédacteur final de décider après coup ce qu'un personnage voulait dire ou savait. Elle permet également de développer l'expression du personnage joueur sans lui ajouter une intention étrangère.

### Conséquences

Le pipeline introduit un `PreparedTurnResult` éphémère. Les figurants ne sont groupés que pour les réactions sans portée durable et une critique spécialisée devient obligatoire pour les scènes à fort risque sémantique.

## NAR-040 — Contrats stricts et dialogues non réécrits

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Chaque rôle retourne un document JSON strict, versionné et corrélé à son contexte. Les expressions du personnage joueur et les dialogues PNJ sont validés avant commit puis conservés comme blocs exacts; le rédacteur final produit uniquement la narration qui les entoure.

### Raisons

Une réécriture tardive pourrait ajouter une intention, une promesse ou une révélation après validation. La séparation des blocs permet aussi à l'interface d'identifier clairement chaque locuteur.

### Conséquences

Une phrase prononcée est persistée comme acte historique sans transformer automatiquement son contenu en vérité. Les déclarations de couverture ou de confiance du modèle restent diagnostiques et sont vérifiées indépendamment.

## NAR-041 — Reprises bornées et rendu sécurisé

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Une sortie fautive reçoit au plus une correction ciblée puis une régénération complète avant arrêt sécurisé. La correction reste dans le même rôle et remplace entièrement la candidate précédente. Après commit, seule la rédaction peut être reprise; un rendu déterministe minimal est disponible en dernier recours.

### Raisons

Les réparations partielles sont difficiles à valider et les boucles illimitées masqueraient des défauts de contrat. Rejouer une résolution déjà committée risquerait de dupliquer des conséquences irréversibles.

### Conséquences

Chaque opération logique possède un `operationId`, chaque tentative un `attemptId` et un commit déjà effectué ne peut pas être répété. Le joueur n'est sollicité que pour une ambiguïté réelle, jamais pour compenser une panne interne.

## NAR-042 — Arbitrage IA borné et sortie fondée sur des sources

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les règles calculables restent exécutées par les domaines. Une IA spécialisée peut interpréter les règles, estimer un paramètre ouvert ou proposer un arbitrage ad hoc sourcé. Le domaine propriétaire valide et committe la décision. Chaque bloc visible référence par ailleurs ses sources révélables ou une permission de texture précise.

### Raisons

Un jeu de rôle ne peut pas prédéfinir toutes les durées, difficultés et interactions possibles. Refuser tout arbitrage IA recréerait un moteur rigide; lui donner une autorité directe rendrait les règles et la chronologie incontrôlables. Une recherche lexicale ne suffit pas non plus à détecter une fuite reformulée.

### Conséquences

Les arbitrages acceptés peuvent être conservés comme précédents de campagne sans modifier les règles officielles. Le contrôle d'affichage combine références autorisées, droits de révélation et analyse sémantique ciblée.
