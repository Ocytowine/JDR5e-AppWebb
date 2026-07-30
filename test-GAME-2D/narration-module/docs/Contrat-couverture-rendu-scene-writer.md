# Contrat de couverture du rendu `scene_writer`

Date : 2026-07-28

Statut : `IMPLEMENTE_ET_VALIDE`

## Problème

Une sortie peut respecter le schéma et l'autorité tout en étant inutilisable pour le joueur. Exemple observé en recette live : une observation générale des personnes présentes est remplacée par la seule description administrative du lieu.

Le `coherence_critic` n'est pas la solution à ce défaut : il contrôle une frontière d'autorité et ne doit ni réécrire la prose ni décider à la place du renderer ce qui répond à la demande.

## Décision

Le brief local dérive des exigences de couverture depuis l'intention canonique, la cible résolue et le registre visible. Ces exigences ne recherchent aucun vocabulaire dans la saisie joueur.

Pour une observation :

- sans cible : au moins une référence perceptible pertinente de la scène doit ancrer le rendu ;
- si aucune référence plus précise n'existe, la scène elle-même reste l'ancrage minimal.

La couverture d'une observation ciblée reste contrôlée par sa frontière d'autorité existante ; elle n'est pas élargie dans ce lot.

`groundedIn` signifie qu'un élément est annoncé comme couvert, et pas seulement qu'il figurait quelque part dans le contexte fourni. Cette auto-déclaration ne suffit toutefois pas : lorsqu'une présence doit être couverte, le brief fournit aussi les désignations narratives autorisées issues du registre. Le validateur vérifie qu'au moins une de ces désignations apparaît réellement dans la prose.

Ce contrôle textuel est dérivé des données de scène (`firstMention`, `subsequentMention`, `playerFacingLabel`). Il ne contient aucune liste de métiers, de noms ou de formulations joueur codée en dur.

## Dégradation

Le rejet conserve la narration déterministe déjà construite depuis les mêmes faits perceptibles. Il ne déclenche ni nouvel appel IA, ni réécriture par le critique, ni mutation métier.

La bulle système expose la raison de rejet (`required_narrative_coverage_missing`) pour distinguer une prose pauvre d'une panne fournisseur.

## Preuves attendues

- test déterministe : une simple description du lieu est rejetée pour une observation générale comportant des acteurs visibles ;
- une narration ancrée sur au moins une présence visible est acceptée ;
- aucune lecture lexicale de l'entrée joueur et aucune liste de noms ou métiers codée en dur ;
- recette OpenAI Archives ;
- build global.

## Validation du 2026-07-28

- `verify-ai-narrative-enhancement.ts` rejette une description de lieu qui ne couvre aucune présence et accepte le même contrat lorsqu'une référence d'acteur visible est effectivement couverte ;
- le test adversarial couvre aussi une fausse déclaration `groundedIn` : citer un acteur sans employer l'une de ses désignations narratives ne suffit plus ;
- le rendu déterministe de secours regroupe les présences visibles dans un seul paragraphe continu et conserve leurs références de provenance ;
- la recette OpenAI exacte « est ce que je vois des gens autour de moi ? » produit un paragraphe continu sur l'archiviste, le clerc et le garde, au lieu du seul résumé du bâtiment ;
- le writer a répondu en 13,53 à 14,66 s sur les passes validées ; aucun `coherence_critic` supplémentaire n'a été nécessaire ;
- les régressions V3 à V5, résolution, contrôleur, transition de scène, route serveur et surface UI passent ;
- `npm run build` passe.

## Renforcement après recette campagne du 2026-07-30

Une demande adressée au clerc des Archives, mal classée en question de contexte,
a reçu une prose provenant de la scène historique de l'auberge. Le
`coherence_critic` l'avait acceptée : sa décision seule ne constitue donc pas
une preuve locale suffisante.

Deux contraintes déterministes complètent désormais la frontière :

- pour une réponse de contexte sans commit, l'autorité de rendu transporte le
  texte déjà construit depuis la scène active comme unique fait positif, avec
  texture créative désactivée ;
- le candidat doit s'ancrer dans la référence de la scène active et employer sa
  désignation de lieu issue des données de cette scène.

Ainsi, un texte sur une salle commune, un garde blessé et une serveuse est
rejeté dans les Archives même s'il déclare à tort une discipline parfaite et
même avant de tenir compte du verdict du critique. Le contrôle utilise
`activeScene.sceneId` et `activeScene.locationName`, jamais une liste codée en
dur de lieux ou d'éléments interdits.
