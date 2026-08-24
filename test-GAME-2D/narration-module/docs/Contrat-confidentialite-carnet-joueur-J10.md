# Contrat de confidentialité du carnet joueur J10

Statut : `IMPLÉMENTÉ ET CERTIFIÉ EN J10-D`

## Objet et autorité

Le carnet est un aide-mémoire privé écrit par le joueur. Il n'est ni une
connaissance du personnage, ni une mémoire narrative, ni une preuve, ni un état
du monde. Son seul propriétaire est le joueur local.

Le contrat futur `player-private-notebook/1` est servi par un port
`PlayerPrivateNotebookRepository` hors du `CampaignRepository`. Aucun domaine
métier ne dépend de ce port et son indisponibilité ne bloque jamais un tour.

## Modèle minimal

Un document est indexé par `campaignId` et `characterRef` et contient :

- une révision monotone locale ;
- une liste ordonnée d'intercalaires ;
- pour chaque intercalaire, un identifiant opaque, un titre, un texte libre et
  des dates techniques de création/modification ;
- aucune référence autoritaire obligatoire vers une intrigue, un PNJ, une
  mission ou un événement.

Les opérations autorisées sont créer, renommer, réordonner, modifier et
supprimer. Elles ne produisent ni commande, ni événement, ni temps de jeu.

## Frontière de confidentialité

Le carnet et toute valeur qui en provient sont interdits dans :

- `CampaignRepository`, agrégats, commandes, événements, opérations, snapshots
  et mémoires ;
- `PlayerPublicContextV1` et les futures projections de récapitulatif ;
- `roleContextPack`, `task`, prompt, output contract ou correction de tous les
  rôles IA ;
- télémétrie, incident, diagnostic, trace système, `sourceRefs` et journal
  serveur ;
- rendu du MJ, d'un PNJ ou d'une intrigue, sauf si le joueur recopie lui-même le
  texte dans la saisie narrative d'un tour ultérieur.

Un bouton ou automatisme « partager avec le MJ » est hors périmètre J10. La
séparation protège contre l'ingestion applicative et réseau ; elle ne constitue
pas un chiffrement contre une personne utilisant le même profil navigateur.

## Stockage et migrations

J10-D utilise la base IndexedDB dédiée
`jdr5e-player-private-notebook-v1`, distincte de la base de campagne. La version
initiale possède un store `notebook_documents` indexé par une clé de portée
dérivée de `campaignId` et `characterRef`.

Il n'existe aucune donnée antérieure à migrer et aucune migration de
`campaign-storage/1` n'est autorisée. Une évolution future devra copier puis
valider le document privé avant bascule ; l'échec conserve la génération
précédente. Export, synchronisation et partage multi-appareils restent différés.

L'implémentation active se trouve dans
`src/narration-ui/playerPrivateNotebook.ts`. Le port
`PlayerPrivateNotebookRepository` possède deux adaptateurs : mémoire pour les
tests de contrat et IndexedDB pour le navigateur. La surface reçoit uniquement
une portée `{ campaignId, characterRef }` et monte un panneau client séparé ; le
contrôleur narratif et le repository de campagne ne reçoivent jamais le
document.

Les limites V1 sont de 20 intercalaires, 80 caractères par titre et 20 000
caractères par texte. Toute mutation incrémente une révision locale et passe par
un compare-and-swap atomique. Les modifications d'une même page sont sérialisées
avant écriture afin d'éviter un faux conflit entre autosauvegarde, renommage et
réorganisation.

## Refus obligatoires

- portée, identifiant d'intercalaire ou révision invalides ;
- écriture concurrente sur une ancienne révision ;
- titre ou texte dépassant les limites fixées par l'implémentation ;
- tentative d'ajout du carnet à une projection, un paquet IA ou une autorité ;
- lecture d'un document appartenant à une autre campagne ou un autre personnage.

## Preuves attendues

- contrats mémoire et IndexedDB, réouverture et conflit de révision ;
- canari privé absent de toute requête IA interceptée ;
- canari absent du récapitulatif, des rendus et du repository de campagne ;
- création, ordre, édition et suppression restaurés après rechargement ;
- jeu et sauvegarde de campagne fonctionnels si la base privée est indisponible.

La commande `npm run narration-module:test:j10d-notebook` couvre ces preuves en
mémoire et dans Chromium. Son audit source refuse toute référence au contrat ou
à la base privée dans `narration-module/src` et dans la route IA serveur.
