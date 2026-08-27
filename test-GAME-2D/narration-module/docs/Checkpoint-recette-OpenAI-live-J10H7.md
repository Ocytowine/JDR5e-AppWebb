# Checkpoint J10-H7 — recette OpenAI live finale

Date : 2026-08-27  
Statut : `FERMÉ — RECETTE LIVE VERTE APRÈS CORRECTIONS OBSERVÉES`

## Périmètre joué

La recette a utilisé la vraie interface Chromium, la route serveur OpenAI et
les modèles configurés par le produit. Elle couvre :

1. approche du garde et salutation ;
2. reload, restauration du fil, puis « Je lui demande si tout va bien. » ;
3. changement explicite vers l'archiviste et question sur le classement des actes ;
4. passage propriétaire vers la Place des archives.

Chaque tour conserve une unique entrée brute, reste sous trois rôles distants,
n'appelle jamais `mj_planner` sur les dialogues V8 et n'affiche aucune trace
technique dans le fil joueur. Les quatre résolutions utiles sont committées ;
aucun fallback ni échec par rôle ne subsiste dans les diagnostics finaux.

## Résultats observés

| Scénario | Rôles OpenAI | Résultat |
|---|---|---|
| Approche + salutation | interpréteur → performer → critique | garde ciblé, salutation incarnée, aucun fallback |
| Reprise pronominale après reload | interpréteur → performer → critique | `lui` résolu vers le garde, réponse cohérente, focus restauré |
| Changement d'interlocuteur | interpréteur → performer → critique | orientation puis dialogue vers l'archiviste, une seule réplique |
| Passage vers la place | interpréteur → créateur de scène → scene writer | transition committée et Place des archives rendue |

Les reçus chiffrés conservés pour les trois derniers scénarios totalisent
62 668 tokens et 90 889 ms de latence cumulée de route :

- reprise pronominale : 18 524 tokens, 26 123 ms ;
- changement d'interlocuteur : 16 233 tokens, 29 935 ms ;
- transition propriétaire : 27 911 tokens, 34 831 ms.

Les neuf appels mesurés sont HTTP 200 et terminés. Les modèles observés sont
`gpt-5.6-luna` pour l'interprétation et la création guidée, puis `gpt-5.5` pour
le performer, le critique et le rendu de scène. Le reçu chiffré du premier tour
n'a pas été conservé par le premier arrêt de harnais, mais ses trois rôles, son
commit, sa performance acceptée et l'absence de fallback ont été vérifiés avant
le reload.

Le plafond global de la campagne de recette est de 22 requêtes de route : 12
appels appartiennent aux quatre scénarios finaux et 10 aux essais diagnostiques
ayant révélé les défauts ci-dessous. Aucun appel n'a dépassé ce plafond.

## Défauts révélés et corrigés

- La route serveur refusait les 8 000 jetons d'entrée déclarés par le
  `npc_performer` : le contrat serveur est maintenant aligné et testé à 8 000,
  avec rejet à 8 001.
- Le performer héritait d'un effort de raisonnement implicite et épuisait ses
  2 000 jetons avant de fermer le JSON : son effort par défaut est désormais
  explicitement `none`, sans augmenter son plafond de sortie.
- Le diagnostic H5 présentait l'ancienne projection de compatibilité comme
  statut d'interprétation : il expose désormais séparément compréhension V8,
  projection historique et décision propriétaire effective.
- Une orientation vers un acteur visible n'avait aucune capacité exacte et
  bloquait le dialogue suivant : `scene.visible-actor-orientation` décrit cette
  mise en attention et autorise uniquement la micro-séquence structurée vers le
  même acteur. Une action inconnue reste bloquée.
- Une composition orientation + parole rendait deux fois le même emplacement
  PNJ : le rendu local n'émet désormais qu'une réaction, ensuite remplacée par
  la performance OpenAI acceptée.
- Le harnais comptait le fil restauré avant la fin de l'hydratation IndexedDB :
  il attend maintenant explicitement l'entrée et la réplique restaurées.

## Vérifications

Le harnais de recette complète reste disponible avec :

```powershell
npm run narration-module:test:j10h7-openai-live
```

Pour ne pas repayer les scénarios déjà prouvés après chaque correction, la
preuve finale a utilisé le mode borné `J10H7_REMAINING_ONLY=1` pour les deux
derniers scénarios. Le résultat H7 est donc consolidé entre les diagnostics des
deux premiers tours et la passe finale verte des deux derniers ; la recette
complète n'a pas été rejouée une fois supplémentaire après fermeture.

Les corrections ont également repassé les gates route OpenAI, G5, G7, H5,
H4, H3, H0, projection de rendu, compilation du module, TypeScript global et
build complet. `git diff --check` ne signale aucune erreur ; les avertissements
de conversion LF/CRLF restent ceux du poste Windows.

## Observation non bloquante

Les métriques fournisseur montrent que les tokens d'entrée réels peuvent être
supérieurs au champ `inputTokenBudget`, lequel décrit actuellement une limite
de préparation applicative et non un plafond fournisseur dur. Ce point doit
rester visible pour une future optimisation des coûts, mais il ne modifie ni
l'autorité, ni la correction sémantique, ni la fermeture de J10-H.
