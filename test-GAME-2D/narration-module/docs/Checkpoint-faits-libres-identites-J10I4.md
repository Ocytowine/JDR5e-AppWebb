# Checkpoint — faits libres et identités légères J10-I4

Statut : `FERMÉ`

Date : 2026-08-28

## Résultat

Le module possède désormais un propriétaire persistant pour les faits libres
de campagne et un registre d'identités narratives légères. Dans le cas de
Lysenthe, le nom personnel proposé pour le Tharque est créé une fois avec son
fait de mandat, puis relu par toute autre demande.

Le commit écrit atomiquement :

- le slot factuel public `Lysenthe + current-ruler-personal-identity` ;
- l'identité `LIGHT_REFERENCE` nommée et son rôle public ;
- la commande acceptée et l'événement de cycle de vie correspondant.

## Garanties certifiées

- cardinalité `SINGLE` et contradiction refusée ;
- assertion identique sans second commit ;
- rejeu idempotent d'une opération terminée ;
- réutilisation du même fait et de la même identité par deux demandes PNJ ;
- reconstruction par les loaders après relecture du dépôt ;
- reconstruction par le lookup factuel après fermeture et réouverture réelle
  d'IndexedDB dans Chromium ;
- ancres `lore-entity`, `lore-fact` et `lore-fragment` validées contre le
  catalogue généré ;
- priorité de `CAMPAIGN_FACT` sur le même slot du lore initial ;
- lecture historique bornée par `campaignRevision` ;
- remplacement explicite avec lien vers le fait précédent ;
- invalidation explicite sans valeur de substitution ;
- concurrence sérialisée par lease, puis rejeu sans doublon ;
- aucune source privée ou cachée admise dans ce chemin public.

## Vérifications

- `npm run narration-module:test:j10i4-campaign-facts`
- `npm run narration-module:test:j10i4-integration`
- `npm run build` — 1597 modules transformés
- `git diff --check`

Aucun appel OpenAI réel n'a été exécuté. Aucun commit Git n'a été créé par
Codex pour ce jalon.

## Reprise J10-I5

J10-I5 doit prendre les candidats connus I3, y inclure le fait de campagne I4,
puis décider séparément ce qui peut être divulgué. La gate doit distinguer
réponse publique directe, ignorance crédible, rumeur qualifiée et secret connu
mais non révélable, avec une cause de refus structurée.

Première commande :

```powershell
cd test-GAME-2D
npm run narration-module:test:j10i4-campaign-facts
```
