# Contrat d'intégration jouable du bastion vers le tactique

Statut : `LIVRE_7C`
Contrats réutilisés : `bastion-incident/1`, `bastion-tactical-session/1`,
`tactical-rest-handoff/1`

## Objectif

Relier une défense de bastion committée à la surface tactique réelle, puis
réintégrer son résultat dans la même campagne sans rejouer le combat, inventer
une conséquence ou contourner un domaine propriétaire.

## État constaté avant 7A

- `App` permettait de choisir manuellement Narration ou Tactique ;
- `GameBoard` démarrait uniquement depuis son propre écran de configuration ;
- aucune graine de campagne n'était lue par le plateau ;
- aucun résultat du plateau n'était retourné au noyau de campagne ;
- la campagne Archives ne possède encore aucun bastion ou incident de
  production.

Le placeholder tactique prouve le contrat dans les tests. Il ne doit jamais
être présenté comme le plateau réel.

## Découpage

### 7A — boîte de réception tactique

Livré :

- recherche d'un événement public `bastion_defense_handoff_started` ;
- relecture du registre de bastion, du `process.handoff` et de la
  `tactical.encounter-seed` correspondants ;
- validation croisée des identités, de la campagne, du lieu et du statut ;
- restauration IndexedDB de la session `READY_FOR_TACTICAL` ;
- signal visible dans la surface narration ;
- ouverture de la surface tactique avec la session persistée ;
- avertissement explicite tant que `GameBoard` ne sait pas consommer la graine ;
- aucune fixture de bastion ajoutée à la campagne Archives.

### 7B — adaptateur d'entrée du plateau

Livré :

- contrat `game-board-encounter-input/1` construit depuis la session committée ;
- résolution injectée des projections d'acteur et de carte, sans lecture de
  `localStorage` ni personnage d'exemple ;
- identité, équipe, type d'adversaire, grille, zones et position vérifiés avant
  le démarrage ;
- terrain, dangers, lumière et visibilité exigés dans la projection de carte et
  confrontés à la graine ;
- surprise non vide et allié contrôlable supplémentaire refusés explicitement,
  car `GameBoard` ne sait pas encore les représenter fidèlement ;
- démarrage automatique avec les types d'adversaire catalogués exacts ;
- écran de configuration libre inaccessible pour une session de campagne ;
- redimensionnement de grille, position non jouable ou obstacle sur une
  position committée bloquants ;
- `processId` conservé sur la racine du plateau pendant la session.

Le résolveur embarqué ne crée aucune donnée : il lit uniquement des projections
déjà présentes dans la graine. Un futur propriétaire personnage/adversaire ou
carte pourra remplacer ce résolveur sans modifier `GameBoard`.

Limite volontaire : les données environnementales sont garanties par le
contrat du résolveur de carte puis matérialisées par le générateur actuel à
partir de son prompt. Une carte persistée cellule par cellule demandera un
résolveur de snapshot dédié ; elle ne doit pas être reconstruite implicitement.

### 7C — journal et résultat propriétaire

#### 7C-A — journal et checkpoint reprenable

Livré :

- journal d'événements tactiques conservé au-delà du seul résumé du round ;
- snapshot `game-board-tactical-state/1` produit aux frontières de tour
  stables ;
- acteurs, PV, ressources, initiative, carte, obstacles, effets et journal
  inclus dans l'état propriétaire du plateau ;
- checkpoint committé dans `tactical.checkpoint` avec empreinte d'intégrité ;
- écrasement révisionné du checkpoint précédent et rejeu idempotent d'une même
  frontière ;
- restauration du checkpoint avec confrontation du `processId`, du `seedId` et
  de l'empreinte de graine ;
- reprise de `GameBoard` depuis le snapshot sans régénérer la rencontre ;
- erreur de sauvegarde rendue visible sur le plateau.

Le checkpoint est volontairement pris à une frontière de tour, pas au milieu
d'une résolution de dés ou d'une animation. Après rechargement, le plateau
reprend donc au dernier début de tour committé.

#### 7C-B — constat terminal et outcome en attente

Livré :

- produire le journal exact des tours et ressources ;
- construire un `TacticalOutcomeV1` depuis l'état réel du plateau ;
- faire fournir par la projection la durée d'un round et le mapping des fins
  mécaniques vers les conditions autorisées de la graine ;
- refuser une fin absente des `allowedEndConditions` ;
- sauvegarder un checkpoint terminal avant le résultat ;
- enregistrer participants, PV, ressources, positions, neutralisations,
  paroles engagées et empreinte finale ;
- conserver les effets personnage et bastion comme
  `consequenceCandidates`, avec `domainDeltas` vide ;
- persister l'outcome et le processus
  `COMPLETED_PENDING_INTEGRATION` dans un même commit ;
- restaurer ensemble le processus, le checkpoint et l'outcome ;
- revenir à la narration avec un statut d'intégration en attente.

Le temps tactique écoulé est enregistré dans l'outcome mais n'avance pas encore
l'horloge de campagne. Cette avance appartient au commit 7C-C.

#### 7C-C — validation et intégration

Livré :

- registre d'autorités injectées, avec exactement un propriétaire par domaine ;
- candidat personnage confronté à `character.state` et
  `character.tactical-projection` avant synchronisation des PV ;
- ressources de combat non représentables refusées au lieu d'être écrasées ;
- candidat bastion confronté au registre et à l'incident
  `HANDOFF_ACTIVE` exact ;
- signification de la condition terminale fournie par une politique de
  résolution de bastion, jamais déduite de son libellé ;
- horloge, deltas propriétaires, incident, processus et outcome validé écrits
  dans un commit temporel unique ;
- opération déterministe et rejeu idempotent sans nouvelle validation ni
  second dégât ;
- événement public `bastion_defense_resolved`, ensuite projeté dans un paquet
  MJ déterministe et persisté dans le fil narratif.

Une référence d'agrégat personnage absente, une autorité manquante, une
révision concurrente ou une ressource sans adaptateur propriétaire bloque
l'intégration. Le combat reste terminé et son outcome brut reste disponible :
il n'est jamais relancé pour contourner cette erreur.

## Invariants

- le bouton Tactique ne constitue pas une preuve de combat ;
- une configuration manuelle du plateau n'est pas appliquée à la campagne ;
- un seed incomplet ou non représentable bloque avant le début ;
- `GameBoard` ne modifie jamais directement les agrégats de campagne ;
- une fin visuelle ne suffit pas : le résultat typé doit être validé ;
- un échec d'intégration ne relance pas le combat ;
- aucune défense de démonstration n'est injectée dans la partie Archives.

## Test utilisateur attendu à terme

```text
un événement monde attaque un bastion existant
→ le fil annonce une défense à l'issue ouverte
→ « Ouvrir le plateau tactique »
→ le plateau reprend lieu, acteurs et positions
→ le combat se termine
→ le résultat est validé et intégré une fois
→ retour automatique à la narration
→ le bastion et les participants reflètent les conséquences
→ un rechargement ne répète ni combat, ni dégâts, ni narration
```

7A restaure et ouvre la session ; 7B initialise le plateau depuis sa graine ;
7C-A conserve le journal et le dernier début de tour stable. 7C-B persiste le
constat terminal avant toute conséquence. 7C-C valide les candidats, applique
temps et deltas une seule fois, clôt l'incident puis inscrit la continuation
dans le fil. Le prochain travail consiste à fournir les catalogues et causes de
bastion réels à une campagne jouable, sans fixture Archives.
