# Règles, variantes maison et arbitrages

Statut : `RETENU` — gouvernance conceptuelle définie; inventaire exhaustif des règles et schémas à produire avant l'implémentation du runtime.

## Objectif

Permettre au logiciel, à l'IA et au développeur de parler exactement du même système de jeu. Le projet s'inspire notamment de D&D 5e, mais aucune connaissance générale du modèle sur D&D ne constitue une règle active de la campagne.

## Source de vérité

Une règle applicable doit exister dans le `RuleRegistry` du ruleset épinglé par la campagne. Chaque entrée possède au minimum :

- identifiant stable et version;
- titre et formulation normative;
- type : invariant système, règle générale, règle maison, règle spécifique de contenu ou configuration de campagne;
- domaine propriétaire;
- conditions d'application et paramètres;
- effet structuré ou contrat d'arbitrage;
- références explicitement remplacées ou spécialisées;
- exemples et contre-exemples;
- cas limites connus;
- statut : brouillon, actif, déprécié ou remplacé;
- tests ou scénarios d'acceptation associés.

Les textes explicatifs facilitent la compréhension, mais les champs structurés et scénarios décident ce qui est vérifiable.

## Résolution des conflits

Le système n'invente pas une priorité à partir du nom ou de l'origine d'une règle.

1. Les invariants techniques empêchent les états impossibles et la corruption des données.
2. Une règle spécifique s'applique dans son périmètre à la place d'une règle générale.
3. Une règle maison ne remplace une règle de base que si cette relation est déclarée explicitement.
4. La configuration épinglée de campagne choisit les variantes activées.
5. Deux règles actives encore contradictoires provoquent une erreur de ruleset ou un arbitrage explicite; elles ne sont pas départagées silencieusement par l'IA.

Les entrées utilisent donc `overrides[]`, `specializes[]`, `incompatibleWith[]` et des conditions de portée plutôt qu'une simple priorité numérique globale.

## Projection vers l'IA

Le `rules_adjudicator` reçoit uniquement les règles utiles au cas, avec identifiants, versions, portée et précédents comparables. Il doit citer les règles utilisées dans sa sortie.

Il lui est interdit :

- de compléter une règle depuis sa connaissance générale de D&D;
- d'affirmer qu'une convention courante est active sans identifiant de règle;
- de transformer un exemple en obligation générale;
- de masquer un vide de règle sous une fausse citation;
- de promouvoir seul un arbitrage en règle officielle.

Si aucune règle active ne suffit, la sortie porte `AD_HOC_RULING` et décrit clairement les hypothèses prises.

## Précédents de campagne

Un `AdjudicationRecord` accepté peut être rappelé pour traiter un cas analogue. Il améliore la cohérence d'une campagne, mais reste distinct du `RuleRegistry`.

Une répétition de précédents peut justifier la rédaction d'une nouvelle règle maison. Cette promotion est une modification explicite du ruleset, accompagnée d'une version et de scénarios de test; elle n'est jamais automatique pendant une partie.

## Changements de règles

Une campagne épingle sa version de ruleset. Modifier une règle exige :

1. nouvelle version de la règle et du ruleset;
2. analyse des données et calculs affectés;
3. migration déterministe ou décision de conserver l'ancienne version pour la campagne;
4. nouveaux tests de cas normal, limites et régression;
5. journal de migration consultable.

Le changement ne réécrit pas les événements historiques. Les décisions futures utilisent la version migrée à partir du commit de migration.

## Format de clarification entre développeur et système

Toute règle encore incertaine est consignée comme `OpenRuleQuestion` avec :

- question précise;
- exemples contradictoires;
- domaines affectés;
- comportement provisoire éventuel;
- personne ou décision attendue;
- blocage ou non de l'implémentation.

Une hypothèse discutée oralement ne devient pas une règle tant qu'elle n'est pas inscrite et validée.

## Définition de règle prête à implémenter

- formulation normative non ambiguë;
- portée et exceptions explicites;
- données d'entrée et effets identifiés;
- propriétaire et autorité définis;
- conflits et remplacements déclarés;
- exemples positifs et négatifs;
- stratégie pour les cas non couverts;
- scénarios de test associés;
- version incluse dans un ruleset.
