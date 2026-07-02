# Modèle persistant de campagne

Dernière mise à jour : `2026-06-30`

Statut : `RETENU` — modèle conceptuel complet; schémas contractuels et technologie de stockage restent à définir avant implémentation.

## Principes retenus

- Une campagne possède une chronologie unique et linéaire.
- Toute conséquence validée est durable.
- Le joueur ne peut pas charger un état antérieur pour annuler une décision.
- Les checkpoints servent à la reprise technique, pas au choix d'une chronologie.
- Une correction produit un nouvel événement explicite; elle ne réécrit pas silencieusement l'histoire.
- La conversation n'est jamais la source de vérité du monde.

## Terminologie

### Fiche source

Fiche produite par l'éditeur de personnage avant l'entrée en campagne. Elle peut servir de base d'import, mais n'est plus l'instance jouée après création de la campagne.

Une fiche source porte un identifiant propre à l'éditeur. Son import produit un nouvel identifiant de personnage de campagne et conserve la référence de provenance vers la fiche et sa version importée.

### Personnage de campagne

Instance réellement jouée après import. Elle appartient à une seule campagne et à une seule chronologie. Ses conséquences, relations, ressources et progressions ne modifient pas rétroactivement la fiche source.

En jeu normal, une fiche déjà importée ne crée pas silencieusement une seconde chronologie du même personnage. Un nouvel import éventuel exige un clonage explicite : la copie reçoit une nouvelle identité et est considérée comme un autre personnage.

Les outils de développement peuvent automatiser ce clonage pour les tests, sans relier les conséquences entre les campagnes produites.

### Campagne

Identité durable d'une partie et de sa chronologie. Elle relie le personnage importé, les agrégats métier, la version courante, les scènes, les tours et le journal d'événements.

### Sauvegarde

Représentation durable de l'état courant de la campagne. Pour le joueur, reprendre une sauvegarde signifie continuer depuis le dernier état validé, jamais choisir un ancien point temporel.

La sauvegarde n'est pas un slot narratif indépendant et n'introduit aucune branche.

### Tour

Unité d'interaction issue d'une entrée du joueur. Un tour terminé conserve l'entrée brute, son interprétation, les validations, les résultats et les messages affichés. Une clarification suspendue reste liée au tour d'origine.

### Commit

Enregistrement atomique d'un tour terminé ou d'un événement autonome du monde. Un commit possède un identifiant idempotent, une version précédente, une nouvelle version et les événements produits.

### Événement

Trace immuable d'un fait survenu. Il explique la causalité et les changements sans remplacer l'état courant optimisé pour la lecture.

### Snapshot

Copie technique cohérente des agrégats à une version donnée. Elle accélère la reprise et limite la quantité d'événements à rejouer.

### Checkpoint

Repère interne indiquant qu'une version est particulièrement adaptée à la reprise, au diagnostic ou à une migration. Il peut référencer un snapshot complet, mais n'est pas exposé comme point de chargement au joueur.

## Chronologie linéaire

Une campagne possède une seule version courante :

```text
version 0
→ commit du tour 1
→ version 1
→ commit du tour 2
→ version 2
→ événement autonome du monde
→ version 3
```

Un commit doit viser la version courante attendue. Si cette version a changé, la proposition est revalidée; elle ne crée pas une branche et n'écrase pas le nouvel état.

Les changements produits par le monde hors d'un échange joueur rejoignent la même chronologie et portent leurs propres causes temporelles.

## Agrégats de campagne

Les agrégats définissent les unités de cohérence et de validation. Ils peuvent être stockés dans une même sauvegarde physique tout en restant séparés logiquement.

### `CampaignHeader`

Porte l'identité de campagne, sa version courante, ses versions de schéma et de contenu, l'identifiant du personnage joué, la scène courante, le dernier commit et le statut de la campagne.

Il référence les autres agrégats sans recopier leur contenu.

### `PlayerCharacterState`

Porte l'instance importée et réellement jouée : identité, apparence, caractéristiques sources, capacités, ressources, états, inventaire, progression de campagne et profil expressif.

Il conserve la provenance de la fiche source et distingue les valeurs sources des valeurs dérivées recalculables.

Les observations d'arc et candidats de traits sont séparés des traits durables. Une évolution identitaire proposée par l'IA ne rejoint le profil expressif qu'après acceptation explicite du joueur; les conditions imposées par les règles restent dans l'état courant.

La fiche prête à jouer est conservée comme source d'import. L'état de campagne normalise inventaire, emplacements et contenants par `instanceId`, recalcule les données dérivées et produit des projections compatibles pour les moteurs consommateurs.

Les pièces physiques sont autoritaires dans l'inventaire. Les résumés monétaires sont dérivés; les actifs non physiques utilisent des structures économiques séparées.

### `WorldState`

Porte l'horloge unique, la position du joueur, les états géographiques, factions, tensions, objectifs et acteurs mobiles appartenant au monde simulé.

Il conserve aussi le niveau de simulation courant des zones et acteurs ainsi que leurs changements de niveau. Une réduction de granularité ne supprime jamais un engagement, une échéance ou un événement committé.

### `CampaignFacts`

Porte les faits objectifs et overrides persistants qui ne vivent ni dans le canon immuable ni dans la connaissance subjective d'un acteur. Chaque fait conserve provenance, validité et liens vers ses causes.

### `NarrativeActors`

Porte les PNJ persistants : identité, apparence, personnalité, motivations, état vital narratif et possessions établies. Positions mondiales, projections tactiques et relations restent référencées depuis leurs domaines propriétaires.

Un profil minimal porte identité stable, état de cycle de vie, première apparition, provenance de création, traits structurés, motivations, limites, apparence établie et références vers positions, relations et connaissances. Le texte libre enrichit le profil sans remplacer ces champs.

### `SocialKnowledgeState`

Porte séparément :

- relations, réputations, dettes et historique social;
- faits connus, croyances, secrets et provenance d'apprentissage par acteur.

La proximité de stockage ne supprime pas la distinction entre relation, connaissance subjective et vérité objective.

Une relation minimale référence les deux parties, son orientation, ses axes structurés, ses drapeaux historiques et les événements justifiant sa valeur. Une connaissance référence l'acteur qui la possède, l'affirmation ou le fait concerné, sa source, sa précision et sa visibilité. Une croyance ajoute une confiance subjective et peut contredire la vérité. Un secret est une connaissance dont la politique de visibilité limite la projection.

La disposition et l'émotion temporaires ne sont pas confondues avec la relation durable. Le modèle relationnel peut porter confiance, respect, peur, affection, hostilité et obligation selon le type de lien; chaque variation référence le résultat social et l'événement qui la justifient.

### `NarrativeThreads`

Porte missions, intrigues, trames et leurs états, ancres, causes, échéances et liens vers les événements qui les font évoluer.

Un fil minimal porte type, état, origine, enjeux connus et cachés, acteurs et lieux ancrés, étapes établies, conditions d'évolution, conséquence d'ignorance, temps pertinent et événement de dernière évolution. Il ne contient pas un scénario textuel complet imposant sa résolution.

### `SceneState`

Porte la scène courante et les scènes conservées : identité, continuité, participants référencés, mise en scène établie, faits locaux éphémères, transitions et liens vers tours et messages.

Un détail promu comme vérité durable quitte l'autorité de la seule scène et rejoint l'agrégat propriétaire approprié.

### `ActiveProcess`

Porte au plus les processus suspendus nécessaires à la reprise : intention en clarification, transition tactique, session de repos ou autre hand-off validé. Chaque processus référence le tour, la version de départ et son propriétaire métier.

Il ne sert pas de fourre-tout pour les tâches ou événements narratifs ordinaires.

Un `TravelProcess` actif conserve plan, segments committés, segment courant, position sur route, pression et graine de rencontre, ressources suivies et cause de suspension. Les candidats de rencontre non présentés ne deviennent pas des faits connus du joueur.

Un processus tactique conserve seed, carte validée, état courant, journal d'actions, checkpoints techniques, condition de fin et éventuel `TacticalOutcome`. L'état `COMPLETED_PENDING_INTEGRATION` interdit toute reprise du combat et autorise uniquement une nouvelle tentative idempotente d'intégration.

Un processus de repos conserve seed, plan, réponses validées, segments committés, consommations, activités, interruptions et bénéfices encore conditionnels. Un événement de début, fin ou interruption déclenche la projection UI correspondante sans devenir une autorité supplémentaire.

### `AdjudicationRecord`

Conserve un arbitrage accepté pour une situation que les règles calculables ne couvraient pas entièrement. Il porte le domaine, les faits déterminants, les références et versions de règles, les précédents consultés, la proposition IA, la décision retenue, sa portée et le commit qui l'a appliquée.

Un enregistrement peut servir de précédent de campagne pour améliorer la cohérence. Il ne devient pas une règle officielle, ne modifie pas le corpus épinglé et n'est rappelé que pour un cas suffisamment comparable.

### `ScheduledEffects`

Registre des effets futurs validés : instant dû, domaine propriétaire, cause, dépendances, règle, politique de frontière, conditions d'annulation, visibilité et état courant.

Les échéances résolues, annulées ou expirées restent historisées. Le scheduler les regroupe par instant dans des `TemporalBatch` idempotents et refuse toute dépendance cyclique ou création rétroactive.

### `EventJournal`

Suite immuable et ordonnée des événements confirmés. Chaque entrée référence son commit, sa cause, son temps de jeu, les agrégats concernés et sa visibilité.

Chaque événement porte aussi son origine de production et son payload versionné. Les regroupements de scène référencent ces entrées sans les remplacer par un événement textuel fusionné.

### `InteractionLog`

Journal complet des entrées brutes, interprétations utiles et messages affichés. Il est relié aux campagnes, scènes, tours et événements, mais n'établit aucun fait par son texte.

Le journal est paginable et archivable. Il peut être consulté par le joueur et les outils de diagnostic sans être chargé intégralement dans l'état courant ni envoyé au modèle IA.

### `Snapshots`

Copies cohérentes et versionnées des agrégats nécessaires à la reprise. Les snapshots ne changent aucune autorité et ne sont pas des sauvegardes sélectionnables par le joueur.

## Relations structurelles

```text
CampaignHeader
 ├─ playerCharacterId ──> PlayerCharacterState
 ├─ currentSceneId ─────> SceneState
 ├─ currentVersion ─────> dernier Commit
 ├─ agrégats ───────────> WorldState / CampaignFacts / NarrativeActors
 │                        SocialKnowledgeState / NarrativeThreads
 ├─ activeProcessId? ───> ActiveProcess
 ├─ eventJournal ───────> EventJournal
 ├─ interactionLog ─────> InteractionLog
 └─ latestSnapshotId? ──> Snapshots
```

Toutes les références inter-agrégats utilisent des identifiants stables. Une projection peut embarquer un libellé ou résumé pour l'affichage, mais ne recopie pas un profil complet faisant autorité ailleurs.

## Commandes, mutations, événements et faits

### Commande

Demande structurée d'une opération future. Elle exprime une intention et ses paramètres, sans affirmer que l'opération est possible ou réussie.

Une commande conserve notamment l'identifiant du tour, l'auteur de la proposition, le domaine cible, les cibles métier, la version attendue et une clé idempotente.

### Mutation préparée

Ensemble exact de changements calculés et validés par un domaine avant le commit. Une mutation n'est visible ni comme vérité ni comme événement tant que la transaction complète n'est pas confirmée.

La mutation peut être conservée dans la trace de diagnostic, mais le journal métier enregistre prioritairement les événements confirmés qui en résultent.

### Événement

Fait passé immuable émis après un commit réussi. Il contient au minimum :

- identifiant et type versionné;
- campagne, commit, tour ou cause autonome;
- domaine émetteur;
- entités concernées;
- temps de jeu et date technique;
- données structurées du résultat;
- niveau de visibilité;
- références aux événements causes si nécessaires.

### Fait de campagne

Vérité durable actuellement exploitable qui ne possède pas déjà un agrégat métier plus adapté. Un fait contient au minimum :

- identifiant stable de l'assertion;
- type de fait versionné;
- sujets et objets référencés;
- valeur structurée;
- portée locale ou globale;
- domaine validateur;
- événement et source d'origine;
- scène et tour d'établissement si applicables;
- temps de jeu de début de validité;
- fin de validité éventuelle;
- statut courant;
- fait remplacé ou invalidé éventuel.

Un changement crée une nouvelle assertion reliée à l'ancienne. L'ancienne reste consultable dans l'historique et cesse simplement d'être la valeur courante.

### Limite du modèle de faits

`CampaignFacts` ne devient pas une base générique de toutes les valeurs du jeu. PV, monnaie, inventaire, statistiques, relations et position restent dans leurs agrégats structurés. Leurs événements assurent la causalité sans dupliquer leurs états comme des faits libres.

## Vérité, connaissances et croyances

### Vérité objective

Valeur confirmée par le domaine propriétaire ou par `CampaignFactDomain`. Elle ne porte pas de score de confiance.

### Connaissance d'un acteur

Information à laquelle un acteur a réellement eu accès, avec sa source, sa date d'acquisition, son niveau de précision et ses droits de révélation. Connaître une affirmation ne garantit pas qu'elle soit vraie.

### Croyance d'un acteur

Interprétation subjective pouvant être exacte, partielle ou fausse. Elle peut porter confiance, origine et liens vers les indices qui l'ont produite.

### Hypothèse ou note du joueur

Interprétation formulée par le joueur. Elle ne modifie jamais la vérité, même lorsqu'elle est écrite avec certitude.

Une hypothèse peut être conservée pour le carnet du joueur ou pour comprendre une action future. Si elle est projetée vers l'IA, elle doit être explicitement étiquetée comme croyance du joueur ou du personnage, jamais comme fait confirmé.

Le système ne déduit pas automatiquement une croyance durable de chaque question ou hésitation du joueur. Il la conserve lorsqu'elle est explicitement formulée, notée ou nécessaire à la continuité d'une action.

### Effet indirect d'une erreur

Une erreur du joueur peut influencer le monde uniquement par une action validée : accusation prononcée, décision prise, information transmise ou comportement adopté. Les PNJ peuvent y réagir selon ce qu'ils entendent et savent. Cette réaction ne transforme pas l'hypothèse initiale en vérité.

## Provenance et temporalité

Les sources possibles comprennent au minimum : canon importé, fiche importée, action joueur, création IA validée, événement de domaine, simulation mondiale, migration et correction administrative tracée.

Chaque donnée durable distingue :

- `gameTime` : moment auquel elle existe dans l'univers;
- `recordedAt` : moment technique de son enregistrement;
- `validFrom` et `validTo` : période de validité dans le jeu;
- `sourceRefs` : sources et événements ayant justifié la donnée;
- `supersedes` ou `invalidates` : relation avec l'état précédent.

Une découverte tardive d'un fait ancien ne change pas sa date d'existence : elle crée un événement d'acquisition de connaissance au temps présent, référant au fait dont la validité peut avoir commencé plus tôt.

## Politique d'enregistrement

### Journal après chaque échange validé

Chaque échange terminé est enregistré, même s'il ne modifie aucun attribut mécanique. Cela permet de reprendre le fil visible et d'auditer la décision de l'IA.

Le commit distingue :

- transcript et données d'interaction;
- mutations métier éventuelles;
- événements publics;
- événements privés ou de diagnostic;
- nouvelle version des agrégats concernés.

Une simple question hors jeu peut être conservée dans l'historique d'interaction sans devenir un fait du monde.

### Snapshots espacés

Un snapshot complet n'est pas nécessaire après chaque message. Une politique configurable peut en produire :

- après un nombre défini de commits;
- lors d'une transition de scène importante;
- après un combat ou un repos;
- avant ou après une migration;
- lors d'une fermeture propre de la campagne;
- lorsqu'un volume d'événements rend la reprise trop coûteuse.

La fréquence relève de la performance et de la robustesse. Elle ne change pas la durabilité des commits intermédiaires.

### Décisions importantes

Une décision importante peut créer un checkpoint explicite pour le diagnostic et l'analyse, mais pas un point de retour jouable.

## Cycle d'un tour persistant

Un tour porte un identifiant de requête unique et la version de campagne sur laquelle il a été construit. Son état technique appartient à l'ensemble suivant :

- `received` : entrée reçue, aucun résultat committé;
- `awaiting_clarification` : intention suspendue sans mutation;
- `validating` : propositions en cours de validation ou résolution;
- `committed` : commit confirmé et résultat durable;
- `technical_failure` : aucun commit produit, reprise ou nouvelle tentative nécessaire.

Un échec dans le jeu n'est pas un `technical_failure` : il produit un tour `committed` avec un résultat d'échec métier.

### Idempotence

L'identifiant de requête est unique dans la campagne. Une nouvelle réception du même identifiant :

- retourne le résultat déjà committé s'il existe;
- reprend l'état de clarification correspondant si le tour est suspendu;
- ne rappelle pas l'IA et ne réexécute pas les domaines après un commit;
- ne produit jamais deux dépenses, gains, événements ou messages validés.

Chaque commande dérivée porte également une clé idempotente liée au tour et à son indice dans la proposition structurée.

### Intention suspendue

Une intention en clarification conserve au minimum :

- identifiants de campagne, tour et scène;
- entrée brute;
- interprétation structurée connue;
- champ ou engagement manquant;
- question affichée;
- version du snapshot initial;
- versions ou identifiants des dépendances à revalider;
- processus principal auquel elle appartient;
- date technique de suspension.

Elle ne conserve ni raisonnement interne du modèle ni ancien paquet de contexte complet. La réponse du joueur référence le tour suspendu; le contexte est reconstruit et les dépendances sont revalidées avant toute mutation.

### Processus au premier plan

Une campagne possède au plus un processus interactif principal au premier plan : narration ordinaire, repos ou tactique. Une clarification ou question peut être attachée à ce processus.

Les intrigues, objectifs et événements du monde ne sont pas des processus interactifs concurrents. Ils restent persistants et peuvent évoluer lorsque l'horloge de jeu avance.

## Temps de jeu et échanges

Le temps réel écoulé entre deux réponses n'a aucun effet sur la campagne. Seules les activités diégétiques validées font avancer l'horloge.

L'instant canonique utilise un entier `elapsedGameSeconds` et un calendrier référencé. Les compteurs horaires du monde simulé sont des curseurs de traitement dérivés; `worldSimulatedThrough` indique jusqu'où la simulation a rattrapé l'horloge de campagne.

### Activités diégétiques

Dialogue avec un PNJ, commerce, observation active, manipulation, micro-déplacement, voyage, repos et autres actions vécues produisent une durée de jeu, même minime lorsque l'action est brève.

L'IA peut proposer une estimation à partir des étapes réellement mises en scène. Le `WorldDomain` valide la durée, avance l'horloge et déclenche les effets temporels correspondants lors du commit. Une entrée composée cumule les durées des étapes effectivement exécutées, pas celles qui ont été interrompues.

### Échanges hors narration

Les opérations suivantes ne font pas avancer l'horloge :

- question sur une règle;
- demande de rappel d'une information déjà connue;
- clarification de l'engagement avant exécution;
- consultation d'interface ou du journal;
- temps réel passé hors de l'application;
- nouvelle tentative technique d'une requête idempotente.

Demander une nouvelle information à un PNJ ou entreprendre une observation dans le monde reste une activité diégétique, même si la phrase du joueur est interrogative.

### Événements autonomes du monde

Les événements autonomes sont produits uniquement par une avance validée du temps de jeu. Ils rejoignent la chronologie dans le même commit coordonné ou dans un commit monde immédiatement causal et ordonné. Ils ne naissent jamais du simple temps réel d'attente du joueur.

## Reprise après interruption

La reprise charge le snapshot valide le plus récent, puis rejoue ou applique les commits ultérieurs jusqu'à la dernière version confirmée.

- Un tour non committé est considéré comme non advenu.
- Une réponse narrative ne doit pas être présentée comme définitive avant son commit.
- Une requête rejouée avec le même identifiant ne peut pas doubler ses effets.
- Un commit incomplet ou corrompu est rejeté; le dernier état cohérent reste la référence.

Le joueur peut devoir reformuler une entrée interrompue, mais il ne perd pas les conséquences déjà confirmées d'un tour antérieur.

## Absence de retour joueur

L'interface normale n'expose :

- ni liste d'anciennes versions;
- ni chargement d'un checkpoint antérieur;
- ni annulation d'une décision;
- ni branche alternative.

Une conséquence peut être combattue, réparée ou inversée uniquement par une nouvelle action dans le monde. Cette évolution produit de nouveaux événements et conserve l'historique de la conséquence initiale.

Les outils de développement peuvent ouvrir une copie isolée d'un état ancien pour reproduire un bug. Cette copie n'est jamais réinjectée silencieusement dans la campagne jouée.

## Sauvegardes de sécurité et migrations

Une copie technique créée avant migration ou réparation n'est pas une branche de jeu. Elle sert uniquement à restaurer une campagne corrompue ou à annuler une migration défectueuse.

Toute restauration exceptionnelle doit être :

- réservée au diagnostic ou à la récupération de données;
- explicitement signalée;
- tracée avec la cause et la version restaurée;
- distincte d'une fonction de rechargement offerte au joueur.

## Versionnement

### Versions enregistrées

La sauvegarde conserve séparément :

- `schemaVersion` global, entier et monotone;
- version de schéma de chaque agrégat;
- `eventSchemaVersion` sur chaque type d'événement;
- `contentVersion` et manifeste des paquets de wiki/catalogues;
- `rulesetVersion` pour les règles mécaniques;
- version applicative, uniquement pour diagnostic.

Une version applicative ne remplace jamais une version de schéma ou de contenu.

### Contenu épinglé

Une campagne épingle les versions de contenu et de règles utilisées à sa création ou lors de sa dernière migration explicite.

- Une mise à jour du wiki ne modifie pas silencieusement une campagne existante.
- Les faits canoniques déjà matérialisés conservent valeur, identifiant de source et empreinte de contenu.
- Le runtime doit pouvoir résoudre le paquet de contenu épinglé ou refuser proprement l'ouverture en demandant une migration.
- Les nouveaux contenus compatibles ne deviennent disponibles qu'après une migration ou activation explicite validée.
- Une contradiction entre ancienne et nouvelle version est signalée; elle n'est pas arbitrée par l'IA.

Le mécanisme concret — paquets de contenu versionnés, snapshot de contenu ou combinaison des deux — reste un choix technologique ultérieur. Le contrat exige seulement la reproductibilité de la version épinglée.

## Pipeline de migration

Une migration de sauvegarde ou de contenu suit obligatoirement :

1. lecture sans mutation de la sauvegarde originale;
2. vérification des versions et préconditions;
3. création d'une copie de sécurité interne;
4. application séquentielle de migrations déterministes `N → N+1`;
5. recalcul contrôlé des données dérivées;
6. validation de tous les agrégats et références;
7. production d'un rapport de migration;
8. remplacement atomique de la sauvegarde active seulement après succès.

Les migrations :

- ne font aucun appel IA;
- ne dépendent pas du réseau;
- ne créent aucun événement de jeu fictif;
- ne changent pas l'horloge de l'univers;
- sont rejouables sur une copie avec un résultat identique;
- conservent les identifiants métier sauf transformation explicitement documentée.

Une sauvegarde provenant d'une version future inconnue n'est jamais ouverte en écriture par une application plus ancienne.

## Exemple non contractuel

[`Exemple-sauvegarde-mvp.json`](Exemple-sauvegarde-mvp.json) illustre les agrégats, versions et références retenus. Il est volontairement parseable, mais ne constitue pas encore le schéma d'implémentation. Toute différence future devra préserver les invariants de ce document plutôt que la forme exacte de l'exemple.

L'exemple démontre notamment :

- une fiche importée sous une identité de campagne distincte;
- un PNJ persistant;
- un fait objectif;
- une croyance erronée du joueur séparée de ce fait;
- une relation et un secret;
- un fil narratif sans résolution préécrite;
- une scène et un transcript reliés aux événements;
- un manifeste de contenu épinglé.

## Invariants déjà retenus

1. Une campagne possède exactement une version courante.
2. Un commit référence la version qu'il prolonge.
3. Deux commits ne peuvent pas prolonger simultanément la même version dans la campagne active.
4. Tout effet persistant provient d'un commit confirmé.
5. Un identifiant idempotent ne produit ses effets qu'une fois.
6. Un snapshot représente une version confirmée et cohérente.
7. Un checkpoint ne change pas la chronologie.
8. Une correction ajoute de l'histoire; elle ne supprime pas l'événement corrigé.
9. Une question méta enregistrée ne devient pas un fait du monde.
10. Le joueur reprend toujours la dernière version cohérente de sa campagne.
11. Un personnage de campagne appartient à une seule campagne et une seule chronologie.
12. Un nouvel import de la même fiche crée une nouvelle identité, jamais une branche du personnage existant.
13. La fiche source conserve sa valeur de modèle initial et ne reçoit pas les conséquences de campagne.
14. Un même identifiant de requête ne peut produire qu'un seul résultat committé.
15. Une intention suspendue ne contient aucune mutation partielle.
16. Une campagne possède au plus un processus interactif principal au premier plan.
17. Le temps réel n'avance jamais l'horloge de jeu.
18. Toute activité diégétique exécutée porte une durée validée par le `WorldDomain`.
19. Une interaction méta ou une clarification pré-exécution possède une durée de jeu nulle.
20. Une campagne ne change de version de contenu ou de règles que par migration explicite.
21. Un arbitrage IA accepté peut créer un précédent de campagne, jamais une règle officielle implicite.
22. Une observation ou proposition d'arc ne modifie jamais silencieusement le profil expressif durable du personnage joueur.
23. Un emplacement, contenant ou focus de campagne référence une instance, jamais seulement une définition d'objet.
24. Une valeur dérivée importée ne devient autoritaire qu'après recalcul avec le ruleset épinglé.
25. Un tirage de rencontre de voyage est stable pour une campagne, un voyage et un segment donnés.
26. La position du joueur et l'horloge de campagne n'ont qu'une autorité, même si plusieurs moteurs en consomment des projections.
27. Une parole peut modifier une croyance ou une relation sans modifier la vérité objective qu'elle évoque.
28. Un résultat tactique terminé produit au plus un commit de conséquences et ne peut pas être rejoué pour réparer son intégration.
29. Un signal UI de processus reflète un événement committé et ne peut ni démarrer ni terminer lui-même ce processus.
30. Deux événements au même instant restent ordonnés par séquence de commit et séquence interne, jamais par une précision temporelle inventée.
31. Une échéance future possède une cause et un propriétaire; son annulation reste historique.
32. Une dépendance causale cyclique ne peut produire aucune mutation partielle.
33. La composition de plusieurs événements dans une scène ne supprime ni ne fusionne leurs identités autoritaires.
34. Un retour tardif compare l'état courant à la dernière perception du personnage sans révéler l'ancien ou le nouveau secret système.
35. Une évolution relationnelle ou mémorielle hors écran exige une cause committée; le temps seul ne l'invente pas.
21. Une migration échouée ne remplace jamais la sauvegarde active.
22. Une migration est déterministe et ne fait aucun appel IA.
23. Une sauvegarde d'une version future inconnue n'est pas modifiée.
24. Le modèle conceptuel ne présume ni moteur de base de données ni format physique définitif.

## Points reportés aux contrats d'implémentation

- schémas JSON exacts et validateurs;
- technologie et emplacement physique du store;
- stratégie concrète de paquets de contenu versionnés;
- seuils de création des snapshots;
- politique de rétention des traces techniques;
- taille et pagination physiques de l'`InteractionLog`.
