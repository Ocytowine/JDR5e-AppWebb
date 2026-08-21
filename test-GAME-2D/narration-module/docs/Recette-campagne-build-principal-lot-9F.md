# Recette de campagne dans le build principal — lot 9F

## But

Cette recette permet de vérifier la campagne réellement ouverte par
`index.html`. Elle n’utilise pas un contrôleur React injecté et ne remplace pas
la persistance IndexedDB par une mémoire de test.

Deux parcours sont volontairement distingués :

1. le parcours libre, reproductible manuellement avec une vraie fiche ;
2. les causes préparées de certification, nécessaires pour tester progression,
   bastion et défense sans inventer ces éléments aux Archives dans une partie
   normale.

## Parcours manuel libre

Depuis `test-GAME-2D/` :

```bash
npm run dev
```

Ensuite :

1. dans le créateur, enregistrer et sélectionner une fiche prête à jouer ;
2. ouvrir l’application puis choisir **Créer** ;
3. vérifier que la scène commence aux Archives de Lysenthe ;
4. saisir par exemple :

   ```text
   J'observe calmement les personnes présentes.
   ```

5. attendre la réponse puis recharger la page ;
6. choisir **Reprendre** et vérifier que l’échange est toujours présent ;
7. ouvrir **Monde**, puis **World simulation** ;
8. cliquer `+1 h` et vérifier que l’en-tête indique `tick 1` ;
9. recharger, reprendre la campagne et vérifier que `tick 1` est restauré ;
10. revenir à la narration.

Résultat attendu : aucune Auberge du Seuil de secours, aucune perte de fil et
aucune remise à zéro de la carte.

## Progression, bastion et défense

Une campagne neuve aux Archives ne reçoit volontairement ni niveau, ni bastion,
ni raid artificiel. Ces cartes n’apparaissent que si leurs autorités ont
committé les états correspondants.

La gate 9F prépare donc, dans sa base isolée :

- un award de niveau demandant un choix de classe ;
- un bastion actif au lieu courant ;
- une cause `WORLD_SIMULATION` privée visant ce bastion.

Elle vérifie ensuite depuis la vraie application :

```text
progression et bastion visibles
→ défense créée par la cause committée
→ GameBoard ouvert
→ checkpoint sauvegardé
→ rechargement et checkpoint restauré
→ issue validée et intégrée au temps de campagne
→ retour narratif unique
```

La préparation se trouve dans
`narration-module/tests/browser/campaign-main-9f-preparation.ts`. Elle n’est
importée par aucun fichier de production et la route privée utilisée par le
raid ne doit jamais apparaître dans le fil joueur.

## Lancer la certification automatisée

```bash
npm run narration-module:test:campaign-build-gate
```

La commande rassemble :

- la gate réelle 9F ;
- les refus de fiche et la reprise 9C ;
- la restauration d’une progression validée ;
- la verticale tactique isolée 8D ;
- le runtime atomique de simulation de campagne.

Pour cibler uniquement l'entrée réelle :

```bash
npm run narration-module:test:campaign-main-9f
```

Pour rejouer spécifiquement, avec OpenAI, la transition depuis une campagne
propre des Archives vers la Place des Archives :

```bash
npm run narration-module:test:archives-place-transition:openai-live
```

Cette gate injecte une fiche valide dans une base IndexedDB isolée, crée la
campagne depuis la vraie entrée, active OpenAI puis soumet « Je me dirige vers
la Place des Archives. ». Elle exige une action réellement exécutée, le passage
par `player_intent_interpreter → scene_creator → scene_writer`, le commit de la
transition, sa reprise après rechargement, aucune alerte et aucune erreur de
page. Ce chemin de création locale réserve le budget de trois appels au
créateur propriétaire du candidat et au writer ; le `mj_planner` n'est donc pas
appelé et le critique éventuel est refusé localement comme quatrième appel. La
présence du nom du lieu dans la seule entrée joueur ne suffit pas à faire passer
la gate.

La passe J2 du 2026-08-19 observe trois appels HTTP 200, dans l'ordre
`player_intent_interpreter → scene_creator → scene_writer`. La transition
committe une seule arrivée et huit secondes diégétiques. Le test passe ensuite
en mode local : « Je retourne aux Archives de Lysenthe » réutilise la connexion
persistée, ajoute huit secondes et ramène la campagne aux Archives. Après
rechargement, **Reprendre** restaure les Archives, les deux transitions et les
seize secondes sans rappeler le créateur. Le `coherence_critic` reste refusé
localement comme quatrième appel ; une sortie `scene_writer` incomplète conserve
le rendu local validé sans annuler le commit.

Pour rejouer la conversation réelle avec le clerc :

```bash
npm run narration-module:test:campaign-clerk-conversation:openai-live
```

Cette gate crée une campagne depuis une fiche valide, contacte le clerc, demande
l'accès aux registres de naissance, puis pose deux questions sur son ancienneté
et son opinion des restrictions. La passe certifiée du 2026-08-17 observe, pour
chacun des quatre tours, trois appels HTTP 200 dans l'ordre
`player_intent_interpreter → mj_planner → npc_performer`. Les quatre répliques
sont rendues, capturées comme paroles attribuées puis restaurées après
rechargement, sans alerte ni erreur de page.

## Refus à observer

- sans fiche active, **Créer** reste désactivé et un diagnostic explique
  l’absence de sélection ;
- une référence de race absente interdit la création ;
- un événement non committé ou sans bastion cible ne crée aucune défense ;
- une progression sans preuve de repos n’est pas appliquée ;
- une rencontre non projetable reste suspendue sans résultat manuel ;
- une reprise pendant un checkpoint recharge ce checkpoint, sans nouveau
  combat.

Les tests de domaine couvrent les refus dont la préparation manuelle demanderait
de corrompre volontairement IndexedDB.

## Corrections révélées par la gate

La première exécution 9F a trouvé quatre défauts de composition :

- l’état de carte contenait des propriétés `undefined` non persistables ;
- les identités de projection narrative dépassaient la limite du noyau ;
- le générateur de battlemap pouvait placer un obstacle sur une position
  tactique pourtant committée ;
- l’intégration du combat créait un second curseur temporel au lieu d’utiliser
  celui de la campagne.

Ces cas sont maintenant exercés par le parcours réel.

## Limite de contenu actuelle

Le monde installé reste le bac de simulation de Valmorin. Une avance est
persistante et peut produire des événements, mais elle ne garantit pas encore
un signal local naturel aux Archives de Lysenthe. La gate prépare explicitement
la cause de raid ; elle ne la fait pas passer pour un événement spontané du
contenu actuel.
