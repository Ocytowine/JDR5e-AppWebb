# Guide — disponibilités de campagne dans l'interface

## À quoi sert le lot 9D ?

Le lot 9D branche les fonctionnalités déjà construites sur la campagne ouverte
depuis l'accueil principal. Il ne donne rien gratuitement au personnage.

La règle simple est :

```text
état committé par une autorité
→ relecture de cet état
→ disponibilité visible dans l'interface
```

Sans état committé, la carte correspondante n'apparaît pas.

## Ce que le joueur peut voir

La carte **État de campagne** peut indiquer :

- une progression en attente et les catégories de choix encore nécessaires ;
- un bastion actif ;
- le nombre de travaux, compagnons affectés et incidents actifs ;
- la possibilité de commencer un repos dans le bastion du lieu courant.

Une défense tactique active conserve son panneau dédié et son bouton vers le
plateau.

## Exemple de repos

Aux Archives de Lysenthe, aucun lieu sûr n'est committé :

```text
Joueur : « je prends un repos long »
Système : le repos ne commence pas
Temps de jeu : inchangé
```

Si la campagne a acquis un bastion et que le personnage s'y trouve :

```text
État de campagne : « Repos autorisé — Bastion du pont »
Joueur : « je prends un repos court »
→ le processus de repos propriétaire démarre
```

Une défense en cours suspend cette autorisation.

## Exemple de défense

Le catalogue de production décrit la carte, les équipes, l'adversaire et les
issues permises. Il contient un emplacement pour le personnage actif, pas le
nom d'un héros de test.

```text
cause monde committée et structurée
→ lieu ciblé = lieu d'un bastion actif
→ incident de défense catalogué
→ emplacement remplacé par le profil actif
→ graine tactique validée
→ bouton « Ouvrir le plateau tactique »
```

Une phrase du joueur, un mot ressemblant à « attaque » ou un événement non
committé ne peut pas fabriquer ce combat.

## Progression

La carte montre uniquement les récompenses `AVAILABLE` ou
`CHOICE_REQUIRED` du registre de progression. Le catalogue chargé vient des
données actuelles du créateur de personnage. La récompense elle-même doit
toujours avoir été accordée par la politique de progression.

L'application mécanique d'un niveau conserve les règles déjà définies :
preuve d'une fenêtre de repos, choix explicites, candidat construit depuis le
catalogue et validation par l'autorité propriétaire.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:campaign-composition
npm run narration-module:test:bastion-defense-catalog
npm run narration-module:test:campaign-entry
npm run narration-module:test:narrative-app-surface
npm run build
```

## Ce qui vient ensuite

Le lot 9E raccorde la simulation du monde. C'est elle qui pourra produire une
cause autoritaire visant réellement un bastion. Le lot 9D prépare et affiche
la conséquence ; il ne déclenche pas une attaque de démonstration.
