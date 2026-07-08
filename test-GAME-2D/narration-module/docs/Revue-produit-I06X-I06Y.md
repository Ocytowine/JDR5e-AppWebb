# Revue produit I-06X / I-06Y

Date : 2026-07-08
Statut : `REVUE_EFFECTUEE`

## Objet

Valider que les corrections I-06X et I-06Y traitent le problème produit observé pendant les tests manuels :

- une variation de formulation ne doit pas changer arbitrairement l'intention comprise ;
- une question ou une possibilité ne doit pas être perçue comme une action exécutée ;
- une clarification doit rester clairement suspendue, sans commit ni temps.

## Traces revues

| Cas | Résultat attendu | Statut |
|---|---|---|
| `Je m'approche du garde et je lui demande...` | `speech`, cible garde, commit parole borné, pas de clarification inutile | OK |
| `Est-ce que je peux voler la bourse du garde ?` | réponse de possibilité, aucune action exécutée, aucun commit métier | OK |
| `Lui voler quelque chose ?` | clarification, aucun commit, temps suspendu | OK |
| Scénario vertical I-06Q/I-06R | stabilité de la scène, méta hors fiction, possibilité sans action | OK |
| Rendu React I-06Y | badges et encarts hors couleur pour no-commit/clarification | OK |

## Preuves exécutées

```powershell
npm run narration-module:test:ai-intent-interpretation
npm run narration-module:test:vertical-quality
npm run narration-module:test:narrative-react-ui
```

Les trois commandes passent le 2026-07-08.

## Décision

I-06X/I-06Y sont validés pour leur périmètre produit actuel.

La prochaine étape retenue est de brancher OpenAI live sur le rôle `player_intent_interpreter`, côté serveur uniquement.

## Contraintes pour le prochain lot

Le prochain lot doit rester limité :

- route serveur dédiée ou extension serveur existante, sans appel OpenAI depuis React ;
- opt-in explicite, comme les autres usages OpenAI live ;
- sortie strictement conforme à `ai-intent-interpretation/1` ;
- fallback conservateur vers le fournisseur local / `intent-clarification/1` ;
- aucune autorité IA sur commit, temps, inventaire, tactique, lore durable ou succès social ;
- tests simulés obligatoires avant smoke live optionnel.

## Hors périmètre maintenu fermé

- `mj_planner` ;
- PNJ autonomes ;
- moteur social mécanique ;
- intrigue dynamique ;
- tactique jouable ;
- repos jouable ;
- lecteur complet d'historique.
