# Matrice de couverture des scénarios narratifs

Date : 2026-07-07

Statut : `ARCHIVE_HISTORIQUE` — couverture observée avant la fermeture des lots
ultérieurs ; ne pas utiliser ses états pour planifier.

## Objectif

Cette matrice vérifiait, à sa date, que les scénarios `NAR-ACC-001` à
`NAR-ACC-021` restaient couverts sans court-circuiter l'ordre alors actif.

Elle ne crée aucune autorisation d'implémentation et ses mentions de prochains
lots sont historiques. La couverture actuelle doit être confrontée au code,
aux contrats actifs et à la feuille de route canonique.

Règle de lecture :

```text
La matrice de couverture contrôle la roadmap.
Elle ne remplace pas la roadmap.
```

## États de couverture

- `COUVERT_CONTRACTUEL` : le comportement possède des types, contrats et tests déterministes dans le périmètre déjà livré.
- `PARTIEL` : un ou plusieurs socles existent, mais le scénario complet dépend encore d'un domaine, d'une fixture ou d'un lot futur.
- `NON_OUVERT` : le scénario dépend d'une capacité encore fermée.
- `CERTIFICATION` : le scénario est surtout une preuve intégrée ou qualitative à exécuter après les lots fonctionnels.

## Vue synthétique

| Scénario | Couverture actuelle | Socles déjà présents | Manques principaux | Lot responsable probable |
|---|---|---|---|---|
| NAR-ACC-001 — question hypothétique face au garde | `PARTIEL` | I-06E/I-06F : possibilité sans action, temps nul, pas de commit | scène réelle avec garde/objets perceptibles; réponse de possibilité contextuelle | I-06/I-08 selon fixture |
| NAR-ACC-002 — parcours vertical Archives | `PARTIEL` | I-00 à I-07 audit couvrent plusieurs checkpoints | PNJ, intrigue, scène réelle, tactique/repos jouables, mémoire longue intégrée | I-08 certification verticale après I-07+PNJ+intrigue |
| NAR-ACC-003 — PNJ créé, promu et retrouvé | `PARTIEL` | I-05A : propositions de création; I-04 : mémoire/contexte; I-03 : ellipse/temps | domaine acteur narratif, promotion persistante, identité PNJ en campagne | futur lot PNJ/créations persistantes |
| NAR-ACC-004 — souvenir paraphrasé | `PARTIEL` | I-04 : mémoire sourcée, rappel, budget, obsolescence | intégration au tour réel et historique long produit par la campagne | futur lot snapshot réel/mémoire intégrée |
| NAR-ACC-005 — retour dans lieu transformé | `PARTIEL` | I-03 : monde/temps; I-04 : dernière perception et contexte; lore I-02 | scène réelle, état de lieu courant, comparaison perception passée/présente | futur lot scène réelle + monde local |
| NAR-ACC-006 — intrigue cohérente | `PARTIEL` | I-05A : création contrôlée; docs intrigue; I-04 : secrets/perspective | domaine intrigue, promotion, fixtures de vérité cachée, critic/coherence | futur lot intrigue dynamique |
| NAR-ACC-007 — événement ignoré hors écran | `PARTIEL` | I-03 : simulation monde sur copie, échéances, voyage; I-04 : visibilité | événement local/narratif promu et restitution perceptive | futur lot monde local/scène |
| NAR-ACC-008 — action mécaniquement impossible | `PARTIEL` | I-02 : ruleset/RuleRegistry; I-06F : handoff/refus borné | résolution mécanique réelle reliée au domaine action/règles | futur lot rules adjudication/action |
| NAR-ACC-009 — inventaire, apparence, commerce | `PARTIEL` | I-02 : import, projections tactique/narrative, règles; docs inventaire | domaine inventaire/économie, transaction atomique réelle, apparence visible dynamique | futur lot inventaire/commerce |
| NAR-ACC-010 — voyage et rencontre contextuelle | `PARTIEL` | I-03D : voyage, pression, candidat déterministe; I-03 : temps/monde | scène de rencontre jouable, promotion éventuelle, interaction libre complète | futur lot voyage-scène/rencontre |
| NAR-ACC-011 — passage tactique et retour | `PARTIEL` | I-06F : détection handoff; I-07 audit : contrat seed/outcome/intégration | types/validateurs I-07A, puis adaptation plateau réel | I-07A puis sous-lots tactiques |
| NAR-ACC-012 — repos interrompu | `PARTIEL` | I-07 audit : contrat rest seed/outcome/signaux; I-03 : temps/processus | types/validateurs I-07A, moteur repos réel, règles de bénéfices | I-07A puis sous-lots repos |
| NAR-ACC-013 — sauvegarde et migration | `COUVERT_CONTRACTUEL` | I-01 : IndexedDB, migrations, rollback, reprise; I-06L : fil visible restauré | benchmark complet NFR et migration de versions futures réelles | I-08/NFR |
| NAR-ACC-014 — panne IA avant/après commit | `PARTIEL` | I-05A/B : retries/incidents; I-06G/J : fallback; I-06K : incidents rendus persistés | orchestration complète pré-commit/post-commit avec tous rôles critiques | I-08 certification + futurs rôles |
| NAR-ACC-015 — contexte supérieur au budget | `COUVERT_CONTRACTUEL` | I-04 : contexte, budget, obsolescence, secret, diagnostics | mesure capacité sur corpus long et rôle réel certifié | I-08/NFR |
| NAR-ACC-016 — création contradictoire ou doublon | `PARTIEL` | I-05A : propositions dynamiques, similarité/doublon au niveau contrat | registre réel d'entités promues, fusion/rejet en campagne | futur lot créations persistantes |
| NAR-ACC-017 — reformulation fidèle et UI multi-acteur | `PARTIEL` | I-06A/B/G/J : DisplayPacket, UI multi-locuteur, expression PJ IA, OpenAI opt-in | vrais PNJ multi-dialogue et scène sociale complète | futur lot social/PNJ + I-08 UX |
| NAR-ACC-018 — double soumission/concurrence | `COUVERT_CONTRACTUEL` | I-00/I-01 : idempotence, writer lease, fencing; I-06D/F : idempotence client | scénario intégré multi-onglets réel dans surface campagne | I-08 intégration |
| NAR-ACC-019 — contenu hostile, import et secret | `PARTIEL` | I-02 : import contrôlé; I-04 : secrets; I-05A/B : incidents expurgés; I-06 UI sans clé | corpus hostile intégré multi-source et export diagnostic | I-08 sécurité |
| NAR-ACC-020 — échéances simultanées | `COUVERT_CONTRACTUEL` | I-03A/B/D : horloge, schedule, batch idempotent, frontières | combinaison avec repos réel et événement monde complet | I-07A/I-08 |
| NAR-ACC-021 — règle maison/arbitrage ouvert | `PARTIEL` | I-02 : RuleRegistry versionné; I-05A : rôle IA borné; I-06F : handoff règles | `rules_adjudicator` réel et `AdjudicationRecord` committable | futur lot règles/arbitrage |

## Lecture par groupes de priorité

### Groupe A — Socle déjà robuste

Ces scénarios possèdent une couverture contractuelle forte, mais devront être rejoués en intégration finale :

- NAR-ACC-013 — sauvegarde et migration;
- NAR-ACC-015 — contexte supérieur au budget;
- NAR-ACC-018 — double soumission/concurrence;
- NAR-ACC-020 — échéances simultanées.

Risque principal : croire qu'ils sont certifiés produit. Ils sont solides au niveau socle, mais pas encore rejoués dans le parcours complet.

### Groupe B — Prochains débloqués par I-07A

Ces scénarios justifient de maintenir I-07A comme prochain lot d'implémentation :

- NAR-ACC-011 — passage tactique et retour;
- NAR-ACC-012 — repos interrompu;
- NAR-ACC-020 — interaction entre repos et échéances;
- checkpoint C/D de NAR-ACC-002.

I-07A doit rester contractuel : seeds, outcomes simulés, intégration idempotente. Il ne doit pas encore devenir une réécriture du plateau ou du moteur repos.

### Groupe C — Nécessitent domaines narratifs encore fermés

Ces scénarios sont importants, mais ne doivent pas précéder I-07A :

- NAR-ACC-003 — PNJ persistants;
- NAR-ACC-006 — intrigue cohérente;
- NAR-ACC-016 — doublons/créations persistantes;
- NAR-ACC-021 — arbitrage de règles ouvert.

Ils exigent des domaines propriétaires supplémentaires. Les ouvrir maintenant risquerait de refaire les erreurs des essais précédents : IA expressive sans vérité structurée suffisante.

### Groupe D — Nécessitent scène/snapshot réels

Ces scénarios dépendent de la connexion entre la surface prototype et une campagne réelle :

- NAR-ACC-001 — garde et clés réellement perceptibles;
- NAR-ACC-004 — rappel depuis historique réel;
- NAR-ACC-005 — retour dans lieu transformé;
- NAR-ACC-007 — événement ignoré et restitution perceptive;
- NAR-ACC-010 — rencontre de voyage jouable;
- NAR-ACC-017 — vrais multi-acteurs.

Ils ne sont pas bloquants pour I-07A, mais deviennent critiques avant une démonstration verticale crédible.

### Groupe E — Certification finale et sécurité intégrée

Ces scénarios croisent plusieurs couches et doivent rester dans I-08 ou dans des sous-lots de certification :

- NAR-ACC-002 — parcours vertical Archives;
- NAR-ACC-014 — pannes IA complètes;
- NAR-ACC-019 — contenu hostile multi-source;
- NFR-ACC-001 — résistance longue.

## Conclusion de pilotage

La roadmap n'est pas perturbée.

La revue confirme que le prochain lot logique reste :

```text
I-07A — types, validateurs, fixtures et intégration idempotente simulée des handoffs tactique/repos.
```

Raisons :

- I-07A débloque deux scénarios structurants (`011`, `012`) et les checkpoints C/D du vertical `002`;
- I-07A s'appuie sur des contrats déjà audités, sans dépendre du MJ complet;
- les scénarios PNJ, intrigue, commerce, règles ouvertes et scène réelle restent identifiés, mais ne doivent pas être ouverts avant d'avoir sécurisé les processus tactique/repos.

La prochaine action ne change donc pas :

```text
Implémenter I-07A dans le périmètre déjà autorisé par tactical-rest-handoff/1.
```
