# Contrat du bastion minimal

Statut : `STABLE_6F_E`
Lot : `6F`
Contrats cibles : `bastion-registry/1`, `bastion-establishment/1`,
`bastion-work-order/1`, `bastion-occupant-assignment/1`,
`bastion-occupant-activity/1`, `bastion-incident/1`,
`tactical-rest-handoff/1`

## Définition

Un bastion est une propriété durable de campagne liée à un lieu existant. Il
devient un ancrage jouable lorsque la campagne conserve :

- le lieu concerné et son propriétaire ;
- son état fonctionnel ;
- ses espaces ou installations établis ;
- ses activités ordonnées et leur avancement ;
- ses occupants affectés après validation de leur propre autorité ;
- les conséquences produites par le temps, le monde et les autres domaines.

Un bâtiment du wiki, un lieu créé dynamiquement ou une scène ne devient jamais
un bastion parce que la narration l'affirme. Il faut une acquisition validée et
un enregistrement durable.

Le bastion n'est ni un écran de statistiques isolé, ni un moteur économique
global, ni un prétexte permettant à l'IA de créer librement des ressources,
des employés, des pièces ou des incidents.

## Valeur joueur

Le lieu doit devenir :

- un point de retour reconnaissable ;
- une responsabilité qui continue d'exister en l'absence du personnage ;
- un support de décisions, de relations et de conséquences ;
- une source possible d'opportunités, de problèmes et de quêtes ;
- une progression territoriale perceptible dans la narration.

La narration reste une projection de l'état réel. Une salle réparée, un service
ouvert ou une effraction doivent être committés avant d'être racontés.

## Audit des fondations

| Besoin | Fondation actuelle | Décision 6F-A |
|---|---|---|
| Persistance atomique et rejeu | `CampaignRepository`, opérations, agrégats, événements et outbox | réutilisable |
| Lieu et topologie | lore jouable, `world.place-registry`, `world.scene-topology`, lieux dynamiques | réutilisable comme identité et projection du lieu, sans lui donner la propriété du bastion |
| Faits de campagne | `campaign.place-facts` et projections lore | consommables ; ne remplacent pas le registre propriétaire du bastion |
| Temps et échéances | horloge unique, segments temporels, tâches `ACTIVITY_COMPLETION` | réutilisables pour les travaux et activités |
| Événements du monde | événements committés, signaux perceptibles et bundles causaux | réutilisables comme causes externes ; le bastion ne rejoue pas la simulation |
| PNJ persistants | registre de PNJ promus | identité réutilisable ; aucune affectation au bastion n'est encore autorisée |
| État social | relations, préoccupations, initiatives locales | réutilisable pour demander ou retirer une affectation, sans transformer un PNJ en ressource |
| Missions et intrigue | engagements mission/relation et intrigue privée | peuvent proposer acquisition, opportunité ou incident ; ne mutent pas directement le bastion |
| Inventaire et monnaie | règles de contenance, équipement et lecture de monnaie physique | insuffisant : aucune autorité transactionnelle de campagne pour payer ou réserver des matériaux |
| Rendu narratif | projections directes, restauration et séparation public/privé | réutilisable après commit métier |
| Catalogue bastion | aucun catalogue d'installations, coûts, durées ou effets | à créer ; aucune table locale spéciale dans le runtime |

## Matrice d'autorité

| Propriété | Autorité | Rôle des autres domaines |
|---|---|---|
| identité du bastion et lien au lieu | `BastionDomain` | le monde ou le lore fournit un lieu référencé |
| propriétaire et statut d'exploitation | `BastionDomain` après preuve d'acquisition | mission, monde ou social peuvent fournir une cause, jamais le résultat seul |
| géographie et connexions | `WorldDomain` | le bastion conserve seulement les références |
| espaces et installations construites | `BastionDomain` | le catalogue décrit les candidats autorisés |
| ordre, avancement et achèvement d'un travail | `BastionDomain` avec horloge du `WorldDomain` | l'orchestrateur transporte les échéances |
| monnaie, matériaux et objets | domaine personnage/inventaire | le bastion exige une preuve de réservation ou de dépense |
| identité, volonté et disponibilité d'un occupant | acteur/social/monde selon la propriété | le bastion enregistre uniquement une affectation déjà autorisée |
| défenses installées | `BastionDomain` | le tactique ou le monde résout une attaque réelle |
| menace et incident extérieur | `WorldDomain` ou domaine d'intrigue | le bastion applique seulement une conséquence validée qui le cible |
| mission liée au lieu | domaine mission/intrigue | le bastion fournit des faits et reçoit les conséquences validées |
| texte présenté au joueur | narration, sans autorité métier | projection des événements publics committés |

Deux domaines ne peuvent pas modifier silencieusement la même propriété. Une
transaction touchant plusieurs autorités est préparée puis committée
atomiquement, ou ne produit aucun changement.

## Découpage retenu

### 6F-B — établissement du bastion

Premier incrément exécutable :

```text
événement d'acquisition committé
  -> politique d'éligibilité injectée
  -> relecture du lieu
  -> création atomique du registre
  -> événement public bastion_established
  -> projection narrative restaurable
```

Le registre minimal porte :

- `bastionId` stable ;
- `placeRef` existant ;
- `ownerRef` explicite ;
- événement et politique ayant autorisé l'acquisition ;
- statut `ACTIVE`, `SUSPENDED` ou `LOST` ;
- version et instant diégétique d'établissement.

Le même lieu ne peut pas être établi deux fois comme bastion actif. Une source
absente, non committée, privée sans projection autorisée ou refusée par la
politique n'écrit rien.

Ce sous-lot ne simule encore ni travaux, ni revenus, ni gardes. Il établit
l'autorité nécessaire pour qu'ils aient ensuite une cible fiable.

État d'implémentation :

- registre `bastion.registry` distinct du lieu et des faits de campagne ;
- événement source et opération committée relus avant toute décision ;
- politique d'acquisition et résolveur de lieu obligatoires et injectés ;
- décision inéligible ou lieu absent sans commit ;
- un seul bastion actif par lieu, avec rejeu idempotent ;
- établissement atomique et événement public `bastion_established` ;
- payload privé de l'acquisition exclu du registre, de l'événement public et
  du rendu ;
- narration déterministe rappelant explicitement qu'aucun aménagement ou
  occupant supplémentaire n'est encore établi ;
- restauration navigateur sans seconde création ni second bloc ;
- rollback sur panne injectée sans registre partiel ;
- preuves `narration-module:test:bastion` et
  `narration-module:test:bastion-ui`.

### 6F-C — premier ordre de travail temporisé

Le premier cycle de gestion complet sera :

```text
choix joueur d'une amélioration cataloguée
  -> validation du bastion et des prérequis externes
  -> ordre committé
  -> échéance enregistrée dans l'horloge
  -> résolution par le BastionDomain
  -> installation modifiée
  -> résultat public narré
```

Le catalogue doit fournir identifiant, libellé, prérequis, durée et effets. Le
runtime n'invente ni coût, ni durée, ni bonus. Tant que l'autorité de monnaie ou
de matériaux n'existe pas, une amélioration qui en exige reste
`BLOCKED_BY_PREREQUISITE`; elle n'est pas rendue gratuite.

État d'implémentation :

- catalogue obligatoirement injecté, sans liste de travaux spéciale dans le
  runtime ;
- définition cataloguée figée dans l'ordre : libellés publics, durée,
  prérequis, effet d'installation et texte d'achèvement ;
- absence du candidat refusée avant opération et absence de l'autorité d'un
  prérequis conservée comme `BLOCKED_BY_PREREQUISITE`, sans commit ;
- décision positive sur un prérequis externe acceptée seulement avec au moins
  une référence de preuve ;
- activité sans prérequis autorisée uniquement lorsque le catalogue déclare
  réellement une liste vide ;
- ordre et échéance committés ensemble dans le registre et un
  `world.schedule` propre au bastion ;
- un seul ordre actif par bastion dans ce premier vertical ; cette limite est
  explicite et ne vaut pas règle économique future ;
- achèvement par le noyau temporel sur l'horloge unique, puis ordre,
  installation, échéance résolue et événement public committés atomiquement ;
- refus de franchir silencieusement une frontière de simulation mondiale : le
  propriétaire du monde doit d'abord la résoudre, puis l'achèvement peut être
  repris ;
- narration reprise depuis la projection publique cataloguée et committée,
  sans appel IA ni fallback ;
- rejeu et restauration IndexedDB sans second ordre, seconde installation ou
  second bloc narratif ;
- preuves `narration-module:test:bastion` et
  `narration-module:test:bastion-ui`.

Exemple : « Réparer la toiture » exige cent pièces dans le catalogue. Sans
autorité économique capable de fournir une preuve, le résultat est bloqué et
l'horloge ne bouge pas. « Déblayer l'ancienne salle commune » déclare
explicitement zéro prérequis : l'ordre peut être committé, sa demi-heure de travail
est enregistrée, puis l'espace déblayé n'existe qu'après l'échéance.

### 6F-D — occupants et vie autonome

Une affectation exige un PNJ persistant et une décision de son autorité sociale
ou mondiale. L'écoulement du temps peut ensuite déclencher une activité ou une
initiative sans saisie joueur, conformément à la gate 6V.

Un occupant n'est jamais une simple unité de production. Sa relation, ses
connaissances, ses engagements et sa possibilité de partir restent propres à
l'acteur.

État d'implémentation :

- seul un PNJ déjà présent dans `campaign.npc-registry` peut être affecté ;
- rôle et activités autorisées proviennent d'un catalogue injecté, sans
  tableau de métiers codé dans le runtime ;
- l'affectation exige une décision positive d'une autorité sociale ou mondiale,
  ainsi qu'une opération et un événement réellement committés ;
- l'absence ou le refus de cette autorité produit `BLOCKED_BY_OWNER` sans
  mutation du bastion ;
- le bastion conserve l'identité du PNJ, son rôle, la preuve d'affectation, son
  statut et son historique public d'activité ; il ne copie ni objectif privé,
  ni croyance, ni relation sociale ;
- une frontière locale dédiée peut être appelée sans saisie joueur par
  `processBastionOccupantBoundary` ;
- l'autorité propriétaire sélectionne une activité, tandis que le catalogue
  vérifie qu'elle appartient bien au rôle et fournit son délai minimal et sa
  narration publique ;
- absence de cause ou d'autorité valide : `CALM`, sans commit et sans texte de
  remplissage ;
- activité retenue : compteur, dernier instant, journal du bastion et événement
  public committés atomiquement, puis narration restaurable ;
- rejeu sans second occupant, second compteur, seconde activité ni second bloc
  narratif ;
- preuves `narration-module:test:bastion` et
  `narration-module:test:bastion-ui`.

Exemple : Mira existe d'abord comme PNJ persistant. Une décision sociale
committée confirme qu'elle accepte le rôle catalogué d'intendante. À une
frontière temporelle ultérieure, sa propre autorité sociale peut sélectionner
« Inspection des volets ». Mira agit alors sans attendre une commande d'Aryn ;
le bastion enregistre le fait public, mais son objectif privé reste dans son
domaine social.

### 6F-E — incidents, défense et opportunités

Le monde et l'intrigue peuvent cibler le bastion par des événements committés.
Le bastion calcule uniquement les effets relevant de ses installations et de
ses ordres. Un affrontement tactique exige un handoff vers le propriétaire
tactique ; le texte narratif ne résout pas l'attaque.

État d'implémentation :

- événement source et opération propriétaire obligatoirement committés ;
- politique de campagne et catalogue d'incidents injectés, sans table
  d'incidents codée dans le runtime ;
- décision inéligible produisant `IGNORED`, sans commit ;
- occasion enregistrée `OPEN`, sans acceptation ou refus implicite ;
- conséquence locale limitée au statut `DAMAGED` ou `DISABLED` de
  l'installation cataloguée ;
- attaque refusée sans propriétaire tactique, sans mutation compensatoire ;
- graine tactique complète validée puis registre, `process.handoff` actif et
  `tactical.encounter-seed` committés atomiquement ;
- aucun résultat, dégât, butin ou vainqueur tactique produit par la narration ;
- résumé public committé projeté tel quel, avec issue explicitement indécise
  pour une défense ;
- payload privé de l'événement source absent du registre public et du rendu ;
- rejeu et restauration navigateur sans second incident ni second bloc ;
- preuves `narration-module:test:bastion`,
  `narration-module:test:bastion-ui` et
  `narration-module:test:tactical-rest-handoff`.

Exemple : une offre commerciale issue du monde devient une occasion ouverte.
Une tempête peut endommager une installation précise. Un raid nocturne crée
seulement la préparation et le processus tactiques ; le plateau décidera plus
tard de son issue et renverra un résultat propriétaire.

## Exemple cible

Une ancienne auberge est acquise par un événement validé. 6F-B l'enregistre
comme bastion sans ajouter de pièce ou de personnel absent des sources.

Plus tard, le joueur choisit une réparation présente dans le catalogue. 6F-C
vérifie le coût, la durée et les prérequis auprès de leurs propriétaires. Après
l'écoulement du temps, la réparation est committée. Si un événement du monde
signale entre-temps une effraction locale, il reste une cause indépendante :
le bastion ou le tactique en résout les conséquences avant que la narration
décrive le retour du personnage.

## Garde-fous

- aucune détection lexicale de « mon château » ou « mon auberge » ne crée une
  propriété ;
- aucune prose IA n'est une preuve d'acquisition ou d'achèvement ;
- aucun coût manquant ne devient zéro ;
- aucun gain de production n'est inventé ;
- aucune affectation de PNJ n'est implicite ;
- aucun événement extérieur n'est créé seulement parce que le joueur entre
  dans le lieu ;
- aucune absence réelle de l'application ne fait avancer le temps ;
- aucun fallback ne remplace une autorité indisponible.

## Hors périmètre immédiat

- économie globale et marché dynamique ;
- construction libre sans catalogue ;
- défense tactique automatique ;
- plusieurs bastions actifs et transferts de propriété complexes ;
- fiscalité, héritage et droit foncier détaillé ;
- interface complète de plan architectural ;
- génération OpenAI autonome des règles, coûts ou effets ;
- bonus mécaniques de personnage accordés par simple présence dans le lieu.

## Preuves attendues

6F-B couvre :

- source d'acquisition committée et politique obligatoire ;
- lieu inexistant ou source invalide sans commit ;
- établissement atomique et événement public minimal ;
- doublon, rejeu et conflit de révision ;
- données privées de la source absentes du rendu ;
- restauration navigateur sans nouvel établissement.

6F-C couvre :

- choix absent ou candidat non catalogué refusé ;
- prérequis externe indisponible sans lancement ;
- ordre et échéance committés ensemble ;
- avance temporelle interrompue à une frontière importante ;
- achèvement idempotent ;
- narration exclusivement fondée sur le résultat committé.

6F-D couvre :

- PNJ non persistant ou rôle absent refusé ;
- propriétaire absent ou refusant sans affectation ;
- opération et événement de preuve obligatoirement committés ;
- affectation idempotente sans copie de l'état social privé ;
- frontière autonome calme sans commit ;
- activité non autorisée par le rôle refusée ;
- délai minimal, compteur et rejeu stables ;
- projection et restauration sans objectif privé ni duplication.

6F-E couvre :

- événement absent ou non committé refusé ;
- politique inéligible sans commit ;
- occasion ouverte sans résolution implicite ;
- conséquence limitée à une installation cataloguée ;
- propriétaire tactique absent sans mutation ;
- graine incohérente refusée ;
- handoff et graine committés atomiquement ;
- absence de résultat tactique inventé ;
- données privées de la cause exclues de la projection ;
- rejeu et restauration sans duplication.
