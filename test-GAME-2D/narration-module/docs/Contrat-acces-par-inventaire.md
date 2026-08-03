# Contrat d'accès par inventaire

Statut : `SOCLE_RUNTIME_CERTIFIE_LOCAL_2026-08-03`

Ce contrat décrit l'approche « je présente/utilise un objet » devant un
contrôle d'accès. Il ne couvre pas les mutations générales d'inventaire
(`prendre`, `acheter`, `équiper`) et n'autorise jamais le texte joueur ou la
prose IA à fabriquer une possession.

## Séquence autoritaire

1. Le contrôleur reconnaît une action engagée devant l'unique seuil contrôlé
   compatible de la scène, ou un seuil explicitement ciblé.
2. Un résolveur de présentation associe les mots du joueur à un exemplaire de
   l'inventaire persistant `character.state`.
3. La politique propriétaire du contrôle précise les définitions d'objet
   acceptées, l'exigence satisfaite, l'accessibilité requise et l'effet
   `RETAIN` ou `CONSUME_ONE`.
4. Pour un titre comme un mandat, l'autorité des justificatifs doit en plus
   prouver qu'il est actif, détenu par le bon acteur, valable à l'heure de jeu
   courante et compatible avec le périmètre demandé.
5. Le domaine inventaire applique la politique au contrôle. L'objet et le
   registre d'accès sont écrits atomiquement dans la même opération narrative.
6. Le contrôleur rend le résultat déjà committé. Le déplacement reste une
   action ultérieure : ouvrir un accès ne téléporte jamais le personnage.

## Garanties

- L'objet doit exister réellement et en quantité positive dans l'agrégat du
  personnage actif.
- Un objet annoncé mais absent, un faux détenteur, un titre révoqué ou hors
  périmètre sont refusés.
- `DIRECTLY_ACCESSIBLE` refuse un objet encore rangé dans un contenant.
- `RETAIN` conserve l'exemplaire ; `CONSUME_ONE` décrémente sa quantité ou le
  retire si elle atteint zéro.
- Un objet consommé ne peut pas être équipé ni servir de contenant.
- Une ouverture `OPEN` est refusée tant qu'une exigence reste active.
- Le rejeu est idempotent et ne consomme jamais deux fois le même objet.
- L'heure vient de `world.clock`; aucune seconde n'est inventée ou avancée.
- Cette voie est locale et n'ajoute aucun appel IA au maximum de trois appels
  facturés par échange.

## Frontière d'intégration

Le moteur générique et son raccord au contrôleur sont disponibles. Chaque
campagne doit encore fournir ses données concrètes : contrôles d'accès, règles
d'objets acceptés, résolveur des noms d'objets et registre autoritaire des
justificatifs. Sans seuil compatible, une demande d'inventaire ordinaire reste
un handoff et ne passe pas par ce moteur.

## Preuves

```text
npm run narration-module:test:inventory-access
npm run narration-module:test:narrative-turn-controller
```

La recette couvre objet absent, justificatif révoqué, mauvais détenteur,
accessibilité, conservation, consommation atomique, ouverture, rejeu et
exécution dans l'opération du tour narratif.
