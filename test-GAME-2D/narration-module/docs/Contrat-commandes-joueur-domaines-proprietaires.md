# Contrat des commandes joueur et domaines propriétaires

Statut : `ACTIF — AUDIT DE CONCEPTION`

## But

Ce contrat fixe ce que le texte libre peut reconnaître et transmettre pour
l'inventaire, la progression, le bastion et le tactique. Il ne donne aucune
autorité supplémentaire à `player_intent_interpreter` : l'interpréteur décrit
le sens, le registre runtime vérifie la capacité installée et le propriétaire
du domaine décide seul de la commande, du commit et du temps.

Une capacité n'est `AVAILABLE` que si un adaptateur effectif relit l'état de
campagne et appelle une autorité déterministe. Une interface existante ne suffit
pas à rendre sa commande déclenchable en texte libre.

## Décision d'ontologie

L'ontologie V5 reste inchangée pendant cet audit. Les formes génériques
`manipulate_visible_object`, `context_question` ou un simple `domainHint` ne
doivent pas être transformées en commandes métier par mots-clés.

Avant d'ajouter un nouveau `semanticIntent.kind`, chaque ouverture devra fournir :

1. une projection publique et typée des options réellement disponibles ;
2. une sélection non ambiguë d'une option ou une clarification locale ;
3. un adaptateur vers le contrat du propriétaire ;
4. un refus sans commit ni temps lorsque le propriétaire ou un prérequis manque ;
5. un rejeu idempotent et une restauration navigateur.

## Matrice de décision

| Domaine | Commande propriétaire existante | Déclenchement texte libre | Décision |
|---|---|---|---|
| Inventaire | présenter un exemplaire possédé à un contrôle d'accès | spécialisé, si le runtime d'accès inventaire est installé | `AVAILABLE` sous `inventory.access-credential` |
| Inventaire | prendre, déplacer, donner, acheter, vendre, équiper ou déséquiper | aucun propriétaire générique | `HANDOFF_ONLY` sous `inventory.mutation` |
| Progression | appliquer un award committé avec choix, candidat validé et fenêtre de repos | interface propriétaire seulement | fermé au texte libre |
| Bastion | démarrer un travail catalogué | interface propriétaire seulement | fermé au texte libre |
| Bastion | affecter un PNJ de campagne à un rôle catalogué | interface propriétaire seulement | fermé au texte libre |
| Bastion | établir, achever un travail, résoudre une activité ou un incident | événement ou frontière propriétaire | `EXTERNAL_TRIGGER_ONLY` |
| Tactique | engager l'approche tactique d'un contrôle d'accès | spécialisé, si la fabrique de graine est installée | `AVAILABLE` sous `tactical.access-conflict` |
| Tactique | défendre un bastion depuis un incident committé | cause propriétaire | `EXTERNAL_TRIGGER_ONLY` |
| Tactique | démarrer un combat générique depuis une phrase | aucune autorité de graine générique | `HANDOFF_ONLY` sous `tactical.generic-handoff` |

`AVAILABLE` signifie seulement que le propriétaire peut examiner la demande.
Cela ne garantit ni succès, ni mutation, ni dépense de ressource.

## Inventaire

### Ouverture existante

`inventory-access-resolution/1` est borné à un seuil `CONTROLLED` qui accepte le
domaine inventaire. L'adaptateur relit le personnage actif, résout un
`itemInstanceId`, vérifie possession, accessibilité, politique et éventuelle
preuve active. La politique décide `RETAIN` ou `CONSUME_ONE` et le changement du
contrôle d'accès est committé atomiquement avec l'éventuelle consommation.

Cette commande ne constitue pas une transaction d'inventaire générale.

### Commandes encore fermées

Prendre, ramasser, transférer, acheter, vendre, ranger, équiper et déséquiper
exigent un nouveau propriétaire de transaction. Celui-ci devra valider au
minimum les instances, quantités, conteneurs, emplacements exclusifs, accès
physique, monnaie et contrepartie. Le `RuleRegistry` sait valider certaines
contraintes, mais ne possède pas la transaction.

L'interpréteur peut conserver `requiredDomain=inventory`; il ne peut pas choisir
l'exemplaire privé, le prix, la quantité ou le résultat.

## Progression

`character-progression-application/1` est l'autorité existante. Elle exige :

- un award déjà committé et encore applicable ;
- les révisions attendues du personnage et de ses projections ;
- une fenêtre de repos autorisée ;
- tous les choix exigés ;
- un candidat reconstruit depuis les catalogues ;
- la validation personnage/ruleset avant commit atomique.

Le texte libre ne reçoit aujourd'hui ni l'award disponible, ni ses choix, ni le
candidat catalogué. Une future commande sémantique ne pourra donc sélectionner
qu'une option issue d'une projection publique propriétaire. « Je monte de
niveau » ne doit jamais créer un award, inventer une classe ou contourner le
repos.

L'évaluation qui accorde un award reste `EXTERNAL_TRIGGER_ONLY` : elle part d'un
événement committé et d'une politique d'éligibilité, pas d'une demande joueur.

## Bastion

Deux commandes joueur disposent déjà d'autorités déterministes :

- `bastion-work-order/1` démarre un travail exactement référencé dans le
  catalogue et refuse tout prérequis non prouvé ;
- `bastion-occupant-assignment/1` affecte un PNJ de campagne existant à un rôle
  catalogué après preuve du propriétaire.

Elles restent accessibles par leur interface dédiée, pas par texte libre. Le
manifeste de l'interpréteur ne connaît ni le bastion actif, ni les travaux
proposables, ni les occupants et rôles éligibles. Une future projection devra
exposer seulement ces options publiques et leurs identifiants stables.

L'établissement du bastion part d'une acquisition committée. L'achèvement d'un
travail, l'activité autonome d'un occupant et les incidents partent du temps ou
d'événements propriétaires. Ils ne deviennent pas des commandes joueur.

Les travaux payants restent fermés tant qu'une autorité de monnaie et de
matériaux ne peut pas produire leurs preuves et transactions.

## Tactique

Le module possède le contrat de handoff, les graines validées, checkpoints,
outcomes et intégrations. Il ne possède pas pour autant une décision générique
« cette phrase démarre ce combat ».

Deux sources de graines sont autorisées :

- un contrôle d'accès actif qui accepte explicitement le domaine tactique et
  dont la fabrique cataloguée est installée ;
- un incident de défense de bastion committé et accepté par son autorité.

Dans les deux cas, le plateau possède le combat et les domaines personnage,
inventaire, accès ou bastion valident ensuite leurs conséquences. La narration
ne décide ni participants, ni carte, ni surprise, ni victoire.

Une attaque libre, une menace ou une volonté de combattre reste
`tactical.generic-handoff=HANDOFF_ONLY`. L'ouvrir exigera une autorité de
qualification de rencontre, une fabrique de graine liée à la scène, une
politique de participants et un propriétaire des conséquences. Aucun fallback
textuel ne peut remplacer ces éléments.

## Manifeste public

`interpreter-runtime-context/1` distingue désormais les capacités spécialisées
raccordées des domaines génériques fermés :

- `inventory.access-credential` reflète la présence du runtime d'accès
  inventaire ;
- `inventory.mutation` reste toujours `HANDOFF_ONLY` ;
- `tactical.access-conflict` reflète la présence du runtime tactique d'accès ;
- `tactical.generic-handoff` reste toujours `HANDOFF_ONLY` ;
- progression et ordres de bastion ne sont pas annoncés comme capacités texte
  libre tant qu'aucune projection publique de leurs options n'existe ;
- leurs causes automatiques restent couvertes par
  `campaign.autonomous-boundaries=EXTERNAL_TRIGGER_ONLY`.

Le manifeste est une aide d'interprétation fingerprintée. Le contrôleur recalcule
encore localement `canHandle` contre la scène et les registres avant toute
exécution.

## Ordre d'implémentation autorisé

1. Conserver et tester les deux raccords spécialisés déjà propriétaires :
   justificatif inventaire et conflit tactique d'accès.
2. Créer une projection publique typée des options de progression et de
   bastion avant toute nouvelle capacité de texte libre.
3. Ouvrir ensuite au plus une commande à la fois, avec sélection exacte,
   clarification, autorité, restauration et cas de refus.
4. Ne cadrer les mutations d'inventaire génériques qu'après création de leur
   transaction propriétaire.
5. Ne cadrer le combat générique qu'après création de son autorité de rencontre
   et de graine.

## Preuves

```powershell
npm run narration-module:test:runtime-routing
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:inventory-access
npm run narration-module:test:tactical-access
npm run narration-module:test:character-progression
npm run narration-module:test:bastion
npm run build
```

La régression du registre doit prouver qu'installer les adaptateurs spécialisés
n'ouvre jamais `inventory.mutation`, `tactical.generic-handoff`, une commande de
progression ou un ordre de bastion implicite.
