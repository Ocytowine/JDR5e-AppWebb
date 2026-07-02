# Matrice de traçabilité et d'acceptation

Statut : `RETENU` — couverture P0 de l'atelier 12 auditée le 2026-07-02.

## Lecture

La matrice relie chaque famille d'exigences prioritaire aux décisions, contrats et scénarios observables. Les oracles sont :

- `D` : déterministe, comparaison exacte de l'état ou des événements;
- `S` : sémantique, intention, connaissance et cohérence;
- `Q` : qualitatif, revue humaine de la restitution;
- `R` : résilience ou sécurité;
- `P` : performance et capacité.

Un scénario peut couvrir plusieurs familles, mais aucune famille P0 ne repose uniquement sur le parcours vertical.

## Couverture P0

| Famille d'exigences | Décisions | Contrats principaux | Scénarios | Oracles et résultat observable |
|---|---|---|---|---|
| MJ IA créateur sous autorités explicites | NAR-001, 002, 014 à 017 | `Dossier-de-conception.md`, `Matrice-autorite.md` | 002, 006, 008, 021 | D/S — aucune mutation hors propriétaire; créations libres dans leur enveloppe |
| Saisie naturelle, méta et ambiguïté | NAR-008, 009, 022, 040 | `Dossier-de-conception.md`, `Pipeline-et-contrats-IA.md` | 001, 017 | D/S — question sans action; clarification puis reprise de l'intention |
| Reformulation et agence du joueur | NAR-009, 040, 065 | `Pipeline-et-contrats-IA.md`, `Exigences-non-fonctionnelles.md` | 001, 002, 017 | S/Q — forme adaptée, sens et consentement inchangés |
| Scènes, dialogues multiples et restitution UI | NAR-010, 012, 040 | `Dossier-de-conception.md`, `Pipeline-et-contrats-IA.md` | 002, 017 | D/Q — locuteur, saisie, expression et narration distinguables |
| Chronologie linéaire et reprise idempotente | NAR-007, 018, 020 à 023 | `Modele-persistant.md`, `Temps-et-monde-vivant.md` | 002, 013, 018, 020 | D/R — aucun retour joueur, doublon ou temps indu |
| Créations dynamiques et identité durable | NAR-004, 024 à 027 | `Creations-dynamiques.md`, `Coherence-intrigues.md` | 003, 006, 007, 016 | D/S — promotion justifiée, identité stable, doublon traité |
| Intrigues solvables, indices et fausses pistes | NAR-024, 025, 069 | `Coherence-intrigues.md`, `Scenarios-acceptation.md` | 006 | D/S/Q — vérité stable, fausse piste réfutable, perspectives respectées |
| Mémoire longue et rappel hybride | NAR-005, 006, 028 à 032 | `Memoire-et-rappel.md`, `Snapshot-et-contextes.md` | 003 à 006 | D/S — rappel paraphrasé pertinent, obsolescence et oubli respectés |
| Snapshot, budgets et séparation des secrets | NAR-003, 033 à 037, 064 | `Snapshot-et-contextes.md`, `Exigences-non-fonctionnelles.md` | 006, 015, 019 | D/R — socle intact, perspective minimale, secret absent |
| Validation, commit et narration après résultat | NAR-015, 038 à 041 | `Pipeline-et-contrats-IA.md`, `Modele-persistant.md` | 002, 011, 014 | D/R — rien avant validation; fallback post-commit sans rejeu |
| Personnage importé et projection compatible | NAR-019, 044, 045 | `Integration-domaines.md`, `Matrice-autorite.md` | 002, 008, 009 | D/S — fiche source distincte, projection sans mutation directe |
| Inventaire, conteneurs, monnaie et présentation | NAR-046, 049 | `Integration-domaines.md` | 009, 017 | D/S — transaction atomique; visible et social issus de l'état |
| Règles maison et arbitrage borné | NAR-042, 047 | `Regles-et-arbitrages.md`, `Pipeline-et-contrats-IA.md` | 008, 021 | D/S — règle versionnée prioritaire; précédent non promu en règle |
| Voyage et rencontres contextuelles | NAR-048 | `Integration-domaines.md`, `Temps-et-monde-vivant.md` | 010, 020 | D/S — durée réelle, rencontre reproductible et non imposée |
| Tactique et intégration unique | NAR-043, 050 | `Integration-domaines.md` | 002, 011, 014 | D/R — handoff sauvegardable; résultat intégré une fois |
| Repos segmenté et UX événementielle | NAR-011, 043, 051 | `Integration-domaines.md`, `Temps-et-monde-vivant.md` | 002, 012, 020 | D/Q — début/fin committés; interruption avant bénéfice |
| Monde hors écran et retour perceptif | NAR-053 à 057 | `Temps-et-monde-vivant.md` | 005, 007, 010, 020 | D/S — ordre causal, évolution justifiée, secrets invisibles |
| Persistance locale, migration et export | NAR-023, 052, 066 | `Modele-persistant.md`, `Exigences-non-fonctionnelles.md` | 013, NFR-001 | D/R/P — copie validée, campagne active intacte, capacité mesurée |
| Fournisseur, retries, circuit et fallback | NAR-041, 059 | `Resilience-securite-diagnostic.md` | 014 | D/R — tentatives bornées, sortie tardive ignorée, fallback certifié |
| Concurrence et double soumission | NAR-060 | `Resilience-securite-diagnostic.md` | 018 | D/R — écrivain unique, fencing et idempotencyKey effectifs |
| Injection, imports hostiles et secrets | NAR-035, 061 | `Resilience-securite-diagnostic.md`, `Snapshot-et-contextes.md` | 006, 019 | D/R — contenu sans autorité; rendu et diagnostic expurgés |
| Diagnostic et confinement des erreurs | NAR-058, 062 | `Resilience-securite-diagnostic.md` | 014, 018, 019 | D/R — incident corrélé; plus petit périmètre; lecture seule seulement si intégrité |
| Latence, qualité, coût et capacité | NAR-063 à 066 | `Exigences-non-fonctionnelles.md` | 004, 006, 015, 017, NFR-001 | P/S/Q — seuils mesurés; report financier visible et bloquant avant finalisation |

## Audit des scénarios

| Scénario | Risque principal | Contrat observable minimal |
|---|---|---|
| NAR-ACC-001 | question transformée en action | aucune commande, mutation, réaction ou avance temporelle |
| NAR-ACC-002 | intégration verticale incohérente | quatre checkpoints cohérents, créations libres et autorités préservées |
| NAR-ACC-003 | PNJ recréé ou omniscient | même identité, relation et connaissances justifiées après ellipse |
| NAR-ACC-004 | recherche limitée aux mots-clés | souvenir paraphrasé retrouvé sans voisins inutiles |
| NAR-ACC-005 | retour révélant le système secret | état actuel décrit depuis la dernière perception |
| NAR-ACC-006 | intrigue mouvante ou insoluble | vérité et graphe gelés, perspectives et réfutation conservées |
| NAR-ACC-007 | monde figé ou intrigue abstraite détruite | évolution causale sans révélation ni résolution arbitraire |
| NAR-ACC-008 | impossible traité comme difficile | rejet déterministe avant jet et commit |
| NAR-ACC-009 | transaction ou apparence inventée | atomicité et projection visible autoritaire |
| NAR-ACC-010 | rencontre forcée ou dupliquée | choix libre, temps validé et batch idempotent |
| NAR-ACC-011 | combat rejoué ou mal réintégré | handoff complet et résultat consommé une fois |
| NAR-ACC-012 | repos accordé par la prose | effets et signaux issus des événements de règles |
| NAR-ACC-013 | migration destructive ou rollback joueur | copie validée et continuité au dernier checkpoint |
| NAR-ACC-014 | panne convertie en succès partiel | aucune mutation pré-commit; fallback sûr post-commit |
| NAR-ACC-015 | troncature d'une contrainte critique | réduction ordonnée ou échec explicite |
| NAR-ACC-016 | duplication ou fusion abusive | réutilisation, fusion compatible ou rejet traçable |
| NAR-ACC-017 | reformulation changeant l'agence | enveloppe sémantique intacte et acteurs lisibles |
| NAR-ACC-018 | double mutation concurrente | un seul commit et intention obsolète non rejouée |
| NAR-ACC-019 | instruction hostile ou fuite | import rejeté, données inertes, secrets expurgés |
| NAR-ACC-020 | ordre temporel instable | même ordre, frontières explicites et batch unique |
| NAR-ACC-021 | connaissance D&D remplaçant la règle maison | version locale prioritaire et arbitrage non promu |
| NFR-ACC-001 | campagne longue non viable | seuils de capacité, reprise, migration et performance vérifiés |

## Résultat de l'audit de couverture

- Toutes les familles P0 identifiées dans les ateliers 1 à 11 possèdent au moins une décision, un contrat et un scénario.
- Les domaines critiques ne reposent pas uniquement sur une évaluation de prose.
- Créativité et continuité d'intrigue sont testées séparément.
- Sécurité, concurrence et ordre temporel disposent de cas dédiés en plus du parcours nominal.
- Le profil financier `balanced` et l'équilibrage des modèles restent reportés au benchmark fournisseur accepté; ils ne sont pas présentés comme mesurés.
- Les fixtures, schémas exécutables et jeux de données seront produits avec le runtime; les oracles normatifs sont définis ici.
