# Contrat d'intention sémantique V2

Date : 2026-07-21

Statut : `IMPLEMENTE_GATE_LIVE_VALIDEE`

## But

`ai-intent-semantic/2` allège `player_intent_interpreter` sans remplacer sa compréhension par des règles lexicales locales. L'IA conserve l'analyse ouverte de formulations indirectes, composées, fautives ou inédites. Le logiciel reprend seulement les responsabilités déterministes et autoritaires.

## Sortie IA conservée

- nature et objectif sémantiques complets ;
- engagement réel, conditionnel, hypothétique ou ambigu ;
- concept d'action ouvert dans `actionHint`, sans liste fermée ;
- domaine suggéré et portée générale (`LOCAL_INTERACTION`, `SCENE_TRANSITION`, etc.) ;
- mention de cible, éventuel lien au focus récent et référence proposée ;
- profondeur de perception ou acte de dialogue quand pertinent ;
- incertitudes et demande de clarification ;
- confiance.

`preconditions` transporte jusqu'au runtime les conditions explicitement posées par le joueur. Une liste non vide stabilise localement `commitment=committed` en `commitment=conditional`; le contenu de la condition reste visible dans `semanticIntent.preconditions` et dans la notification système. Cette cohérence est fondée sur la sortie structurée, sans analyse lexicale locale de la phrase joueur.

Les familles sémantiques distinguent désormais explicitement :

- `move_near_visible_actor` : déplacement local vers un acteur, sans parole ni signal communicatif ;
- `nonverbal_signal` : communication volontaire sans parole ;
- `manipulate_visible_object` : action sur un objet qui reste dans la scène courante ;
- `traverse_visible_boundary` : franchissement d'une limite visible vers un autre espace, routé vers le domaine monde.

Une cible décrite par ses propriétés publiques n'est proposée que si les faits visibles désignent un meilleur candidat unique. Une comparaison non étayée, comme « le moins nerveux » quand aucune graduation visible n'existe, doit rester ambiguë plutôt que d'être forcée.

Les points de passage peuvent déclarer des `destinationAliases` publics. Le registre les projette en `publicDestinationAliases`, transmis à l'interpréteur sous `destinations`. Si l'IA reconnaît un `traverse_visible_boundary` mais laisse `proposedRef=null`, l'adaptateur local peut relier la destination mentionnée à une ouverture uniquement lorsqu'une seule relation publique correspond, indépendamment de l'étiquette de lien contextuel proposée. Zéro ou plusieurs correspondances conservent la clarification : aucun choix arbitraire n'est effectué.

## Sorties retirées de l'IA

- projection legacy complète ;
- décision runtime et statut de support ;
- `noCommit`, `noGameTime` et effet temporel ;
- résolution autoritaire du référent ;
- listes répétées de risques et d'interdictions ;
- décision de handoff ou de mutation.

Ces champs sont reconstruits par l'adaptateur local, le registre de référents, le validateur d'autorité et `runtimeCapabilityRouting`. Aucun identifiant propre à l'auberge, aucune phrase joueur et aucun vocabulaire de PNJ n'est codé dans l'adaptateur V2.

## Compatibilité

Le contrat V1 reste accepté par la route et les fournisseurs contractuels existants. La surface OpenAI utilise V2 avec un budget de 900 tokens. Le V1 ne sera retiré qu'après une gate live stable.

## Preuves

- `npm run narration-module:test:semantic-intent-v2` : sept formulations ouvertes, dont mouvement local, franchissement, signal silencieux, cible descriptive, tentative conditionnelle, observation composée avec ellipse et question de perception sur une population générique non résolue.

Une mention perceptive générique, par exemple « est-ce que je perçois des gens non loin de moi ? », ne constitue pas une cible obligatoire. Le runtime conserve le sujet dans `perception.focus` mais n'exige pas de référent de scène précis avant de résoudre l'observation. Les intentions qui agissent sur un acteur ou un objet précis continuent, elles, à demander une cible résolue.

Une observation sans cible précise projette les présences immédiatement perceptibles déjà déclarées par la scène (`presentNpc` et `ambientPopulation`) dans une formulation destinée au joueur. Elle ne transmet ni clés de catalogue, ni rubriques wiki, ni inventaire exhaustif des `visibleElements` et `pointsOfInterest`. En l'absence de présence, la situation perceptible sert de repli. Les `perceptionClues` restent nécessaires pour les signes focalisés, vérifiés ou cachés.
- `npm run narration-module:test:ai-intent-interpretation` : compatibilité V1 ;
- `npm run narration-module:test:narrative-openai-route` : schémas stricts V1 et V2 ;
- `npm run narration-module:test:complete-conversations` : parcours déterministe de dix tours.

## Résultat live initial

Le parcours V2 complet dure 269,2 s contre 328,8 s en V1. L'interprétation descend de 14,2–30,0 s à 6,7–21,6 s sur huit des dix tours ordinaires. Les conversations, changements de PNJ, ellipses et mémoires restent cohérents.

Le tour de transition a produit le handoff attendu en 17,3 s puis 18,8 s lors de replays ciblés. Un replay supplémentaire a toutefois atteint la borne fournisseur de 30 s. La gate reste donc ouverte : le sens et le routage sont corrigés, mais la stabilité de latence n'est pas encore suffisante.

## Observabilité et gate de performance

Chaque appel serveur expose désormais dans la notification système existante : rôle, modèle, latence fournisseur, tokens d'entrée/sortie/total, motif de fin, budgets, taille du contexte et taille du schéma. Un transport interrompu conserve les mêmes dimensions avec des compteurs de tokens inconnus.

Le contexte V2 est limité aux référents visibles et à leurs propriétés publiques, aux trois focus récents et aux trois intentions sémantiques récentes. Le V1 conserve son paquet historique.

Un unique retry technique est autorisé pour l'interpréteur V2. Il ne s'applique qu'aux transports, timeouts, erreurs HTTP ou sorties incomplètes, avec une seconde borne ramenée à 15 s. Les erreurs sémantiques et d'autorité ne sont jamais rejouées.

La commande `npm run narration-module:test:complete-conversations:openai-gate` exécute trois parcours indépendants et exige zéro erreur fonctionnelle, un p95 d'interprétation inférieur ou égal à 15 s et aucun maximum supérieur à 25 s. La gate ciblée du 2026-07-21 obtient trois handoffs corrects en 16,0 s, 17,8 s et 18,7 s : qualité 3/3, gate de latence refusée avec p95=18,7 s.

Après séparation mouvement/franchissement, ajout des relations ouverture-destination et transport des préconditions, la gate finale Luna `none` du 2026-07-22 obtient trois passages consécutifs à 8/8, sans retry. Les p95 sont 3,761 s, 2,633 s et 2,846 s. Le contrat V2 est validé pour `player_intent_interpreter` avec `gpt-5.6-luna` et `reasoning=none`.
