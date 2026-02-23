# Fil d'avancement (source unique)

Objectif: pouvoir reprendre le projet rapidement après une pause.

## État actuel (snapshot)
- Date: 2026-02-23
- Statut global: `Vert` | `Orange` | `Rouge`
- Focus sprint/jalon: Recentrage narration + mémoire + IA MJ
- Build local: `OK`
- Blocage principal:

## Fil rouge produit
- Coeur: narration solo guidée, avec possibilité coop.
- Tactique: module de résolution secondaire mais exigeant.
- Différenciateur: MJ IA avec mémoire et cohérence d’aventure.

## Dernières avancées
- Clarification du positionnement produit: narratif avant tactique.
- Structuration d’un cadre d’idéation orienté cas d’usage.
- Mise en place d’une base documentaire Evolution plus exploitable.
- Cas 001 traité: proposition technique multi-sens (vision/ouïe/odorat) orientée data + IA MJ.
- Cas 001 précisé: Q2/Q3 validées + tickets techniques Phase A/B rédigés.
- Cas 002 acté: topologie verticale/altitude/niveaux (terrain, bâtiments, sous-sols, vol).
- Cas 002 verrouillé: étage standard 3 m, plafond de vol 30 m, chute DnD officielle.
- Tickets Cas 002 Phase A/B rédigés.
- ADR-001 rédigé et acté pour figer les conventions verticales et d’unités.
- Cas 003 acté: modèle acteur unifié joueur/ennemi pour rendre les créatures interchangeables côté contrôle.
- Tickets Cas 003 Phase A/B rédigés.
- Priorisation fine des tickets Cas 003 réalisée (lots, dépendances, jalons M1-M4).

## En cours (WIP)
- [ ] Définir le contrat de sortie du MJ IA (format actionnable)
- [ ] Définir le noyau de mémoire (court terme vs long terme)
- [ ] Définir le hand-off narration ↔ pipeline tactique
- [x] Transformer Cas 001 en tickets d’implémentation (Phase A/B)
- [x] Valider la cible verticalité (Q1) pour finaliser les constantes perception
- [x] Découper Cas 002 en tickets d’implémentation (fondations topologiques)
- [x] Découper Cas 003 en tickets d’implémentation (normalisation `ActorSheet`)

## Prochaines actions (ordre strict)
1. Réaligner Cas 001 et Cas 002 sur la source canonique `ActorSheet`.
2. Préparer les critères de tests de compatibilité “ennemi contrôlé joueur”.
3. Démarrer le lot 1 Cas 003 (`T301`, `T302`, `T303`) en préparation d’implémentation.

## Blocages et risques
- Blocage:
  - Impact:
  - Option de résolution:
  - Décision prise:

## Questions ouvertes (à ne pas perdre)
- Quel niveau d’autonomie est autorisé au MJ IA?
- Quelle granularité de mémoire est nécessaire pour rester cohérent sans surcoût?
- Quelles mécaniques tactiques doivent impérativement être exposées à la narration?

## Reprise rapide (quand tu reviens)
1. Lire ce fichier.
2. Lancer le projet (`npm run build` puis flow de run habituel).
3. Ouvrir `Idées.md` et ajouter/mettre à jour l’inbox.
4. Prendre la première idée non traitée et remplir une fiche cas par cas.
5. Reporter la décision dans `Choix-techno.md` si elle est structurante.

## Journal
### YYYY-MM-DD
- Fait:
- Décision:
- Prochaine étape:
