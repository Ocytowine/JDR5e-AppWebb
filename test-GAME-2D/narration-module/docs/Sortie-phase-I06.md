# Sortie de phase I-06 — scène, social et interface conversationnelle

Date : 2026-07-08
Statut : `ARCHIVE_HISTORIQUE`

Ce document décrit la sortie de phase telle qu'elle était décidée le
2026-07-08. Ses « prochaines étapes » ne sont plus actives ; voir
[`Consolidation-fondations-narration.md`](Consolidation-fondations-narration.md).

## Décision

I-06 est considéré livré dans son périmètre de prototype narratif sûr, mais pas prêt à être généralisé comme moteur de MJ complet.

La phase a validé le socle technique : surface narration, affichage accessible, pipeline de rendu, enrichissement IA borné, persistance des projections, scène jouable minimale, mémoire courte PNJ, intégration wiki minimale, créations éphémères contrôlées, gate intrigue et badges UX.

La phase a aussi exposé une limite structurante : l'interprétation d'intention actuelle reste déterministe et trop dépendante de formulations exactes. Elle ne doit pas être étendue par accumulation de règles lexicales.

La prochaine capacité narrative à ouvrir doit donc traiter l'interprétation naturelle de l'intention joueur par un rôle IA structuré, avec validation locale stricte et sans donner à l'IA l'autorité de commit.

## Livré par I-06

- Types de scène, social, blocs visibles, transcript et `DisplayPacketV1`.
- Interface React pure `NarrativeConversationPanel`.
- Surface narration dédiée distincte du plateau tactique.
- Contrôleur de tour narratif prototype avec idempotence.
- Interprétation conservatrice, clarifications et réponses sans commit.
- Résolution narrative bornée, commit limité d'actes de parole et handoffs.
- Enrichissement IA du rendu visible sans autorité métier.
- OpenAI opt-in côté serveur, jamais appelé directement depuis le navigateur.
- Persistance des projections de rendu et reconstruction du fil visible.
- Scène de référence `reference-inn-rain-001`.
- Paquet IA `scene_writer` ancré dans la scène.
- État minimal de scène `scene.state`.
- Mémoire courte PNJ bornée.
- Scénario vertical qualité.
- Corrections qualité ciblées.
- Contrat de scène jouable minimal.
- Adaptation d'un lieu wiki en scène jouable sans révéler les secrets.
- Créations éphémères contrôlées sans promotion durable.
- Gate de préparation intrigue sans création d'intrigue.
- Badges UX accessibles pour rôles et statuts critiques.

## Garanties stabilisées

- Une clarification ne produit pas de commit métier.
- Une réponse sans commit ne fait pas avancer le temps de jeu.
- Les questions de possibilité ne déclenchent pas l'action évoquée.
- Le texte IA n'est pas autorité de vérité, de commit, de temps, d'inventaire, de tactique ou de lore durable.
- Les secrets wiki ne sont pas envoyés à la scène jouable ni au `scene_writer`.
- Les créations éphémères restent transitoires et non promues.
- Les erreurs ou sorties invalides OpenAI dégradent vers fallback local.
- L'interface expose les rôles et statuts sans dépendre uniquement de la couleur.
- Le module carte reste hors autorité narrative; les handoffs tactique/repos réels restent des contrats différés.

## Limites assumées

- Pas de MJ complet de campagne.
- Pas de mémoire sociale générique multi-PNJ.
- Pas de lecteur UX complet d'historique.
- Pas de sélection dynamique complète de scène depuis le wiki.
- Pas de création durable automatique de PNJ, lieu, objet, intrigue ou lore.
- Pas de révélation contrôlée complète des secrets.
- Pas de graphe d'intrigue dynamique.
- Pas de tactique jouable branchée au plateau réel.
- Pas de repos jouable complet côté UI.
- Pas de progression de personnage.
- Pas de certification qualité OpenAI live obligatoire.

## Défaut confirmé sur l'interprétation d'intention

Observation manuelle confirmée le 2026-07-08 :

```text
Je m’approche du garde et je lui demande s’il a vu quelque chose d’étrange.
```

Résultat actuel du contrôleur :

```text
intentType: unclear_commitment
commitment: unclear
requiresClarification: true
resultKind: CLARIFICATION_REQUIRED
noCommit: true
noGameTime: true
```

Le système reconnaît pourtant correctement des variantes proches :

```text
Je demande au garde ce qui s’est passé.
Je m’approche du garde et je demande au garde s’il a vu quelque chose d’étrange.
```

Diagnostic :

- le défaut ne vient pas de l'UX I-06W;
- le défaut ne vient pas d'OpenAI;
- le défaut vient de l'interpréteur déterministe `intent-clarification/1`;
- la formulation pronominale `je lui demande` n'est pas comprise comme parole explicite;
- ce problème est représentatif d'une limite plus large : une variation de formulation peut changer l'interprétation.

Ce défaut est bloquant pour une narration naturelle, mais il ne remet pas en cause les garde-fous de sécurité livrés par I-06.

## Décision anti-rustine

Il est interdit de traiter ce défaut par simple ajout de formulations dans une liste de regex.

Une correction locale du type `ajouter je lui demande` améliorerait un cas, mais laisserait intact le problème structurel. La suite doit séparer :

```text
compréhension naturelle de l'intention
→ proposition structurée par IA
→ validation locale stricte
→ résolution propriétaire
→ commit uniquement par le code autorisé
```

L'IA peut proposer une interprétation. Elle ne doit jamais :

- committer une action;
- faire avancer le temps;
- créer du lore durable;
- révéler un secret;
- résoudre un combat;
- modifier l'inventaire;
- accorder un résultat social mécanique;
- décider seule d'un handoff propriétaire.

## Suite recommandée

Ouvrir un lot dédié avant toute généralisation du MJ :

```text
I-06X — Interprétation IA structurée de l'intention joueur
```

Objectif :

- introduire un rôle IA spécialisé, par exemple `player_intent_interpreter`;
- produire une intention structurée validée localement;
- reconnaître des familles de formulations équivalentes;
- conserver une clarification uniquement pour les vraies ambiguïtés;
- maintenir les commits et les domaines propriétaires côté code.

Sortie cible illustrative :

```json
{
  "intentType": "speech",
  "target": "npc:garde",
  "action": "ask",
  "topic": "ce qu'il a vu d'étrange",
  "commitment": "committed",
  "requiresClarification": false,
  "confidence": "high"
}
```

Exemples qui devront être équivalents :

```text
Je demande au garde ce qu’il a vu.
Je lui demande ce qu’il a vu.
Je m’approche du garde et je lui demande ce qu’il a vu.
Je vais vers le garde pour lui demander ce qu’il a vu.
Je questionne le garde sur ce qu’il a vu.
```

Exemples qui doivent rester clarifiés ou bornés :

```text
Lui voler quelque chose ?
Je pourrais peut-être entrer ?
Je convaincs le garde de me laisser passer.
```

## Tests attendus pour I-06X

I-06X devra ajouter une matrice de robustesse linguistique avec des familles de phrases, pas seulement des cas isolés.

Familles minimales :

- parole adressée à un PNJ;
- observation;
- question de possibilité;
- question méta;
- action explicite;
- action risquée;
- demande d'information;
- tentative sociale avec résultat mécanique implicite;
- action mixte;
- formulation elliptique réellement ambiguë.

Chaque famille devra vérifier :

- intention normalisée attendue;
- cible si identifiable;
- engagement `committed`, `hypothetical`, `none` ou `unclear`;
- besoin ou non de clarification;
- absence de commit direct par l'IA;
- maintien des handoffs propriétaires.

## Autorisation actuelle après cadrage

I-06 reste clos dans son périmètre prototype sûr.

La prochaine étape narrative autorisée est le cadrage puis l'implémentation limitée d'I-06X. I-08, le MJ complet, les intrigues dynamiques, la mémoire sociale générique et les handoffs jouables restent fermés tant que l'interprétation d'intention robuste n'est pas traitée.
