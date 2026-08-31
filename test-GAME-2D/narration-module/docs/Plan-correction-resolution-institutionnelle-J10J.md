# Plan de correction sémantique et institutionnelle J10-J

Statut : `EN EXÉCUTION — J10-J0 À J10-J3 FERMÉS, J10-J4 OUVERT`

Date d'ouverture : 2026-08-31

Autorité : ce document détaille le lot correctif J10-J ouvert après la
certification J10-I. La consolidation reste l'unique feuille de route globale.

## Motif d'ouverture

Dans la scène réelle des Archives, la demande « pouvez-vous me rappeler le nom
de notre roi, je suis un nouvel arrivant » est correctement adressée au garde,
mais le lookup retourne zéro candidat et transforme l'absence de résolution en
« Je ne sais pas ».

Le lore établit pourtant qu'Astryade est un royaume, que son souverain porte le
titre de Primarque et que la Tour du Primarque représente le pouvoir central à
Lysenthe. Seul le nom personnel du titulaire manque. Le diagnostic révèle aussi
que la question suivie d'une justification est finalement projetée comme
`dialogueAct=OTHER`, puis que la création requise reste
`REQUIRED_NOT_EXECUTED`.

## Interdiction structurante : aucun routeur lexical

J10-J ne doit contenir aucune liste de mots, synonymes, expressions régulières
ou règles de préfixes destinée à reconnaître une formulation joueur. Ajouter
des variantes textuelles déplacerait simplement le blocage et rendrait le
système impossible à maintenir.

Le texte est compris une seule fois par l'interpréteur. Le chemin local consomme
ensuite uniquement :

- des références publiques proposées et validées ;
- des dimensions sémantiques ouvertes ;
- des relations typées du graphe de lore ;
- des propriétés factuelles déclarées par le catalogue ;
- des autorités et politiques locales existantes.

La gate de dette lexicale doit refuser toute nouvelle lecture du texte joueur
ou de ses reformulations dans le résolveur.

## Architecture cible

```text
formulation libre
    → V8 : besoin sémantique + sujet/portée/propriété proposés
    → validation des références dans le contexte public
    → parcours générique du graphe lore par relations typées
    → faits complets ou partiels + dimensions manquantes structurées
    → connaissance PNJ → divulgation
    → création propriétaire éventuelle
    → performer
```

Les références proposées restent non autoritaires : le catalogue valide leur
existence et le lookup décide seulement de la lecture. Une propriété inconnue
reste manquante ; elle ne déclenche ni recherche lexicale locale ni invention du
performer.

## Invariants

- une prémisse approximative doit être corrigée depuis le lore, pas convertie
  en ignorance fictionnelle ;
- autorité locale et autorité centrale restent deux sujets distincts ;
- un titre ou un office connu ne vaut jamais nom personnel ;
- une réponse partielle dit ce qui est établi et ce qui manque ;
- seul `CAMPAIGN_FACT` peut persister une valeur publique créée ;
- une justification simultanée ne remplace pas l'acte directeur
  `ASK_QUESTION` ;
- aucun propriétaire métier, secret ou budget IA existant n'est contourné ;
- aucune formulation précise n'est nécessaire pour atteindre ces résultats.

## État d'exécution

| Sous-lot | État | Gate |
|---|---|---|
| J10-J0 — contrat sémantique ouvert | `FERMÉ` | [`Checkpoint-selecteurs-semantiques-information-J10J0.md`](Checkpoint-selecteurs-semantiques-information-J10J0.md) |
| J10-J1 — graphe institutionnel générique | `FERMÉ` | [`Checkpoint-graphe-semantique-information-J10J1.md`](Checkpoint-graphe-semantique-information-J10J1.md) |
| J10-J2 — réponse partielle | `FERMÉ` | [`Checkpoint-reponse-partielle-information-J10J2.md`](Checkpoint-reponse-partielle-information-J10J2.md) |
| J10-J3 — création contrôlée | `FERMÉ` | [`Checkpoint-creation-controlee-information-J10J3.md`](Checkpoint-creation-controlee-information-J10J3.md) |
| J10-J4 — acte directeur composé | `EN COURS` | question + justification conserve `ASK_QUESTION` |
| J10-J5 — certification produit | `PRÉVU` | corpus sans phrases imposées, Chromium, propriétaires, budgets et build |

## J10-J0 — Contrat sémantique ouvert

`information-need/2` étend le besoin sans taxonomie de vocabulaire fermée afin de
transporter séparément le sujet proposé, la portée contextuelle, les propriétés
factuelles recherchées, les relations à suivre et les dimensions qui
constituent une réponse complète.

Ces éléments sont des références ouvertes validées contre le contexte public ou
le catalogue, pas des catégories déduites localement depuis des mots. J10-J0
ferme le transport, la validation structurelle et la portée publique ;
l'acceptation des propriétés et relations par le catalogue ouvre J10-J1.

## J10-J1 — Graphe institutionnel générique

Les heuristiques historiques qui relisaient `subjectMention` et
`requestedDimension` sont supprimées du lookup. La gate confirme désormais
zéro consommateur de ces descriptions dans ce fichier.

Le lore expose les offices et liens d'autorité comme données structurées. Le
lookup suit les relations demandées avec un budget et une profondeur bornés,
sans connaître le vocabulaire qui a conduit l'interpréteur à les choisir. Le
même mécanisme doit servir une guilde, un temple, une armée, une maison noble ou
une administration future.

## J10-J2 — Réponse partielle

Le performer reçoit séparément les faits établis et les dimensions manquantes.
Il corrige une prémisse depuis les faits autorisés et reconnaît uniquement la
partie réellement absente. Le fallback possède la même capacité sans appel IA.
Le libellé des propriétés absentes provient du catalogue public et le statut
`answerCoverage` interdit de confondre réponse partielle et ignorance globale.

## J10-J3 — Création contrôlée

Lorsque la politique autorise un détail public stable, une proposition doit être
validée puis committée atomiquement comme identité légère et fait de campagne.
Rejeu, concurrence, remplacement et reload réutilisent la même identité. Le
performer ne choisit ni ne persiste la valeur.

La politique de création est désormais une donnée du lore. Le rôle créatif ne
propose qu'une valeur sous `PROPOSE_ONLY_NO_COMMIT`; le propriétaire construit
l'identité éventuelle et valide les sources. Dans le contrôleur réel, la
préparation est intégrée au commit atomique du tour afin de préserver le verrou
de campagne ; une projection validée permet la réponse immédiate, puis les
tours suivants relisent le fait persisté. Les sélecteurs vides sous
`UNDERSTOOD`, le budget du quatrième rôle optionnel et les reproches issus du
seul profil conversationnel sont couverts par la gate J3.

## J10-J4 — Dialogue composé

Un groupe social atomique peut contenir une question et une justification. Son
acte directeur est fourni par la structure ordonnée, pas redéduit du texte. Les
autres déclarations restent disponibles comme contexte.

## J10-J5 — Fermeture

La certification emploie plusieurs cadres sémantiques équivalents dont les
phrases ne sont jamais inspectées par les assertions métier. Elle couvre la vraie
surface des Archives, IndexedDB, rejeu, panne performer, propriétaires J3 à
J10-I, garde anti-dette lexicale et build. Tout appel OpenAI live reste soumis à
un accord explicite.

## Conditions d'arrêt

- si une correction exige un nouveau synonyme local, arrêter et enrichir le
  contrat sémantique ou le graphe ;
- si une relation n'existe pas dans le lore, la déclarer dans la source et la
  compiler plutôt que la deviner ;
- si une propriété proposée n'est pas publique ou validable, ne pas la lire ;
- si la création ne peut pas être atomique, conserver la réponse partielle sans
  produire de valeur.
