# Contrat du voyage de campagne J6

Statut : `ACTIF — J6 FERMÉ`

## Expérience joueur

Le joueur exprime par écrit où il veut aller. Le MJ peut reformuler cette
volonté naturellement, mais ne crée ni route, ni durée, ni provision, ni membre
du groupe. Un trajet lointain commence seulement si le monde connaît une route
ouverte et un mode de déplacement compatible.

Le voyage avance par segments. Après chaque segment, la narration peut décrire
le chemin, l'heure écoulée et les signes rencontrés. Une rencontre rend la main
au joueur avec des approches ouvertes comme observer, éviter ou aller à la
rencontre. Elle ne déclenche jamais automatiquement un combat.

## Autorités

- Le monde possède les ancres, routes, directions, durées, dangers et milieux.
- Le propriétaire du groupe fournit une photographie versionnée de ses membres.
- L'inventaire prouve les ressources disponibles et prépare leur consommation.
- `TravelProcess` possède le plan, les segments, les checkpoints et les
  décisions reproductibles de rencontre.
- L'horloge et la simulation mondiale restent les seules autorités du temps.
- Le renderer et l'IA racontent uniquement le résultat déjà autorisé.

J6 accepte une photographie de groupe fournie par un propriétaire sans définir
comment un PNJ devient compagnon. Le recrutement, le départ et la volonté du
compagnon appartiennent à J7.

## Départ et progression

Le départ persiste le plan et le checkpoint initial sans consommer de temps. Un
segment relit avant tout commit :

1. la position réelle ;
2. la version et les membres du groupe ;
3. les ressources réellement disponibles ;
4. l'horloge et la frontière courante de simulation ;
5. le checkpoint précédent.

Une modification du groupe, une ressource insuffisante, une position divergente
ou une route non compatible refuse le segment sans changement. Lorsqu'il est
valide, l'horloge, le checkpoint, la position et la consommation préparée par
l'inventaire appartiennent au même commit atomique.

Le processus s'arrête à une frontière du monde, une interruption, une rencontre
ou l'arrivée. Un rechargement retrouve un voyage planifié, actif ou interrompu
et ne recalcule pas la rencontre déjà décidée.

## Ressources

Les besoins viennent de la route et des règles sous forme d'un taux par personne
et par jour. La consommation d'un segment est calculée depuis la progression
cumulée afin qu'un découpage en petits segments ne crée ni ne double des coûts.
Le domaine voyage ne modifie jamais lui-même l'inventaire : il vérifie que la
réservation propriétaire correspond exactement au besoin calculé.

## Refus obligatoires

- destination ou route absente, fermée ou incompatible avec le mode demandé ;
- groupe différent de la photographie validée au départ ;
- provision manquante ou réservation différente du besoin ;
- position réelle différente du checkpoint ;
- progression d'un processus arrivé, annulé ou échoué ;
- combat ou issue durable inventés depuis la catégorie d'une rencontre.

## Preuves exécutables

```powershell
npm run narration-module:test:local-exploration-j6
npm run narration-module:test:time:travel
npm run narration-module:test:time:persistence
```

Ces preuves couvrent la boucle locale, les routes du monde, le groupe versionné,
les ressources, l'atomicité campagne, les frontières, les interruptions, les
rencontres reproductibles et le rejeu.
