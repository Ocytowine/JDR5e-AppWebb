# Checkpoint — besoin d'information V8 J10-I1

Statut : `FERMÉ`

Date : 2026-08-27

## Résultat

Un composant V8 `ASK_QUESTION` peut désormais porter un
`informationNeed/1` ouvert et nullable. Le besoin conserve le sujet mentionné,
une référence publique proposée, la dimension demandée, la portée temporelle,
la forme de réponse et l'identifiant du composant source.

Le transport est fidèle dans le cadre sémantique, le plan d'exécution G5, la
commande adressée au propriétaire social et le reçu de fidélité. Une référence
de sujet non publique suspend le tour avant la commande et avant tout commit.

Le schéma Structured Outputs exige `informationNeed` comme objet ou `null` sur
les nouvelles réponses du fournisseur. Les anciennes fixtures et données V8
qui omettent encore le champ restent lisibles et sont normalisées à `null`.

## Autorités inchangées

- aucun fait n'est recherché, inventé ou committé par ce contrat ;
- le propriétaire social ne reçoit toujours pas la saisie brute du joueur ;
- le performer PNJ n'est pas encore alimenté par le besoin ;
- connaissance de l'acteur et droit de divulgation restent hors de J10-I1 ;
- aucun temps de jeu supplémentaire n'est consommé.

## Couverture

- les dix questions factuelles du corpus J10-I0 acceptent un besoin structuré ;
- les quatre contre-exemples conservent `null` ;
- un cas factuel traverse toute la chaîne contrôleur jusqu'au reçu ;
- une question personnelle traverse avec `null` ;
- une référence de sujet privée ou inconnue provoque clarification sans commit ;
- une source de composant incohérente ou un besoin attaché à autre chose qu'un
  `ASK_QUESTION` est rejeté.

## Vérifications exécutées

- `npm run narration-module:test:j10i1-information-need`
- `node narration-module/tests/server/verify-narrative-openai-route.js`
- `npm run narration-module:test:open-semantic-frame-g2`
- `npm run narration-module:test:j10h3-fidelity`
- `npm run build` — 1593 modules transformés
- `git diff --check`

Aucun appel OpenAI réel n'a été exécuté. Aucun commit Git n'a été créé.

## Écart restant et reprise

J10-I1 ne résout encore aucun fait. J10-I2 doit brancher une lecture bornée par
le sujet, la propriété et les relations, avec priorité à l'état de campagne,
puis prouver que « Tharque régent » et « Château Tharqual » sont retrouvés
depuis les Archives sans dépendre du paquet descriptif fixe.

Première commande de reprise :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i1-information-need
```
