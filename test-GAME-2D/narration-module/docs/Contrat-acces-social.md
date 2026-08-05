# Contrat d'accès social

Statut : `REPRISE_TEST_SOCIAL_CERTIFIEE_LOCALEMENT_2026-08-04`

Ce contrat traite une approche adressée à un interlocuteur qui contrôle ou
représente un seuil. Il complète l'enregistrement des paroles : une phrase du
joueur reste une tentative sociale et n'accorde jamais elle-même un succès.

## Résultats autoritaires

Le propriétaire `SOCIAL_ACCESS_DOMAIN` peut produire exactement l'un de ces
résultats :

- `GRANTED` : la permission sociale est satisfaite et l'accès peut devenir
  `OPEN` si aucune autre exigence ne reste active ;
- `DENIED` : la demande est refusée et l'accès reste `CONTROLLED` ;
- `CONDITION_OFFERED` : l'interlocuteur formule une condition référencée, sans
  considérer qu'elle est déjà remplie ;
- `CHECK_REQUIRED` : une proposition de test est référencée, sans inventer son
  jet ni son résultat.

## Séquence

1. Le contrôleur constate une parole engagée devant un seuil social compatible.
2. Le résolveur de cible établit quel acteur répond réellement. Une cible
   absente ou ambiguë arrête la voie sociale.
3. L'autorité sociale relit le contrôle et décide selon la politique de la
   campagne. L'IA ne possède pas cette décision.
4. La parole exacte, l'interlocuteur, le résultat, l'heure et les sources sont
   enregistrés dans le registre des tentatives sociales.
5. Seul `GRANTED` peut modifier les exigences et l'état du contrôle, dans le
   même commit que la tentative.
6. La réponse autorisée de l'interlocuteur est affichée. L'ouverture ne déplace
   pas le personnage ; le franchissement reste une action séparée.

Lorsque le résultat est `CHECK_REQUIRED`, l'autorisation contient aussi la
proposition mécanique prête à lancer et une politique sociale couvrant les
deux branches. Le contrôleur persiste un contexte propriétaire avec la
tentative, le seuil, le joueur et l'interlocuteur. Le bouton de jet reprend ce
contexte :

1. le moteur de règles persiste un unique d20 ;
2. le domaine social relit la tentative et le contrôle ;
3. il transforme le verdict mécanique en `GRANTED` ou `DENIED` ;
4. la résolution de tentative, le contrôle éventuellement ouvert et le temps
   sont committés atomiquement ;
5. la réponse sociale committée est affichée sans reformulation du joueur ni
   nouvel appel IA.

Le dé ne modifie donc jamais directement le registre d'accès.

## Garanties

- Un refus, une condition ou un test requis ne modifient pas l'accès.
- L'acteur qui répond doit être exactement celui visé par la commande.
- Une autorisation invalide n'enregistre aucune tentative.
- Les références de résolution sont uniques et le rejeu est idempotent.
- Un rechargement entre la proposition et le jet restaure la même tentative ;
  un double clic ou un retry ne consomme pas un second d20 et n'applique pas
  deux fois la décision sociale.
- La réponse visible provient de l'autorité sociale ; une prose libre ne peut
  pas convertir un refus en accord.
- L'heure vient de `world.clock` et aucun temps de jeu n'est avancé.
- La voie locale ne crée aucun appel IA et reste sous le plafond transversal de
  trois appels facturés.

## Limites de composition

Le moteur, l'adaptateur de scène et le raccord au contrôleur sont disponibles.
La campagne installée fournit un premier mapping concret pour la connexion
Caserne centrale → Château Tharqual : l'officier de quart visible répond et
peut demander un test difficile de Charisme (Persuasion). Une réussite accorde
une audience sous sa responsabilité ; un échec maintient le contrôle. Les
autres seuils doivent encore fournir leur mapping et leur politique. Le raccord
refuse toute proposition incomplète, sans contexte personnage, DD résolu,
branches sourcées ou exigence sociale valide.

## Preuves

```text
npm run narration-module:test:social-access
npm run narration-module:test:pending-skill-check-resume
npm run narration-module:test:narrative-turn-controller
npm run narration-module:test:campaign-access-lot-b
```
