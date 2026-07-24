Pour le developpement général :

Revoir la facon de build l'application. Des blocs sont inutiles pour rendre les test efficaces.

l'UI sépare la narration du module map et plateau. il ne faut pas. la narration et le principal écran, c'est les commandes qui ferons apparaitre les modules. la map elle, sera accessible via un bouton. Pour le dev, les modules seront accessibles via des boutons dans l'UI. Il faut donc revoir la structure de l'UI pour que la narration soit le point central et que les modules soient des extensions accessibles via des commandes ou des boutons.

L'arborescence de l'app est à revoir complétement. il devrait y'avoir une logique de dossier par module, et un dossier contenant les composants communs. un module plateau, un module naarration, un module map, un module creation de personnage puis le wiki. Chaque module devrait contenir ses composants et ses tests. Les composants communs devraient être dans un dossier séparé pour éviter les duplications.

il y'a un soucis de standardisation de données pour que chaque module puisse fonctionner avec les mêmes informations. la création de personnage ne génère pas de personnage compatible avec le module de narration. Il faut donc revoir la structure des données pour que chaque module puisse interagir correctement avec les autres.
le module narration et le module map doivent lire les meme données wiki pour que les informations soient cohérentes. Il faut donc standardiser les données et les structures pour que chaque module puisse fonctionner avec les mêmes informations.


