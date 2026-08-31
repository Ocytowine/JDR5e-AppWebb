# Checkpoint création contrôlée d'information J10-J3

Statut : `FERMÉ`

Date : 2026-08-31

## Résultat

La propriété publique manquante d'Astryade est maintenant déclarée créable
comme identité. Lors de la première demande, une proposition créative bornée
est validée puis transformée par `CAMPAIGN_FACT` en un commit atomique contenant
l'identité légère et le fait. Dans un tour narratif actif, cette mutation est
préparée puis fusionnée au commit propriétaire du tour : aucun commit imbriqué
ne contourne le verrou de campagne. La projection factuelle relit la préparation
validée pour répondre dans le même tour, et tout tour suivant relit le fait
persisté depuis la nouvelle révision.

Les demandes suivantes, y compris depuis un autre PNJ ou après reload, lisent
le fait existant sans nouvel appel de génération. Deux créations concurrentes
ne peuvent produire qu'un slot actif et une identité. Une sortie qui tente de
changer la propriété ciblée est refusée sans commit et retombe sur la réponse
partielle J10-J2.

## Garanties

- politique de création déclarée dans le lore, sans routeur lexical ;
- valeur proposée par l'IA mais autorité de commit exclusivement locale ;
- identifiant d'identité construit de façon stable par le propriétaire ;
- cardinalité `SINGLE`, idempotence et contradiction protégées par J10-I4 ;
- fait et identité écrits dans un commit atomique ;
- parole, état de scène, fait et identité partagent le commit du tour lorsque
  la création naît pendant un dialogue ;
- aucun `campaign-busy` masqué et aucun relâchement du verrou de campagne ;
- deux PNJ, concurrence, replay et reload couverts ;
- réouverture IndexedDB couverte par la gate d'intégration J10-I4 réexécutée ;
- performer sans pouvoir de création ;
- panne ou proposition invalide sans mutation et avec réponse partielle sûre ;
- une question factuelle `UNDERSTOOD` ne peut plus traverser le serveur, le
  validateur local ou l'adaptateur avec sujet/portée, propriétés ou complétude
  vides ; le cas réel « Qui est le roi ? » traverse le contrôleur complet ;
- le profil conversationnel ne peut plus sourcer un reproche sur le ton ou le
  comportement actuel du joueur pendant une réponse factuelle ;
- le plafond reste à trois appels ordinaires et n'obtient un quatrième slot
  que si la création propriétaire est effectivement atteinte.

## Gate

```text
npm run narration-module:test:j10j3-controlled-creation
```

La gate couvre les sélecteurs J10-J0, le nouveau runtime, le schéma serveur, la
verticale réelle du contrôleur, le budget et les quatre rôles maximaux du
dialogue, J10-J2, l'intégration IndexedDB J10-I4, les validations de contenu et
le build global. Aucun appel OpenAI live n'est exécuté.
