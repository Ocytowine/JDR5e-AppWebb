# Snapshot de tour et paquets contextuels

Dernière mise à jour : `2026-06-30`

Statut : `EN_CONCEPTION` — séparation, vocabulaire, sections par rôle, permissions et réduction budgétaire validés; obsolescence et audit restent à finaliser.

## Objectif

Donner à chaque rôle IA un contexte fiable, limité et adapté à sa tâche, sans lui demander de reconstruire la scène depuis la conversation ni lui transmettre toute la campagne.

## Vocabulaire

### `CampaignSnapshot`

Copie technique persistante servant à sauvegarder et reprendre la campagne. Il appartient au modèle de persistance et n'est pas directement un prompt IA.

### `TurnSnapshot`

Vue interne cohérente, immuable et versionnée des sources nécessaires au traitement d'un tour au moment de son ouverture.

Il est complet pour les besoins du tour, mais ne copie pas nécessairement toute la campagne. Il porte les références et versions permettant de retrouver ou vérifier ses sources.

### `RoleContextPack`

Projection temporaire construite depuis le `TurnSnapshot`, la mémoire autorisée et la tâche demandée. Elle contient uniquement les informations utiles et révélables pour un rôle précis.

### `CommittedTurnResult`

Résultat structuré et confirmé du tour : validations, résolutions, événements, changements de version, temps écoulé et vues autorisées.

La narration finale reçoit le `TurnSnapshot` initial et le `CommittedTurnResult`, ou une projection post-commit explicitement versionnée. Elle ne prétend pas que l'état initial contient déjà les conséquences du tour.

## Flux conceptuel

```text
sources autoritaires à la version N
→ TurnSnapshot immuable N
→ RoleContextPack d'interprétation
→ propositions et validations
→ commit N → N+1
→ CommittedTurnResult
→ RoleContextPack de narration
→ messages validés
```

Une clarification sans commit reste liée au snapshot initial, puis vérifie son obsolescence avant reprise.

## Contenu du `TurnSnapshot`

Le snapshot interne porte au minimum :

- campagne, tour, scène et identifiant de requête;
- version globale attendue et versions des agrégats lus;
- version de contenu et de règles;
- rôle du personnage joueur et état pertinent;
- scène active, lieu, heure et conditions locales;
- participants et identités référencées;
- processus principal actif;
- faits, résultats ou contraintes obligatoires déjà connus;
- références vers fils, engagements et mémoires susceptibles d'être projetés;
- entrée brute ou intention suspendue;
- empreinte permettant de vérifier son intégrité.

Il distingue les données incorporées des références résolubles. Il ne transforme pas un résumé narratif en état autoritaire.

## Enveloppe commune du `TurnSnapshot`

L'enveloppe conceptuelle contient :

### Identité

- `snapshotId` : identité unique de la photographie de tour;
- `campaignId` : campagne concernée;
- `turnId` : tour en cours;
- `requestId` : requête idempotente du joueur;
- `sceneId` : scène active;
- `activeProcessId` éventuel : repos, tactique ou autre processus interactif.

### Versions

- `baseCampaignVersion` : version globale attendue au début du tour;
- `aggregateVersions` : version de chaque agrégat effectivement lu;
- `contentVersion` : contenu épinglé;
- `rulesetVersion` : règles actives;
- `contextPolicyVersion` : politique de projection et de sélection;
- `schemaVersion` : version du contrat du snapshot.

### Temps technique et temps de jeu

- `capturedAt` : date technique de capture;
- `gameTime` : instant autoritaire dans l'univers;
- `expiresAt` éventuel : limite technique d'un cache, sans effet sur l'horloge de jeu.

### Intégrité

- manifeste ordonné des sources;
- empreinte déterministe de l'enveloppe et des sections incorporées;
- statut de validation;
- avertissements éventuels de projection.

L'empreinte détecte une altération ou une reconstruction différente. Elle n'est pas utilisée comme secret ni comme mécanisme d'autorisation.

## Manifeste des sources

Chaque source lue est déclarée avec :

- domaine propriétaire;
- type et identifiant stable;
- version ou séquence;
- période de validité pertinente;
- provenance canonique ou de campagne;
- empreinte si la source vient du contenu épinglé;
- mode `embedded` ou `referenced`;
- classification de visibilité maximale.

Le manifeste permet de vérifier qu'un paquet a été construit depuis les bonnes versions sans recopier tout le store.

## Sections communes

### `turnInput`

Entrée brute, langue, intention suspendue éventuelle et références nécessaires à une clarification. L'interprétation générée n'est pas confondue avec l'entrée originale.

### `sceneContinuity`

Identité de scène, mise en scène établie, transitions, participants référencés, détails éphémères encore actifs et messages immédiatement nécessaires à la continuité.

### `worldFrame`

Lieu et hiérarchie, temps de jeu, environnement, état local, position des acteurs et événements monde déjà applicables.

### `playerFrame`

Identité de campagne du PJ, apparence utile, capacités, langues, états et ressources pertinents pour le tour. Les caches ou données sans rapport restent exclus.

### `actorRefs`

Références des acteurs présents ou directement ciblés avec leurs versions. Leurs perspectives complètes sont projetées seulement dans les paquets qui en ont besoin.

### `activeProcess`

Nature, état et propriétaire du processus principal, ainsi que la question en attente éventuelle.

### `mandatoryConstraints`

Règles, faits, résultats antérieurs, engagements et interdictions qui ne peuvent pas être évincés par le budget.

### `retrievalSeeds`

Ancres et buts destinés au pipeline mémoire. Cette section déclenche une recherche; elle ne contient pas encore les souvenirs sélectionnés.

## Données incorporées et références

Une donnée courte, obligatoire et sensible à la cohérence peut être incorporée avec sa provenance. Une donnée volumineuse, secondaire ou déjà autoritaire ailleurs reste référencée avec sa version.

Le constructeur choisit selon :

- nécessité immédiate;
- risque de changement;
- coût de résolution;
- taille;
- visibilité;
- besoin de vérifier l'intégrité.

Une référence est résolue avant remise au rôle qui en a besoin. L'IA ne reçoit pas un identifiant opaque en espérant qu'elle invente son contenu.

## Provenance des blocs projetés

Chaque bloc structuré remis à un rôle conserve :

- `sourceRefs`;
- domaine validateur;
- version source;
- validité temporelle;
- perspective et visibilité;
- statut objectif, perçu, connu, cru ou dérivé;
- méthode de condensation éventuelle.

Un texte condensé sans ces références ne peut pas satisfaire une section obligatoire.

## Reproductibilité

À politique, versions, perspective et but identiques, deux constructions produisent les mêmes blocs structurés obligatoires et le même manifeste. L'ordre des éléments est stable avant sérialisation et calcul d'empreinte.

Les extraits rédigés peuvent varier seulement lorsqu'un rôle de rédaction est explicitement appelé; cette variation ne modifie ni manifeste ni données structurées.

## Paquets contextuels spécialisés

Chaque paquet contient une enveloppe commune : `packId`, `snapshotId`, rôle, tâche, perspective, version de politique, budget, sections incluses et contrat de sortie attendu.

| Rôle conceptuel | Perspective | Sections indispensables | Informations exclues | Finalité |
|---|---|---|---|---|
| `intent_interpreter` | `player_character` + scène visible | entrée, cibles, capacités, contraintes d'engagement | secrets MJ et conséquences non résolues | structurer l'intention et les ambiguïtés |
| `mj_planner` | `system_mj` limitée à la tâche | ancres, vérités nécessaires, fils, engagements, espaces libres, contraintes | secrets sans rapport et données de diagnostic | proposer commandes, créations et point d'arrêt |
| `player_expression_adapter` | `player_character` + enveloppe d'intention | intention validée, traits pertinents, registre, limites de reformulation | secrets, conséquences futures et options non choisies | mettre en scène l'expression sans changer son sens |
| `npc_performer` | `npc:<actorId>` | profil, motivation, relation, savoir, croyances, perception, résultat autorisé | vérités ignorées, pensées d'autres acteurs, diagnostic | produire paroles et réactions compatibles |
| `rules_adjudicator` | système ciblé sur un domaine | faits du cas, règles versionnées, précédents et bornes | secrets narratifs sans effet sur l'arbitrage | proposer l'interprétation d'un cas ouvert |
| `coherence_critic` | système privé ciblé | proposition, invariants, sources, chronologie et engagements concernés | secrets et domaines sans rapport | détecter contradictions et produire une critique structurée |
| `scene_writer` | sortie joueur autorisée | emplacements narratifs, résultats committés, révélations autorisées, ton | vérité cachée brute, diagnostic, dialogues validés à ne pas réécrire | rédiger les seuls blocs de narration MJ |
| `clarification_writer` | `player_character` | intention suspendue, champ manquant, options visibles | solutions cachées et hypothèses MJ | demander la précision minimale nécessaire |

Le nom technique final des rôles reste ouvert; leurs frontières de perspective sont normatives.

### Interprétation de l'entrée

Reçoit l'entrée, la scène visible, les cibles possibles, les capacités pertinentes et les règles d'engagement. Il n'a pas besoin des secrets sans rapport avec la compréhension de la demande.

Il distingue parole, action, question méta, rappel, question de possibilité et engagement incertain. Il ne reçoit aucun résultat futur à anticiper.

### Création ou orchestration

Reçoit les contraintes créatives, ancres, profil local, fils concernés, espaces libres et engagements à respecter. Il peut recevoir des secrets MJ nécessaires à la proposition, selon une perspective privée.

Le secret fourni doit posséder une raison d'inclusion liée à la tâche. L'accès `system_mj` n'autorise pas l'envoi systématique de tous les secrets de campagne.

### Expression du personnage joueur

Reçoit l'intention interprétée et validée, les traits utiles à son expression, son registre et les contraintes de la scène. Il ne reçoit ni option non choisie, ni conséquence future, ni secret susceptible d'influencer artificiellement la reformulation.

Son paquet contient une enveloppe sémantique indiquant ce qui doit être exprimé, ce qui peut varier dans la forme et ce qui ne peut pas être ajouté. La sortie reste candidate jusqu'au contrôle d'équivalence.

### Dialogue d'un PNJ

Reçoit identité, personnalité, motivation, relation, connaissances, croyances, perceptions et résultat validé accessibles à ce PNJ. Il ne reçoit pas la vérité cachée qu'il ignore.

Une information que le PNJ soupçonne est marquée comme croyance avec sa confiance; elle n'est pas reformulée comme certitude par le paquet.

### Contrôle de cohérence

Reçoit la proposition, les invariants, sources et engagements nécessaires pour détecter les contradictions. Sa sortie reste une validation ou critique, jamais une mutation directe.

Le critique peut connaître une vérité cachée uniquement si elle est nécessaire au contrôle demandé. Sa sortie privée ne rejoint pas le fil joueur.

### Arbitrage d'une situation ouverte

Reçoit uniquement les faits nécessaires, les règles pertinentes avec leur version, les précédents comparables et les limites du domaine. Il propose une application, une estimation ou un arbitrage ad hoc sans modifier les règles ni l'état.

### Narration du résultat

Reçoit l'intention interprétée, les résultats committés, les changements perceptibles, le temps écoulé, les références aux messages validés et les emplacements narratifs à compléter.

Le `scene_writer` ne reçoit pas la vérité cachée brute. Le `mj_planner` lui fournit une enveloppe de révélation distinguant :

- `reveal` : information autorisée explicitement;
- `hint` : élément perceptible pouvant être suggéré sans révéler sa cause;
- `withhold` : information à ne pas mentionner.

Une consigne de style ou de richesse descriptive ne peut pas élargir cette enveloppe.

Les expressions du personnage joueur et répliques des PNJ restent des blocs séparés déjà validés. Le rédacteur ne peut pas les réécrire; l'interface les assemble avec ses blocs narratifs selon le `RenderPlan`.

### Clarification

Reçoit l'intention suspendue, le champ manquant, les options réellement disponibles et la scène visible. Il ne reçoit pas d'informations qui permettraient de souffler au joueur des solutions cachées.

Il pose la question minimale permettant de reprendre le tour et ne transforme pas la clarification en nouveau choix narratif artificiel.

## Permissions créatives explicites

Chaque `RoleContextPack` contient un `creativeScope` calculé par l'orchestrateur. Le modèle ne peut ni le modifier, ni l'élargir dans sa réponse.

```text
creativeScope
  mayCreate[]
  mayReference[]
  mayProposeCommands[]
  mayReveal[]
  mustPreserve[]
  mustNotCreate[]
  mustNotModify[]
  noveltyConstraints[]
  outputContract
```

- `mayCreate` énumère les formes créatives autorisées et leur profondeur maximale : texture sensorielle éphémère, réplique, réaction, candidat PNJ ou candidat événement;
- `mayReference` limite les entités et souvenirs utilisables;
- `mayProposeCommands` énumère les commandes métier que le rôle peut seulement proposer; leur validation et leur commit restent déterministes;
- `mayReveal` contient l'enveloppe de révélation : faits révélables, indices permis, informations à retenir et degré de certitude exprimable;
- `mustPreserve` fixe l'intention du joueur, les résultats déjà committés, la causalité et les engagements narratifs;
- `mustNotCreate` et `mustNotModify` ferment explicitement les zones hors autorité;
- `noveltyConstraints` expose les invariants locaux, le profil du lieu, les engagements d'intrigue et les limites de nouveauté;
- `outputContract` impose le schéma de sortie et sépare toute proposition de création durable du texte narratif.

Une demande du modèle visant davantage de contexte ou de permissions est une simple proposition. L'orchestrateur la réévalue selon la politique du rôle; elle n'est jamais auto-acceptée.

### Permissions par rôle

| Rôle | Liberté autorisée | Interdictions principales |
|---|---|---|
| `intent_interpreter` | Interpréter le texte, détecter les intentions et ambiguïtés, formuler une clarification | Créer ou modifier le monde, résoudre l'action, transformer une hypothèse du joueur en fait |
| `mj_planner` | Construire un plan, proposer des événements, acteurs ou commandes dans les types autorisés | Committer une mutation, ignorer un invariant, élargir seul son périmètre créatif |
| `player_expression_adapter` | Développer la forme selon le personnage dans une enveloppe sémantique fermée | Ajouter un objectif, un consentement, un savoir, un risque ou une action non voulus |
| `npc_performer` | Produire paroles, attitude et réaction compatibles avec le savoir et l'état du PNJ | Établir un fait objectif nouveau, inventer un souvenir durable, connaître une information inaccessible |
| `rules_adjudicator` | Interpréter les règles et proposer un arbitrage borné pour un cas ouvert | Inventer une règle officielle, exécuter un jet, muter une ressource ou committer une décision |
| `coherence_critic` | Analyser une proposition et signaler conflits, lacunes et risques | Corriger directement l'état ou ajouter une solution canonique non demandée |
| `scene_writer` | Mettre en scène les résultats committés et ajouter une texture sensorielle éphémère compatible | Ajouter un résultat, une entité durable, une révélation ou une décision absente de son enveloppe |
| `clarification_writer` | Formuler une question claire dans le ton adapté | Faire avancer le temps, supposer la réponse ou poursuivre la narration |

La texture éphémère autorisée au rédacteur peut enrichir la forme — lumière, rythme, bruit indistinct, geste sans conséquence — mais ne doit jamais introduire une sortie, un objet utilisable, un témoin, une preuve ou un engagement réutilisable sans proposition et commit explicites.

## Budgets par rôle

Les budgets sont configurés par modèle et par rôle. Ils ne sont pas chiffrés dans ce contrat : la taille utile dépendra des modèles retenus, de leur fenêtre et des mesures en production. Leur ordre de priorité est en revanche contractuel.

Tout paquet réserve d'abord de la place pour :

1. les instructions et le schéma de sortie du rôle;
2. le texte courant du joueur;
3. la perspective et les permissions créatives;
4. les contraintes obligatoires et résultats committés;
5. une marge suffisante pour la réponse attendue.

Le reste est attribué selon le rôle :

| Rôle | Contenu prioritaire après le socle commun |
|---|---|
| `intent_interpreter` | Scène immédiate, cibles visibles, capacités connues, dernier échange |
| `mj_planner` | Contraintes du monde, intrigue active, espace créatif autorisé, souvenirs pertinents |
| `player_expression_adapter` | Enveloppe sémantique, traits expressifs pertinents, registre et contexte perceptible |
| `npc_performer` | Savoir de l'acteur, relation, état émotionnel, résultats auxquels il réagit |
| `rules_adjudicator` | Faits du cas, règles applicables, précédents comparables, bornes du domaine |
| `coherence_critic` | Proposition complète, invariants applicables, sources et engagements concernés |
| `scene_writer` | Résultat committé, enveloppe de révélation, continuité immédiate, voix et style |
| `clarification_writer` | Ambiguïté précise, information manquante, options légitimement visibles |

### Réduction lorsque le budget est insuffisant

L'ordre de réduction est déterministe et tracé :

1. retirer les exemples stylistiques et ornements facultatifs;
2. raccourcir les résumés dérivés sans perdre leurs références;
3. retirer le lore secondaire sans dépendance avec la tâche;
4. réduire les candidats sémantiques de plus faible score;
5. exclure les souvenirs dormants puis archivés non obligatoires;
6. remplacer de gros objets par des références résolvables si leur contenu complet n'est pas requis.

Ne sont jamais tronqués silencieusement : instructions du rôle, schéma de sortie, perspective, permissions, contraintes obligatoires, faits ou résultats committés nécessaires, enveloppe de révélation et dépendances critiques de la scène.

Si ce socle obligatoire dépasse à lui seul le budget, l'orchestrateur échoue explicitement, découpe le travail en appels spécialisés ou demande une clarification. Il ne lance pas un appel incomplet susceptible de fabriquer une cohérence apparente.

## Obsolescence et contrôle de concurrence

Un résultat IA n'est applicable que si les sources autoritaires dont il dépend sont encore compatibles au moment de sa validation. Comparer uniquement la version globale de campagne serait trop strict : un changement sans rapport ne doit pas invalider une réplique déjà calculée.

Chaque paquet porte donc :

- `baseCampaignVersion`, pour situer globalement le calcul;
- `dependencyVersions`, qui énumère les agrégats, propriétés et engagements réellement lus;
- `projectionPolicyVersion` et `retrievalIndexVersion`, pour les données dérivées;
- `expiresOnSceneChange`, pour les tâches liées à la scène immédiate.

Au retour d'un appel, l'orchestrateur classe le paquet :

| État | Condition | Traitement |
|---|---|---|
| `CURRENT` | aucune dépendance utile n'a changé | poursuivre la validation |
| `REPROJECT_REQUIRED` | seules une projection, une politique ou un index dérivé ont changé | reconstruire le contexte concerné; ne pas réutiliser aveuglément la sortie |
| `REVALIDATE_REQUIRED` | une source pertinente a changé mais la proposition reste potentiellement applicable | revalider depuis l'état courant et recalculer les conséquences |
| `STALE` | scène, cible, autorité, engagement critique ou précondition a changé | abandonner la sortie et reprendre la tâche depuis un nouveau snapshot |

Aucune commande ni mutation n'est committée depuis un paquet `STALE`. Le modèle ne décide jamais lui-même que son résultat reste compatible.

### Cas particuliers

- Après une clarification, l'intention suspendue reste référencée, mais la reprise construit toujours un nouveau `TurnSnapshot`.
- Une réponse tardive liée à une scène quittée est `STALE`, même si les entités existent encore.
- Une modification étrangère aux dépendances du paquet n'impose pas un nouvel appel.
- La narration finale référence le `CommittedTurnResult` et la version post-commit; elle n'est jamais produite comme preuve que le commit a eu lieu.
- Si plusieurs appels IA travaillent en parallèle, leurs sorties sont validées séparément contre leurs dépendances exactes.

## Trace de construction et d'utilisation

Chaque `RoleContextPack` produit une `ContextBuildTrace` conservée pour le diagnostic, sans être injectée intégralement dans le prompt :

- identité du snapshot, rôle, tâche, perspective et politique;
- sources candidates et versions observées;
- blocs obligatoires inclus;
- éléments optionnels retenus, condensés, remplacés par référence ou écartés;
- motif de chaque inclusion et exclusion;
- budget réservé, consommé et marge de sortie;
- filtres de visibilité et permissions appliqués;
- empreinte du paquet sérialisé;
- résultat du contrôle d'obsolescence au retour;
- identifiants des propositions, validations, commits et sorties narratives issus du paquet.

Cette trace permet de répondre à trois questions distinctes : « qu'est-ce que l'IA savait? », « qu'avait-elle le droit de faire? » et « sur quelle version son résultat a-t-il été accepté ou rejeté? ».

L'exemple [`Exemple-role-context-pack.json`](Exemple-role-context-pack.json) illustre ce contrat conceptuel. Il est parseable, mais ne remplace pas le futur schéma JSON versionné.

## Rôles sans IA

Validation de schéma, résolution mécanique, mutation, filtrage des droits, calcul de budget, vérification de version et sélection obligatoire restent déterministes. Ils ne reçoivent pas un `RoleContextPack` dans le but de déléguer leur autorité au modèle.

Une IA peut assister un contrôle sémantique ou proposer une durée, mais le résultat reste validé par le domaine propriétaire.

## Séparation des natures d'information

Chaque paquet distingue explicitement :

- `objective_truth` : vérité autoritaire nécessaire au rôle;
- `perceived` : information perceptible dans la situation;
- `known` : connaissance acquise par l'acteur de la perspective;
- `believed` : croyance subjective avec confiance et source;
- `secret` : vérité ou connaissance privée autorisée seulement pour le rôle;
- `derived` : résumé, capsule ou estimation sourcée;
- `unknown` : absence reconnue d'information.

Une catégorie ne change pas pendant la projection. Une croyance ne devient pas `objective_truth` parce qu'elle est incluse dans un paquet système.

## Exemple — garde des Archives

### État de départ

- Archives de Lysenthe, 14 h 20;
- accès sur mandat;
- garde présent et relation neutre;
- joueur persuadé sans preuve que le garde est corruptible;
- registre disparu lié à une intrigue;
- horaires de patrouille connus du garde mais secrets pour le joueur.

Entrée : « Je lui demande discrètement combien il voudrait pour me laisser entrer. »

### Pack d'interprétation

- entrée brute;
- garde comme cible;
- situation visible;
- hypothèse du joueur étiquetée comme croyance;
- capacités sociales pertinentes.

Résultat : parole engagée et tentative de corruption nécessitant une résolution sociale.

### Résultat committé

- tentative échouée;
- garde méfiant;
- relation dégradée;
- deux minutes écoulées.

### Pack du garde

- traits procéduraux et vigilants;
- règle du mandat;
- relation mise à jour;
- résultat de méfiance;
- connaissances propres du garde.

Les secrets de l'intrigue et les pensées d'autres acteurs sont exclus.

### Pack de narration

- action du joueur à mettre en scène;
- échec validé;
- réplique du garde;
- temps écoulé;
- conséquences perceptibles.

## Invariants initiaux

1. Un `RoleContextPack` référence exactement un `TurnSnapshot` et une perspective.
2. Un paquet n'est jamais utilisé comme source pour construire la vérité d'un autre paquet.
3. Les projections reviennent toujours aux sources et références autoritaires.
4. Un secret exclu d'une perspective ne peut pas réapparaître par condensation.
5. Le snapshot initial reste immuable après le commit.
6. Les résultats postérieurs sont apportés par un `CommittedTurnResult` ou une projection post-commit versionnée.
7. Deux paquets du même rôle, construits depuis les mêmes versions et la même politique, contiennent les mêmes faits structurés obligatoires.
8. La variation de prose ne modifie pas le contenu autoritaire du paquet.

## Points à traiter

- sections obligatoires et facultatives de chaque rôle;
- identifiants, empreintes et versions sources;
- permissions et interdictions créatives : traitées;
- budget et ordre de réduction par rôle : traités;
- détection et traitement d'un snapshot obsolète : traités;
- trace de construction des paquets : traitée;
- exemple de contrat conceptuel parseable : fourni.
