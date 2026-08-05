# Mon guide de fonctionnement du jeu par un scénario continu

Destinataire : propriétaire du projet

Statut : `DOCUMENT_PERSONNEL_VIVANT_NON_CONTRACTUEL`

Dernière mise à jour : 2026-08-04

## Comment lire ce document

Ce guide raconte toujours la même aventure. Après chaque échange, il explique
en français ce que le système fait, ce qu'il sauvegarde, ce qu'il ne doit pas
supposer et ce qui reste à développer.

Les états utilisés sont :

- **Disponible** : comportement présent et vérifié dans l'application ;
- **Partiel** : une partie existe, mais le chemin complet n'est pas raccordé ;
- **Prévu** : contrat ou architecture décidée, runtime encore absent ;
- **Interdit** : comportement que l'application doit volontairement refuser.

## Scénario — Les bruits sous les Archives

### 1. Le personnage entre aux Archives

**MJ :** « Tu te trouves dans les Archives de Lysenthe. Des archivistes, des
clercs et un garde occupent les lieux. »

**Ce que fait le système**

Le jeu charge la scène depuis le lore et l'état actuel de la campagne. Il ne
considère pas toute la fiche du wiki comme immédiatement connue du personnage.
Il projette seulement les faits publics et perceptibles. Les silhouettes
ambiantes deviennent des interlocuteurs ciblables sans être automatiquement
créées comme PNJ durables.

**État : Disponible.** Les scènes lore, présences ambiantes, désignations et
rechargements sont actifs.

### 2. Le joueur questionne une archiviste

**Joueur :** « Est-ce qu'il se passe quelque chose d'inhabituel dans le
quartier ? »

**Archiviste :** « On raconte que du bruit a été entendu non loin, sous les
rues du centre. Certains parlent d'un ancien égout. »

**Ce que le système doit comprendre**

L'archiviste ne vient pas nécessairement d'énoncer une vérité. Elle a transmis
deux affirmations : un bruit aurait été entendu et un ancien égout pourrait
exister. Ces affirmations sont reliées à sa perspective et à sa réplique
exacte.

Le personnage apprend : « l'archiviste rapporte cette rumeur ». Il n'apprend
pas automatiquement : « le bruit existe » ou « l'Égout du Centre existe ».

Cette parole peut créer une amorce narrative et un sujet hypothétique nommé
provisoirement « Égout du Centre ». Ce sujet n'est pas encore une scène
jouable. Il sert à regrouper les témoignages et les contraintes futures sans
inventer rétroactivement une vérité.

**État : Disponible pour le dialogue et sa mémoire structurée.** Le jeu possède
les registres persistants capables de conserver l'affirmation, la perspective privée de l'archiviste, son
témoignage et ce que le personnage a entendu. Le performer PNJ classe désormais
« cet ancien égout » dans sa réponse structurée, et le runtime peut créer ou
réutiliser le dossier hypothétique sans déclarer que le lieu existe. Avant la
réponse, le même appel `npc_performer` reçoit les faits, croyances et
incertitudes persistantes autorisés pour l'archiviste. Une croyance reste
obligatoirement formulée comme croyance et non comme fait connu.

### 3. Le joueur interroge un clerc

**Joueur :** « Avez-vous entendu parler de cet égout ? »

**Clerc :** « Je ne sais pas s'il s'agit d'un égout. J'ai seulement vu une
grille condamnée derrière la cour des copistes. »

**Ce que fait le système cible**

Le clerc possède une autre perspective. Il exprime une observation et une
incertitude. Son témoignage ne remplace pas celui de l'archiviste et ne fusionne
pas avec lui en une vérité moyenne.

Le dossier « Égout du Centre » contient désormais deux sources :

- une rumeur sur des bruits sous les rues ;
- une observation attribuée d'une grille condamnée.

Le personnage connaît les deux déclarations et leur provenance. Il peut les
comparer, mais l'interface ne doit pas lui révéler laquelle est correcte.

**État : Disponible pour la chaîne PNJ → parole → mémoire.** Le registre sait conserver les deux témoignages comme deux
sources distinctes reliées à une même affirmation, sans en déduire une vérité.
Ce comportement est testé avec trois témoins. L'extraction depuis une
performance structurée, la sauvegarde après affichage et la réutilisation du
dossier « Égout du Centre » sont actives. Chaque PNJ reçoit seulement sa propre
projection durable : connu, cru ou incertain. Les relations, objectifs privés
et secrets du registre social ne sont pas transmis avec elle.

### 4. Le joueur demande au garde

**Joueur :** « Que protège la grille derrière la cour des copistes ? »

**Garde :** « Il n'y a aucune grille dans cette cour. Vous perdez votre
temps. »

**Ce que le système doit décider avant la réponse**

Trois situations sont possibles :

- le garde sait réellement qu'il n'y a pas de grille ;
- il croit sincèrement qu'il n'y en a pas ;
- il sait qu'elle existe et ment pour une raison établie.

Le système ne doit jamais choisir le mensonge uniquement pour rendre la scène
plus mystérieuse. Un mensonge volontaire exige une vérité privée et une cause,
par exemple protéger un passage utilisé par des contrebandiers. Si ces éléments
n'existent pas, le garde peut seulement répondre depuis une connaissance, une
croyance ou une incertitude autorisée.

Le joueur enregistre seulement : « le garde nie l'existence de la grille ».
L'intention secrète du garde reste invisible.

**État : Disponible sans mensonge volontaire.** La perspective privée peut être
sauvegardée sans être exposée au joueur et le performer lit maintenant les
perspectives `KNOWN`, `BELIEVED` et `UNCERTAIN` du garde. Une perspective de
tromperie est retirée de sa projection avec sa vérité et sa cause privées. Le
performer OpenAI interdit donc encore cette réponse mensongère en jeu.

### 5. Le joueur décide de chercher la cour

**Joueur :** « Je cherche la Cour des Copistes près des Archives. »

**Ce que fait le système**

Il vérifie d'abord si la cour existe déjà dans le lore, dans les lieux créés ou
dans les engagements de campagne. Si elle reste hypothétique, il évalue sa
plausibilité locale. Les témoignages ne votent pas pour son existence : ils
servent de contraintes attribuées.

Si la cour est compatible, le système fixe une vérité minimale avant de la
présenter : son identité, son parent géographique et les éléments déjà engagés.
Le créateur reçoit séparément le lore, la vérité committée, ce que le
personnage sait et les témoignages contradictoires. Il peut rendre crédibles les
déclarations sans rendre tout le monde véridique.

**État : Disponible pour la préparation cohérente du lieu.** La plausibilité,
la création locale, les doublons, le commit et le rechargement fonctionnent.
Le créateur reçoit désormais trois sections séparées : canon strict,
engagements de campagne et témoignages que le personnage actif a réellement
entendus. Un témoignage privé entre deux autres acteurs est exclu. Le créateur
peut rendre la Cour compatible avec la rumeur de la grille, mais ce choix de
création ne transforme pas rétroactivement le clerc en source objective.

### 6. Le personnage arrive dans la Cour des Copistes

**MJ :** « Tu quittes les Archives et gagnes une petite cour où les activités
de copie se poursuivent derrière plusieurs guichets. Au fond, une grille attire
ton attention. »

**Ce que fait le système**

La narration est produite après le commit. Elle suit le départ, le
franchissement et l'arrivée. La présence de la grille doit provenir d'une vérité
ou d'un engagement validé, pas simplement de la phrase du clerc.

Si la grille est réelle, le clerc avait peut-être raison. Cela ne prouve pas
encore que les bruits ou l'ancien égout existent. Chaque affirmation conserve
son propre statut.

**État : Disponible et certifié localement.** La scène peut être matérialisée
avec son contrôle d'accès sans déplacer le personnage. La création ne change
pas le statut des trois témoignages ; leur réconciliation arrive seulement
lorsqu'un domaine produit ensuite une preuve autoritaire.

### 7. La grille contrôle l'accès

**Joueur :** « J'ouvre la grille et j'entre. »

**MJ :** « La grille est surveillée et le passage ne t'est pas accordé pour
l'instant. »

**Ce que doit faire le système**

L'existence du lieu et son accessibilité sont deux questions différentes. Le
lieu situé derrière la grille peut exister même si le personnage ne peut pas y
entrer immédiatement.

Le passage possède un contrôle d'accès : ouvert, contrôlé, bloqué ou encore
inconnu. Le personnage peut atteindre le seuil sans franchir la connexion vers
l'intérieur.

Le système ne doit pas imposer une solution. Le joueur peut parler au garde,
présenter un mandat, mentir, négocier, observer, chercher une autre entrée,
forcer le passage ou repartir. Chaque approche est envoyée au domaine capable
de la résoudre.

**État : Disponible, y compris lors d'une matérialisation atomique.** Le
contrôle est sauvegardé séparément, la transition s'arrête au seuil sans
déplacer le personnage et une exigence secrète n'est pas affichée. Pour un lieu
entièrement nouveau, le lieu et son contrôle peuvent être créés dans un même
commit, mais seulement avec une autorisation du domaine propriétaire. Un simple
indice de l'arbitre reste insuffisant.

### 8. Le personnage découvre la condition

**Joueur :** « Je demande au garde ce qu'il faut pour passer. »

**Garde de la grille :** « Il faut présenter un mandat du Collegium. »

**Ce que fait le système cible**

Si le personnage ignorait cette règle, il l'apprend maintenant par le
témoignage du garde. Il sait que le garde affirme qu'un mandat est requis. Une
affiche officielle, un règlement ou une validation du domaine peut ensuite
confirmer objectivement cette information.

S'il avait déjà obtenu cette information auprès d'un autre PNJ, le système peut
la rappeler comme information entendue, sans annoncer qu'elle est vraie avant
confirmation.

**État : Disponible pour un témoignage PNJ rendu sans réécriture divergente.**
L'acquisition structurée `HEARD` et sa sauvegarde sont produites après la
réponse visible, sans appel IA supplémentaire. Si le texte affiché diffère de
la performance structurée, la capture est refusée pour ne pas mémoriser une
phrase que le joueur n'a pas vue.

### 9. Le joueur choisit une approche libre

**Joueur :** « Je présente le mandat obtenu plus tôt. »

**Ce que doit faire le système**

Le jeu vérifie réellement l'inventaire ou l'autorité ayant délivré le mandat.
Le texte du joueur et la parole d'un PNJ ne suffisent pas à créer l'objet. Si le
mandat existe et satisfait le contrôle, le passage peut être ouvert puis la
transition committée.

Avec une autre approche, le système change de domaine : social pour convaincre,
perception pour chercher une entrée, règles pour forcer, tactique si un conflit
est réellement déclenché.

**État : approche inventaire disponible dans le runtime et premier seuil de
campagne raccordé.** Devant un seuil compatible, « je tente de présenter
mon mandat » est envoyé au domaine inventaire sans nouvel appel IA. Le système
relit le personnage actif, retrouve l'exemplaire réel, vérifie sa quantité,
son accessibilité, son détenteur, sa validité à l'heure de campagne et son
périmètre. Le mandat est conservé ; un sceau à usage unique pourrait au
contraire être consommé. L'objet et l'accès sont mis à jour atomiquement, puis
le joueur doit encore demander le franchissement. Une campagne doit fournir
les politiques et justificatifs concrets correspondant à ses objets. La
campagne installée fournit maintenant le passage Caserne centrale → Château
Tharqual, un ordre de passage défini mais non accordé au personnage, ses alias
et un registre d'émission initialement vide.

Pour une négociation, le garde peut maintenant accorder, refuser, proposer une
condition ou demander un test. La parole exacte et sa décision sont conservées.
Seul un accord autoritaire ouvre le passage ; « revenez avec l'accord de ma
supérieure » n'accomplit pas automatiquement cette condition. Si un test est
requis, le bouton de jet reprend maintenant la même tentative après un
éventuel rechargement. Le domaine social transforme la réussite ou l'échec
mécanique en accord ou refus, puis sauvegarde atomiquement le résultat, le
temps et l'ouverture éventuelle. Le joueur ne reformule pas sa demande et
aucun nouvel appel IA n'est ajouté.

À la Caserne centrale, la perception est maintenant jouable sur le passage du
Château Tharqual. Un regard montre le contrôle, un examen peut contredire
l'hypothèse d'une porte latérale, et une recherche active demande un jet. Une
réussite révèle seulement que les gardes répondent au signal de l'officier de
quart : elle suggère une approche sociale, sans ouvrir le passage. Le résultat
du jet est restauré après rechargement.

La force brute est aussi jouable sur ce seuil : le domaine relit la Force et
l'Athlétisme du personnage, propose un DD 20, puis conserve six secondes et le
fracas produit. Une réussite ouvre le dispositif ; un échec le laisse
contrôlé. « Je crochète » est refusé tant qu'aucun véritable outil de voleur
n'est détenu.

L'approche tactique est également jouable. « J'attaque le garde » committe une
rencontre, sans ouvrir le passage ni faire avancer le temps. Le plateau relit
le personnage et le garde catalogué, conserve ses checkpoints après
rechargement et produit seul sa condition terminale. Une victoire validée
neutralise le contrôle et ouvre le passage ; une défaite le maintient. Les PV,
le registre d'accès et l'horloge sont intégrés ensemble une seule fois. La
liste des approches demeure non exhaustive.

### 10. Le personnage découvre la vérité

**MJ :** « Derrière la grille, le passage rejoint bien un ancien collecteur.
Les traces récentes expliquent les bruits rapportés. »

**Ce que fait le système cible**

La découverte confirme certaines affirmations, en réfute ou nuance d'autres,
et conserve l'historique : l'archiviste avait relayé une rumeur, le clerc avait
vu la grille et le premier garde l'avait niée. Le jeu ne réécrit aucune ancienne
parole.

Si le démenti du garde était un mensonge lié à une intrigue, la vérité, sa cause
et une voie de réfutation devaient avoir été engagées avant la révélation.

Le même fonctionnement doit s'appliquer à un personnage supposé mort, un récit
historique contesté, une faction secrète ou un événement dont plusieurs témoins
donnent des versions différentes.

**État : Disponible pour la résolution générique d'une affirmation.** Un
domaine propriétaire peut maintenant confirmer ou réfuter une proposition en
citant ses faits et son opération source. Seuls les acteurs autorisés reçoivent
`CONFIRMED` ou `REFUTED`. Leur prochain dialogue utilise cette résolution à la
place de leur ancienne croyance, tandis que les paroles historiques des trois
témoins restent inchangées. Les domaines concrets doivent naturellement
produire cette résolution au moment où leur gameplay établit le fait.

## Limites globales actuelles mises en évidence

- les PNJ utilisent leurs faits, croyances, incertitudes, confirmations et
  réfutations persistants ;
- les dialogues PNJ rendus alimentent automatiquement les registres, mais le
  mensonge volontaire reste volontairement exclu ;
- le créateur de lieu lit les témoignages entendus sans les confondre avec le
  canon ; confirmations, réfutations et reprise sont certifiées localement ;
- le mensonge volontaire reste interdit dans le performer actif ;
- existence et accès sont séparés et leur création atomique est certifiée ; le
  moteurs d'autorisation par inventaire et négociation sont certifiés, y
  compris la reprise automatique d'un test social ; un premier catalogue
  concret Caserne centrale → Château Tharqual couvre contrôle, interlocuteur,
  objet et justificatifs ; la perception du même seuil est certifiée sans
  mutation arbitraire ; la force par règles est certifiée avec équipement,
  jet, temps et bruit ; le handoff tactique du seuil est certifié avec
  checkpoint, outcome propriétaire, temps, ouverture et reprise ;
- le voyage lointain est reconnu, mais son processus joueur complet reste à
  construire.

## Coût IA d'un échange

Un tour ne peut jamais envoyer plus de trois appels OpenAI facturés, même si
plusieurs rôles ou une reprise technique sont demandés. La classification du
sujet, la création du dossier hypothétique, la sauvegarde du témoignage et la
mise à jour de la connaissance sont réalisées dans les sorties existantes ou
localement : elles n'ajoutent aucun appel. Si les trois places sont déjà
consommées, le critique ou le writer suivant est refusé et le jeu utilise son
rendu déterministe.

## Règle de mise à jour de ce guide

À chaque nouveau lot, remplacer l'état des étapes réellement livrées et ajouter
la preuve correspondante. Ne jamais présenter une cible documentaire comme une
fonction disponible. Conserver le même scénario afin de voir immédiatement si
une nouvelle brique améliore ou casse la cohérence globale.
