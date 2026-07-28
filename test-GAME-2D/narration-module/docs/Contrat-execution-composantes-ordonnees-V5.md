# Contrat d'exécution des composantes ordonnées V5

Date : 2026-07-28

Statut : `IMPLEMENTE_ET_VALIDE`

## Problème

V3 et V4 conservent une approche et une communication dans `semanticIntent.composition`, mais les consommateurs aval exploitent surtout l'intention principale. Une approche suivie d'une salutation produit donc une réplique PNJ sans mise en scène de l'approche. De même, « je vous remercie, puis je m'écarte » conserve l'éloignement dans l'objectif libre mais ne le représente pas comme composante exécutable.

## Évolution V5

`ai-intent-semantic/5` conserve V4 et ajoute `composition.spatialFollowUp` :

- `kind=REPOSITION_AWAY` ;
- objectif sémantique propre ;
- ordre relatif aux autres composantes.

Les composantes bornées deviennent :

- `LOCATE_VISIBLE_TARGET` ;
- `APPROACH_TARGET` ;
- `SPEECH` ou `NONVERBAL_SIGNAL` ;
- `REPOSITION_AWAY`.

Elles décrivent uniquement des étapes demandées par le joueur. Elles ne transportent ni réussite sociale, ni réaction PNJ, ni temps, ni nouvel état durable.

## Consommation

Le planner local projette les composantes en beats ordonnés. Le rendu produit seulement les étapes locales réversibles autorisées :

```text
APPROACH_TARGET
→ GM_NARRATION courte
→ SPEECH
→ NPC_SPEECH
```

ou :

```text
SPEECH
→ NPC_SPEECH
→ REPOSITION_AWAY
→ GM_NARRATION courte
```

Le positionnement précis n'est pas persisté comme vérité spatiale durable dans ce lot. `REPOSITION_AWAY` ferme toutefois le focus conversationnel récent de session pour éviter qu'un pronom ultérieur ne cible automatiquement l'ancien interlocuteur.

## Autorité

- l'IA propose les composantes depuis le sens complet ;
- le registre valide la cible visible ;
- le runtime ordonne mécaniquement les composantes ;
- le renderer réalise les gestes confirmés sans annoncer de conséquence ;
- le performer PNJ reste seul producteur de la réplique ;
- aucune lecture du texte brut n'est ajoutée au chemin de décision.

## Preuves attendues

- approche puis salutation : narration MJ avant réplique PNJ ;
- remerciement puis éloignement : réplique PNJ avant narration MJ ;
- ordre indépendant des formulations ;
- focus récent retiré après éloignement ;
- V1 à V4 compatibles ;
- recette OpenAI Archives et build global.

## Validation du 2026-07-28

- le test déterministe `verify-semantic-intent-v5-ordered-execution.ts` valide le contrat, les beats, le rendu et la libération du focus ;
- les validations serveur couvrent le schéma strict V5 et conservent V1 à V4 ;
- la recette OpenAI Archives exécute deux tours successifs avec `player_intent_interpreter:ai-intent-semantic/5` : approche avant la salutation, puis remerciement avant l'éloignement ;
- le rendu obtenu reste strictement narratif ; les noms de composantes sont réservés à la bulle système de diagnostic ;
- `npm run build` passe.
