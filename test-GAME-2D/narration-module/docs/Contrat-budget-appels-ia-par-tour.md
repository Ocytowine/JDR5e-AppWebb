# Contrat du budget d'appels IA par tour narratif

Statut : `IMPLEMENTE_ET_TESTE`

## Règle

Un échange joueur complet dispose par défaut de trois appels OpenAI facturés.
Le plafond est partagé par tous les rôles et compte chaque tentative réellement
envoyée, y compris une reprise technique.

Une seule extension à quatre est autorisée lorsque le propriétaire
`CAMPAIGN_FACT` atteint effectivement une propriété publique absente dont le
lore autorise la création. Elle est ouverte juste avant `scene_creator`, pas au
début de tous les dialogues. Un cinquième appel, ou un quatrième appel sans
cette autorisation, est refusé localement avant d'atteindre le fournisseur. Le
jeu conserve alors son fallback déterministe. Les traitements locaux et les
providers de test ne consomment pas ce budget.

## Répartition

Le budget n'impose pas toujours les mêmes trois rôles. Exemples :

- dialogue V8 ordinaire : interpréteur, performer PNJ, critique si nécessaire ;
- dialogue V8 avec fait public créé : interpréteur, créateur du fait, performer
  PNJ, critique si nécessaire ;
- action narrative : interpréteur, planner, writer si nécessaire ;
- lieu local inconnu : interpréteur, arbitre de destination, créateur de scène.

Le planner est donc volontairement omis lorsqu'une création dynamique de lieu
est déjà prise en charge par son arbitre et son créateur. Un critique ou un
writer qui arriverait après consommation des trois places est remplacé par les
contrôles et rendus déterministes existants.

## Connaissances et témoignages

La classification d'une affirmation et de son sujet est produite dans la sortie
structurée du `npc_performer` déjà appelé. La résolution locale du dossier, la
sauvegarde du témoignage et la projection `HEARD` ne déclenchent aucun appel IA.

## Preuve

`npm run narration-module:test:ai-call-budget` vérifie :

- trois tentatives facturables au maximum, reprises comprises ;
- le partage du plafond entre interpréteur, planner, performer et writer ;
- le refus du quatrième appel avant le provider ;
- l'extension propriétaire bornée à quatre et le refus du cinquième appel ;
- l'exclusion des traitements locaux du budget facturé.
