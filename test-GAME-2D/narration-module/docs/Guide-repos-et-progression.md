# Guide du repos et de la progression

Statut : `GUIDE_ACTIF`

## Quand un repos commence

Un repos mécanique commence seulement après une intention explicite comprise
dans le domaine `rest` et si le lieu l'autorise. Parler du repos, poser une
question de règle ou attendre devant l'écran ne fait pas avancer le temps.

Le runtime demande seulement les choix réellement manquants, par exemple repos
court ou long. Il n'utilise pas une liste de phrases françaises codées en dur.

## Déroulement

```text
intention explicite
→ autorisation du lieu
→ graine et processus committés
→ progression par segments
→ interruption ou durée atteinte
→ validation des bénéfices
→ continuation narrative
```

Chaque segment avance l'horloge exactement une fois. Entre les segments, le
monde, une intrigue ou un PNJ peuvent atteindre une frontière réellement due.

Exemple : pendant un repos long, un choc contre les volets peut interrompre le
sommeil. Le joueur voit le signe perceptible, pas le pourcentage de danger ni la
graine interne.

## Bénéfices et progression de niveau

Finir la durée ne suffit pas à inventer une récupération. Le processus passe
par `COMPLETED_PENDING_BENEFITS` jusqu'à validation par les propriétaires
personnage et inventaire.

La progression mécanique de classe est distincte de l'évolution sociale :

- niveau de classe, maîtrise et points de vie maximum suivent les catalogues et
  règles du personnage ;
- confiance, réputation ou évolution personnelle restent narratives et
  sociales ;
- un passage de niveau exige un segment de repos court ou long consacré à la
  progression ;
- un choix absent du créateur de personnage suspend la progression, sans bonus
  compensatoire inventé.

## Interface actuelle

Lorsqu'un repos est actif, la saisie libre est suspendue et un bouton permet de
committer le segment suivant. Un rechargement restaure le checkpoint exact.

La scène pilote des Archives refuse actuellement le repos : aucun emplacement
sûr n'y est déclaré. Cette réponse est normale et vient de la politique du
lieu, pas d'une panne de l'interpréteur.

## Tests disponibles

```powershell
npm run narration-module:test:narrative-rest-runtime
npm run narration-module:test:rest-ui
npm run narration-module:test:tactical-rest-handoff
npm run narration-module:test:character-progression
npm run narration-module:test:character-progression-ui
```

Les scénarios navigateur couvrent rechargement en cours de repos,
interruption, achèvement sans bénéfice anticipé et progression validée.

Les activités complètes de classe, consommations générales, soins et
fabrication restent incomplets tant que leurs propriétaires ne sont pas tous
branchés.
