# Recette manuelle post-I-06ZR

Date de préparation : 2026-07-20

Statut : `A_EXECUTER`

## Objectif

Cette recette vérifie en conditions réelles la fidélité entre les textes du joueur, les référents de la conversation, la résolution système et le rendu visible après I-06ZR.

Elle doit être exécutée avec la surface narration en mode **OpenAI**. Les textes doivent être saisis exactement dans l'ordre indiqué, sans reformulation et sans supprimer IndexedDB entre deux étapes d'un même scénario.

## Informations à noter une seule fois

- Date et heure du test :
- Commit testé (`git rev-parse --short HEAD`) :
- Navigateur et version :
- Mode affiché dans l'interface :
- Modèles configurés, si connus :
- Serveur redémarré avant la recette : oui / non
- Erreur visible dans la console navigateur avant le premier scénario :

Ne jamais copier de clé API, de contenu de `.env` ou de secret dans le compte rendu.

## Réinitialiser la campagne narrative

La base de la surface narration s'appelle `jdr5e-narration-prototype`.

Pour repartir d'un état propre dans Chrome ou Edge :

1. ouvrir les outils de développement avec `F12` ;
2. ouvrir **Application** ;
3. dans **Stockage** / **Storage**, développer **IndexedDB** ;
4. sélectionner `jdr5e-narration-prototype` ;
5. choisir **Supprimer la base de données** / **Delete database** ;
6. recharger complètement la page ;
7. vérifier que la scène initiale de l'auberge est de nouveau affichée ;
8. sélectionner de nouveau le mode **OpenAI** si nécessaire.

Si la suppression est bloquée, fermer les autres onglets de l'application, recharger l'onglet restant et recommencer.

### Règle de séparation

- Supprimer IndexedDB **avant chaque scénario numéroté** ci-dessous.
- Ne pas la supprimer entre les étapes d'un scénario.
- Si une étape reste indéfiniment occupée ou produit `campaign-busy`, conserver toutes les sorties, noter l'incident et arrêter ce scénario. Réinitialiser ensuite IndexedDB avant le scénario suivant.

## Comment consigner chaque réponse

Après chaque saisie, attendre que tous les blocs du tour soient affichés. Copier les blocs dans leur ordre exact, y compris les titres, badges, notifications système, détails `Issue:` et messages d'erreur.

Utiliser ce modèle sous chaque étape :

```text
Texte saisi :

Bloc visible 1 — titre/type :
Contenu :
Badges :

Bloc visible 2 — titre/type :
Contenu :
Badges :

Bloc visible 3 — titre/type :
Contenu :
Badges :

Autres blocs :

Erreur console ou réseau associée :
```

Ne pas résumer les notifications système : les copier intégralement. Une capture d'écran peut compléter le texte, mais ne le remplace pas.

## Scénario 1 — Chaîne conversationnelle principale

**Supprimer IndexedDB avant l'étape 1.**

Saisir successivement, en attendant la fin complète de chaque tour :

1. `Je regarde la serveuse.`
2. `Je l'observe plus attentivement.`
3. `Je lui demande pourquoi elle regarde la porte.`
4. `Je l'ouvre.`

Points contrôlés :

- une seule narration MJ par tour ;
- narration MJ placée avant la notification système ;
- les deux premières observations ciblent la serveuse ;
- `lui` cible encore la serveuse au troisième tour ;
- la porte mentionnée au troisième tour devient, ou non, le référent exploitable de `Je l'ouvre.` ;
- les observations sont affichées comme exécutées sans mutation durable ;
- la parole est enregistrée comme parole adressée à la serveuse ;
- l'ouverture est soit exécutée sur la porte avec un statut cohérent, soit explicitement clarifiée/refusée sans faux succès ;
- absence de `AI_INTERPRETATION_FAILED`, `intent-authority.contradiction` et `campaign-busy`.

## Scénario 2 — Référent objet explicite puis ellipse

**Supprimer IndexedDB avant l'étape 1.**

1. `Je regarde la porte.`
2. `Je l'observe plus attentivement.`
3. `Je l'ouvre.`

Points contrôlés :

- `l'` reste attaché à la porte aux étapes 2 et 3 ;
- l'observation n'est pas confondue avec une ouverture ;
- l'ouverture ne cible ni la serveuse ni un objet arbitraire ;
- distinction nette entre observation sans mutation durable et ouverture locale enregistrée ;
- aucune erreur d'autorité ou campagne occupée.

## Scénario 3 — Ambiguïté réelle sans référent masculin récent

**Supprimer IndexedDB avant l'étape 1.**

1. `Je le regarde.`

Points contrôlés :

- aucune cible masculine n'est choisie arbitrairement ;
- le système demande une clarification ou refuse l'exploitation du tour ;
- aucune narration ne présente l'observation comme exécutée sur une cible inventée ;
- aucun commit et aucune avance temporelle ;
- absence de `AI_INTERPRETATION_FAILED`, `intent-authority.contradiction` et `campaign-busy`.

Après la réponse, saisir sans réinitialiser :

2. `Je regarde le garde blessé.`
3. `Je le regarde plus attentivement.`

Points contrôlés :

- le tour 2 reste accepté après la clarification du tour 1 ;
- `le` cible le garde blessé au tour 3 ;
- la clarification précédente n'a pas laissé la campagne occupée.

## Scénario 4 — Changement de domaine : observation, parole, attaque

**Supprimer IndexedDB avant l'étape 1.**

1. `Je regarde le garde blessé.`
2. `Je lui demande ce qui lui est arrivé.`
3. `Je l'attaque.`

Points contrôlés :

- le garde reste la cible des trois tours ;
- le passage observation → parole ne mélange pas les statuts ;
- le passage parole → attaque est reconnu comme changement de domaine ;
- aucune attaque n'est faussement résolue par le domaine narratif si le domaine tactique est fermé ;
- un handoff/refus tactique reste sans faux commit narratif et sans narration de victoire ou de blessure ;
- le PNJ ne répond pas comme si l'attaque était une nouvelle parole ;
- absence des trois erreurs surveillées.

## Scénario 5 — Changement de domaine : observation puis inventaire

**Supprimer IndexedDB avant l'étape 1.**

1. `Je regarde la porte.`
2. `Je vérifie mon inventaire.`
3. `Je l'ouvre.`

Points contrôlés :

- l'étape 2 est dirigée vers le domaine inventaire, sans être transformée en observation de la porte ;
- aucun objet d'inventaire n'est inventé ni modifié par la narration ;
- le changement de domaine ne doit pas fabriquer un nouveau référent pour `l'` ;
- noter précisément si l'étape 3 cible encore la porte, demande une clarification ou est refusée ;
- aucune mutation d'inventaire et aucune erreur d'autorité.

## Scénario 6 — Exécuté sans mutation durable contre action refusée

**Supprimer IndexedDB avant l'étape 1.**

1. `J'observe attentivement la salle.`
2. `Je prends la bourse de la serveuse.`

Points contrôlés :

- l'observation est décrite comme exécutée sans mutation durable, et non comme une action refusée ;
- la prise/vol ne reçoit pas le même statut que l'observation si le domaine requis est fermé ;
- aucune possession n'est ajoutée et aucun succès de vol n'est narré ;
- les notifications permettent de distinguer clairement les deux situations ;
- absence de `AI_INTERPRETATION_FAILED`, `intent-authority.contradiction` et `campaign-busy`.

## Scénario 7 — Reprise après clarification

**Supprimer IndexedDB avant l'étape 1.**

1. `Je l'ouvre.`
2. `Je parle à la serveuse.`
3. `Je lui demande ce qu'elle attend.`

Points contrôlés :

- l'étape 1 clarifie ou refuse faute de référent compatible ;
- l'étape 2 est acceptée immédiatement après ;
- l'étape 3 cible la serveuse ;
- aucune opération `RECEIVED` résiduelle ne provoque `campaign-busy` ;
- la clarification n'est pas présentée comme une action exécutée.

## Bilan global à remplir

```text
Scénario 1 : OK / À CORRIGER / BLOQUANT
Scénario 2 : OK / À CORRIGER / BLOQUANT
Scénario 3 : OK / À CORRIGER / BLOQUANT
Scénario 4 : OK / À CORRIGER / BLOQUANT
Scénario 5 : OK / À CORRIGER / BLOQUANT
Scénario 6 : OK / À CORRIGER / BLOQUANT
Scénario 7 : OK / À CORRIGER / BLOQUANT

Nombre de tours avec plusieurs narrations MJ :
Nombre de tours avec notification avant narration :
Nombre de référents manifestement incorrects :
Nombre d'actions refusées présentées comme exécutées :
Nombre d'observations exécutées présentées comme refusées :
Occurrences de AI_INTERPRETATION_FAILED :
Occurrences de intent-authority.contradiction :
Occurrences de campaign-busy :

Anomalie la plus importante :
Premier tour exact où elle apparaît :
```

## Règle de décision pour la revue

La recette bloque la fermeture fonctionnelle si au moins un tour :

- exécute une action sur le mauvais référent ;
- invente une cible pour résoudre une ambiguïté réelle ;
- produit plusieurs narrations MJ concurrentes ;
- place la notification système avant la narration du même tour ;
- annonce un succès ou une mutation hors de l'autorité du domaine ;
- laisse la campagne occupée après un rejet ou une clarification ;
- produit une contradiction d'autorité ;
- masque un échec d'interprétation IA derrière une narration fictionnelle.

Un `AI_INTERPRETATION_FAILED` isolé doit être conservé avec son diagnostic complet. Il indique d'abord un incident fournisseur, de schéma ou de mapping à analyser ; il ne doit jamais être reclassé comme une réponse narrative normale.
