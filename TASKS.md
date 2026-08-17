# Tableau d'exécution du projet

Dernière mise à jour : 2026-08-17

Ce fichier reste volontairement court. L'unique état global et feuille de route
du module narration est
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
Les contrats définissent les comportements ; les passations, audits, plans et
matrices datées n'ordonnent plus le travail.

## Lot actif — J1 : consolidation joueur ↔ MJ

- [x] Créer avec les propriétaires une projection publique typée des
  connaissances et états observables utiles au personnage :
  - [x] figer les champs publics et leurs sources autoritaires ;
  - [x] exclure fiche mécanique complète, secrets et inventaire privé ;
  - [x] fournir les réponses déterministes à « où suis-je ? », « qui est
    présent ? » et « que sais-je ? » ;
  - [x] intégrer la projection à l'empreinte de contexte et à la reprise.
- [x] Auditer les frontières automatiques après chaque famille de tour :
  action, dialogue, monde, intrigue, initiative PNJ, temps, progression,
  bastion et tactique.
- [ ] Centraliser dans le contrôleur l'ordre des réactions automatiques, puis
  remplacer les appels dispersés de l'interface.
- [ ] Étendre la qualité multi-tours hors du pilote Archives : continuité de
  scène, variété, rythme, conséquences perceptibles et restitution de la main.
- [ ] Consolider les événements naturels de la simulation du monde dans une
  campagne, sans signal local artificiel.

### Prochaine action concrète

Implémenter l'orchestration unique décrite dans
[`Contrat-frontieres-automatiques-J1.md`](test-GAME-2D/narration-module/docs/Contrat-frontieres-automatiques-J1.md),
puis migrer un premier parcours sans modifier les autorités existantes.

## Prochain lot

J2 étendra la verticale officielle `NAR-ACC-002` dans le build principal. Il ne
commence qu'après fermeture de J1. Les lots J2 à J9 et leurs critères sont
ordonnés uniquement dans la feuille de route canonique.

## Dernier point de contrôle

- Lots narration 0 à 9 fermés dans leur périmètre.
- Contrôles d'accès A à F certifiés.
- Transition OpenAI Archives → Place des Archives certifiée et restaurable.
- Conversation OpenAI de quatre tours avec le clerc certifiée et restaurable.
- Rejeu social après promotion et identités longues de témoignage corrigés.
- Matrice propriétaire inventaire/progression/bastion/tactique figée ; seules
  les capacités spécialisées réellement raccordées sont annoncées disponibles.
- Contexte public joueur J1 livré : lieu, présences visibles, équipement visible
  et connaissances acquises, avec réponses locales sans temps de jeu.
- Build global et régressions ciblées verts au dernier point de contrôle.

## Blocages et reports explicites

- Les tests de compétence attendent toujours une projection mécanique stable du
  créateur de personnage.
- La transaction générique de monnaie, matériaux et inventaire de campagne
  manque ; aucun coût ne doit devenir gratuit.
- Le voyage lointain complet reste non ouvert ; seules les transitions locales
  sont jouables.
- Le compagnon n'a encore ni contrat durable, ni appartenance au groupe, ni
  directives, ni déplacement de groupe.
- Les compagnons contrôlables et la surprise restent refusés par la projection
  tactique actuelle.
- La consolidation interne du moteur de simulation reste suivie dans
  [`world-simulation-corrective-roadmap.md`](test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md) ;
  ce document du module carte ne remplace pas la roadmap narration.
- `npm audit --omit=dev` signale une vulnérabilité transitive existante dans
  `@xmldom/xmldom` via PixiJS, à traiter séparément avant livraison publique.

## Règle de mise à jour

À la fermeture d'une tâche, ne conserver ici que le lot actif, sa prochaine
action et les blocages. Mettre à jour la consolidation seulement si l'état
global, l'ordre des lots ou leurs critères changent. Ne créer aucun commit sans
demande explicite.
