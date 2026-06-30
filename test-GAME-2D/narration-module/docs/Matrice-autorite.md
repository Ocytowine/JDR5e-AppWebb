# Matrice d'autorité du module narration

Dernière mise à jour : `2026-06-30`

Statut : `RETENU` — toutes les données persistantes du scénario MVP possèdent une autorité conceptuelle; les schémas et signatures restent à figer.

## Objet

Cette matrice définit, pour chaque famille de données du MVP :

- qui en fixe la vérité;
- qui peut la consulter;
- qui peut proposer une évolution;
- qui valide et exécute cette évolution;
- quels événements rendent la modification traçable;
- ce que le code actuel fournit déjà ou doit encore construire.

Les domaines sont des frontières logiques dans un monolithe modulaire. Ils ne désignent pas des microservices.

## Règles de lecture

- `Autorité` : domaine qui fixe la valeur courante et ses invariants.
- `Lecteurs` : consommateurs autorisés à recevoir une projection adaptée.
- `Proposants` : acteurs pouvant demander un changement sans le rendre vrai.
- `Validation/exécution` : domaine qui accepte, refuse, résout et produit la mutation.
- `Événements` : faits immuables expliquant le changement.
- `Écart actuel` : différence entre la cible et le dépôt au moment de l'audit.

Le `CampaignStore` persiste les agrégats et événements. Il n'est pas l'autorité métier de toutes les données qu'il contient.

## 1. Contenu et données initiales

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Canon initial : lieux, factions, histoire | `ContentDomain` à partir du wiki | Monde, faits de campagne, contexte IA, outils | Auteurs du wiki hors partie | Validation de contenu avant chargement | `content_version_loaded`, diagnostic de contenu invalide | Front matter présent; schéma global et version de contenu absents |
| Catalogues : objets, actions, sorts, règles | `ContentDomain` à partir des catalogues validés | Personnage, inventaire, tactique, repos, contexte IA filtré | Auteurs de contenu hors partie | Scripts et validateurs de contenu | `catalog_version_loaded` | Plusieurs validateurs existent; projection narrative unifiée absente |
| Fiche créée avant campagne | `CharacterDomain` de création | Import de campagne, éditeur | Joueur via l'éditeur | Règles de création et progression | `character_sheet_created`, `character_sheet_updated` | Sauvegarde riche en `localStorage`; contrat permissif et sans version de campagne |

## 2. Campagne et personnage joueur

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Identité de campagne, version, snapshots | `CampaignStore` pour la persistance | Orchestrateur, reprise, diagnostic | Orchestrateur et migrations | Contrôle de version et transaction du store | `campaign_created`, `campaign_saved`, `campaign_migrated` | Store de campagne absent |
| Faits objectifs et overrides de partie | `CampaignFactDomain` | Scène, monde, acteurs, mémoire, contexte IA | IA, monde, tactique, repos, joueur via actions | Validation par le propriétaire de la propriété puis enregistrement sourcé | `campaign_fact_asserted`, `campaign_fact_replaced`, `campaign_fact_invalidated` | Modèle absent |
| Identité et apparence du PJ joué | `CharacterDomain` de campagne | Scène, social, tactique, UI, contexte IA | Progression validée, effets autorisés | Règles personnage | `player_profile_changed` | Import de la fiche vers une campagne absent |
| Profil expressif et évolutions narratives du PJ | `CharacterDomain` de campagne; choix identitaires confirmés par le joueur | Adaptateur d'expression, scène et UI | IA via observation et candidat, joueur | Provenance des événements puis acceptation explicite du joueur | `character_arc_observed`, `narrative_trait_proposed`, `narrative_trait_accepted`, `narrative_trait_rejected` | Modèle absent |
| Présentation visible, hygiène et état des objets portés | `CharacterDomain` pour le corps et les possessions du PJ; domaine propriétaire pour les autres acteurs | Scène, social, tactique et UI selon perception | Équipement, activités, repos, environnement et événements validés | Règles d'état et projection de visibilité | `presentation_state_changed`, `item_condition_changed`, `visible_equipment_changed` | Apparence statique et emplacements présents; états dynamiques absents |
| Caractéristiques, capacités et langues du PJ | `CharacterDomain` de campagne | Règles, scène, tactique, repos, contexte IA filtré | Progression, effets de règles | Règles personnage/progression | `player_capability_changed`, `player_language_changed` | Données présentes dans la fiche; autorité runtime non centralisée |
| PV, états, fatigue et ressources du PJ | `CharacterDomain` de campagne | Tactique, repos, scène, UI | Tactique, repos, actions validées | Règles personnage | `player_resource_changed`, `player_condition_changed`, `player_died` | État actuellement réparti entre fiche et runtime tactique |
| Inventaire, monnaie et équipement du PJ | `CharacterDomain` de campagne avec `InventoryRules` | Scène, tactique, repos, UI | Joueur, IA, récompense, commerce, tactique | Instances, placements et capacités puis transaction coordonnée | `item_acquired`, `item_transferred`, `item_consumed`, `currency_changed` | Instances et contenants présents, mais références hétérogènes et transaction de campagne absente |
| Position géographique du PJ | `WorldDomain` | Scène, voyage, contexte IA, UI | Joueur ou IA via intention validée | Règles de déplacement du monde | `player_departed`, `player_arrived`, `travel_interrupted` | Aucun lien persistant campagne ↔ position monde |

## 3. PNJ, social et connaissances

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Identité, personnalité, apparence et motivations d'un PNJ persistant | `NarrativeActorDomain` | Scène, social, monde, tactique, UI, contexte IA | IA via création candidate; contenu initial | Validation de création/promotion | `npc_promoted`, `npc_profile_changed`, `npc_retired` | Registre narratif persistant absent |
| État vital durable d'un PNJ | `NarrativeActorDomain` | Monde, scène, tactique, social | Tactique, monde, événement narratif validé | Règles acteur puis transaction coordonnée | `npc_injured`, `npc_died`, `npc_recovered` | Projection de combat sans restitution persistante complète |
| Position et activité mondiale d'un PNJ | `WorldDomain` | Scène, social, contexte IA, UI | Monde, voyage validé, création de campagne | Règles monde | `npc_departed`, `npc_arrived`, `npc_activity_changed` | Mobiles monde présents; raccord avec PNJ narratifs absent |
| Possessions établies d'un PNJ | `NarrativeActorDomain` avec `InventoryRules` | Scène, commerce, tactique si nécessaire | IA, monde, transfert validé | Règles inventaire et transaction | `npc_item_acquired`, `item_transferred` | Modèle absent |
| Relation individuelle, dette et historique social | `SocialKnowledgeDomain` — volet social | Scène, PNJ concerné, contexte IA filtré, journal joueur selon visibilité | IA, actions et événements validés | Règles sociales | `relationship_changed`, `debt_created`, `debt_settled` | Modèle persistant absent |
| Réputation locale ou de faction du PJ | `SocialKnowledgeDomain` — volet social | Monde, scène, factions, contexte IA | Monde, IA, résultats de quête ou tactiques | Règles sociales et de faction | `reputation_changed`, `social_threshold_crossed` | Concepts documentés, runtime absent |
| Faits connus, croyances et secrets par acteur | `SocialKnowledgeDomain` — volet connaissance | Acteur concerné, scène et contexte selon droits | Perception, dialogue, événement validé, IA | Validation de provenance et de visibilité | `knowledge_acquired`, `belief_updated`, `secret_revealed` | Modèle absent |
| Vérité objective correspondant à une connaissance | Domaine propriétaire du fait ou `CampaignFactDomain` | Domaine connaissance sous projection | Domaines propriétaires | Validation du fait concerné | Événement métier d'origine | Séparation vérité/croyance non implémentée |

## 4. Scène, intrigue et conversation

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Identité, continuité et mise en scène établie | `SceneDomain` | Orchestrateur, contexte IA, UI, mémoire | IA, transitions validées, moteurs | Validation de scène contre les domaines autoritaires | `scene_started`, `scene_updated`, `scene_suspended`, `scene_ended` | Domaine absent |
| Participants de scène | `SceneDomain` comme projection d'identités et positions autoritaires | Contexte IA, UI | Monde, IA, transition | Validation contre position, disponibilité et événements | `scene_participant_joined`, `scene_participant_left` | Domaine absent |
| Détail éphémère sans effet durable | `SceneDomain` | Contexte IA et UI de la scène | IA | Contrôle de compatibilité | Aucun événement persistant obligatoire; trace de tour | Domaine absent |
| Détail de décor devenu durable | `CampaignFactDomain` après promotion | Scènes futures, monde si pertinent | IA via création candidate | Domaine de fait ou monde selon la propriété | `campaign_fact_asserted` ou événement monde | Promotion absente |
| Intrigue, mission et fil narratif | `SceneDomain` pour l'activité locale, persisté comme agrégat narratif de campagne | Scène, journal joueur filtré, contexte IA | IA, monde, joueur par ses décisions | Règles de cycle narratif | `thread_created`, `thread_advanced`, `thread_resolved`, `thread_abandoned` | Runtime absent |
| Entrée brute, interprétation et intention en attente | `NarrativeOrchestrator` pendant le tour; persistance de reprise dans `CampaignStore` | Orchestrateur, diagnostic, UI autorisée | Joueur et IA pour l'interprétation | Contrat de tour | `turn_submitted`, `clarification_requested`, `turn_resumed` | Contrat absent |
| Messages validés du fil | `SceneDomain` pour le transcript; aucune autorité sur les faits par le texte | UI, reprise, diagnostic | IA après résultats validés | Contrôle des locuteurs et droits de révélation | `message_committed` | Route de résumé tactique existante, sans transcript de campagne |

## 5. Monde, tactique et repos

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Horloge unique | `WorldDomain` | Tous les domaines temporels | Narration, repos, voyage, tactique selon durée | Règles temporelles du monde | `world_time_advanced` | Horloge de simulation existante; persistance campagne absente |
| Estimation temporelle ouverte et arbitrage de règle | Domaine propriétaire concerné, dont `WorldDomain` pour le temps | Orchestrateur, diagnostic et mémoire de précédents | IA via `rules_adjudicator` | Bornes, invariants, critique si sensible, puis domaine propriétaire | `adjudication_recorded` et événement métier résultant | Contrat du futur runtime absent |
| Géographie, météo et conditions locales | `WorldDomain` | Scène, perception, voyage, contexte IA | Monde, IA pour créations candidates compatibles | Règles monde | `local_condition_changed`, `weather_changed` | Géographie structurée; météo runtime à confirmer |
| Factions, tensions, pressions et objectifs mondiaux | `WorldDomain` | Scène, social, contexte IA | Simulation, IA via candidat, joueur par conséquences | Moteur de simulation | Événements `WorldEvent` et deltas monde | Moteur et validation de candidats présents; raccord campagne absent |
| État temporaire d'une rencontre | `TacticalDomain` | UI tactique, règles, retour narratif filtré | Narration via hand-off, IA ennemie encadrée | Moteur tactique | `encounter_started`, événements d'action, `encounter_resolved` | Moteur présent; événements exposés limités et hand-off absent |
| Conséquences persistantes d'un combat | Domaine concerné : personnage, acteur, inventaire, faits, monde | Scène de continuation, UI, mémoire | `TacticalDomain` via résultat | Chaque propriétaire, coordonné atomiquement | blessures, morts, dépenses, butin, effets monde | Réinjection unifiée absente |
| Session, activités et progression d'un repos | `RestDomain` | Scène, personnage, monde, UI narrative | Joueur, IA, règles | Moteur de repos | `rest_started`, `rest_activity_resolved`, `rest_interrupted`, `rest_completed` | Moteur absent |
| Effets persistants et temps d'un repos | Personnage et monde, sur propositions du `RestDomain` | Scène de continuation, UI | `RestDomain` | Propriétaires concernés, transaction coordonnée | ressources restaurées, fatigue, temps, événement d'interruption | Contrat absent |

## 6. Projections, IA, interface et configuration

| Données | Autorité | Lecteurs | Proposants | Validation/exécution | Événements attendus | Écart actuel |
|---|---|---|---|---|---|---|
| Snapshot de début de tour | Projection versionnée construite par l'orchestrateur depuis les autorités | Pipeline IA et diagnostic | Orchestrateur uniquement | Vérification des versions sources | `turn_snapshot_built` en diagnostic | Absent |
| Paquet de contexte IA | Projection temporaire du contexte; aucune autorité métier | Modèle IA et diagnostic sécurisé | Projecteur de contexte | Budget, provenance et droits de révélation | `context_pack_built` en diagnostic | Sélection lore historique retirée; nouveau pipeline absent |
| Proposition et prose IA | Aucune autorité tant qu'elles ne sont pas validées | Orchestrateur puis UI pour la prose validée | Modèle IA | Schémas et domaines propriétaires | `ai_proposal_received`, `ai_output_rejected` en diagnostic | Appels ponctuels existants, sans contrats du futur module |
| État visuel de l'interface | `NarrativeUI` uniquement pour la présentation | UI | Utilisateur et contrôleurs UI | Réducteur/état UI | Aucun événement métier | Future interface absente |
| Politique de rythme et options de diagnostic | Configuration applicative/campagne selon portée | Orchestrateur et UI | Développeur; joueur si option exposée plus tard | Validation de configuration | `narrative_policy_changed` si persisté | Absent |

## Invariants transversaux

1. Toute référence inter-domaines utilise un identifiant stable.
2. Une propriété mutable possède exactement une autorité métier.
3. Une projection ne peut jamais modifier sa source.
4. Le texte généré n'est jamais une commande implicite.
5. Une mutation persistante porte provenance, tour causal et version.
6. Les conséquences multi-domaines sont préparées puis enregistrées atomiquement.
7. Les événements privés et publics sont séparés avant construction du contexte IA.
8. Le temps est modifié uniquement par le `WorldDomain`.
9. Le `CampaignStore` ne contourne pas les validations métier.
10. Un conflit d'autorité interrompt la mutation et produit un diagnostic; aucune priorité silencieuse n'est appliquée.

## Audit du dépôt actuel

### Éléments réutilisables

- Le wiki porte déjà des identifiants et relations en front matter.
- Le `map-module` expose un `WorldState`, une horloge, des événements, des deltas et la validation de certaines propositions candidates.
- L'éditeur exporte une fiche détaillée avec caractéristiques, langues, apparence, inventaire, progression et capacités dérivées.
- Le moteur tactique peut émettre quelques événements structurés et produit des rapports de résolution.
- Les catalogues de contenu possèdent déjà plusieurs scripts de génération et validation.

### Écarts bloquant une implémentation immédiate

- Aucun `CampaignStore` versionné ne réunit encore les états du monde, du personnage et de la narration.
- La fiche active repose encore sur `localStorage` et n'est pas importée comme instance de campagne.
- L'état de simulation mondiale vit principalement dans l'interface de simulation et n'est pas persisté avec une campagne.
- Le wiki utilise un parseur front matter local sans schéma narratif global ni version de contenu.
- Les PNJ narratifs, relations, connaissances, scènes et fils ne possèdent aucun runtime persistant.
- Le moteur tactique n'émet qu'un sous-ensemble des conséquences nécessaires au retour narratif.
- Le moteur de repos cible n'existe pas.
- La route actuelle `/api/narration` produit un résumé tactique; elle n'est pas l'orchestrateur futur.

### Conclusion d'audit

Toutes les données persistantes du scénario MVP ont désormais une autorité conceptuelle unique. Les absences constatées sont des écarts d'implémentation, pas des ambiguïtés d'architecture. Les schémas détaillés seront traités par les ateliers sur le modèle persistant, le contexte et les intégrations.
