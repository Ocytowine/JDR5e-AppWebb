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

Une `APPROACH_TARGET` peut précéder une intention principale
`traverse_visible_boundary` : elle décrit alors l'amorce du déplacement vers le
passage et ne remplace pas le franchissement. La canonicalisation ne rabat donc
une amorce spatiale vers `move_near_visible_actor` que si l'intention principale
n'est ni une transition déclarée, ni de portée `SCENE_TRANSITION`.

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

## Paquet d'entrée actif de l'interpréteur

V5 conserve une sortie `intent` principale unique avec ses composantes
ordonnées. L'entrée `player_intent_interpreter` contient :

- le texte joueur comme donnée non fiable ;
- l'identifiant et la version de la scène active ;
- uniquement les référents visibles, alias, propriétés publiques et
  destinations publiques ;
- `characterContext` conforme à `interpreter-character-context/1`, limité à
  l'identité, aux langues, aux actions, aux sorts et à l'équipement visible ;
- jusqu'à trois focus locaux et trois tours sémantiques récents ;
- l'interlocuteur actif lorsqu'un échange validé n'a pas libéré son focus ;
- `runtimeContext` conforme à `interpreter-runtime-context/1`.

`runtimeContext.capabilities[]` expose pour chaque capacité publique :

- son identifiant stable et son domaine propriétaire ;
- `AVAILABLE` si le runtime possède un raccord effectif, sans préjuger de
  l'autorisation métier ;
- `HANDOFF_ONLY` si le sens doit être conservé mais que la saisie libre ne peut
  pas exécuter le domaine ;
- `EXTERNAL_TRIGGER_ONLY` si la fonctionnalité part d'une cause ou commande
  propriétaire et jamais de l'interpréteur.

Le contexte personnage aide uniquement à reconnaître une référence. Toutes ses
entrées sont `REFERENCE_ONLY`; une ambiguïté d'alias non levée impose une
clarification locale, même si l'IA avait choisi un candidat.

Le manifeste runtime aide à choisir le bon domaine. Il n'autorise ni succès, ni commit,
ni temps, ni mutation, et le logiciel recalcule toujours la décision runtime.

L'empreinte de contexte couvre la scène visible, les focus, les tours récents,
l'interlocuteur actif, le contexte personnage et ce manifeste. Après
rechargement, le contrôleur
reconstruit les cinq derniers tours sémantiques depuis les opérations
persistées avant d'accepter une nouvelle saisie.

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
