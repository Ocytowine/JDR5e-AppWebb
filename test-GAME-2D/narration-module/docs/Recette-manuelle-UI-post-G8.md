# Recette manuelle UI après G8

Date : 2026-08-26
Statut : `PRÊTE — OBSERVATION PRODUIT CIBLÉE`

## But

Cette recette vérifie la fluidité de l'interprétation OpenAI dans une vraie
conversation. Elle ne cherche ni une prose exacte ni la réussite forcée des
actions. Une clarification pertinente est un résultat sûr et acceptable ; une
mutation, un changement d'interlocuteur ou un engagement inventé ne l'est pas.

## Préparation

Depuis `test-GAME-2D/`, lancer l'application complète avec `npm run dev`, puis
ouvrir une campagne sur une scène contenant le garde, la serveuse et la porte du
fond. Utiliser une campagne fraîche ou noter l'état initial : interlocuteur,
temps, inventaire et scène.

Pour chaque essai, conserver la phrase exacte, la réponse visible et les quatre
états ci-dessus. Ne pas comparer mot à mot la prose du MJ.

## Tests utiles maintenant

0. **Approche d'un acteur ambiant** — aux Archives de Lysenthe : « je
   m'approche du clerc ».  
   Attendu : l'intention vise le clerc déjà visible et la réponse raconte le
   rapprochement dans la fiction. Aucune demande de reformulation, parole ou
   réaction automatique du clerc ; aucun terme technique comme « moteur »,
   « capacité », « commit » ou « action enregistrée » dans le fil joueur.

0 bis. **Approche et salutation composées** — aux Archives : « je m'approche du
   clerc, et je le salue ».
   Attendu : l'approche et la salutation du même clerc sont conservées dans cet
   ordre, racontées dans la fiction et validées comme une seule interaction
   locale bornée. Aucun handoff vers un « domaine propriétaire ». Une réaction
   visible du clerc peut être narrée, mais aucun dialogue prononcé ne doit être
   inventé si OpenAI a compris la salutation comme non verbale.

0 ter. **Même intention, liaison de but** — « je m'approche du clerc afin de le
   saluer ».
   Attendu : même continuité immersive. Si OpenAI choisit la capacité exacte de
   dialogue mais fournit un domaine indicatif différent, le registre local doit
   retrouver le propriétaire social de cette capacité ; aucun handoff technique.

1. **Dialogue direct** — « Je demande au garde ce qui s'est passé ici. »  
   Attendu : la demande reste adressée au garde. Aucun succès social ou fait
   caché n'est accordé par l'interpréteur.

2. **Ellipse conversationnelle** — après la réponse au test 1 : « Et dehors ? »  
   Attendu : soit la relance continue naturellement avec le garde, soit une
   unique clarification pertinente apparaît. Mauvais résultat : changement
   silencieux vers une question générale au MJ ou invention d'un destinataire.

3. **Condition isolée** — « Si le garde s'écarte, alors j'ouvre la porte du
   fond. »  
   Attendu : la porte ne s'ouvre pas avant établissement de la condition ; pas
   de temps, d'inventaire ou de succès implicite.

4. **Séquence simple** — « Je demande au garde d'attendre, puis je donne ma
   fiole à la serveuse. »  
   Attendu actuel : le sens et l'ordre doivent être conservés. Une suspension
   sûre est normale, car le coordinateur natif multi-propriétaires n'est pas
   encore livré. Ne pas attendre l'exécution complète des deux étapes.

5. **Ambiguïté volontaire** — dans une situation avec plusieurs destinataires
   plausibles : « Je lui donne la fiole. »  
   Attendu : clarification ou résolution depuis un contexte réellement
   suffisant, jamais choix arbitraire ; aucune mutation avant clarification.

6. **Contexte du personnage** — « Je dis au garde que cet endroit me rappelle
   les tours près desquelles j'ai grandi. »  
   Attendu : dialogue conservé et usage possible du récit public du personnage,
   sans inventer de mécanique, ressource ou secret.

## Tests inutiles ou trompeurs à ce stade

- exiger l'exécution complète d'une longue phrase multi-domaines ou
  multi-cibles : le
  coordinateur atomique reste volontairement absent ;
- tester carte de voyage, placement tactique ou contrôle direct des compagnons ;
- chercher des mots déclencheurs précis ou comparer la prose exacte ;
- multiplier des formulations aléatoires sans noter contexte et état initial ;
- considérer toute clarification comme un bug : elle devient un bug seulement
  si le contexte public rendait réellement le sens et les référents suffisants.

## Critères de retour

Le retour utile contient : phrase exacte, deux ou trois tours précédents,
réponse visible, clarification éventuelle, interlocuteur avant/après, temps
avant/après et inventaire avant/après. Une capture d'écran peut compléter ces
informations, mais ne remplace pas le texte exact.
