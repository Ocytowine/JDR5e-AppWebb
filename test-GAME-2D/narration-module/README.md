# Module narration

Le module narration transforme une entrée libre du joueur en intention
structurée, la confronte à l'état de campagne et aux capacités disponibles, puis
produit une réponse visible sans donner à l'IA l'autorité sur les faits, les
résultats ou les commits.

## État actuel

Le vertical jouable sait notamment :

- démarrer une scène issue du wiki et suivre ses connexions ;
- charger un catalogue narratif ciblé généré au build, sans compiler le wiki
  brut dans le navigateur ;
- valider la fiche active du créateur, créer ou reprendre sa campagne
  persistante depuis l'accueil réel, ou ouvrir volontairement le pilote
  Archives isolé ;
- interpréter des intentions libres et composées avec le contrat sémantique V5 ;
- résoudre des observations, approches, dialogues et transitions locales dans
  leur périmètre actuel ;
- distinguer foule ambiante, acteur local, identité reconnue et PNJ durable ;
- maintenir cinq couples de dialogue exacts par acteur à travers un changement
  d'interlocuteur et un retour de scène ;
- enregistrer une proposition de mission ou de relation, distinguer
  acceptation, refus, condition et incertitude, puis vérifier l'acceptation
  propriétaire avant toute promotion durable d'un acteur local ;
- faire primer un remplacement ou un masquage validé de campagne sur le lore
  auteur, avec provenance et sans modifier le catalogue généré ;
- enrichir une narration avec OpenAI côté serveur, avec validation locale et
  rendu déterministe sûr ;
- persister la scène, le fil visible, la mémoire courte et les créations locales
  autorisées dans IndexedDB ;
- établir un bastion, terminer un travail catalogué, affecter un PNJ volontaire
  et recevoir une occasion, une conséquence locale ou une défense tactique
  issue d'une cause committée ;
- restaurer une défense active, valider ses projections d'acteurs, d'équipes et
  de carte, puis initialiser `GameBoard` sans configuration libre ;
- committer des checkpoints de frontière de tour, reprendre le plateau après
  rechargement, persister son outcome terminal, faire valider ses conséquences
  par leurs propriétaires puis les intégrer avec le temps dans un commit
  idempotent avant la reprise narrative. Une autorité cataloguée sait désormais
  préparer la graine depuis les agrégats personnage relus et conserver leurs
  références jusqu'au retour. Le bootstrap enregistre le personnage actif et
  le catalogue de défense est chargé depuis le paquet de contenu versionné.
  Une cause monde ou intrigue committée peut désormais cibler un bastion actif
  par une politique injectée, avec une frontière calme sinon. Le parcours
  complet est certifié dans le navigateur depuis une campagne isolée
  bootstrapée jusqu'à la continuation narrative restaurée après combat.

La campagne personnage est maintenant accessible depuis le build principal.
La composition de toutes les disponibilités repos, progression, bastion et
monde dans cette surface, ainsi que la mémoire sociale longue, restent
incomplètes.

## Principes

- Le wiki guide le lore ; il ne constitue pas l'inventaire exhaustif de tout ce
  qui existe dans une scène.
- L'IA comprend et rédige ; les domaines locaux valident, résolvent et
  persistent.
- Une parole de PNJ reste une parole attribuée, pas une vérité automatique.
- Une sortie destinée au joueur reste narrative. Les diagnostics appartiennent
  aux blocs système et ne doivent jamais contaminer la prose du MJ.
- Aucun mot ou exemple joueur n'est codé en dur pour décider du domaine, de la
  cible, du résultat ou du commit.
- Un appel IA n'est exécuté que s'il ajoute une valeur nécessaire au tour.

## Reprendre le travail

Lire dans cet ordre :

1. [`TASKS.md`](../../TASKS.md) ;
2. [`Consolidation-fondations-narration.md`](docs/Consolidation-fondations-narration.md) ;
3. [`docs/README.md`](docs/README.md) pour trouver le contrat concerné ;
4. le code et les tests du lot ;
5. `git status --short --branch`.

## Vérifications

Depuis `test-GAME-2D/` :

```powershell
npm run narration-module:test:contracts
npm run narration-module:test:orchestration
npm run narration-module:test:campaign-entry
npm run narration-module:test:campaign-entry-ui
npm run narration-module:test:playable-scene
npm run narration-module:test:narrative-lore-build-catalog
npm run narration-module:test:campaign-lore-projection
npm run narration-module:test:lore-playable-scene
npm run narration-module:test:complete-conversations
npm run narration-module:test:mission-relation-authority
npm run narration-module:test:npc-return-ui
npm run narration-module:test:semantic-v5-realistic-gate
npm run build
```

Les recettes OpenAI sont opt-in et nécessitent la configuration locale du
serveur. Elles complètent les tests déterministes ; elles ne les remplacent pas.

Le guide [`Guide-bastion-fonctionnement-et-tests.md`](docs/Guide-bastion-fonctionnement-et-tests.md)
explique en français le vertical 6F, ses exemples, ses commandes de test et ses
limites actuelles dans le build principal.

Les guides français des
[`PNJ et futurs compagnons`](docs/Guide-pnj-compagnons-et-initiative.md), du
[`repos et de la progression`](docs/Guide-repos-et-progression.md) et des
[`lieux connus ou créés`](docs/Guide-lieux-connus-crees-et-deplacements.md)
expliquent également les comportements actifs et leurs limites.

Le guide
[`défense de bastion et plateau tactique`](docs/Guide-defense-bastion-et-plateau-tactique.md)
décrit l'entrée 7A/7B de `GameBoard`, le retour 7C et l'alimentation de
campagne 8A à 8D, y compris la gate navigateur complète.
