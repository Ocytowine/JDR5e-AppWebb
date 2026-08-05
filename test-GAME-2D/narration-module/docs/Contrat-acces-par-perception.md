# Contrat d'accès par perception

Statut : actif — lot C livré le 2026-08-04.

## Frontière d'autorité

La perception peut décrire un dispositif visible, contredire une hypothèse ou
révéler un indice catalogué. Elle ne crée ni passage, ni faiblesse, ni
permission et ne modifie jamais directement `world.access-control-registry`.
Seule une autorité monde ou accès pourra ouvrir le seuil si un état physique
change réellement.

Une recherche active réutilise `perception-resolution/1`, le d20 persistant et
`perception-skill-check-outcome/1`. Une réussite révèle seulement des indices
`CHECKED` et `VISIBLE_SIGN` de la cible ; un échec ne révèle rien et exige un
changement de contexte avant une nouvelle tentative. Les identités de test
sont courtes, déterministes et dérivées de la scène et de la cible afin de
rester valides dans les commits réels.

## Premier catalogue installé

Le seuil `poi:caserne_centrale:poi:2`, sur la connexion
`lore:caserne_centrale:connection:2`, expose trois niveaux sourcés :

- un regard constate le contrôle formel permanent ;
- un examen attentif ne confirme aucune ouverture secondaire visible ;
- une recherche réussie montre que les gardes attendent le signal de
  l'officier de quart, ce qui révèle une approche sociale possible sans
  accorder de permission.

Les cas « rien trouvé », information directe, test requis, approche révélée et
contradiction sont couverts. La liste des approches reste non exhaustive.

## Vérifications

```text
npm run narration-module:test:access-perception
npm run narration-module:test:perception
npm run narration-module:test:perception-skill-check-outcome
npm run narration-module:test:pending-skill-check-resume
npm run narration-module:test:campaign-access-lot-c
```

La recette navigateur crée une campagne, place explicitement le personnage au
seuil, observe, examine, lance une recherche déterministe, recharge la campagne
et vérifie que le résultat est restauré tandis que le contrôle demeure
`CONTROLLED`. Aucun appel OpenAI facturé n'est utilisé.

## Limites

Le catalogue ne déclare aucune entrée alternative réelle et ne sait pas encore
appliquer une faiblesse physique. Crochetage, force, outils et sorts relèvent
du lot D ; les outcomes tactiques relèvent du lot E.
