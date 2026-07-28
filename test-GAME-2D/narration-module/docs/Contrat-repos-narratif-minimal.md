# Contrat du repos narratif minimal

Statut : `PRÉPARATION`  
Sous-lot : `6A`  
Contrat cible : `narrative-rest-runtime/1`

## Objectif joueur

Le joueur formule naturellement une intention explicite de repos. Le système
demande uniquement les choix réellement nécessaires, puis résout un repos
segmenté dont le temps, les interruptions, consommations et bénéfices sont
traçables.

Exemple :

> Je voudrais prendre un repos long ici. Je monte la première garde, puis je
> dors.

## Frontière d'autorité

- L'interpréteur identifie le domaine `rest` ; il ne décide ni sécurité, ni
  durée, ni résultat.
- Le `RestDomain` possède le processus, ses segments, activités et
  interruptions.
- Le `TimeDomain` possède l'avance de l'horloge.
- Le `WorldDomain` fournit les risques et événements proches validés.
- Le `CharacterDomain` valide et applique les récupérations.
- `InventoryRules` valide les consommations.
- Le renderer raconte uniquement le résultat committé.

Le MJ IA peut formuler une question ou une continuation. Il ne lance pas de jet
caché libre et n'accorde aucun bénéfice.

## Entrée

Le runtime ne s'ouvre que si :

- l'intention sémantique est confirmée ;
- le domaine demandé est `rest` ;
- le joueur demande réellement de commencer un repos ;
- le lieu et l'état courant autorisent au moins une proposition de repos.

Aucun nouveau dictionnaire de phrases françaises n'est ajouté au runtime. Le
fallback lexical historique ne devient pas l'autorité du déclenchement.

Le registre actuel `narrative-runtime-capability-registry/1` classe encore
`rest` parmi les domaines fermés et impose `noGameTime=true` à toutes ses
routes. Le raccord 6A doit donc versionner cette frontière : le repos reste un
`HANDOFF` vers son propriétaire, mais devient disponible uniquement si le
contrôleur possède un port `RestDomain`, avec une politique temporelle validée
par ce domaine. Un simple retrait de `rest` de la liste fermée serait
insuffisant et incohérent.

Si le type de repos, les participants, la garde ou une activité incompatible
manquent réellement, le système demande ces seuls éléments sans avancer le
temps.

## Cycle minimal

```text
PROPOSED
  -> NEEDS_PLAYER_CHOICES | READY
  -> ACTIVE
  -> segment committé
  -> ACTIVE | INTERRUPTED | COMPLETED_PENDING_BENEFITS
  -> INTEGRATED
  -> continuation narrative
```

`COMPLETED_PENDING_BENEFITS` interdit d'afficher une récupération tant que les
domaines personnage et inventaire n'ont pas validé leurs deltas.

## Interruption et information cachée

Le profil de sécurité et la graine déterministe restent système. Le joueur voit
les signes perceptibles et les conséquences, jamais le pourcentage interne ni
le résultat brut du contrôle.

Exemple :

- interne : interruption déterministe au segment 2 ;
- joueur : « Un choc sourd contre les volets te tire du sommeil avant que le
  repos soit achevé. »

La narration ne peut pas inventer l'auteur du choc si aucun événement monde ou
intrigue ne l'a établi.

## Premier scénario d'acceptation

Dans une scène autorisant le repos :

1. le joueur demande explicitement un repos long et donne un plan de garde ;
2. aucune clarification artificielle n'est demandée ;
3. `rest_started` est committé avant l'affichage du début ;
4. chaque segment avance exactement l'horloge une fois ;
5. une interruption stable conserve les segments acquis ;
6. aucun bénéfice de repos long n'est appliqué si la durée manque ;
7. un achèvement n'affiche les bénéfices qu'après validation des propriétaires ;
8. le rejeu ne double ni temps, ni consommation, ni récupération ;
9. la bulle MJ reste narrative et le diagnostic technique reste dans la bulle
   système.

## Oracles à ajouter

- intention `rest` explicite contre question ou évocation du repos ;
- clarification limitée aux choix manquants ;
- démarrage, segment, interruption et achèvement ;
- panne avant puis après commit ;
- rejeu idempotent ;
- refus de récupération non validée ;
- absence de fuite du profil de danger ;
- restauration navigateur au milieu d'un repos ;
- continuation résumée et continuation RP détaillée fondées sur le même
  résultat.

## Hors sous-lot 6A

- toutes les activités de classe ;
- fabrication complète ;
- rencontre tactique automatique ;
- progression de niveau ;
- intrigue générée par l'interruption ;
- UI avancée de planification horaire.

Ces extensions utiliseront le même processus, sans modifier son autorité.
