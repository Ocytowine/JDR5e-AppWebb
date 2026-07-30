# Contrat d'alimentation de campagne du vertical bastion-tactique

Statut : `LOT_8_LIVRE`

## Objectif

Fournir au vertical 7 une graine issue de données de campagne et de catalogues,
sans fabriquer une attaque, un bastion ou un personnage de démonstration dans
la partie Archives.

## 8A — autorité de défense cataloguée

Livré :

- catalogue `bastion-defense-encounter-catalog/1` injecté ;
- une entrée par définition d'incident tactique ;
- règles, objectifs, adversaires, équipes, carte, terrain, dangers, positions,
  conditions terminales et narrations finales fournis par cette entrée ;
- projection du personnage fournie par un résolveur propriétaire ;
- relecture de `character.state` et
  `character.tactical-projection` avant création de la graine ;
- références exactes de ces deux agrégats conservées dans le participant afin
  que 7C puisse appliquer le retour ;
- empreinte, `processId` et `seedId` déterministes ;
- événement source réduit à son identité et son type : son payload privé n'est
  jamais copié dans la graine ;
- politique de résolution construite depuis le même catalogue ;
- bundle de contrôleur réunissant catalogue d'incident, politique
  d'éligibilité, autorité de préparation et autorités de retour.

### Exemple

```text
événement monde committé : raid sur un bastion existant
→ politique d'incident : définition « raid nocturne »
→ catalogue de rencontre : adversaires, carte et fins autorisées
→ résolveur personnage : agrégats et projection GameBoard réels
→ graine tactique persistable
```

La condition `all_hostiles_neutralized` n'est pas interprétée par son nom. Son
entrée de catalogue déclare par exemple `BASTION_DEFENDED`, le statut
`ACTIVE` et la phrase publique correspondante.

## Refus protecteurs

La préparation est refusée si :

- l'incident n'a aucune entrée de rencontre ;
- le personnage ou ses références propriétaires sont absents ;
- les PV de l'état canonique, de la projection tactique et de la projection
  GameBoard divergent ;
- une condition terminale n'a pas exactement une résolution cataloguée ;
- le seed final ne satisfait pas le contrat tactique.

Un refus ne crée ni processus, ni incident compensatoire, ni combat manuel.
Après le combat, un catalogue devenu incompatible bloque également
l'intégration : aucun statut de bastion de remplacement n'est inventé.

## 8B — profil actif et contenu versionné

Livré :

- le bootstrap enregistre un profil `campaign.active-character-profile` qui
  relie l'identité active aux agrégats personnage, tactique, narratif et
  position ;
- le profil conserve aussi les versions de contenu et de règles épinglées par
  la campagne ;
- le résolveur de défense relit ce profil puis les deux agrégats propriétaires ;
- un adaptateur injecté construit la projection `GameBoard` depuis ces données ;
- l'équipe du joueur vient explicitement de la définition de rencontre ;
- le catalogue de défense est chargé depuis une entrée
  `GAME_CATALOG_ENTRY` du paquet de contenu épinglé ;
- toute version de paquet différente, entrée absente, définition invalide ou
  référence dupliquée est refusée ;
- aucun personnage d'exemple n'est utilisé en secours.

### Exemple

```text
campagne → profil actif : Aryn
         → character.state@0
         → character.tactical-projection@0
catalogue content.test@1 → raid nocturne → équipe « défenseurs »
adaptateur application → projection GameBoard d'Aryn
```

Le profil ne contient pas une copie supplémentaire de la fiche. Il indique où
se trouvent ses propriétaires. Le créateur de personnage pourra donc évoluer :
il devra adapter sa sortie au contrat canonique du bootstrap, sans imposer son
format interne au moteur narratif.

## 8C — routage des causes committées

Livré :

- relecture obligatoire de l'opération et de l'événement source committés ;
- liste des seuls bastions actifs remise à une politique de routage injectée ;
- décision explicite `IGNORE` ou `TARGET`, sans déduction lexicale du routeur ;
- contrôle de provenance `WORLD_SIMULATION` ou événement d'intrigue planifié ;
- vérification que la cible choisie est encore un bastion actif ;
- commande d'incident déterministe construite depuis la cause, la politique et
  la cible ;
- appel de `processBastionIncidentBoundary` uniquement après ciblage valide ;
- résultat calme, sans opération ni commit, lorsqu'aucun bastion n'est visé ;
- rejeu idempotent sans second incident ni seconde préparation tactique ;
- payload privé absent du résultat de routage et des projections joueur.

### Exemple monde

```text
événement committé : attaque au lieu « auberge du vieux pont »
→ politique monde : ce lieu appartient à bastion:old-bridge-inn
→ TARGET
→ incident « raid nocturne »
→ handoff tactique
```

### Exemple calme

```text
événement d'intrigue committé : pression politique dans un autre quartier
→ politique intrigue : aucun bastion ciblé
→ IGNORE
→ aucun commit, aucune bulle, aucun combat
```

Le routeur ne connaît pas les noms `raid`, `attaque` ou `bastion`. La politique
injectée connaît le schéma autoritaire de sa source et retourne une identité
canonique. Une cible inventée ou un événement non committé est refusé.

## 8D — certification navigateur complète

Livré :

- base IndexedDB isolée et campagne réellement bootstrapée depuis le fixture
  actuel du créateur de personnage ;
- profil actif, agrégats personnage et catalogue de défense versionné relus par
  les propriétaires ;
- bastion et cause monde committés avant le routage 8C ;
- ouverture réelle de `GameBoard`, sans écran de configuration libre ;
- checkpoint committé, rechargement de page et restauration du même combat ;
- constat terminal construit depuis l'état du plateau, puis validation
  personnage/bastion et intégration atomique ;
- continuation narrative publique restaurée exactement une fois après un
  second rechargement ;
- payload privé de la cause absent du fil joueur ;
- aucun raid, bastion ou personnage de test ajouté à la partie Archives.

La gate a aussi fermé trois défauts qui n'apparaissaient pas dans les tests
unitaires : identifiants de checkpoint/outcome trop longs pour le contrat
persistant, textures Pixi absentes pendant un chargement asynchrone et
frontière sociale d'entrée de scène rendue non idempotente par l'avance de
l'horloge tactique.

### Exemple certifié

```text
campagne bootstrapée
→ cause monde privée committée
→ ciblage du bastion et narration publique
→ GameBoard
→ checkpoint puis rechargement
→ fin mécanique
→ validation des conséquences
→ temps et domaines intégrés
→ reprise narrative unique après rechargement
```

## Preuve

```powershell
npm run narration-module:test:bastion-defense-catalog
npm run narration-module:test:bastion-vertical-8d
```

Les preuves vérifient le profil produit au bootstrap, le chargement de la
version épinglée, la projection active, la graine déterministe, les références
propriétaires, l'absence de fuite du payload privé, la résolution cataloguée,
le refus d'une projection périmée, le routage monde/intrigue, la frontière
calme, la cible active, le rejeu et la composition du bundle du contrôleur. La
gate 8D ajoute la preuve navigateur de l'aller-retour complet et de sa reprise
persistante.
