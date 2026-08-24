# Contrat d'interruption narrative du voyage J10

Statut : `IMPLÉMENTÉ ET CERTIFIÉ EN J10-B`

## Objet

Le voyage est joué uniquement par la narration, mais reste simulé par les
autorités J6. Le joueur démarre ou poursuit un trajet par une intention libre ;
aucune carte, barre de progression ou commande UI dédiée n'est nécessaire.

## État existant réutilisé

`TravelProcessStateV1` possède déjà le plan, le checkpoint et le statut
`INTERRUPTED`. Le payload générique de processus conserve une
`pendingDecision` avec l'identité de la décision et les approches ouvertes :
`TRAVEL_ENCOUNTER_DECISION` pour une rencontre, ou
`TRAVEL_INTERRUPTION_DECISION` pour une frontière monde explicitement fournie
par son propriétaire. J10 ne duplique pas cette vérité.

Une vue future `player-travel-interruption/1` projette cet état avec :

- le processus et la révision de checkpoint sources ;
- le lieu ou segment publiquement compréhensible ;
- le signe perceptible issu du catalogue autorisé ;
- l'état `AWAITING_PLAYER` ou `RESOLVED` ;
- les catégories d'approches ouvertes, sans liste fermée de phrases.

La vue `player-travel-interruption/1` est maintenant produite après commit. La
prose exacte reste dans la projection de rendu. La vue d'interruption ne
contient ni jet, seuil, graine, pression privée, issue future ou vérité cachée.

## Orchestration

1. une intention de départ crée le processus sans temps de jeu ;
2. une intention explicite de continuer prépare un seul segment ;
3. le commit atomique applique temps, ressources, checkpoint et position ;
4. le contrôleur s'arrête à la première frontière significative ;
5. une interruption persistée est racontée puis rend la main au joueur ;
6. la réponse libre est routée vers son domaine propriétaire ;
7. seul un résultat autorisé clôt la décision pendante et permet un nouveau
   segment ;
8. l'arrivée est racontée après le commit de position et de scène.

Le MJ peut imposer une conséquence seulement lorsqu'un événement ou domaine
l'a déjà décidée. Le writer ne peut créer une interruption ni résoudre un choix.

## Persistance et migration

J10-B n'a requis aucune migration : `process.state/1`, le
statut suspendu et `pendingDecision` portent déjà l'état nécessaire. J10-B devra
ajouter une commande idempotente de résolution/reprise et une projection publique
typée, sans changer la forme de `TravelProcessStateV1` si l'audit
d'implémentation a confirmé cette lecture. La commande
`travel.interruption.resolve` incrémente le checkpoint, efface
`pendingDecision` et remet le processus en `ACTIVE` sans avancer l'horloge.
Une `TRAVEL_ENCOUNTER_DECISION` exige en plus un résolveur de rencontre injecté
qui fournit son résultat public et ses sources ; en son absence, le runtime
refuse de clore la rencontre. L'interruption monde installée reste décidée par
la politique de voyage cataloguée, jamais par la prose.

Toute nécessité ultérieure de modifier le payload de voyage impose une version
2 et une migration explicite ; elle ne peut être introduite silencieusement.

## Refus obligatoires

- continuation sans processus actif ou suspendu compatible ;
- second segment tant qu'une décision est pendante ;
- réponse ne ciblant pas l'interruption active ;
- conséquence, combat ou arrivée proposés seulement par la prose ;
- rejeu, double clic ou rechargement produisant un second temps ou coût ;
- exposition au joueur de la graine, du jet, du seuil ou d'une pression privée.

## Preuves attendues

- départ, continuation, interruption, réponse et arrivée depuis la saisie libre ;
- même interruption et même prose visible après rechargement ;
- refus d'avancer tant que la décision reste pendante ;
- résolution et reprise idempotentes ;
- temps, ressources, groupe, checkpoint et position cohérents ;
- aucune carte ou commande de voyage dans l'interface.

Ces preuves sont exécutées par
`npm run narration-module:test:j10b-travel`. Le scénario installé
Archives → Halles restaure la même interruption et la même prose après
recréation du contrôleur, puis refuse tout doublon de temps au rejeu.
