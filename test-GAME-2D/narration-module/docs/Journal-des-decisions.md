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

## NAR-043 — Transactions courtes et handoffs sauvegardables

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Les intégrations utilisent soit une transaction courte coordonnée, soit un `ProcessHandoff` lorsque le contrôle passe temporairement à un moteur interactif. Le tactique est un processus suspendant la scène; le monde macroscopique évolue par événements validés liés à l'horloge commune.

### Raisons

Un combat, un repos complexe ou un voyage détaillé ne peuvent pas être représentés honnêtement par une commande instantanée. Inversement, fusionner narration, tactique et simulation mondiale créerait des autorités concurrentes et des états impossibles à reprendre proprement.

### Conséquences

Les processus longs possèdent seed, état actif, checkpoints et résultat structuré. Leur retour passe par une transaction multidomaine puis un nouveau snapshot. Les implémentations actuelles seront raccordées par adaptateurs et ne sont pas considérées comme des contrats achevés.

## NAR-044 — Progression mécanique et évolution identitaire séparées

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Le personnage de campagne sépare identité importée, profil mécanique, état courant et profil expressif. L'IA peut proposer progression et évolutions narratives, mais les règles valident la première et le joueur accepte explicitement toute modification identitaire durable.

### Raisons

Les événements doivent pouvoir transformer le personnage sans permettre au modèle de lui attribuer silencieusement une nouvelle personnalité. De même, une récompense narrative ne peut pas contourner les choix et préconditions de progression.

### Conséquences

Observations d'arc, candidats de traits et traits durables ont des cycles distincts. La fiche source reste inchangée et les choix de progression incomplets suspendent leur propre processus sans être décidés par l'IA.

## NAR-045 — Import normalisé et projections compatibles du personnage

Date : `2026-06-30`

Statut : `RETENU`

### Décision

La fiche prête à jouer devient une source d'import conservée, validée puis normalisée dans `PlayerCharacterState`. Les valeurs dérivées sont recalculées et chaque moteur reçoit une projection compatible plutôt que l'agrégat complet.

### Raisons

La fiche actuelle combine choix sources, caches, provenance de création et représentations historiques. La partager directement empêcherait une évolution fiable et permettrait à un retour tactique d'écraser des données extérieures à son autorité.

### Conséquences

Un rapport d'import réconcilie références, monnaie et caches. Le tactique conserve une projection adaptée à son contrat actuel et renvoie uniquement événements et deltas.

## NAR-046 — Instances physiques et présentation sociale contextuelle

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Équipement, placements et contenus référencent des instances. Les pièces physiques sont la monnaie autoritaire portée. État du corps, propreté et objets visibles forment une projection de présentation dont l'effet social dépend du contexte sans modifier le Charisme de base.

### Raisons

Le modèle actuel représente déjà sacs, capacités, emplacements et pièces physiques, mais mélange identifiants de définition, emplacements et instances. L'apparence doit produire des conséquences de rôleplay sans devenir un bonus universel abstrait.

### Conséquences

Les données legacy sont migrées, les contenus de sacs deviennent dérivés des placements, et le domaine social valide des facteurs de présentation bornés selon l'observateur et la scène.

## NAR-047 — Ruleset maison explicite et versionné

Date : `2026-06-30`

Statut : `RETENU`

### Décision

Seules les règles présentes dans le `RuleRegistry` du ruleset épinglé sont applicables. Les règles maison déclarent explicitement leur portée et les règles remplacées. La connaissance générale de D&D détenue par l'IA n'a aucune autorité.

### Raisons

Le jeu combine plusieurs inspirations et règles propres. Une convention implicite serait impossible à partager, tester et faire évoluer sans ambiguïté entre développeur, moteur et IA.

### Conséquences

Les arbitrages citent leurs règles et restent ad hoc en cas de vide. Toute nouvelle règle maison ou migration possède version, conflits déclarés, exemples et scénarios de test.

## NAR-048 — Voyage segmenté et rencontres contextuelles reproductibles

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les voyages deviennent des processus sauvegardables progressant par segments. Un moteur de rencontres calcule une pression contextuelle, effectue un tirage stable puis sélectionne une catégorie. L'IA concrétise seulement les candidats qui ne proviennent pas déjà du monde simulé.

### Raisons

Un simple jet aléatoire par heure produirait des répétitions, ignorerait le monde vivant et changerait lors d'une reprise technique. À l'inverse, réserver toutes les rencontres aux seuls acteurs existants limiterait fortement la variété des voyages.

### Conséquences

La graine dépend de la campagne, du voyage et du segment. Danger, trafic, écologie, factions, heure et intrigues modulent les catégories. Les rencontres peuvent être sociales, étranges, animales, environnementales ou hostiles et rendent la main sans liste d'actions.

## NAR-049 — Résolution sociale guidée par l'acteur

Date : `2026-07-02`

Statut : `RETENU`

### Décision

La résolution sociale commence par la faisabilité selon motivations, valeurs, connaissances et relation du PNJ. Un jet intervient seulement lorsqu'un résultat reste incertain et significatif. Relations, dispositions, croyances et vérités sont conservées séparément.

### Raisons

Un jet systématique réduirait les PNJ à des serrures de Charisme. Évaluer la qualité d'écriture du joueur pénaliserait aussi celui qui joue un personnage plus éloquent que lui et avantagerait artificiellement l'inverse.

### Conséquences

L'IA interprète approche, preuves et contexte, puis le domaine social applique le ruleset. Les relations utilisent plusieurs axes causés et bornés; une affirmation peut modifier une croyance sans devenir un fait objectif.

## NAR-050 — Session tactique sauvegardable et intégration unique

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le tactique est un handoff déclenché lorsque la résolution exige sa granularité spatiale et mécanique. Seed, carte, actions et checkpoints sont versionnés. La fin produit un résultat structuré intégré une seule fois par les domaines propriétaires.

### Raisons

Déclencher le plateau pour tout conflit ralentirait inutilement la narration, tandis qu'un simple résumé victoire/défaite perdrait ressources, positions, paroles et conséquences. Rejouer un combat à cause d'une panne d'intégration violerait la chronologie irréversible.

### Conséquences

Les cartes générées sont validées et reproductibles. Les paroles significatives deviennent des actions. Un résultat terminé peut attendre son intégration, mais la rencontre ne peut plus être rouverte et la narration reprend toujours depuis un nouveau snapshot post-commit.

## NAR-051 — Repos segmenté et signal d'interface événementiel

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le repos est un processus narratif piloté par le ruleset, progressant par segments et capable d'être interrompu. Les questions restent dans la conversation. Un popup distinct signale début, fin ou interruption uniquement depuis les événements committés du repos.

### Raisons

Un repos peut demander des choix, consommer du temps et des ressources, déclencher des événements et ne réussir que partiellement. Une notification purement générée par la prose pourrait annoncer un état qui n'existe pas réellement.

### Conséquences

Le `RestOutcome` coordonne personnage, inventaire, temps, monde et mémoire. Les notifications sont accessibles, historisées et sans effet métier; le helper actuel de recharge devient un calcul interne parmi d'autres.

## NAR-052 — Repository abstrait et IndexedDB pour le prototype local

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le métier utilise un `CampaignRepository` abstrait. Les tests emploient un adaptateur mémoire, le prototype navigateur IndexedDB et une évolution serveur pourra employer SQLite. `localStorage` ne devient pas le stockage canonique de campagne.

### Raisons

La campagne exige transactions multidomaines, journal croissant, checkpoints et reprise par état. `localStorage` est synchrone, limité et sans transaction entre collections. IndexedDB répond mieux au prototype tout en restant entièrement local.

### Conséquences

Les opérations persistent leur état de réception jusqu'au rendu. Une panne après commit reprend seulement les étapes postérieures. Préférences, campagne active et imports historiques peuvent rester dans `localStorage`.

## NAR-053 — Horloge diégétique précise et ticks monde dérivés

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le `WorldDomain` possède un `CampaignClock` exprimé par un entier monotone de secondes depuis l'origine de campagne. Le calendrier est dérivé. Les microticks horaires du monde sont des paliers de calcul suivis par un curseur, pas une horloge concurrente.

### Raisons

La narration consomme secondes et minutes tandis que la simulation raisonne par heures. Deux horloges autoritaires dériveraient et rendraient impossibles les interruptions causales au milieu d'un voyage ou d'un repos.

### Conséquences

Tout module soumet une avance sourcée au `WorldDomain`. Les longues durées sont committées par segments et deux événements à la même seconde sont ordonnés par leurs séquences plutôt que par une précision fictive.

## NAR-054 — Échéancier causal et frontières explicites

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les effets futurs sont des `ScheduledEffect` possédés par un domaine et résolus dans des `TemporalBatch` idempotents. Les dépendances imposent l'ordre causal. Lorsqu'une simultanéité influence le gameplay, le ruleset déclare sa relation à la fin de l'activité.

### Raisons

L'ordre d'exécution accidentel des modules ne doit pas déterminer si un repos se termine avant une attaque ou si un effet expire avant une action. Les avances longues doivent aussi pouvoir s'arrêter exactement à la première interruption pertinente.

### Conséquences

Les échéances annulées restent historiques, les cycles bloquent avant commit et les événements perceptibles simultanés sont composés dans une même restitution avant toute nouvelle avance.

## NAR-055 — Origines distinctes et composition événementielle

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Chaque événement indique s'il provient du joueur, d'une règle, de la simulation, d'une proposition IA, d'un processus ou d'une échéance. Les événements simultanés ou liés sont regroupés dans un `SceneEventBundle` sans fusionner leurs identités autoritaires.

### Raisons

La narration doit pouvoir exploiter ensemble créations IA et monde simulé sans dupliquer une patrouille, transformer une rumeur en fait ou perdre les causes précises derrière une scène synthétique.

### Conséquences

Les propositions IA sont dédupliquées et validées avant commit. La simulation produit des événements, jamais directement de la prose. Un événement invisible reste journalisé et pourra être découvert ultérieurement par un canal valide.

## NAR-056 — Retour tardif fondé sur perception et histoire committée

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le monde évolue hors écran uniquement lorsque le temps de campagne avance. Un retour dans un lieu reconstruit les changements depuis les événements committés, l'état courant, la dernière perception et les souvenirs du personnage.

### Raisons

Comparer seulement deux vérités système révélerait des secrets anciens ou nouveaux. Improviser les mois d'absence au moment du retour créerait des causes rétroactives et fragiliserait les intrigues.

### Conséquences

Les niveaux actif, résumé et abstrait adaptent le coût sans supprimer les engagements critiques. Les changements sont classés comme visibles, déductibles, appris, remémorés, cachés ou différés avant composition de la scène.

## NAR-057 — Validation temporelle par scénario causal reproductible

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le contrat temporel est validé par un corpus de cas limites et un exemple parseable combinant interruption de repos, frontière horaire, événement perceptible, événement caché et nouvelle tentative idempotente.

### Raisons

Les erreurs temporelles apparaissent surtout aux frontières : simultanéité, interruption, rattrapage, panne après commit et retour tardif. Une description nominale ne suffit pas à prouver leur comportement attendu.

### Conséquences

Tout futur schéma ou runtime devra préserver ces résultats. Une régression qui double un tick, applique un bénéfice non atteint ou révèle un événement invisible viole le contrat de l'atelier.

## NAR-058 — Confinement des erreurs et lecture seule protectrice

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les erreurs sont confinées par appel, sortie, opération, domaine, processus puis campagne. Les défauts d'intégrité non vérifiables placent la campagne en lecture seule; les pannes de présentation ou d'index utilisent un mode dégradé.

### Raisons

Traiter toutes les erreurs de la même manière conduirait soit à poursuivre avec un état incertain, soit à bloquer inutilement une campagne saine à cause d'une simple panne IA.

### Conséquences

Chaque incident significatif possède un enregistrement expurgé et une politique de reprise. Le mode lecture seule interdit les écritures mais préserve consultation et export sans correction automatique destructive.

## NAR-059 — Reprises fournisseur bornées et fallback certifié

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les tentatives IA sont corrélées et bornées, avec compteurs techniques et sémantiques séparés. Un circuit breaker limite les attentes répétées. Un modèle de secours doit être certifié pour le rôle, le schéma et les mêmes permissions.

### Raisons

Une réponse tardive ou un fallback moins contraint pourrait être acceptée après qu'une autre tentative a déjà progressé, dupliquer le travail ou exposer un secret. Mélanger erreurs réseau et contradictions rendrait aussi les reprises inefficaces.

### Conséquences

Chaque tentative possède son statut et toute sortie remplacée est ignorée. Les rôles critiques se suspendent sans modèle qualifié; seuls les rendus et recherches disposant d'un fallback sûr se dégradent automatiquement.

## NAR-060 — Écrivain unique et reprise par idempotencyKey

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Une campagne possède un écrivain métier actif, protégé par version optimiste et fencing token. Les doubles soumissions partagent une idempotencyKey. Les appels IA s'exécutent hors transaction et leurs dépendances sont relues avant commit.

### Raisons

Double clic, deux onglets ou réponse tardive peuvent sinon appliquer deux fois une action. Après une fermeture brutale, l'absence de réponse UI ne permet pas de savoir si IndexedDB a committé.

### Conséquences

La reprise recherche l'opération existante au lieu de répéter l'effet. Les processus n'avancent qu'après checkpoint, et les projections post-commit sont alimentées par une outbox idempotente.

## NAR-061 — Les contenus restent des données sans autorité procédurale

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les textes du joueur, du lore, des imports, de la mémoire et des générations IA restent des données non fiables à travers toutes leurs transformations. Les rôles IA disposent de permissions minimales, ne mutent jamais directement l'état et ne reçoivent que les secrets nécessaires. Toute proposition est filtrée par schéma, fondation, révélations autorisées et invariants métier.

### Raisons

Une recherche de mots suspects ne protège ni des injections indirectes ni d'une fuite accidentelle de secret. La sécurité doit venir de frontières d'autorité structurelles qui restent valides même lorsque le texte hostile n'est pas reconnu comme tel.

### Conséquences

Les contextes séparent instructions et contenu, les imports et rendus sont bornés et assainis, et les diagnostics sont expurgés. Une violation bloque l'opération concernée sans condamner une campagne saine; une incertitude d'intégrité conserve la politique de lecture seule.

## NAR-062 — Diagnostic corrélé, expurgé et séparé de la vérité métier

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Journal métier, incidents techniques et traces détaillées sont trois catégories distinctes. Les incidents conservent versions, références, étapes et issue sans prompts ou réponses brutes par défaut. L'expérience joueur et l'interface développeur présentent des niveaux d'information séparés.

### Raisons

Un diagnostic trop pauvre empêche de corriger les incohérences; une copie systématique des contextes et sorties créerait un second stockage de secrets et polluerait l'expérience. La non-détermination des modèles interdit aussi de promettre une reproduction textuelle exacte.

### Conséquences

Les incidents expurgés sont initialement retenus 30 jours ou à hauteur de 500 par campagne. Le mode détaillé est volontaire et limité à 24 heures. L'audit reproduit entrées, permissions et validations, tandis que le journal métier reste l'unique historique autoritaire.

## NAR-063 — Mesurer séparément attente, commit et rendu

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Un tour expose des jalons distincts d'acceptation, préparation, commit et rendu. Les classes standard et complexe possèdent des objectifs p95 et des limites maximales différentes. L'interface signale l'étape active sans diffuser de contenu non validé.

### Raisons

Une durée globale confondrait lenteur fournisseur, résolution métier et panne de rendu. Elle encouragerait aussi à publier trop tôt ou à sacrifier une validation pour améliorer une moyenne peu représentative.

### Conséquences

Les mesures conservent médiane, p95, maximum et dépassements par étape. Le tour standard vise 40 secondes au p95 avec une limite de 90 secondes; le tour complexe vise 75 secondes avec une limite de 120 secondes. Une annulation après commit ne revient pas sur la vérité acquise.

## NAR-064 — Enveloppes IA globales et coût financier mesuré

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Chaque rôle possède une enveloppe d'entrée et de sortie, incluse dans un plafond global de tour couvrant aussi corrections et retries. Les coûts sont estimés avant appel et mesurés après réponse. Les montants financiers restent ouverts jusqu'au benchmark des fournisseurs et modèles retenus.

### Raisons

Un plafond par appel seulement laisserait exploser les scènes multi-PNJ et les reprises. À l'inverse, un prix en euros fixé sans modèle, cache ni durée de session donnerait une précision fictive rapidement obsolète.

### Conséquences

Le profil initial limite un tour standard à 60 000 tokens d'entrée et 8 000 de sortie, et un tour complexe à 120 000 et 16 000. Les contenus obligatoires ne sont jamais sacrifiés au budget. Le benchmark du profil `balanced` devient une condition préalable à l'implémentation finale.

## NAR-065 — Seuils statistiques subordonnés aux invariants absolus

Date : `2026-07-02`

Statut : `RETENU`

### Décision

La qualité est évaluée sur un corpus annoté et versionné par contrôles déterministes, assertions d'état et revue humaine. Secrets, autorité, agence, ambiguïtés dangereuses et faits critiques ont une tolérance zéro. Sorties structurées, rappel, reformulation et répétitions possèdent en complément des seuils statistiques initiaux.

### Raisons

Une excellente moyenne pourrait autrement masquer une fuite grave ou une action exécutée contre l'intention du joueur. Une évaluation confiée uniquement à un autre modèle de la même chaîne créerait également un juge non indépendant et difficile à auditer.

### Conséquences

Les sorties doivent être valides après reprise dans au moins 99,5 % des cas, le rappel annoté vise 90 % avec 80 % de précision et la reformulation fidèle 95 %. La qualité narrative est revue sur quatre dimensions avec une moyenne minimale de 4/5, sans rendre acceptable une violation absolue.

## NAR-066 — Capacité vérifiée et migrations sans remplacement destructif

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le prototype est dimensionné par un benchmark minimal de 10 000 tours, 200 000 événements, 50 000 mémoires et 500 Mo hors médias. IndexedDB reste admis s'il respecte les seuils. Toute migration travaille sur une copie validée et ne remplace la campagne active qu'après contrôle complet.

### Raisons

La mémoire longue et les intrigues persistantes n'ont de valeur que si leur coût reste borné après des mois de jeu. Une migration en place ou une importation partielle pourrait détruire une chronologie que le joueur ne peut volontairement recharger.

### Conséquences

Les chemins critiques ne parcourent jamais tout l'historique. Le stockage surveille son quota et avertit à 70 %. SQLite devient nécessaire si IndexedDB échoue au benchmark ou si l'autorité durable quitte le navigateur. Les copies de migration sont une protection technique, pas un retour narratif.

## NAR-067 — Scénarios courts, checkpoints et prose libre

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les scénarios d'acceptation sont atomiques, fonctionnels, verticaux ou longitudinaux. Un scénario automatisé ne dépasse pas 20 échanges; un historique long est préparé par fixture et les parcours supérieurs sont divisés par checkpoints. Les oracles déterministe, sémantique et qualitatif sont séparés.

### Raisons

Rejouer des centaines d'échanges rendrait les tests lents, coûteux et impossibles à diagnostiquer. Comparer le texte exact transformerait par ailleurs une IA créative en moteur de dialogues préécrits.

### Conséquences

État et événements sont vérifiés exactement, tandis que la formulation demeure libre dans une enveloppe sémantique et qualitative. Une clarification compte comme un nouvel échange et doit reprendre l'intention suspendue sans mutation préalable.

## NAR-068 — Parcours vertical contraint sans contenu narratif imposé

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Le scénario vertical couvre 18 échanges et quatre checkpoints aux Archives de Lysenthe. Il fixe état initial, intentions joueur, domaines traversés et assertions, mais laisse à l'IA le contenu concret compatible des PNJ, de l'intrigue, des indices et de la confrontation.

### Raisons

Un parcours totalement ouvert serait impossible à auditer; une quête écrite pour le test contredirait l'objectif d'un MJ créateur. Les checkpoints permettent de vérifier les contrats sans imposer la solution fictionnelle.

### Conséquences

Le scénario traverse dialogue, social, temps, tactique, repos, sauvegarde, ellipse et rappel. Le combat doit posséder une cause interne et le retour tardif est évalué depuis les perceptions du personnage, jamais depuis l'ancien texte complet.

## NAR-069 — Certifier la création puis geler la structure d'intrigue

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les intrigues sont testées en deux phases. La première mesure la création autonome d'une structure solvable à partir de contraintes. Une structure acceptée devient ensuite une fixture versionnée utilisée pour tester sa continuité, sans figer la prose.

### Raisons

Une génération ponctuellement cohérente ne prouve pas la stabilité dans le temps. Inversement, suivre une intrigue écrite à la main ne prouve pas la capacité du MJ IA à en créer. Séparer les phases rend les défauts attribuables et les régressions reproductibles.

### Conséquences

Le corpus conserve plusieurs formes d'intrigue et interdit la mise à jour automatique des références. Les tests avec fournisseur certifient la création; les fixtures permettent des régressions fréquentes sur vérités, indices, témoignages, perspectives et fausses pistes.

## NAR-070 — Tester chaque propriétaire avec le niveau d'IA nécessaire

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les scénarios des domaines emploient des fixtures contrôlées pour leurs états et résultats déterministes. Les appels à un fournisseur réel sont réservés aux assertions portant sur interprétation, arbitrage ouvert, création ou rédaction. Les parcours intégrés complètent ces tests ciblés.

### Raisons

Faire dépendre chaque vérification d'une génération distante rendrait les régressions lentes, coûteuses et difficiles à attribuer. Supprimer toute IA des tests ne vérifierait toutefois pas le cœur du produit.

### Conséquences

Règles, transactions, voyage, tactique, repos, migration et reprise peuvent être éprouvés de façon reproductible. Les certifications IA restent obligatoires là où la capacité générative est réellement revendiquée.

## NAR-071 — Couverture P0 traçable avant audit final

Date : `2026-07-02`

Statut : `RETENU`

### Décision

L'atelier d'acceptation est fermé uniquement après liaison de chaque famille P0 à une décision, un contrat, un scénario et un oracle observable. Des scénarios dédiés complètent le parcours vertical pour agence, concurrence, sécurité, ordre temporel, règles maison et capacité longue.

### Raisons

Une checklist de cas nominaux pouvait sembler complète tout en laissant sans preuve des mécanismes critiques déjà spécifiés. Un seul grand parcours aurait également rendu les échecs difficiles à attribuer.

### Conséquences

La matrice de traçabilité devient l'index de couverture de l'atelier 12. Les fixtures exécutables restent un produit du runtime futur. Le coût financier fournisseur demeure un report visible et ne peut être déclaré validé par le seul corpus fonctionnel.

## NAR-072 — Alignement documentaire sans élargissement du contrat

Date : `2026-07-02`

Statut : `RETENU`

### Décision

L'audit aligne les statuts et formulations anciennes sur les décisions déjà retenues. Le `scene_writer` est obligatoire dans le parcours IA nominal, avec pour seule exception le rendu déterministe de sécurité. Le champ visible `withhold` ne transporte qu'un identifiant opaque, jamais le texte brut d'un secret.

### Raisons

Des métadonnées périmées faisaient apparaître comme ouvertes des décisions déjà prises. Deux formulations absolues créaient aussi une ambiguïté entre disponibilité et sécurité sans refléter l'architecture validée.

### Conséquences

Les documents de temps, contexte et intégration passent à `RETENU`. IndexedDB est distingué du schéma physique encore ouvert. Les corrections ne changent ni autorité, ni séquence de commit, ni périmètre MVP.

## NAR-073 — Chaque report bloque uniquement sa capacité propriétaire

Date : `2026-07-02`

Statut : `RETENU`

### Décision

Les questions restantes sont classées en prérequis avant premier code, prérequis de capacité, mesure avant certification, décision conditionnelle ou hors MVP. Seuls les contrats du premier lot doivent être `FIGE` avant son démarrage; les autres restent `RETENU` jusqu'à leur propre gate.

### Raisons

Tout bloquer jusqu'au choix du fournisseur, de l'index sémantique ou de l'UX finale empêcherait un noyau sain. À l'inverse, considérer ces points comme de simples détails autoriserait le code à créer silencieusement le contrat.

### Conséquences

Chaque report possède désormais propriétaire, échéance et preuve attendue. Aucun fallback, seuil ou format ne peut être choisi implicitement. Le runtime reste globalement bloqué tant que les identités, versions, opérations, événements, erreurs et repository du premier lot ne sont pas figés.

## NAR-074 — Noyau transactionnel `campaign-core/1`

Date : `2026-07-02`

Statut : `FIGE`

### Décision

Le premier lot d'implémentation cible uniquement un noyau de campagne transactionnel avec repository mémoire. Le contrat `campaign-core/1` fige identités, versions, opérations, commandes acceptées, agrégats, événements, horloge minimale, commit, fencing, outbox, erreurs et port de persistance.

### Raisons

Commencer par le fournisseur IA ou l'interface recréerait les erreurs précédentes : la prose deviendrait implicitement source de vérité et les reprises seraient ajoutées après coup. À l'inverse, figer dès maintenant tous les domaines produirait une architecture spéculative.

### Conséquences

Le premier lot ne dépend d'aucun moteur narratif, fournisseur, UI ou stockage navigateur. Une suite contractuelle unique certifiera l'adaptateur mémoire puis les futurs adaptateurs. Toute évolution normative exigera une nouvelle version et une décision de compatibilité.

## NAR-075 — InteractionLog reconstructible et prose hors commit métier

Date : `2026-07-02`

Statut : `FIGE`

### Décision

L'entrée brute est persistée dans `OperationRecord` dès réception. Les actes de parole durables et résultats de domaine appartiennent au commit. La prose finale post-commit est un résultat filtré et non autoritaire de l'opération. `InteractionLog` est une projection reconstructible de ces sources.

### Raisons

Placer la prose finale dans le commit contredisait l'ordre validé du pipeline; effectuer un second commit métier pour l'afficher aurait compliqué idempotence et reprise. Une simple question méta doit également rester durable sans créer d'événement du monde.

### Conséquences

Une panne de rédaction ne rejoue aucun effet. Une opération reçue peut reprendre depuis son payload durable. La perte du cache de transcript ne supprime ni entrée, ni résultat, ni acte de parole committé.

## NAR-076 — Autorisation limitée au lot I-00

Date : `2026-07-02`

Statut : `FIGE`

### Décision

Le cahier des charges autorise uniquement I-00 : types, schémas, validateurs, noyau transactionnel, port `CampaignRepository`, adaptateur mémoire et tests de `campaign-core/1`. Les huit lots suivants restent fermés jusqu'à leur gate.

### Raisons

Le contrat fondamental est désormais stable et testable, tandis que les capacités suivantes possèdent encore des schémas ou mesures propres à produire. Une autorisation globale recréerait des choix implicites; un blocage total empêcherait de vérifier la fondation.

### Conséquences

I-00 peut commencer sur demande explicite. Il ne modifie ni UI, ni serveur, ni route tactique et ne branche aucun fournisseur. Sa réussite conditionne l'ouverture d'I-01.

## NAR-077 — Persistance IndexedDB par générations de campagne

Date : `2026-07-03`

Statut : `FIGE`

### Décision

I-01 implémente `campaign-storage/1` dans une base IndexedDB unique. Chaque campagne pointe vers une génération active; tous ses enregistrements métier portent physiquement `generationId`, et chaque transaction d'écriture relit ce pointeur. Une migration prépare une nouvelle génération, la valide, bascule le pointeur atomiquement et conserve l'ancienne comme sauvegarde technique.

### Raisons

Une migration directe des enregistrements ne permettrait pas à la fois copie de sécurité, reprise bornée et activation atomique sur une campagne volumineuse. Une base distincte par génération rendrait impossible la vérification atomique du pointeur face à un ancien onglet. Le pointeur et les données dans la même base permettent de bloquer les écritures pendant la copie puis d'empêcher toute écriture dans une génération devenue obsolète.

### Conséquences

Le schéma physique, les index et les frontières transactionnelles sont normatifs. Les calculs longs restent hors transaction. La suite commune est exécutée contre mémoire et IndexedDB, complétée par quinze cas dans un vrai Chromium. Les seuils définitifs de capacité restent mesurés en I-08, sans reporter la gestion sûre des erreurs de quota.

## NAR-078 — Autorisation limitée au lot I-01

Date : `2026-07-03`

Statut : `FIGE`

### Décision

Après livraison et vérification d'I-00, AF-R03 est résolu par `campaign-storage/1`. Le lot I-01 est autorisé pour l'adaptateur IndexedDB, le moteur de migration par générations, la factorisation de la suite contractuelle et les tests navigateur. I-02 à I-08 restent fermés.

### Raisons

Le port métier reste inchangé, les structures et transactions sont définies, les pannes attendues possèdent un oracle et les mesures de capacité non bloquantes sont séparées de l'intégrité. Aucun choix de contenu, règle, personnage ou IA n'est nécessaire pour éprouver la persistance.

### Conséquences

I-01 peut commencer sans importer IndexedDB dans React ou les domaines. Toute extension vers le wiki, l'import personnage ou les règles maison reste interdite avant la résolution de AF-R04 à AF-R07.

## NAR-079 — Bootstrap depuis des dépendances immuables et validées

Date : `2026-07-03`

Statut : `REMPLACE` par NAR-081 et NAR-082

### Décision

Le contrat `campaign-bootstrap/1` résout AF-R04 à AF-R07. Une campagne est créée depuis un paquet de contenu et un ruleset résolus par identifiant et version exacts, ainsi qu'une fiche importée à travers une enveloppe versionnée. Le wiki est compilé avec diagnostics bloquants et provenance; les valeurs dérivées du personnage sont recalculées par des exécuteurs communs; toute règle mécanique est identifiée et versionnée.

### Raisons

Le parseur wiki actuel ignore des erreurs, la fiche legacy mélange choix, état mutable et dérivés, et les règles sont dispersées entre données et code. Lire ces sources directement au démarrage d'une campagne reproduirait les causes des essais précédents : contexte non fiable, autorités concurrentes et comportement dépendant de connaissances implicites du modèle.

### Conséquences

Les fichiers sources, caches UI et créations dynamiques ne sont jamais des dépendances flottantes d'une campagne. Le document brut `gouvernances/primauté` devra être converti ou exclu explicitement. L'import vérifie inventaire physique, monnaie, conteneurs et équipement visible; l'apparence peut devenir un facteur social sans altérer le Charisme. Un arbitrage accepté reste un précédent de campagne et ne devient jamais automatiquement une règle.

## NAR-080 — Autorisation limitée au lot I-02

Date : `2026-07-03`

Statut : `REMPLACE` par NAR-083

### Décision

Après livraison d'I-01 et gel de `campaign-bootstrap/1`, I-02 est autorisé pour la génération du paquet V1, l'ingestion wiki stricte, l'import et les projections du personnage, le `RuleRegistry` MVP et l'opération atomique `campaign.bootstrap`. I-03 à I-08 restent fermés.

### Raisons

Les autorités, versions, erreurs attendues, frontières d'intégration et preuves de sortie sont désormais assez précises pour être implémentées sans inventer le contrat dans le code. Les mécanismes de temps, mémoire, fournisseur IA, scène, tactique et repos ont leurs propres gates et ne sont pas nécessaires pour certifier le bootstrap.

### Conséquences

I-02 doit réutiliser le noyau et le repository existants, ne pas lire `localStorage` dans le domaine, ne pas étendre le parseur permissif comme autorité et ne pas dupliquer les formules de personnage. Sa fermeture exige les Archives de Lysenthe, la fiche prête à jouer, les rejets ciblés et les checkpoints NAR-ACC-008, 009 et 021.

## NAR-081 — Bootstrap atomique par port spécialisé

Date : `2026-07-06`

Statut : `FIGE`

### Décision

`campaign-bootstrap/2` remplace `campaign-bootstrap/1`. `CampaignBootstrapRepository` crée campagne, opération, horloge, agrégats initiaux, commandes, commit, événements et outbox dans une transaction unique. Il réutilise les invariants de `campaign-core/1` sans appeler préalablement `createCampaign`.

### Raisons

`createCampaign` autorise uniquement la campagne et son horloge. L'enchaîner avec un commit métier publierait une campagne partielle en cas de panne et violerait l'atomicité annoncée. Modifier le noyau déjà livré n'est pas nécessaire : la capacité de création complète appartient au contrat I-02 et peut être implémentée par les deux adaptateurs existants.

### Conséquences

La campagne persistée par le bootstrap commence à la révision `1`, tous ses agrégats initiaux référencent le commit initial et la reprise conserve les identités originales. La suite I-02 injecte des pannes à chaque frontière d'écriture et vérifie qu'aucun état à la révision `0` n'est observable.

## NAR-082 — Lore auteur structuré par entité et niveau de connaissance

Date : `2026-07-06`

Statut : `FIGE`

### Décision

`lore-authoring/1` complète le bootstrap avec les types `espece`, `culture`, `pnj`, `periode_historique` et `evenement_historique`. Les informations sélectionnables portent un niveau `COMMUN`, `LOCAL`, `SPECIALISE`, `RESTREINT` ou `MJ_SECRET` et deviennent des fragments déterministes sourcés.

### Raisons

Les catalogues existants décrivent surtout les règles jouables et les anciens templates mélangent textes libres, état initial, état mutable, connaissances et secrets. La future IA doit retrouver une information par lieu, acteur, culture, alias ou relation sans charger un document entier ni exposer un secret à la mauvaise perspective.

### Conséquences

Catalogues mécaniques, lore initial et agrégats de campagne ont des autorités distinctes. Espèce et culture ne sont pas synonymes. Les templates vivent hors de `wiki/lore/`; le générateur sépare les fragments secrets avant indexation joueur et conserve la provenance jusqu'au champ source.

## NAR-083 — Autorisation I-02 maintenue après révision contractuelle

Date : `2026-07-06`

Statut : `FIGE`

### Décision

I-02 reste le seul lot autorisé, désormais dans les limites de `campaign-bootstrap/2` et `lore-authoring/1`. I-03 à I-08 restent fermés.

### Raisons

Les contradictions découvertes ont été résolues avant création des types exécutables. Le port atomique, les autorités de contenu, les nouveaux types, les niveaux de connaissance et les preuves attendues sont explicites.

### Conséquences

L'implémentation peut commencer par les types et schémas lore, les diagnostics, la génération déterministe et les tests du port de bootstrap. Elle ne branche ni mémoire longue, ni fournisseur IA, ni UI narrative.

## NAR-084 — Horloge unique et ouverture limitée d'I-03A

Date : `2026-07-06`

Statut : `FIGE`

### Décision

I-02 est clos pour le périmètre narration avec une réserve de parité tactique différée. I-03 est découpé en quatre sous-lots. Seul I-03A, défini par `temporal-kernel/1`, est ouvert : propositions d'avance, échéances, ordre causal, batches déterministes et calcul des frontières horaires.

`world.clock.elapsedGameSeconds` reste l'unique horloge. Les compteurs `tick`, `microTick` et `macroTick` du `map-module` sont des curseurs dérivés derrière `worldSimulatedThrough`.

### Raisons

Le moteur monde existant mute son `WorldState` et force au moins une heure dans `runWorldHours`. Le brancher directement à une durée narrative risquerait un tick sur une durée nulle, une perte des fractions d'heure et une autorité temporelle concurrente. Un noyau pur doit segmenter et valider le temps avant toute intégration.

### Conséquences

I-03A ne persiste rien et n'importe pas le moteur carte. I-03B devra rendre échéances et checkpoints atomiques avec l'horloge. I-03C appellera la simulation uniquement avec un nombre entier strictement positif d'heures dues et sur une copie de travail. I-04 à I-08 restent fermés.

## NAR-085 — Persistance temporelle dans le commit du noyau

Date : `2026-07-06`

Statut : `FIGE`

### Décision

Échéancier, curseur de simulation et checkpoints de processus sont des agrégats ordinaires versionnés. `prepareTemporalSegmentCommitV1` écrit leurs évolutions avec `world.clock` dans une unique `CommitRequest` de `campaign-core/1`.

### Raisons

Créer un repository temporel ou un store de processus séparé rendrait une avance partiellement observable et dupliquerait l'idempotence déjà fournie par le noyau. Les checkpoints doivent suivre le même commit et la même révision de campagne que leurs événements.

### Conséquences

Une panne ne publie ni heure, ni effet résolu, ni checkpoint isolé. Les payloads portent leurs propres versions et empreintes. Une tâche de simulation est refusée avant I-03C afin qu'un curseur ne puisse jamais avancer sans `TickOutput` réellement validé.

## NAR-086 — Adaptateur monde sur copie et résultat empreinté

Date : `2026-07-06`

Statut : `FIGE`

### Décision

Le module narration appelle le moteur monde uniquement via `WorldSimulationPortV1`. L'adaptateur `map-module` reçoit un snapshot JSON, vérifie son empreinte et ses compteurs, exécute un nombre entier positif d'heures sur une copie, puis retourne un nouvel état, un `TickOutput`, un curseur et une empreinte de résultat.

### Raisons

`runWorldHours` mute son argument et transforme toute durée inférieure à une heure en au moins un tick. Un appel direct depuis une intention narrative pourrait donc avancer le monde à tort et rendre un échec partiellement visible.

### Conséquences

La segmentation temporelle décide d'abord des heures dues. L'état source reste intact jusqu'au commit. Le résultat est revalidé avant d'être écrit atomiquement avec le curseur et `CampaignClock`. Le `map-module` ne devient pas propriétaire du temps de campagne et le module narration ne réimplémente pas sa simulation.

## NAR-087 — Fermeture I-03 et audit I-04 limité à mémoire/snapshot

Date : `2026-07-07`

Statut : `FIGE`

### Décision

I-03 est livré dans son périmètre : noyau temporel, échéancier, checkpoints, simulation monde sur copie, voyage segmenté, rencontre structurée, position et événement de voyage committés atomiquement. I-04 n'est pas ouvert en implémentation; seul l'audit AF-R08/AF-R09 est autorisé.

### Raisons

Les preuves couvrent NAR-ACC-007, NAR-ACC-010 et NAR-ACC-020 au niveau déterministe : temps nul pour méta, ordre causal stable, voyage committé une fois, candidat de rencontre reproductible et rejeu idempotent en mémoire et Chromium. Les capacités restantes demandées par I-04 relèvent d'un autre type d'autorité : rappel, budget de contexte, secrets, provenance et reconstruction d'index.

### Conséquences

La mémoire ne peut pas devenir une deuxième vérité et le snapshot ne peut pas envoyer des agrégats bruts au futur fournisseur IA. Le prochain contrat devra figer unités de mémoire, ports d'index, `TurnSnapshot`, `RoleContextPack`, quotas, traces de sélection et règles de non-fuite avant tout code I-04. UI, tactique, repos jouable, création dynamique et fournisseur IA restent fermés.
