# Contrat d'intégration d'une campagne jouable dans le build principal

Statut : `LOT_9_LIVRE`

Lot : `9`

## Objectif

Rendre les verticales déjà certifiées accessibles depuis `npm run dev`, avec
une vraie campagne persistée, un personnage importé, un contenu épinglé et des
causes committées. Le lot ne crée pas une nouvelle autorité métier : il compose
les propriétaires existants et expose leurs décisions dans l'interface.

Le parcours cible est :

```text
fiche active validée
→ création ou reprise d'une campagne dédiée
→ contenu et règles épinglés
→ scène initiale activée
→ contrôleur composé depuis la campagne
→ narration, temps et événements dans le même repository
→ handoffs propriétaires accessibles dans l'UI
```

La campagne Archives actuelle reste un pilote narratif. Elle ne reçoit ni
bastion, ni raid, ni progression ou lieu sûr artificiel pour démontrer une
fonctionnalité.

## 9A — constat du build actuel

| Frontière | État constaté | Conséquence |
|---|---|---|
| Entrée React | `main.tsx` monte directement `<App />` | aucun accueil ou choix de campagne |
| Narration par défaut | `NarrativeAppSurface` ouvre `jdr5e-narration-archives-pilot-v4` et `cmp-narrative-prototype` | le build joue toujours le pilote Archives |
| Créateur | les fiches sont dans `jdr5e_saved_sheets` et la sélection dans `jdr5e_active_sheet` | stockage legacy non versionné, lisible uniquement par un adaptateur UI |
| Plateau manuel | `GameBoard` relit directement la fiche active au démarrage d'un combat libre | cette lecture n'est pas une importation de campagne |
| Bootstrap | `CampaignBootstrapServiceV1` et le profil actif sont implémentés | aucun résolveur de contenu/ruleset de production ne les appelle |
| Contenu | le catalogue narratif généré sert les scènes et influences | ce n'est pas encore un paquet complet `campaign-bootstrap/2` |
| Scène active | le bootstrap crée la position, mais pas `scene.lifecycle` | 8D doit encore activer explicitement sa première scène |
| Identités runtime | déplacements, social, intrigue et reprises utilisent encore plusieurs identifiants `PROTOTYPE_*` | une campagne à identifiants propres lirait les mauvais agrégats |
| Repos | le runtime principal est injecté, mais les Archives le refusent toujours | le moteur est visible, pas un repos jouable dans ce lieu |
| Progression | autorités, catalogues et projection UI existent dans les preuves | aucune composition ni commande joueur dans la surface principale |
| Bastion | autorités et aller-retour tactique existent | aucun catalogue, actif ou cause n'est fourni au pilote Archives |
| Monde | la carte et la simulation sont accessibles depuis le créateur tactique | l'état simulé reste dans React et ne produit pas les commits de la campagne narrative |
| Sélection | `CampaignRepository` sait lire une campagne par identifiant, pas les lister | le premier raccord doit utiliser une identité déterministe ou un index UI distinct |

La gate 8D prouve que toutes les briques peuvent être composées autour d'une
campagne IndexedDB. Elle ne doit pas être copiée dans le code de production :
ses données initiales restent une preuve.

## Invariants du lot 9

- Le noyau campagne ne lit jamais `localStorage`.
- Un adaptateur UI peut lire une fiche legacy, mais la campagne en conserve un
  snapshot importé et validé ; modifier ensuite la fiche ne réécrit pas
  silencieusement le personnage de campagne.
- Une fiche invalide ne crée aucun morceau de campagne.
- Une campagne épingle exactement une version de contenu et de règles.
- Une dépendance absente ouvre un diagnostic ou un mode lecture seule, jamais
  un fallback vers les Archives.
- Les identifiants d'agrégats viennent d'une liaison de campagne explicite, pas
  des constantes du prototype.
- L'activation de la première scène est committée ou créée dans la transaction
  de bootstrap ; elle n'est pas reconstruite seulement dans l'état React.
- La simulation du monde reste propriétaire de ses décisions. Le module
  narration ne transforme pas un texte ou un bouton en cause mondiale.
- Un panneau UI appelle une commande propriétaire et affiche son résultat ; il
  ne modifie pas directement un agrégat.
- Aucun scénario de test, raid automatique ou récompense gratuite n'est ajouté
  à la partie Archives.

## Découpage exécutable

### 9B — liaisons d'une campagne active

Introduire un contrat `campaign-runtime-bindings/1` qui désigne au minimum :

- campagne et horloge ;
- personnage actif et position ;
- cycle de scène ;
- calendrier/schedule ;
- curseur de simulation ;
- état de processus temporel.

Les transitions, frontières sociales, intrigues, jets en attente et créations
dynamiques recevront ces liaisons. Les constantes `PROTOTYPE_*` resteront
uniquement dans la factory du pilote Archives.

9B initialise aussi la première `scene.lifecycle` depuis un lieu et une scène
résolus, avec une opération idempotente. Un rechargement ne recrée pas l'entrée
de scène.

Livré :

- contrat `campaign-runtime-bindings/1` validé avec identités distinctes ;
- valeurs du pilote regroupées dans
  `PROTOTYPE_CAMPAIGN_RUNTIME_BINDINGS_V1` ;
- contrôleur, frontières sociales/intrigues, transition cataloguée, création
  dynamique et reprise de jet raccordés aux liaisons injectées ;
- activation initiale committant ensemble la référence canonique de position
  et `scene.lifecycle` ;
- opération d'activation déterministe et rejouable sans second commit ;
- gate 8D migrée vers des identifiants non-prototype et la nouvelle activation.

### 9C — paquet installé, fiche active et porte d'entrée UI

- générer un paquet `campaign-bootstrap/2` browser-safe depuis les sources et
  catalogues du build, sans compiler le wiki dans le navigateur ;
- fournir le résolveur du ruleset MVP épinglé ;
- déplacer l'adaptateur des catalogues du créateur hors des fixtures de test ;
- lire la fiche active par un adaptateur UI dédié ;
- afficher les diagnostics d'import avant toute création ;
- créer une identité de campagne déterministe à partir de la sauvegarde choisie
  et de la version du profil de départ ;
- reprendre cette campagne au rechargement sans réimporter la fiche ;
- remplacer le démarrage implicite des Archives par une porte d'entrée
  explicite : reprendre une campagne, en créer une depuis la fiche active, ou
  ouvrir volontairement le pilote Archives.

Livré :

- paquet navigateur généré avec manifeste `campaign-bootstrap/2`, payloads
  vérifiables et provenance des sources sans texte wiki auteur brut ;
- catalogue personnage construit depuis les chargeurs réels du créateur et
  résolveur exact de `rules.jdr5e@2` ;
- adaptateur UI isolé pour `jdr5e_saved_sheets` et `jdr5e_active_sheet` ;
- diagnostics d'import affichés avant création et erreurs bloquantes ;
- identité déterministe liée à la sauvegarde et à son instantané de départ ;
- enveloppe de création conservée avant l'appel pour reprendre une issue
  inconnue avec les mêmes identités ;
- campagne IndexedDB créée atomiquement, scène initiale activée puis reprise
  sans réimport silencieux ;
- accueil réel `créer / reprendre / pilote Archives` et retour `Campagnes` ;
- gate navigateur couvrant succès, reprise et refus d'une fiche invalide.

### 9D — composition des verticales déjà livrées

Construire une factory applicative unique qui injecte :

- scènes et transitions cataloguées ;
- création dynamique lorsque le mode OpenAI l'autorise ;
- repos et politique locale ;
- progression et catalogues personnage ;
- état social, intrigues et projection causale ;
- bastion, incidents, catalogue de défense et autorités de retour tactique.

L'interface montre uniquement les disponibilités committées : repos autorisé,
progression en attente, bastion possédé, travail ou défense en cours. Elle ne
fabrique pas ces disponibilités.

Livré :

- une composition de campagne qui partage le repository, les liaisons, le
  contenu épinglé et la scène active entre les verticales ;
- une lecture seule des registres de progression et de bastion pour la
  surface principale ;
- aucun panneau lorsqu'aucun award ou bastion n'a été committé ;
- une politique de repos autorisant uniquement un bastion actif au lieu
  courant et refusant le démarrage pendant sa défense ;
- le catalogue de progression réel du créateur chargé par la composition ;
- un catalogue de défense de production dans le paquet installé ;
- un emplacement de catalogue `$ACTIVE_CAMPAIGN_CHARACTER`, remplacé par
  l'identité du profil actif avant validation de la graine tactique ;
- la projection canonique du personnage actif vers `GameBoard`, sans relire
  la fiche legacy ni utiliser le personnage d'exemple ;
- un routage borné aux causes structurées et committées
  `BASTION_TACTICAL_DEFENSE` visant le lieu d'un bastion actif ;
- la restauration et le retour tactiques déjà propriétaires conservés dans
  la même factory.

Exemple :

```text
aucun bastion committé aux Archives
→ aucune carte bastion ou repos
→ « je prends un repos long » est refusé sans avance de temps

bastion actif committé au lieu courant
→ carte « Bastion » et « Repos autorisé »
→ une cause monde structurée peut ouvrir la défense cataloguée
→ le personnage actif remplace le slot du catalogue
```

Les intrigues et initiatives sociales restent exécutées par les frontières
du contrôleur à l'entrée de scène et après une avance locale. Leur contenu
privé n'est pas exposé dans la carte de disponibilité.

### 9E — raccord de la simulation du monde

Le mode simulation de la carte doit remettre ses avances à un port campagne :

```text
demande d'avance
→ adaptateur `MapModuleWorldSimulationAdapterV1`
→ segment temporel validé
→ résultat monde committé
→ événements autoritaires routés
→ effets perceptibles composés dans la scène
```

La simulation React actuelle ne devient pas l'autorité persistante. Les axes
encore ouverts sur les mobiles non-système et la calibration enrichiront le
contenu produit, mais ne bloquent pas le raccord des événements déjà certifiés.

Le lot 9E livre ce port avec un commit atomique de l'horloge, du curseur et de
l'état monde. L'interface principale expose l'onglet Monde pour une campagne
joueur, restaure l'état committé et route ensuite les causes de bastion, les
signaux locaux et la frontière sociale. Le détail testable est décrit dans
[`Guide-simulation-monde-campagne-lot-9E.md`](Guide-simulation-monde-campagne-lot-9E.md).

### 9F — certification du build principal

La fermeture exige une gate sur l'entrée réelle `index.html`, sans
`bootstrapController` de test :

1. sélectionner une fiche valide ;
2. créer la campagne ;
3. jouer puis recharger une scène ;
4. avancer une frontière de temps autorisée ;
5. observer une conséquence monde ou intrigue committée ;
6. ouvrir une disponibilité de progression et conserver son choix ;
7. restaurer un état de bastion ;
8. recevoir une défense causée par le monde ;
9. ouvrir `GameBoard`, restaurer son checkpoint et intégrer sa fin ;
10. revenir une seule fois à la narration.

Une recette manuelle française accompagne la gate. Elle distingue les étapes
libres du joueur des causes préparées par le contenu initial de campagne.

Le lot 9F est certifié par la gate `campaign-main-9f`, montée depuis la vraie
entrée du build. Les awards, le bastion et le raid utilisés pour la partie
contrôlée sont préparés dans la base isolée de la gate, jamais ajoutés au
contenu initial des Archives. La procédure et cette distinction sont publiées
dans
[`Recette-campagne-build-principal-lot-9F.md`](Recette-campagne-build-principal-lot-9F.md).

## Scénarios de refus obligatoires

- aucune fiche active ;
- fiche legacy invalide ou référence catalogue absente ;
- campagne existante dont le contenu épinglé n'est plus installé ;
- changement de fiche active après création ;
- cycle de scène absent ou incohérent ;
- événement monde non committé ;
- aucune cause visant un bastion ;
- progression sans preuve de repos ;
- défense dont un acteur ou une carte n'est pas projetable ;
- rechargement pendant un checkpoint ou une intégration en attente.

Chaque refus laisse la campagne intacte et fournit une bulle système
diagnostique. Aucun ne bascule vers un personnage exemple, une campagne
prototype ou une issue tactique locale.

## Définition de fermeture du lot 9

Le lot est fermé lorsque l'utilisateur peut démarrer `npm run dev`, choisir une
fiche, créer ou reprendre une campagne, puis tester depuis l'UI principale les
verticales raccordées avec la même persistance. Les gates isolées restent des
régressions, mais ne sont plus le seul moyen d'atteindre ces comportements.
