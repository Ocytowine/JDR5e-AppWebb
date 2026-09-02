# Checkpoint J10-K0 — baseline mesurée du contexte par rôle

Statut : `FERMÉ`

Date : 2026-09-01

## Résultat

J10-K0 fige une reproduction publique et anonymisée du troisième tour de la
conversation avec le garde des Archives :

> « pouvez vous me dire qui gouverne le pays ? »

La fixture utilise la vraie scène compilée, son vrai catalogue sémantique, le
garde ambiant, un focus de dialogue actif et deux intentions récentes. Le profil
joueur est volontairement minimal et ne contient aucun secret. La sortie
`NEEDS_CLARIFICATION` jointe au diagnostic utilisateur est rejouée par un faux
fournisseur afin de conserver l'observation historique sans effectuer d'appel
OpenAI.

Cette gate ne mesure donc pas à nouveau la qualité du modèle. Elle prouve le
contenu disponible avant l'appel, son volume et l'écart entre le résultat
observé et l'oracle produit attendu.

## Mesures reproductibles

| Section | Caractères | Estimation à 4 caractères/token |
|---|---:|---:|
| `request.input` | 18 050 | 4 513 |
| `roleContextPack` | 2 904 | 726 |
| `task` | 15 047 | 3 762 |
| `task.embodiedContext` | 14 817 | 3 705 |
| catalogue d'information | 7 726 | 1 932 |
| scène dans le contexte incarné | 916 | 229 |
| instructions du rôle | 7 384 | 1 846 |
| schéma Structured Outputs | 5 944 | 1 486 |
| corps fournisseur complet | 33 704 | 8 426 |

Le corps anonymisé estimé à 8 426 tokens est cohérent avec les 8 900 tokens
réellement rapportés dans le diagnostic. L'écart est attendu : la campagne
réelle possède un profil et des projections publiques plus riches, et
l'estimation ne remplace pas le tokenizer du fournisseur.

Le budget déclaré reste 2 000 tokens. La gate prouve que cette valeur est déjà
dépassée avant l'appel, sans provoquer de réduction ou de refus. J10-K4 reste
responsable de la correction ; K0 n'en change pas la sémantique.

## Catalogue disponible

Le catalogue représente 7 sujets, 18 propriétés et 12 relations. Il contient
déjà :

- `lore-entity:astryade`, type royaume ;
- `lore-entity:lysenthe`, type ville ;
- `lore-entity:ylssea`, type région ;
- `lore-edge:archives_de_lysenthe:territoire:astryade` ;
- les propriétés du titre et de l'identité du dirigeant d'Astryade.

La fausse clarification n'est donc pas causée par l'absence d'Astryade dans le
catalogue de l'interpréteur.

## Doublons établis

La même identité de scène apparaît dans `roleContextPack.sceneId` et
`embodiedContext.currentScene.sceneId`.

Les trois acteurs ambiants sont également présents dans :

- `roleContextPack.visibleReferents` ;
- `embodiedContext.currentScene.presentActors`.

Après normalisation des préfixes `npc:` et `actor:`, les trois références sont
identiques. Le garde actif fait partie de ce recouvrement. La gate exige ce
doublon afin qu'il ne disparaisse qu'au moment explicite de J10-K2, avec une
mesure avant/après.

## Carte source → projection → rôle

| Source autoritaire | Projection actuelle | Consommateur | Constat K0 |
|---|---|---|---|
| `PlayableSceneStateV1` | registre de référents dans `roleContextPack` | interpréteur | utile, mais recopie scène et acteurs |
| `PlayableSceneStateV1` + `PlayerPublicContextV1` | `embodiedContext.currentScene` | interpréteur | seconde représentation des mêmes acteurs |
| `LocalInteractionFocusV1` | `activeInterlocutor`, `activeInteraction`, `recentFocus` | interpréteur | recouvrement sémantique à analyser, pas encore classé comme doublon |
| catalogue lore compilé | `informationCatalog` | interpréteur | une seule copie, volumineuse mais nécessaire aux sélecteurs J10-J |
| personnage et inventaire publics | `character`, `namedReferences` | interpréteur | borné ; aucun canari privé détecté par les gates G4 |
| capacités installées | `runtimeCapabilities` | interpréteur | nécessaire aux propositions G5, à mesurer par pertinence en K2 |
| faits acquis publics | `acquiredKnowledge` | interpréteur | borné ; aucune valeur factuelle privée autorisée |

K0 n'affirme pas que tout recouvrement est supprimable. K1 doit décider quelle
projection fait foi et quel rôle justifie chaque consommation.

## Corpus figé

La fixture versionne cinq oracles produits :

- pays courant → Astryade, compris ;
- ville courante → Lysenthe, compris ;
- région courante → Ylsséa, comprise ou absence factuelle structurée, mais pas
  ambiguïté géographique artificielle ;
- même question avec interlocuteur actif → garde conservé et Astryade comme
  sujet factuel ;
- deux pays également saillants → clarification réelle.

Ces oracles décrivent le sens attendu. Aucun test métier ne recherche les mots
« pays », « ville » ou « région » dans le runtime.

## Fichiers et commande

- fixture : `tests/fixtures/context-corpus-j10k0.ts` ;
- mesure : `tests/scene/verify-context-packet-baseline-j10k0.ts` ;
- commande :

```powershell
npm run narration-module:test:j10k0-context-baseline
```

La commande régénère le catalogue, exécute la baseline K0, les protections G4
du contexte incarné et la gate de dette lexicale.

## Limites conservées

- aucun appel OpenAI live n'a été lancé ;
- aucun prompt, schéma, constructeur de contexte ou comportement runtime n'a
  été modifié ;
- l'estimation à quatre caractères par token sert uniquement de comparaison ;
- le paquet réel de la session utilisateur n'est pas exporté par le diagnostic
  actuel, donc la fixture reproduit sa scène et sa structure avec un profil
  public anonymisé plutôt que ses 22 710 caractères exacts.

## Reprise

J10-K1 doit maintenant formaliser le manifeste éphémère, les propriétaires, les
classifications, les consommateurs et les exclusions. Il ne doit encore
supprimer aucun champ du paquet.
