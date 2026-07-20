# Contrat du registre de référents de scène

Version active : `scene-referent-registry/1`  
Date : 2026-07-17  
Lot : I-06ZP

## Finalité

Le registre est la seule source locale autorisée pour décider qu'une cible appartient à la scène courante, est visible, présente et compatible avec une interaction. Il est construit depuis `PlayableSceneStateV1`; aucun identifiant de fixture n'est ajouté au code générique.

## Entrée et sortie

Chaque `SceneReferentV1` expose uniquement :

- une `canonicalRef` unique;
- un type public `npc`, `object` ou `place`;
- un nom et des alias publics issus des données de scène;
- des propriétés déjà visibles;
- les capacités `speech`, `nonverbal_signal`, `observe` ou `manipulate`;
- la provenance et la version de scène.

Les PNJ présents deviennent `npc:<actorId>`, les points d'intérêt `poi:<pointId>` et les autres éléments visibles `element:<elementId>`. Un identifiant non préfixé n'est accepté que s'il correspond sans ambiguïté à une entrée existante.

## Vues par rôle

`toSceneReferentRoleViewV1` projette le registre pour `player_intent_interpreter`, `mj_planner`, `npc_performer` ou `scene_resolution`. Le performer ne reçoit que les PNJ. Toutes les vues excluent par construction les entités absentes, invisibles et les propriétés secrètes, puisque leur source est la projection jouable publique.

## Résolution et ambiguïté

La résolution d'un alias produit exactement `RESOLVED`, `AMBIGUOUS` ou `NOT_FOUND`. Elle peut être filtrée par capacité. Une ambiguïté ne choisit jamais le premier élément; le tour doit clarifier. La résolution textuelle reste cantonnée au faux fournisseur local : dans le chemin IA, le code canonicalise et valide la référence structurée proposée.

## Référent récent

Un `LocalReferentHintV1` cite désormais `sceneId` et `sceneVersion`. Il est rejeté si la scène/version ne correspond plus, si la référence n'existe plus ou si elle n'est pas compatible avec l'action. La liste reste bornée à cinq entrées. Un pronom sans référent récent valide ne retombe plus sur un PNJ par défaut.

## Limites

Le rendu narratif et l'état métier de l'auberge restent des adaptateurs spécifiques à la scène de référence. I-06ZP généralise la frontière d'interprétation et de validation des cibles; il n'introduit pas un moteur de rendu multi-scènes ni de nouvelles interactions.
