# Contrat d'accès par règles

Statut : actif — lot D livré le 2026-08-04.

## Autorité

Le domaine `rules` reçoit une méthode structurée, le dispositif ciblé, le
personnage actif et, lorsque la politique l'exige, une instance d'objet
réellement détenue. Le verbe *forcer* ou *crocheter* ne constitue jamais une
réussite. L'autorité relit la fiche mécanique épinglée, l'inventaire, le
contrôle et la règle de difficulté avant de proposer un jet.

La tentative est persistée avant le lancer. La reprise commune des tests de
compétence persiste ensuite un d20 unique, avance le temps et applique dans un
même commit le résultat propriétaire, le bruit, les éventuelles ressources et
l'état du contrôle. Un rejeu ne peut pas appliquer deux fois la conséquence.

## Politique installée

Sur `poi:caserne_centrale:poi:2`, la campagne accepte une première méthode
`FORCE` : Force (Athlétisme), difficulté difficile résolue à DD 20, durée de
six secondes. La réussite ouvre physiquement le passage et produit un bruit
`LOUD`; l'échec conserve l'état `CONTROLLED` et produit également un bruit
`LOUD`.

Le crochetage est compris mais refusé : aucun objet individuel d'outils de
voleur n'est encore installé dans le catalogue de campagne et le personnage
n'en détient donc aucune instance vérifiable. Aucun outil n'est créé depuis le
texte du joueur.

## Vérifications

```text
npm run narration-module:test:rules-access
npm run narration-module:test:pending-skill-check-resume
npm run narration-module:test:campaign-access-lot-d
```

La recette navigateur couvre l'outil absent, la tentative persistée, le
rechargement avant jet, la réussite, le temps, le bruit, l'ouverture et une
nouvelle restauration. Aucun appel OpenAI facturé n'est utilisé.

## Limites

La consommation d'une ressource est décrite dans la politique mais reste
refusée par l'adaptateur tant que son écriture inventaire atomique n'est pas
installée. Les sorts non catalogués restent refusés. Une agression ne passe
pas par ce domaine : elle relève du handoff tactique du lot E.
