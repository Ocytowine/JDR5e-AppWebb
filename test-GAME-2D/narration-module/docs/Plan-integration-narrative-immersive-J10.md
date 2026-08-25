# Plan d'intégration narrative immersive J10

Statut : `J10-A À J10-F FERMÉS — J10-G OPTIONNEL EN ATTENTE D'ACCORD`

Date : 2026-08-24

## Objet

J10 transforme les capacités certifiées de J1 à J9 en une expérience manuelle
complète qui reste centrée sur la fiction. Il ne crée pas un tableau de gestion
de jeu : le joueur agit par la saisie narrative, en s'adressant au MJ ou aux PNJ
présents, et ne reçoit que les informations accessibles à son personnage.

Le lot corrige principalement les raccords encore pilotés par les recettes de
test. Il conserve intégralement les autorités existantes : le voyage, le monde,
le groupe, les relations, les missions, les intrigues, les connaissances et
l'inventaire décident avant que le renderer ou l'IA racontent leur résultat.

## Décisions produit invariantes

1. **Narration d'abord.** Aucun écran de carte, bouton d'avancement de trajet,
   popup de quête ou panneau de commande des compagnons n'est ajouté.
2. **Personnage non omniscient.** L'interface montre seulement une information
   observée, apprise, possédée ou publiquement engagée.
3. **Action dans la fiction.** Voyager, continuer, interroger, proposer une
   hypothèse, négocier une mission ou demander quelque chose à un compagnon
   passe par une intention libre.
4. **Autorité avant prose.** Une conséquence imposée par le MJ doit provenir
   d'un domaine ou événement committé. Le planner, le writer et le performer ne
   créent ni fait durable, ni relation, ni temps, ni ressource.
5. **Aides-mémoire non autoritaires.** Le carnet, l'inventaire compact et le
   récapitulatif aident le joueur sans exécuter une action à sa place.
6. **Immersion par défaut.** Les traces techniques restent disponibles dans un
   mode développeur explicite, mais disparaissent du fil joueur normal.
7. **Tactique inchangé.** J10 ne modifie ni `GameBoard`, ni la génération de
   carte, ni le placement ou le contrôle des participants tactiques.

La décision « aucune carte de voyage » ne signifie pas que le trajet est simulé
uniquement par prose. `TravelProcess`, les routes, l'horloge, les ressources,
les checkpoints et les interruptions restent autoritaires sous l'interface.
Seule leur présentation devient entièrement narrative.

## Expérience cible

### Voyage

Le joueur peut écrire « nous partons vers les Halles » ou « nous reprenons la
route ». Le contrôleur détecte le voyage actif, prépare un seul avancement
autorisé et s'arrête à la première frontière significative : interruption,
rencontre, événement monde ou arrivée.

Une interruption ouvre une scène racontée. Le système rend la main au joueur et
n'avance plus le voyage tant que la situation n'a pas reçu une décision valide.
Les choix restent libres ; aucune liste fermée n'est nécessaire. Une contrainte
réelle peut être imposée par le MJ seulement après décision de son propriétaire.

### Groupe, relations et missions

Le joueur ne commande jamais le groupe depuis un panneau. Il s'adresse au PNJ
concerné. La réponse visible traduit une décision propriétaire d'acceptation,
d'adaptation, de condition ou de refus.

Les relations ne montrent ni jauge, ni score privé. Les missions ne produisent
ni popup « nouvelle quête », ni liste omnisciente d'objectifs. Seuls les faits
publics peuvent rejoindre le récapitulatif : demande entendue, promesse faite,
condition exprimée, refus reçu ou issue effectivement connue.

### Carnet privé du joueur

Le carnet comporte plusieurs intercalaires créés, renommés, ordonnés et
supprimés par le joueur. Son texte est libre et peut suivre plusieurs intrigues
en parallèle.

Le carnet est une donnée locale non autoritaire :

- il n'entre pas dans `CampaignRepository`, les événements ou les agrégats ;
- il n'est jamais ajouté aux paquets de contexte IA, prompts, diagnostics ou
  récapitulatifs automatiques ;
- une note ne devient ni connaissance personnage, ni indice, ni hypothèse
  persistée dans `plot.registry` ;
- le joueur doit prononcer son hypothèse dans la fiction pour la confronter au
  MJ ou à un PNJ ;
- un partage futur exige une action explicite distincte et reste hors J10.

Le stockage passe par un port `PlayerPrivateNotebookRepository` séparé, avec une
implémentation IndexedDB dédiée au navigateur. Cette séparation évite de faire
du carnet une vérité de campagne. Elle protège contre une transmission
accidentelle au MJ, mais ne promet pas un chiffrement contre une autre personne
ayant accès au même profil navigateur.

### Inventaire compact

Un panneau discret peut rappeler les exemplaires possédés, quantités,
contenants et équipements visibles. Il est en lecture seule du point de vue
métier. Équiper, ranger, donner, recevoir, acheter ou utiliser reste une action
narrative validée par l'autorité inventaire.

### Récapitulatif de reprise

Le récapitulatif s'ouvre volontairement, notamment après une longue absence. Il
est structuré et déterministe avant toute éventuelle reformulation :

- lieu, moment et situation publique actuels ;
- derniers événements connus du personnage ;
- personnes présentes et dernières positions publiquement connues ;
- compagnons reconnus et état narratif public ;
- engagements, conditions et issues explicitement connus ;
- indices acquis et hypothèses effectivement exprimées ;
- possessions importantes ;
- questions encore ouvertes, sans inventer leur réponse.

Il ne lit jamais la vérité privée d'une intrigue, les motivations internes, les
scores sociaux, les événements futurs ou le carnet privé. Une version locale
structurée reste disponible si l'enrichissement IA est absent ou refusé.

## Matrice d'autorité

| Élément visible | Source autoritaire | Interdiction principale |
|---|---|---|
| progression et interruption de voyage | monde, `TravelProcess`, horloge, inventaire | avancer ou créer un obstacle depuis la prose seule |
| présence et décision d'un compagnon | scène, mission/relation, social, groupe | contrôle direct ou affichage d'une politique privée |
| mission ou relation connue | engagement et conséquence publics | jauge sociale, objectif secret ou succès inventé |
| indice et hypothèse | connaissance acquise et `plot.registry` public | révéler la vérité ou promouvoir une note privée |
| inventaire compact | projection inventaire du personnage | mutation directe depuis le panneau |
| carnet | joueur et repository privé séparé | lecture par le MJ ou ingestion IA implicite |
| récapitulatif | composition de projections publiques | lecture directe des payloads privés propriétaires |

## Plan d'exécution et dépendances

```text
J10-A contrats et inventaire des projections
  ├─> J10-B voyage narratif
  ├─> J10-C interactions groupe/mission/relations
  └─> J10-D carnet privé
J10-B + J10-C + J10-D ─> J10-E aides-mémoire et récapitulatif
J10-E ─> J10-F surface immersive et gate navigateur
J10-F ─> J10-G recette OpenAI optionnelle avec accord
```

### J10-A — Contrats et audit de fuite

- recenser les informations publiques déjà projetées par chaque propriétaire ;
- définir les contrats du carnet privé et du récapitulatif public ;
- définir un état explicite de scène d'interruption de voyage ;
- auditer les traces techniques actuellement visibles et les paquets IA ;
- figer les refus avant toute modification React ou IndexedDB.

Terminé lorsque les contrats nomment chaque autorité, chaque donnée interdite et
les migrations nécessaires, avec des cas de refus explicites et un garde-fou
exécutable couvrant les sorties IA.

Fermeture du 2026-08-24 : les contrats du carnet, du récapitulatif et de
l'interruption sont retenus. L'audit recense huit builders d'egress IA, confirme
les projecteurs manquants et isole les traces techniques à corriger en J10-F.
`player_private_notebook` est explicitement exclu du contexte public et
`npm run narration-module:test:j10a-boundaries` protège l'inventaire des sorties
ainsi que l'absence de dépendance au carnet dans application, IA et repository
de campagne. Aucune modification React ou IndexedDB n'a été faite.

### J10-B — Voyage narratif sans carte

- raccorder « continuer/reprendre le voyage » au processus actif sans bouton ;
- avancer au plus jusqu'à la prochaine frontière autorisée ;
- transformer interruption et rencontre en scène persistante attendant le
  joueur ;
- raconter l'arrivée seulement après le commit de position et de scène ;
- restaurer voyage et interruption après rechargement sans double temps.

Terminé lorsque le parcours Archives → Halles est jouable uniquement par saisie
narrative, y compris une interruption déterministe et sa reprise.

Fermeture du 2026-08-24 : le contexte de l'interpréteur expose désormais
seulement l'état public du trajet actif. Le contrôleur transforme une nouvelle
intention `traverse_visible_boundary` en un segment autoritaire et une réponse
libre à l'interruption en commande idempotente. Le trajet installé
Archives → Halles porte un signal public déterministe à mi-parcours. La
projection `player-travel-interruption/1` masque graine, jet, seuil et pression.
`npm run narration-module:test:j10b-travel` certifie départ, interruption,
rechargement, prose stable, réponse, reprise, arrivée et rejeux sans second
temps. Aucun composant de carte ou contrôle de voyage n'a été ajouté.

### J10-C — Groupe, missions et relations par dialogue

Statut : `FERMÉ ET CERTIFIÉ`

- installer les politiques et contenus propriétaires nécessaires hors tests ;
- traiter recrutement, directive, séparation et réunion depuis une parole
  adressée au bon PNJ visible ;
- conserver refus et conditions dans la fiction, sans statut technique ;
- exposer uniquement les engagements publics nécessaires au futur résumé ;
- certifier les refus pour PNJ absent, information inconnue ou demande sans
  autorité mécanique.

Terminé lorsque la verticale J4/J7 de J9-C n'a plus besoin du pilote de test pour
être vécue dans l'interface.

La composition de production installe désormais une politique de recrutement
et d'autonomie pour l'archiviste éligible. Le contrat sémantique V7 distingue
une directive ordinaire d'une demande de séparation, de réunion ou de départ,
sans décider à la place du PNJ. La décision d'autonomie et le changement de
présence sont atomiques ; une directive de compagnon actif n'est plus retraitée
comme une proposition de mission. La gate
`npm run narration-module:test:j10c-companions` couvre refus d'un autre PNJ,
recrutement, risque refusé, séparation, réunion et rejeu.

### J10-D — Carnet privé multi-intercalaires

Statut : `FERMÉ ET CERTIFIÉ`

- créer le port, le schéma versionné et l'adaptateur IndexedDB séparé ;
- ajouter création, renommage, ordre, édition et suppression d'intercalaires ;
- autosauvegarder et restaurer par campagne et personnage ;
- garantir par tests source et runtime l'absence du carnet dans tous les appels
  IA et dans la projection publique ;
- prévoir export/import manuel comme extension ultérieure, sans l'inclure au
  premier incrément.

Terminé lorsque les notes survivent au rechargement et qu'une note contenant un
secret factice ne peut apparaître dans aucun appel MJ, rendu ou récapitulatif.

Le port privé, ses adaptateurs mémoire et IndexedDB et le panneau repliable sont
installés hors du noyau de campagne. La création, le renommage, l'ordre,
l'édition et la suppression sont persistés par portée campagne/personnage. Les
écritures concurrentes obsolètes sont refusées ; une indisponibilité du carnet
reste non bloquante pour le jeu. La gate
`npm run narration-module:test:j10d-notebook` couvre réouverture Chromium,
canari privé, absence réseau et audit des frontières IA/campagne.

### J10-E — Aides-mémoire publiques

- composer le récapitulatif depuis des projections publiques typées ;
- séparer visuellement faits connus, engagements, hypothèses exprimées et
  questions ouvertes ;
- ajouter l'inventaire compact en lecture seule ;
- rappeler uniquement la dernière situation connue des compagnons ;
- fournir une version déterministe sans appel IA.

Terminé lorsque la reprise après rechargement restitue les informations utiles
sans score privé, vérité cachée, note personnelle ou mutation métier.

Fermeture du 2026-08-25 : la surface installée compose lieu, faits avec statut,
compagnons, engagements, découvertes, hypothèses exprimées, chronique rendue et
inventaire personnel depuis des projections publiques bornées. Le panneau est
repliable, déterministe, sans IA ni stockage supplémentaire. La gate
`npm run narration-module:test:j10e-recap` couvre les canaris privés, la
reconstruction et Chromium. J10-F peut désormais traiter l'effacement des
traces techniques et la gate UI continue.

### J10-F — Surface immersive et certification navigateur

- masquer les diagnostics détaillés par défaut et conserver un mode développeur
  explicite ;
- remplacer les popups de progression par des blocs narratifs intégrés ;
- vérifier clavier, lecteur d'écran, états occupés et erreurs récupérables ;
- créer une gate Chromium depuis l'entrée réelle, sans pilote appelant
  directement les opérations J4 à J7 ;
- couvrir carnet, voyage interrompu, dialogue compagnon, inventaire, résumé,
  rechargement et rejeu dans une même campagne.

Terminé lorsque le parcours manuel et la gate utilisent les mêmes interactions
joueur, sans carte de voyage, panneau de commande du groupe ou popup de quête.

Fermeture du 2026-08-25 : les diagnostics détaillés, badges UX, notices de
fallback et contrôles IA sont cachés par défaut et restent disponibles depuis
« Options techniques ». La navigation ne propose plus de carte du monde ni de
surface tactique hors handoff réel, et les panneaux de progression ont disparu
de la surface joueur. L'interpréteur local installé reconnaît désormais les
demandes de compagnon et les formulations libres de voyage ; les présentations
propriétaires du voyage ne sont plus réécrites par l'enrichisseur de scène. La
gate `npm run narration-module:test:j10f-immersive-ui` part de l'entrée réelle,
n'appelle aucun pilote métier direct et couvre clavier, carnet privé,
inventaire/récapitulatif, autonomie du compagnon, interruption persistée,
rechargement, choix narratif, reprise et arrivée sans doublon.

### J10-G — Certification OpenAI optionnelle

Après passage de toutes les preuves locales, une recette courte vérifie que
l'interpréteur et les performers préservent cette expérience. Elle nécessite
un nouvel accord explicite avant dépense et ne devient jamais un prérequis du
fonctionnement local.

## Refus et risques à tester

- note privée retrouvée dans un prompt, diagnostic, résumé ou événement ;
- résumé révélant une intrigue, une motivation ou une relation privée ;
- voyage avancé deux fois par rejeu, rechargement ou double soumission ;
- interruption racontée sans événement autoritaire correspondant ;
- arrivée racontée avant le commit de position ;
- compagnon commandé ou déplacé depuis un contrôle UI ;
- mission annoncée par popup ou objectif inconnu du personnage ;
- hypothèse de carnet promue automatiquement en fait ou connaissance ;
- panneau inventaire modifiant directement un agrégat ;
- absence d'alternative locale lorsque OpenAI est indisponible.

## Preuves finales attendues

- tests unitaires des projections publiques et du filtrage de secrets ;
- contrats mémoire/IndexedDB du carnet privé et tests de migration ;
- régressions J4, J5, J6 et J7 inchangées ;
- gate Chromium J10 entièrement pilotée par l'interface et la saisie libre ;
- reprise et rejeu sans doublon ;
- `npm run build` et `git diff --check` ;
- recette OpenAI seulement après accord explicite.

La verticale locale J10 est livrée par la gate complète J10-F. J10-G demeure
une preuve distante facultative et ne doit être lancée qu'après accord explicite.
Chaque sous-lot doit mettre à jour le contrat proche du code et `TASKS.md` sans
dupliquer ce plan.
