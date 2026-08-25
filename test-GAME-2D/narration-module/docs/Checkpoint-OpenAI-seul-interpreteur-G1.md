# Checkpoint G1 — OpenAI seul interpréteur

Date : 2026-08-25

Statut : `FERMÉ`

## Résultat

Le chemin de jeu n'installe plus d'interpréteur lexical par défaut. La surface
jouable démarre directement avec la route serveur OpenAI et ne propose plus de
sélecteur local. Une configuration absente, une panne de transport ou une
sortie refusée produit une interprétation diagnostique non exécutable et une
question de reformulation destinée au joueur.

Avant tout routage, le contrôleur intercepte ce diagnostic. Il ne construit
aucune commande de domaine, n'appelle aucun `canHandle` ou `execute`, ne lance
ni planificateur MJ ni performer PNJ, ne commite rien et n'avance pas le temps.
Les détails techniques restent dans les traces de sécurité ; le fil joueur ne
montre qu'une clarification immersive et confirme que rien ne s'est produit.

Le fournisseur lexical est conservé sous le nom explicite
`createLocalAiIntentInterpreterFixtureConfigV1`. Son ancien alias ne sert qu'à
la compatibilité des tests existants et n'est appelé par aucune composition de
production. Il n'est jamais utilisé après une erreur distante.

## Preuves

- `npm run narration-module:test:openai-only-g1` : vert dans Chrome réel ; la
  route OpenAI simulée répond HTTP 503, `player_intent_interpreter` est bien
  appelé, aucun propriétaire de domaine ne l'est et aucune action locale
  n'apparaît ;
- `npm run narration-module:test:ai-intent-interpretation` : vert ; les sorties
  invalides restent sans fallback et leur rendu joueur demande une
  reformulation sans fuite du diagnostic technique ;
- `npm run narration-module:test:openai-intent-lexical-debt` : vert, aucune
  augmentation des seize fichiers suivis ;
- `npm run build` : vert ;
- aucun appel OpenAI live et aucune dépense distante pendant G1.

La suite `narration-module:test:narrative-turn-controller` atteint encore une
attente historique indépendante sur une performance PNJ locale absente après
une parole. La fixture d'interprétation y est désormais injectée explicitement ;
ce défaut n'implique ni fallback d'interprétation ni mutation lors d'une panne.
La recette J10-F historique utilisait implicitement le mode lexical du produit ;
elle reste une preuve archivée de J10-F mais devra recevoir un serveur OpenAI
simulé dans G6 avant de redevenir une gate compatible avec le chemin G1.

## Frontière de G2

G1 choisit qui interprète et sécurise l'échec. Il ne rend pas encore le schéma
V7 suffisamment ouvert. G2 doit ajouter le statut explicite de compréhension et
les composantes sémantiques ordonnées sans imposer une liste fermée d'actions.
