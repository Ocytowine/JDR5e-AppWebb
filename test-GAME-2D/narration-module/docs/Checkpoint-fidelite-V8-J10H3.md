# Checkpoint de fidélité V8 J10-H3

Date : 2026-08-26

Statut : `FERMÉ — SANS APPEL OPENAI LIVE`

## Résultat

Le tour narratif conserve maintenant trois niveaux distincts :

1. `output.interpretation.openSemanticFrame`, cadre original reçu d'OpenAI ;
2. `output.resolution.interpretation`, projection structurée réellement remise
   au propriétaire local ;
3. `output.openSemanticFidelity`, reçu persistant qui relie les deux sans
   accorder d'autorité métier à l'interpréteur.

Le reçu `open-semantic-fidelity-receipt/1` transporte toutes les composantes
dans leur ordre, leur engagement, leurs conditions, leurs dépendances, leurs
cibles, leur capacité, leur domaine, leur disposition de routage et leur état
de sélection par l'adaptateur. Il expose également la cible validée et l'acte
de parole effectif.

## Frontière de confiance

La saisie brute reste interdite aux propriétaires V1. Ils reçoivent seulement
le sens structuré produit par OpenAI. Une fois leur décision terminée, le
contrôleur rattache la saisie originale au bloc `characterExpression` avec la
fidélité `RAW_EQUIVALENT`. Cette opération ne change ni la commande, ni le
commit, ni le temps de jeu.

Les effets de parole et d'action locale utilisent désormais la référence de la
cible validée lorsqu'elle est unique. La référence générique de scène reste un
fallback uniquement quand le contrat ne fournit aucune cible sûre.

## Actes de parole

Le cadre V8 accepte désormais un `dialogueAct` sémantique par composante de
parole. Le schéma serveur l'impose aux nouvelles réponses OpenAI et les anciennes
sauvegardes sans ce champ restent lisibles. L'adaptateur ne recherche aucun mot
dans la phrase : il transmet l'acte fourni, ou `OTHER` pour une ancienne donnée
qui ne le possède pas.

## Preuve locale

La gate suivante certifie une micro-séquence approche puis salutation :

```text
npm run narration-module:test:j10h3-fidelity
```

Elle vérifie cadre original, projection effective, expression brute, cible,
acte, ordre, provenance, interdiction du texte brut chez le propriétaire et
compatibilité des gates H0, G5 et G7. Le contrat serveur V8 reste couvert par
`narration-module:test:open-semantic-frame-g2`.

## Suite

J10-H4 peut maintenant traiter les limites, paquets et fallbacks des rôles IA
sur une donnée sémantique complète. Aucun appel OpenAI live n'est autorisé par
ce checkpoint.
