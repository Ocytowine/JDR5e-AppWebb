# Checkpoint de certification factuelle J10-I7

Statut : `FERMÉ — J10-I TERMINÉ`

Date : 2026-08-31

## Résultat produit

Le runtime d'information PNJ est raccordé au contrôleur persistant et à la
surface jouable des Archives, y compris son repli mémoire. Une question ouverte
adressée au garde retrouve le fait public dans le lore, établit que cet acteur
local peut le connaître, autorise sa divulgation et produit une réponse directe
mentionnant le Tharque régent de Lysenthe.

Le même tour conserve sa réponse au rejeu et après rechargement IndexedDB. Le
diagnostic développeur expose `RESOLVED` et `ANSWER_DIRECTLY` sans référence
privée. Le fil joueur ne reçoit ni notice technique ni doublon.

## Matrice certifiée

| Famille | Preuve |
|---|---|
| lore, titre, siège, lieu et portée passée | lookup ciblé J10-I2 et contrôleur réel des Archives |
| connaissances communes, locales, professionnelles et acquises | projection candidat par candidat J10-I3 |
| fait libre, création d'identité et remplacement | autorité campagne atomique J10-I4 |
| rumeur, incertitude, secret, ignorance et orientation | divulgation J10-I5 |
| performer indisponible et témoignage | fallback expurgé J10-I6 |
| deux accès, concurrence, rejeu et reload | J10-I4, IndexedDB Chromium et contrôleur I7 |
| vraie surface produit | scénario Playwright des Archives avec restauration du fil |
| propriétaires J3 à J10-H | gate transverse `j10h6-owners` sans régression |

## Intégration et persistance

- `npcInformationRuntimeFactory` traverse les fabriques du contrôleur prototype
  et du contrôleur navigateur ;
- le pilote Archives construit ce runtime depuis le catalogue wiki, le dépôt de
  campagne et les ancres géographiques de la scène ;
- le repli mémoire utilise exactement la même composition ;
- le test navigateur emploie la vraie surface React, son bootstrap produit par
  défaut, le vrai contrôleur et une vraie base IndexedDB Chromium ;
- les migrations, la fermeture/réouverture et le refus des écritures partielles
  restent couverts par la gate IndexedDB existante.

## Vérification

Commande de certification complète :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i7-certification
```

Résultat local : contrôleur I7, gates I0 à I6, lore, faits de campagne,
IndexedDB, migrations, UI Chromium, propriétaires J3 à J10-H et build global
verts. Le build Vite transforme 1 601 modules.

Aucun appel OpenAI réel n'a été lancé : les indisponibilités distantes sont
simulées et la recette live reste soumise à un accord explicite.

## Autorités inchangées

Le performer et le writer ne créent ni vérité ni commit. Les secrets restent
chez leurs propriétaires, les témoignages ne deviennent pas des faits objectifs
et les domaines intrigue, mission, compagnon, inventaire, voyage, repos, monde
et tactique conservent leurs règles de mutation et de rejeu.

## Reprise

J10-I0 à J10-I7 sont fermés. Aucun sous-lot correctif J10-I ne reste ouvert.
Avant un futur changement de cette chaîne, relancer
`npm run narration-module:test:j10i7-certification` comme gate d'entrée.
