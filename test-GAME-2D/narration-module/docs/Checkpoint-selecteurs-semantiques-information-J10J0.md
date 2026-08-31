# Checkpoint J10-J0 — sélecteurs sémantiques ouverts

Statut : `FERMÉ — CERTIFIÉ LOCALEMENT`

Date : 2026-08-31

## Résultat

`information-need/2` transporte désormais, sans analyser la formulation du
joueur :

- le sujet public éventuellement résolu ;
- les portées publiques proposées ;
- les propriétés factuelles proposées ;
- les relations proposées pour le parcours du graphe ;
- les propriétés nécessaires à une réponse complète.

Ces quatre collections contiennent des références canoniques ouvertes et
bornées, non une énumération de concepts politiques. Les identifiants utilisés
par la gate sont volontairement opaques. J10-J0 n'ajoute aucune recherche de
mot, synonyme ou préfixe dans la saisie ou dans `requestedDimension`.

L'audit avait toutefois confirmé une dette antérieure dans le lookup J10-I : il
classait encore certaines dimensions libres par fragments de mots. J10-J1 l'a
depuis supprimée ; sa preuve est dans
[`Checkpoint-graphe-semantique-information-J10J1.md`](Checkpoint-graphe-semantique-information-J10J1.md).

## Autorité et validation

- `proposedSubjectRef` et `proposedScopeRefs` doivent appartenir au contexte
  public avant tout routage propriétaire ;
- les références de propriété et de relation ne sont que des propositions :
  leur acceptation par le catalogue appartient à J10-J1 ;
- toute collection est bornée à douze références canoniques, sans doublon ;
- `information-need/1` reste lisible pour les tours persistés et les anciennes
  recettes, tandis que les nouvelles sorties serveur utilisent exclusivement
  `information-need/2` ;
- le performer ne reçoit aucune autorité de lecture, de création ou de commit
  supplémentaire.

## Preuves

Commande :

```powershell
npm run narration-module:test:j10j0-information-selectors
```

Elle certifie le schéma serveur strict, les validateurs locaux, le rejet d'une
portée non publique, le transport exact V8 → G5 → commande propriétaire → reçu
de fidélité, la compatibilité J10-I1, la gate anti-dette lexicale étendue aux
descriptions sémantiques et le build du module narration.

Résultat : vert, sans appel OpenAI live.

## Suite

J10-J1 doit d'abord supprimer les classifications lexicales historiques, puis
publier depuis les données du lore un catalogue borné de propriétés
et relations pertinentes, puis accepter et parcourir ces références de manière
générique. Aucune règle lexicale locale n'est autorisée pour combler une donnée
de graphe absente.
