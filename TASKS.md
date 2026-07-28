# Tableau de bord du projet

Dernière mise à jour : 2026-07-28

Ce fichier ne contient que le travail actif, la prochaine décision et les blocages.
L'état détaillé du module narration, ses principes et sa feuille de route sont dans
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).

## Étape active

- [x] Étape 0 — remettre la documentation narration à plat :
  - une seule source de reprise ;
  - un index séparant contrats actifs et archives ;
  - suppression des anciens suivis concurrents ;
  - feuille de route ordonnée et méthode de travail explicite.
- [x] Lot 1 — stabiliser et certifier le parcours sémantique V5 :
  - gate déterministe de huit tours ;
  - focus récent, clarification, changement d'interlocuteur et transition ;
  - recettes OpenAI Archives et arrière-salle ;
  - métriques séparées par rôle et build global validé.
- [x] Lot 2 — générer au build un catalogue lore narratif ciblé :
  - compilation du wiki retirée du navigateur ;
  - provenance, niveaux de connaissance et budget explicites ;
  - dimensions absentes laissées ouvertes à une création compatible ;
  - topologie et commits maintenus sous autorité locale ;
  - configuration `scene_creator` benchmarkée appliquée.
- [x] Lot 3 — étendre les conversations PNJ longues et leur mémoire courte :
  - identité et voix isolées par acteur, sans liste de fixtures ;
  - cinq couples joueur → réponse exacte au maximum par PNJ ;
  - changement d'interlocuteur et sortie-retour de scène validés ;
  - paroles maintenues comme projections attribuées, sans vérité ni engagement
    durable automatique ;
  - métriques OpenAI séparées entre interpréteur, performer et critique.
- [x] Lot 4 — ouvrir une autorité mission/relation bornée :
  - proposition et résolution persistées dans un registre propriétaire ;
  - acceptation, refus, condition et incertitude conservés distinctement ;
  - confirmation émise uniquement par une autorité de quête ou sociale valide ;
  - promotion durable précédée d'une relecture de cette confirmation ;
  - commits atomiques et rejeu idempotent validés.
- [x] Lot 5 — surcharger le lore auteur par l'état validé de campagne :
  - registre propriétaire distinct du catalogue de build ;
  - remplacement et masquage déterministes avec provenance ;
  - lecture historique bornée par la révision de campagne ;
  - même vue effective pour les scènes lore et le `scene_creator` ;
  - immutabilité du catalogue, atomicité et idempotence prouvées.

## Prochain lot narration

- [x] Lot 6 — audit et redécoupage des scénarios 005 à 009 :
  - dépendances confrontées aux runtimes et tests actuels ;
  - repos retenu comme premier vertical ;
  - orchestrateur 005 découpé en hooks sans autorité métier ;
  - social placé avant le noyau d'intrigue et ses événements cachés ;
  - progression puis bastion ordonnés selon leurs propriétaires.
- [ ] Sous-lot 6A — raccorder le repos narratif minimal :
  - ouvrir la capacité `rest` sur une intention sémantique explicite ;
  - poser uniquement les choix réellement manquants ;
  - raccorder contrôleur, processus segmenté, temps et continuation narrative ;
  - empêcher tout bénéfice avant validation personnage/inventaire ;
  - couvrir interruption, restauration et rejeu dans le navigateur.

## Lots suivants

1. 6B — premier hook de l'orchestrateur avec le résultat de repos.
2. 6C — état social durable et connaissances par acteur.
3. 6D — noyau d'intrigue, révélations et événements cachés.
4. 6E — progression narrative.
5. 6F — bastion.

## Autres chantiers

- [ ] Consolider la simulation du monde après les objectifs multi-phases, les
  opportunités de faction et les mobiles non-système.
  Référence :
  [`world-simulation-corrective-roadmap.md`](test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md).

## Blocages et reports explicites

- Les tests de compétence attendent une projection mécanique stable du créateur
  de personnage, sans rendre le noyau narration dépendant de son implémentation.
- Les jonctions jouables avec le tactique, l'inventaire et les scénarios 005 à
  009 restent différées jusqu'à l'existence de leurs autorités propriétaires.
- `npm audit --omit=dev` signale une vulnérabilité transitive existante dans
  `@xmldom/xmldom` via PixiJS ; elle doit être traitée séparément avant une
  livraison publique.

## Dernier point de contrôle

- Le 2026-07-28, les changements de campagne peuvent remplacer ou masquer une
  influence lore sans modifier le catalogue auteur. L'audit suivant retient le
  repos comme premier vertical et place explicitement les intrigues cachées
  après le routeur d'événements et l'état social.

## Règle de mise à jour

À la fin d'un lot, remplacer son entrée par le prochain lot concret. Ne pas
accumuler ici le journal des tâches terminées : les contrats, matrices de preuve,
tests et l'historique Git conservent ces informations.
