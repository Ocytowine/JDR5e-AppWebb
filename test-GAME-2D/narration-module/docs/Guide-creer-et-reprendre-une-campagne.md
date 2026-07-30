# Guide — créer et reprendre une campagne

Statut : `ACTIF`

Lot : `9C`

## À quoi sert cette entrée ?

Au lancement du build principal, l'application ne démarre plus
automatiquement une partie de démonstration. Elle propose :

- de créer une campagne depuis la fiche active du créateur ;
- de reprendre la campagne correspondant exactement à cette sauvegarde ;
- d'ouvrir volontairement l'ancien pilote des Archives.

Le pilote et la campagne joueur utilisent des bases séparées. Jouer dans le
pilote ne modifie donc pas la campagne du personnage.

## Exemple simple

La fiche active est `Aryn prête à jouer`.

1. L'accueil lit la sauvegarde sans encore créer de campagne.
2. L'importeur vérifie race, classes, caractéristiques, inventaire, actions et
   autres références contre le paquet installé.
3. Si la fiche est valide, le bouton `Créer` devient disponible.
4. Le clic conserve d'abord une enveloppe de reprise dans le stockage UI, puis
   bootstrappe atomiquement campagne, horloge, personnage, projections,
   position et dépendances.
5. La première scène aux Archives est activée dans la campagne.
6. De retour à l'accueil, le bouton devient `Reprendre`.

La fiche importée est un instantané. Si Aryn est ensuite modifiée dans le
créateur, la campagne existante n'est pas réécrite. Une sauvegarde de départ
ayant une nouvelle version produit une autre identité déterministe.

## Comprendre les diagnostics

Une erreur bloque le bouton avant toute création. Par exemple :

```text
CHARACTER_RACE_UNKNOWN — /character/raceId
```

Cela signifie que la fiche désigne une race absente du paquet installé. Il faut
corriger ou resauvegarder la fiche dans le créateur, revenir à l'accueil, puis
utiliser `Relire la fiche active`.

Un avertissement n'interdit pas l'import. Il indique une donnée legacy ignorée
ou normalisée et reste visible avant confirmation.

Une campagne existante dont la version de contenu ou de règles n'est plus
installée est refusée. Elle n'est jamais ouverte avec le contenu du pilote.

## Ce que contient le paquet installé

Le build génère
`src/narration-ui/generated/campaignBootstrapPackage.generated.json`.
Il contient :

- un manifeste `campaign-bootstrap/2` et ses empreintes ;
- les entités de lore nécessaires aux scènes jouables et à leur géographie ;
- les identifiants des catalogues réellement embarqués ;
- les payloads compilés utiles au bootstrap.

Le texte wiki auteur brut n'est pas livré au navigateur. Son empreinte reste
une provenance produite au build, tandis que les payloads et le manifeste sont
revérifiés au chargement.

Le ruleset `rules.jdr5e@2` est résolu exactement. Il n'existe aucun fallback
vers une autre version.

## Vérifications automatiques

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:campaign-entry
npm run narration-module:test:campaign-entry-ui
npm run narration-module:test:orchestration
npm run build
```

La gate navigateur utilise l'entrée réelle `/`, crée la campagne, revient à
l'accueil puis reprend la même campagne. Un second scénario prouve qu'une fiche
invalide reste bloquée avant création.

## Limites actuelles

Le 9C rend la campagne réelle accessible, mais ne compose pas encore tous les
panneaux métier dans cette surface :

- le repos, la progression et le bastion sont composés depuis 9D ; leurs
  cartes n'apparaissent que si la campagne possède l'état committé requis ;
- les événements committés de la simulation de carte attendent 9E ;
- la grande recette fonctionnelle de bout en bout attend 9F.

La narration et les transitions cataloguées sont déjà raccordées à la
campagne. Une absence d'état committé doit rester indisponible et
expliquée, jamais être simulée par une récompense ou un état de démonstration.
