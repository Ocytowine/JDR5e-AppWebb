# Revue du branchement Archives de Lysenthe → scènes dynamiques

Date: 2026-07-22

## Parcours retenu

1. Le corpus wiki borné est compilé dans le client.
2. Les scènes jouables connues et leurs connexions ouvertes sont dérivées du lore.
3. Une transition connue passe par le runtime de topologie et le catalogue de scènes.
4. Une sortie visible déclarée `external:` mais sans destination connue est confiée à `scene_creator`.
5. Le candidat reçoit la scène source et la référence canonique exacte de la sortie.
6. Les gates lore, doublon, persistance et topologie précèdent le port monde.
7. Le lieu, ses faits, la topologie, le temps, la position et le cycle de scène sont publiés dans un commit atomique.
8. La scène d'arrivée est reconstruite depuis le commit et reste résoluble après réouverture d'IndexedDB.

## Défauts trouvés et traités

- Les fonctions d'un bâtiment pouvaient être confondues avec des sorties: seules les sorties portant des alias de destination peuvent déclencher une création.
- Le créateur ne connaissait pas la frontière canonique franchie: `sourceBoundaryRef` fait désormais partie de son contexte obligatoire.
- Une destination déjà décrite par le wiki pouvait être recréée: les scènes jouables du corpus et leurs connexions connues alimentent d'abord la topologie.
- Le retour depuis une scène dynamique dépendait encore du prototype de l'auberge: un runtime générique lit maintenant la topologie et le catalogue de campagne.
- Un échec après `PREPARING` pouvait laisser la campagne occupée: le contrôleur annule toute opération pré-commit encore annulable.
- Un paquet de lore unique aurait contaminé les créations depuis une autre scène wiki: le paquet est sélectionné selon la scène source.
- Le lease du bootstrap pouvait survivre à une exception de commit: sa libération est protégée par `finally`.

## Limites encore ouvertes

- La recette OpenAI live doit confirmer que le modèle produit systématiquement les connexions entrante et sortante attendues avec le nouveau `sourceBoundaryRef`.
- Le corpus est encore embarqué par `import.meta.glob`; un catalogue généré réduira le bundle et évitera de compiler le wiki au démarrage.
- Les projections de campagne qui corrigent le lore initial ne sont pas encore injectées dans le brief UI.
- La création depuis une scène dynamique ne peut continuer que si cette scène expose une nouvelle frontière ouverte; le contrat actuel reconstruit surtout les connexions déjà proposées lors de sa création.
- La récupération du bootstrap après une interruption exactement entre ses phases d'opération mérite un test d'injection de panne dédié.

