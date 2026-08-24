# Tableau d'exécution du projet

Dernière mise à jour : 2026-08-24

Ce fichier reste volontairement court. L'unique état global et feuille de route
du module narration est
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
Les contrats définissent les comportements ; le plan J10 porte le détail du lot.

## Lot actif — J10 : intégration narrative immersive

J1 à J9 sont fermés dans leur périmètre narratif. J10 rend leur verticale
entièrement pilotable dans l'interface sans transformer le jeu en tableau de
gestion. Voir
[`Plan-integration-narrative-immersive-J10.md`](test-GAME-2D/narration-module/docs/Plan-integration-narrative-immersive-J10.md).

- [x] J10-A — contrats du carnet privé, du récapitulatif public et de
  l'interruption narrative figés ; projections, huit sorties IA, migrations et
  traces UI auditées ; garde-fou exécutable actif.
- [x] J10-B — départ, poursuite, interruption persistée, réponse, reprise et
  arrivée raccordés à la saisie libre ; temps, processus, position et rejeux
  restent autoritaires, sans carte ni commande UI.
- [x] J10-C — politiques de recrutement et d'autonomie installées ; demandes,
  refus, séparation et réunion passent par le dialogue avec le PNJ visible,
  sans panneau de commande, jauge privée ou popup de quête.
- [x] J10-D — carnet privé multi-intercalaires livré dans une base IndexedDB
  séparée, avec autosauvegarde, restauration, conflits de révision et exclusion
  certifiée des autorités de campagne, du MJ et de tous les contextes IA.
- [ ] J10-E — ajouter le récapitulatif public structuré et l'inventaire compact
  en lecture seule, sans secret ni mutation directe.
- [ ] J10-F — masquer les traces techniques par défaut et certifier dans
  Chromium le parcours complet depuis les seules interactions joueur.
- [ ] J10-G — recette OpenAI courte uniquement après passage local et nouvel
  accord explicite.

### Prochaine action concrète

Ouvrir J10-E : composer le récapitulatif de reprise et les aides-mémoire depuis
les seules projections publiques, puis ajouter un inventaire compact strictement
en lecture seule sans note privée, secret ou mutation métier.

## Dernier point de contrôle

- J1 à J9 sont fermés dans leur périmètre narratif ; la matrice finale distingue
  toujours la verticale narrative du chantier tactique différé.
- J9-C certifie la campagne continue dans Chromium et IndexedDB avec reprise et
  rejeux critiques sans doublon.
- J9-D certifie cinq familles de tours OpenAI live : treize appels HTTP 200,
  ordre canonique, rôles uniques et budget respecté.
- Les régressions ciblées, le build global et `git diff --check` sont verts au
  dernier point de contrôle.
- J10-B certifie Archives → Halles depuis la saisie libre, avec interruption
  restaurée, réponse libre, reprise, arrivée et rejeux sans second temps.
- J10-C installe la verticale J4/J7 dans la composition UI et certifie refus de
  recrutement, recrutement autorisé, autonomie, séparation, réunion et rejeu via
  `npm run narration-module:test:j10c-companions`.
- J10-D certifie opérations, limites, conflits, isolement des portées, réouverture
  IndexedDB et absence de fuite réseau/IA via
  `npm run narration-module:test:j10d-notebook`.

## Blocages et reports explicites

- Les tests de compétence attendent toujours une projection mécanique stable du
  créateur de personnage.
- Les compagnons tactiques et la surprise restent refusés par la projection
  actuelle. Le contrôle direct reste fermé sans capacité mécanique autoritaire.
- La génération de carte, le placement multi-acteurs et la reprise de
  `GameBoard` restent dans le chantier tactique futur décrit par le guide J8.
- La consolidation interne du moteur de simulation reste suivie dans
  [`world-simulation-corrective-roadmap.md`](test-GAME-2D/map-module/docs/world-simulation-corrective-roadmap.md).
- `npm audit --omit=dev` signale une vulnérabilité transitive existante dans
  `@xmldom/xmldom` via PixiJS, à traiter avant livraison publique.

## Règle de mise à jour

À la fermeture d'une tâche, ne conserver ici que le lot actif, sa prochaine
action et les blocages. Mettre à jour la consolidation seulement si l'état
global, l'ordre des lots ou leurs critères changent. Ne créer aucun commit sans
demande explicite.
