# Contrat d'accès par résultat tactique

## Objet

Ce contrat raccorde un contrôle d'accès au plateau tactique existant. Une
intention hostile comme « j'attaque le garde » peut amorcer une rencontre,
mais elle ne neutralise aucun acteur et ne change jamais le seuil par sa seule
formulation.

## Frontières d'autorité

- la narration interprète l'intention et sélectionne un seuil contrôlé ;
- `tactical-access-handoff/1` committe le processus et la graine de rencontre ;
- `GameBoard` reste propriétaire des tours, positions, PV et conditions
  terminales ;
- le checkpoint tactique doit être persisté avant tout outcome terminal ;
- l'outcome brut contient des candidats, jamais des deltas métier déjà
  autorisés ;
- `tactical-access-consequence-authority/1` relit le registre d'accès et la
  politique installée avant de produire le delta final ;
- l'intégration temporelle applique ensemble les conséquences personnage,
  accès, horloge et événement public.

Le processus, la graine, le checkpoint et l'outcome utilisent les agrégats
génériques du handoff tactique. Les anciens noms spécialisés bastion restent
des alias compatibles, sans imposer le bastion aux nouvelles rencontres.

## Politique installée Caserne → Château

Le seuil `access-control:caserne-centrale-chateau-tharqual` accepte désormais
le domaine `tactical`. La graine installée relit le personnage actif et sa
projection tactique, place un garde catalogué sur une carte bornée et n'autorise
que deux conditions terminales :

- `all_hostiles_neutralized` : les exigences encore actives sont levées et le
  seuil devient `OPEN` ;
- `player_defeated` : le seuil et ses exigences restent `CONTROLLED`.

Une condition terminale absente de cette liste ou un candidat qui ne reprend
pas le processus, le seuil et la politique committés est refusé.

## Reprise et idempotence

La surface restaure aussi bien une défense de bastion qu'un conflit d'accès.
Un rechargement avant ou après le checkpoint conserve la même rencontre.
L'outcome est enregistré une fois, validé par ses propriétaires, intégré une
fois puis projeté dans le fil narratif. Après ouverture, aucune session
tactique active n'est encore présentée pour ce seuil.

## Preuves exécutables

```text
npm run narration-module:test:tactical-access
npm run narration-module:test:campaign-access-lot-e
npm run narration-module:test:game-board-handoff
npm run narration-module:test:tactical-checkpoint
npm run narration-module:test:tactical-rest-handoff
```

La recette navigateur vérifie l'absence de mutation et de temps avant combat,
la création du handoff, l'ouverture réelle de `GameBoard`, le checkpoint et sa
restauration, la victoire terminale, l'ouverture autoritaire, le temps écoulé,
la projection narrative et le rejeu. Le test d'autorité couvre séparément la
défaite qui maintient le contrôle.
