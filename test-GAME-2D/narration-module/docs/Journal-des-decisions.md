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
