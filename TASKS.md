# Tableau d'exécution du projet

Dernière mise à jour : 2026-08-21

Ce fichier reste volontairement court. L'unique état global et feuille de route
du module narration est
[`Consolidation-fondations-narration.md`](test-GAME-2D/narration-module/docs/Consolidation-fondations-narration.md).
Les contrats définissent les comportements ; les passations, audits, plans et
matrices datées n'ordonnent plus le travail.

## Lot actif — J8 : cadrage du compagnon tactique

- [ ] Auditer les contrats tactiques, la graine `GameBoard` et l'intégration des
  conséquences avant de définir la projection d'un compagnon.
- [ ] Écrire le contrat J8 : contrôle, autonomie, placement, initiative, tour,
  ressources, blessures, fuite, incapacité et retour narratif.
- [ ] Implémenter seulement après validation de ce contrat.

### Prochaine action concrète

Relire les briques tactiques existantes et écrire le contrat J8 sans injecter
encore de compagnon dans `GameBoard`.

## Lots suivants

J8 traite la projection tactique du compagnon, puis J9 certifie le parcours
complet.

## Dernier point de contrôle

- Anciens lots narration 0 à 9 fermés dans leur périmètre historique.
- Contrôles d'accès A à F certifiés.
- Transition OpenAI Archives → Place des Archives certifiée et restaurable.
- Conversation OpenAI de quatre tours avec le clerc certifiée et restaurable.
- Rejeu social après promotion et identités longues de témoignage corrigés.
- Matrice propriétaire inventaire/progression/bastion/tactique figée ; seules
  les capacités spécialisées réellement raccordées sont annoncées disponibles.
- Contexte public joueur J1 livré : lieu, présences visibles, équipement visible
  et connaissances acquises, avec réponses locales sans temps de jeu.
- Orchestration automatique J1 livrée : monde, transitions, repos, résultat
  tactique et reprise passent par l'ordre commun sans remplacer leurs autorités.
- Qualité multi-tours J1 certifiée hors Archives : quatre échanges avec un PNJ,
  formulations variées, sortie-retour, conséquence de déplacement visible,
  reprise persistante et restitution de la saisie après chaque tour.
- Événement monde naturel J1 certifié : une vraie heure de simulation produit
  un signal local raconté sans données privées, stable au rejeu et au
  rechargement.
- Cadrage J2 terminé : une seule gate progressive `NAR-ACC-002`, séparation
  explicite des capacités J3–J9 et interdiction des événements artificiels.
- Gate J2 et checkpoint A livrés : entrée réelle, Archives, observation libre,
  questions de contexte et méta, temps inchangé, changement d'écran et reprise
  persistante sans doublon d'échange.
- Deux interlocuteurs J2 livrés : l'archiviste et le clerc répondent séparément,
  restent correctement attribués et leurs échanges sont restaurés sans doublon.
- Accès privé J2 livré : le moteur social enregistre la condition du mandat de
  haut rang, laisse l'accès contrôlé et n'avance pas le temps.
- Boucle de lieu J2 livrée : création OpenAI unique de la Place des Archives,
  aller en 8 secondes, retour local en 8 secondes et reprise aux Archives à
  16 secondes sans rappeler le créateur.
- J2 fermé comme extension partielle de `NAR-ACC-002` ; les capacités J3–J9
  restent explicitement ouvertes par leurs propres lots.
- J3 personnel livré : les volontés écrites ranger, sortir, équiper et
  déséquiper passent par une transaction atomique, restaurable et sans temps.
- J3 lieu livré : déposer transfère un exemplaire possédé vers le lieu actif et
  prendre ne récupère qu'un exemplaire réellement présent et accessible.
- J3 fermé : donner/recevoir utilisent l'inventaire persistant et l'autorisation
  du PNJ ; achat/vente utilisent une offre réelle, le prix de `src/data/items`
  et de la monnaie physique, sans création ni perte d'objet.
- J4 fermé : une demande adressée à un PNJ visible devient une proposition
  durable ; le propriétaire décide avant la formulation narrative de l'IA.
  Acceptation, refus, condition, hésitation et nouvelle décision sont conservés
  sans état technique visible.
- Réussite, échec et abandon d'une mission sont durables. Leurs conséquences
  utilisent uniquement les axes sociaux existants `trust`, `affinity`, `fear`
  et `debt`, avec rejeu sûr.
- J5 fermé : motivations contrôlées avant création, croyances séparées par PNJ,
  hypothèses conservées sans changer la vérité, évolution hors écran et
  résolution certifiées dans un parcours de dix échanges narratifs.
- J6 fermé : exploration de trois lieux avec retour, trajet lointain fondé sur
  les routes du monde, groupe versionné, ressources propriétaires, progression
  atomique de l'heure, de la position et du checkpoint, interruptions ouvertes
  sans combat imposé et reprise persistante.
- J7 cadré et noyau livré : recrutement depuis une cause mission/relation réelle,
  groupe durable, volonté propre, déplacement, séparation, réunion, départ et
  photographie compatible avec le voyage J6.
- J7 fermé : une demande libre est structurée par `ai-intent-semantic/6` sans
  mots-clés métier, la décision du compagnon est persistée dans le même tour,
  sa réponse passe par le performer avec fallback narratif, son initiative
  sociale bornée est certifiée et le parcours navigateur survit au rechargement.
- Build global et régressions ciblées verts au dernier point de contrôle.

## Blocages et reports explicites

- Les tests de compétence attendent toujours une projection mécanique stable du
  créateur de personnage.
- Le voyage J6 possède son runtime de campagne et ses preuves ; son branchement
  dans la grande gate joueur continue de relever de l'intégration finale J9.
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
