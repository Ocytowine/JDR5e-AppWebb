# Contrat des conversations PNJ longues

Statut : actif depuis le 2026-07-28

## But

Une conversation peut durer, changer d'interlocuteur et reprendre après un
retour de scène sans confondre les voix ni transformer les paroles en vérités de
campagne.

## Unité de mémoire

La mémoire courte est isolée par `actorId`. Chaque entrée utile couple :

- l'opération d'origine ;
- l'expression ou l'intention du joueur ;
- la réplique PNJ exactement affichée ;
- la projection de rendu qui prouve cette réplique.

Le paquet du `npc_performer` reçoit au maximum les cinq derniers couples de
l'acteur ciblé. Une réplique d'un autre acteur ne peut pas entrer dans ce paquet.

Depuis le 2026-07-30, il reçoit également le dernier profil conversationnel
éphémère accepté du même acteur. Ce profil est produit dans le même appel que la
réplique, porte une révision stricte et reste `durable=false`. Une performance
rejetée ne devient jamais la source du tour suivant.

Exemple : après six questions à la serveuse puis trois au garde, reparler à la
serveuse fournit ses cinq derniers échanges, aucun échange du garde et aucune
réponse reconstruite par approximation.

## Identité de locuteur

Le `speakerId` est dérivé génériquement de l'identifiant canonique de l'acteur.
La reconstruction ne contient aucune liste de PNJ connus ni exception propre à
une scène.

Ainsi `npc:reference-inn-rain-001:ambient:copiste` retrouve le même locuteur
avant et après une transition, comme les PNJ authored ou les acteurs locaux
créés ultérieurement.

## Autorité des paroles

Une réplique persistée possède l'autorité `PRESENTATION_ONLY`. Elle sert à la
continuité du dialogue, mais ne devient pas :

- un fait objectif ;
- une relation mécanique ;
- un engagement durable ;
- une connaissance globale du personnage ;
- un commit de campagne.

Le `npc_performer` doit produire `durableCommitments: []`. Une acceptation
durable attend toujours une confirmation du domaine mission/relation.

Exemple : « je peux vous aider » reste une phrase attribuée au garde. Elle ne
crée une mission ou une obligation que si le futur domaine propriétaire
confirme cet engagement.

## Retour de scène

Les répliques affichées sont reconstruites depuis les projections persistées de
la campagne. La présence actuelle de l'acteur reste validée par la scène active.
Après un départ et un retour :

1. l'identité de l'acteur est résolue dans la scène revenue ;
2. seules ses projections de dialogue sont relues ;
3. les cinq plus récentes sont couplées aux expressions du joueur ;
4. le performer répond depuis cette perspective bornée.

Le retour ne promeut pas l'acteur en PNJ durable.

Le même `actorId` retrouve aussi sa perspective, ses opinions subjectives, ses
préoccupations immédiates et sa manière de parler. Ces éléments restent une
continuité de présentation privée : ils ne mutent pas l'agrégat social 6C.

## Critique et coût

Le premier échange simple peut éviter le critique. Dès qu'une histoire de
dialogue est fournie, le critique vérifie conditionnellement la fidélité à
l'acte, à l'acteur et à la continuité. Il ne rédige pas une réponse de secours.

La recette OpenAI du 2026-07-28 couvre 14 tours continus :

| Rôle | Appels | Latence moyenne | Maximum |
|---|---:|---:|---:|
| `player_intent_interpreter` | 14 | 2,717 s | 4,560 s |
| `npc_performer` | 11 | 12,280 s | 15,142 s |
| `coherence_critic` | 9 | 4,598 s | 7,779 s |

Elle se termine avec cinq souvenirs pour la serveuse et quatre pour le garde,
après une entrée dans l'arrière-salle et un retour dans la salle commune.

## Preuves

- `npm run narration-module:test:complete-conversations` : 13 tours
  déterministes, deux PNJ, limite par acteur et absence d'engagement durable.
- `npm run narration-module:test:narrative-render-projection` : persistance et
  reconstruction des paroles affichées.
- `npm run narration-module:test:npc-return-ui` : gate J1 hors Archives avec
  quatre échanges, variation locale bornée, une réponse par tour, sortie-retour,
  conséquence de déplacement visible et reprise du fil depuis IndexedDB.
- `npm run narration-module:test:complete-conversations:openai-live` : recette
  OpenAI de 14 tours et métriques séparées par rôle.
