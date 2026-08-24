# Guide — défense de bastion et plateau tactique

Ce guide explique simplement ce que font les lots 7A et 7B, comment les tester
et ce qui manque encore avant un aller-retour jouable complet.

## Le parcours actuel

Une défense tactique n'est pas créée par le bouton « Tactique ». Elle doit
d'abord exister dans la campagne :

```text
cause autoritaire
→ incident de bastion committé
→ processus tactique et graine committés
→ restauration par la narration
→ adaptation vérifiée
→ ouverture automatique de GameBoard
```

La graine décrit notamment le lieu, les participants, leurs équipes, leurs
positions, les conditions de carte et les fins autorisées. Le plateau ne décide
pas de remplacer ces informations par une configuration plus pratique.

### Exemple

La graine indique :

- Aryn dans l'équipe des défenseurs, en `(2, 4)` ;
- un assaillant de type catalogué `brute`, en `(8, 4)` ;
- une grille de 12 par 10 ;
- une cour d'auberge de nuit ;
- aucune surprise.

`GameBoard` charge la fiche projetée d'Aryn et le type `brute`, génère la carte
prévue, contrôle les deux cases puis démarre. Il ne consulte ni la dernière
fiche du navigateur, ni le personnage d'exemple, ni l'écran libre de
préparation.

## Pourquoi certaines rencontres sont suspendues

Un refus protège la continuité de campagne. Par exemple :

- le type d'ennemi n'existe pas dans le catalogue ;
- un acteur est absent de son équipe ;
- un danger de la graine n'est pas déclaré par la projection de carte ;
- une position tombe sur une charrette ;
- la carte exige une grille plus grande que la grille committée ;
- la graine applique la surprise, encore non représentée par le plateau ;
- un compagnon devrait être contrôlé comme un second personnage joueur.

Dans ces cas, aucun combat manuel de remplacement n'est proposé et aucun
résultat de campagne n'est inventé.

## Sauvegarde tactique — 7C-A

Au début d'un tour stable, le plateau sauvegarde un checkpoint de campagne. Il
contient les acteurs, leurs PV et positions, les ressources du personnage,
l'ordre d'initiative, la carte modifiée et le journal déjà produit.

Exemple : Aryn termine son tour avec 7 PV, puis le tour du premier assaillant
commence. Le checkpoint « début du tour de l'assaillant » est committé. Si la
page est rechargée, la carte et les 7 PV sont restaurés ; la rencontre n'est pas
regénérée et l'initiative n'est pas relancée.

Une action encore en cours n'est pas un checkpoint. Si le navigateur est fermé
au milieu d'un jet ou avant le passage au tour suivant, la reprise revient au
dernier début de tour committé.

## Fin du combat — 7C-B

Le plateau ne choisit pas seul ce que signifie une fin mécanique. La projection
de rencontre fournit la correspondance autorisée.

```text
tous les adversaires du plateau sont à 0 PV
→ condition déclarée : all_hostiles_neutralized
→ checkpoint terminal committé
→ TacticalOutcomeV1 committé
→ processus marqué COMPLETED_PENDING_INTEGRATION
```

L'outcome contient les PV, ressources, positions, neutralisations et le journal.
Il propose ensuite un candidat pour le personnage et un candidat pour le
bastion. Il n'écrit encore aucun de ces effets.

La durée d'un round vient elle aussi de la projection du ruleset. Le plateau ne
contient donc pas une durée cachée et supposée universelle.

## Intégration des conséquences — 7C-C

Après le constat brut, chaque candidat est relu par son propriétaire.

```text
PV proposés : 10 → 7
→ l'autorité personnage relit les PV actuels et la projection tactique
→ l'autorité bastion relit l'incident exact
→ la politique injectée interprète la condition terminale
→ temps + PV + incident + outcome sont committés ensemble
→ la narration reprend avec la conséquence publique validée
```

Si les PV de campagne ont changé entre-temps, si une référence propriétaire
manque ou si une ressource n'a pas encore d'adaptateur, l'intégration s'arrête.
Le combat n'est pas rejoué et aucun demi-résultat n'est appliqué.

Un second appel avec le même outcome restaure le résultat du premier commit. Il
ne redéduit pas la victoire et ne retire pas une seconde fois les PV.

Les compagnons tactiques, la surprise et une carte persistée cellule par cellule
restent également à raccorder avant de pouvoir les accepter dans une graine. Un
futur compagnon sera autonome par défaut ; le contrôle direct restera un cas
mécanique autoritaire exceptionnel. La reprise est cadrée dans
[`Guide-reprise-future-module-tactique.md`](Guide-reprise-future-module-tactique.md).

## Tests automatisés

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:game-board-handoff
npm run narration-module:test:tactical-checkpoint
npm run narration-module:test:bastion-defense-catalog
npm run narration-module:test:game-board-handoff-ui
npm run narration-module:test:bastion-vertical-8d
npm run build
```

Le premier test vérifie l'adaptateur, ses refus et la construction de l'outcome.
Le deuxième vérifie le commit, le remplacement et le rejeu d'un checkpoint,
la persistance de l'outcome, la validation propriétaire, l'avance du temps,
l'intégration atomique, la continuation narrative et le rejeu sans double
effet. Le test navigateur
ouvre réellement `GameBoard`, recharge un checkpoint et contrôle aussi un
rapport terminal. Le build valide l'intégration à l'application complète.

Le test de catalogue vérifie le passage entre une vraie projection propriétaire
du personnage et la graine : les références d'agrégats sont relues puis
conservées, les données privées de la cause restent exclues, et chaque fin
tactique possède une résolution explicite.

## Alimentation par la campagne — 8A et 8B

Le moteur ne contient pas une liste interne de raids. Une campagne fournit :

- un catalogue d'incidents ;
- une politique disant si l'événement cible réellement le bastion ;
- une entrée de rencontre avec adversaires, carte et fins ;
- un résolveur donnant le personnage actif et ses agrégats.

Exemple : une entrée « raid nocturne » peut déclarer deux fins,
`all_hostiles_neutralized` et `bastion_overrun`, avec leurs conséquences
publiques. Un autre univers peut utiliser d'autres identifiants sans modifier
le runtime.

Au bootstrap, la campagne enregistre désormais un petit profil de liaison. Il
ne duplique pas la fiche : il désigne le personnage actif et les agrégats
canonique, tactique, narratif et de position qui lui appartiennent. La défense
relit ce profil et exige ensuite un adaptateur explicite vers `GameBoard`.

Exemple : si Aryn est actif et que la rencontre déclare l'équipe
`defenders`, l'adaptateur reçoit les données persistées d'Aryn et
`teamId = defenders`. Il ne peut pas remplacer Aryn par le personnage
d'exemple du plateau.

Le catalogue de défense est lui aussi une entrée du paquet de contenu
versionné de la campagne. Une campagne épinglée sur `content.test@1` ne peut
pas charger silencieusement le catalogue de `content.test@2`.

## Comment une cause atteint le bastion — 8C

Le moteur monde ou l'intrigue doit d'abord committer son propre événement. Le
routeur de narration ne crée aucune attaque : il relit cet événement et demande
à une politique connaissant son format s'il cible un bastion actif.

```text
cause monde committée
→ politique de ciblage
→ aucun bastion : arrêt calme
→ bastion actif : commande d'incident déterministe
→ catalogue d'incident
→ éventuellement défense tactique
```

Exemple : un événement monde porte une référence de lieu. La politique monde
peut comparer cette référence aux lieux des bastions actifs. Le routeur reçoit
seulement `TARGET + bastion:old-bridge-inn` ou `IGNORE`; il ne cherche pas le
mot « attaque » dans le texte.

Une cause d'intrigue suit la même frontière, mais doit être un événement
`plot.*` planifié et committé. Une intrigue qui évolue ailleurs produit
`IGNORE` : aucun combat, aucune notification et aucune mutation silencieuse.

Le même événement routé deux fois génère le même identifiant de requête.
L'incident et sa présentation sont donc restaurés au lieu d'être recréés.

## Certification complète — 8D

La gate 8D exécute le parcours entier dans le navigateur avec une campagne
IndexedDB indépendante :

1. elle bootstrappe la campagne et le personnage du créateur actuel ;
2. elle relit le catalogue de défense épinglé ;
3. elle committe une cause monde privée puis la route vers un bastion actif ;
4. elle ouvre réellement `GameBoard` ;
5. elle recharge la page et vérifie le checkpoint restauré ;
6. elle termine le combat, valide les conséquences et avance le temps ;
7. elle recharge encore la page et exige une seule continuation narrative.

Exemple visible : le joueur voit que des assaillants atteignent la cour, ouvre
le plateau, puis lit que les assaillants se replient. Il ne voit jamais leur
voie d'approche privée contenue dans l'événement monde.

Cette preuve automatisée ne signifie pas encore qu'une attaque de bastion est
déclenchable dans la partie Archives ordinaire. La gate utilise une campagne
isolée pour ne pas transformer cette partie en démonstration permanente.
