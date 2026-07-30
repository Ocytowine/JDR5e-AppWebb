# Audit du lot 6 — scénarios 005 à 009

Statut : `ACTIF`  
Date : 2026-07-28

## Décision

Les anciens cas 005 à 009 restent des objectifs fonctionnels valides, mais ils
ne constituent pas cinq lots techniques indépendants. Le cas 005 est une
coordination transversale ; les cas 006 à 009 possèdent ou nécessitent leurs
propres autorités.

L'ordre historique par numéro n'est donc pas l'ordre d'implémentation.

## État vérifié

| Cas | Fondations exécutables | Autorités encore absentes | Décision |
|---|---|---|---|
| 005 — aventure orchestratrice | contrôleur de tour, opérations et événements typés, temps, monde, handoffs, mission/relation, projections lore, premier routeur d'outbox borné au repos | généralisation à d'autres événements, agrégat d'intrigue, projection privée par scène, abonnements métier propriétaires | découper ; ne jamais créer un super-orchestrateur propriétaire de tout |
| 006 — progression | disponibilité, repos obligatoire, choix, projection des catalogues, validation ruleset, application atomique et restauration | choix ASI/don, multiclassage complet et interface de sélection réelle | 6E-D fermé ; contenu incomplet suspendu sans fallback |
| 007 — social | registre par acteur, relations, croyances, préoccupations, initiative locale et restauration | règles sociales longues, affectation volontaire à un bastion et cycle compagnon complet | fondation réutilisable, jamais convertie en main-d'œuvre implicite |
| 008 — bastion | lieux dynamiques, topologie, PNJ promus, temps, événements monde, social et projections | autorité de propriété, registre bastion, catalogue de travaux, économie transactionnelle, production et défense | 6F-A retient établissement puis travail temporisé, sans coût inventé |
| 009 — repos | intention, processus segmenté, interruption, horloge, checkpoints, restauration, outbox et activité de progression | récupération et bénéfices inventaire non raccordés | vertical jouable, bénéfices absents maintenus en attente |

## Preuves relancées

Le 2026-07-28 :

- `narration-module:test:tactical-rest-handoff` : 14/14, dont le routeur 6B ;
- `narration-module:test:time` : noyau, persistance, monde et voyage verts ;
- `narration-module:test:character` : import et projections verts ;
- `narration-module:test:mission-relation-authority` : décisions et autorité vertes ;
- `narration-module:test:plot-preparation` : gate verte, mais elle interdit
  encore explicitement la création runtime d'intrigue.

Une gate documentaire d'intrigue n'est donc pas un moteur d'intrigue.

## Ordre retenu

### 6A — repos narratif minimal jouable

Raccorder une intention sémantique explicite au processus de repos existant,
poser les questions nécessaires, avancer un segment, intégrer interruption ou
achèvement, puis rendre une continuation strictement issue des événements
committés.

### 6B — premier hook de l'orchestrateur 005

Introduire une enveloppe d'événement et un routeur sans autorité métier. Le
résultat du repos sera son premier cas réel : le routeur signale, les domaines
destinataires décident.

Livré le 2026-07-28 avec `orchestration-event-router/1` : les deux résultats
terminaux du repos créent une tâche d'outbox atomique, le routeur livre les
hooks dans un ordre stable et clôt proprement le cas sans abonné. Il ne reçoit
ni profil de danger ni graine déterministe et n'effectue aucun write métier.

### 6C — état social durable

Créer les axes relationnels, la réputation et la connaissance par acteur. La
parole reste une proposition ; seuls les résultats sociaux validés modifient
l'état.

6C livre aussi la première initiative locale causée : un PNJ présent peut agir
depuis son objectif, son état social, une échéance ou un événement perçu, sans
attendre une saisie du joueur et sans que le personnage soit sa cible par
défaut.

Livré le 2026-07-28 : registre social persistant, projection de connaissance,
relations orientées, préoccupations privées, sélection stable, performance
bornée et reconstruction sans duplication dans l'interface.

### 6D — noyau d'intrigue et événements cachés

Ce sous-lot est explicite : il n'est pas repoussé dans une liste indéterminée.
Il introduira :

- vérité privée committée avant mise en scène ;
- engagements et chronologie causale ;
- preuves, indices, fausses pistes et voies indépendantes ;
- projection révélable par scène ;
- évolution hors écran déclenchée par des événements validés ;
- ingestion des événements monde autoritaires et composition en
  `SceneEventBundle` ;
- interruption ou mouvement de scène à une échéance, puis restitution de la
  main au joueur ;
- séparation entre vérité, croyance et connaissance des acteurs.

Il dépend de 6B pour les événements et de 6C pour les perspectives sociales.
Le joueur ne reçoit jamais le graphe privé complet.

Sous-lot fermé le 2026-07-28 : vérité et engagements privés, solvabilité
minimale, étapes planifiées exigibles depuis l'horloge, révélation committée et
recette navigateur sans fuite ni répétition. Les signaux perceptibles des
événements `world-simulation` déjà committés rejoignent désormais les
perceptions d'intrigue dans un bundle causal commun. Une échéance importante
arrête l'avance, met en scène le signal puis restitue la main au joueur.

### Gate 6V — monde vivant

Avant 6E, une gate transversale vérifie de bout en bout que le personnage est un
participant et non le déclencheur unique. Elle couvre initiative PNJ locale,
action visant un tiers, évolution d'une situation ignorée, événement distant
non narré, interruption temporelle, scène légitimement calme et rejeu sans
double conséquence.

Gate certifiée le 2026-07-29. La frontière sociale est également ouverte après
une avance diégétique normale ; une interruption urgente conserve la priorité.
La matrice exécutable est
[`Matrice-certification-gate-6V-monde-vivant.md`](Matrice-certification-gate-6V-monde-vivant.md).

La fermeture réelle de l'application ne fait pas avancer le monde : seule une
avance validée de l'horloge diégétique déclenche ces évolutions.

Contrat :
[`Contrat-cible-monde-vivant-et-initiative-pnj.md`](Contrat-cible-monde-vivant-et-initiative-pnj.md).

### 6E — progression narrative

Brancher les disponibilités de progression sur les événements, le repos et une
autorité personnage/ruleset. La narration accompagne un gain validé ; elle ne
le décide pas.

6E-A à 6E-C livrés le 2026-07-29 : une politique injectée peut ouvrir une
disponibilité depuis un événement committé. Un choix requis reste suspendu tant
que le joueur ne l'a pas résolu. Un candidat complet revalidé par l'autorité
personnage/ruleset peut ensuite mettre à jour atomiquement l'état personnage,
ses deux projections et le registre. Le résumé public est enfin projeté dans le
fil narratif durable et restauré sans réappliquer ni dupliquer la progression.

6E-D livré après relecture du document produit historique : l'application
exige désormais la preuve d'un segment committé de repos court ou long consacré
à la progression. Le candidat est préparé depuis les catalogues actuels de
classe et leurs références, puis contrôlé par le ruleset épinglé. Une donnée
manquante ou un gain omis maintient la récompense en attente sans fallback.
L'audit contractuel 6F-A est désormais consigné ci-dessous ; le prochain
chantier exécutable est l'établissement 6F-B.

### 6F — bastion

Ouvrir propriété, gestion et vie du lieu après disponibilité des autorités
sociale, événementielle, temporelle, mission et personnage nécessaires.

6F-A livré le 2026-07-29 comme audit et contrat, sans faux moteur de gestion :

- un bâtiment ne devient bastion qu'après une acquisition autoritaire ;
- `BastionDomain` possède l'identité, le statut, les installations et les
  ordres, mais jamais le temps, l'inventaire ou la volonté des PNJ ;
- 6F-B établit le registre depuis un événement committé et une politique
  injectée, puis produit une projection restaurable sans contenu implicite ;
- 6F-C introduira un travail catalogué et temporisé, bloqué si une preuve de
  coût ou de matériaux requise est indisponible ;
- occupants, incidents et défense restent des sous-lots distincts fondés sur
  les domaines social, monde, intrigue et tactique.

Contrat :
[`Contrat-bastion-minimal.md`](Contrat-bastion-minimal.md).

6F-B livré le 2026-07-29 : registre propriétaire, acquisition et lieu relus,
déduplication par lieu, commit atomique, événement public minimal, projection
déterministe et restauration navigateur. Les secrets de la source ne rejoignent
ni le registre ni le fil. Le prochain sous-lot est 6F-C.

## Pourquoi commencer par le repos

Le repos possède déjà la plus grande part de son noyau propriétaire. Le travail
manquant est un raccord jouable et des autorités de bénéfices, pas une
architecture à inventer.

Il fournit également un premier événement transversal concret :

```text
intention explicite
  -> RestDomain
  -> segment temporel committé
  -> repos terminé ou interrompu
  -> événement
  -> continuation narrative
```

Ce chemin servira ensuite à construire l'orchestrateur sur un cas réel.

## Règle pour les éléments cachés

Un événement caché est écrit par son domaine propriétaire avant qu'un signe
visible ne soit raconté. La narration ne reçoit que :

- les signes perceptibles ;
- les révélations autorisées ;
- les contraintes utiles à son rôle.

Le moteur d'intrigue conservera la vérité privée et l'orchestrateur ne fera que
transporter ses événements ou demandes.
