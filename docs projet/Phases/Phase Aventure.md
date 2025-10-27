# Phase Aventure

## Présentation UI Générale

### Sidebar et onglet d'aventure

La side barre est constituée de plusieurs boutons :

    - Narration
    - Fiche personnelle
    - Equipement et inventaire
    - boutons modulaire 1 (il prend le noms de la classe 1) (peut avoir un 2eme bouton si multiclassage)
    - Journal
    - Quêtes
    - Compagnon (Optionnel)
    - wiki
Chaque bouton renvoie à l'affichage d'onglet et mécanique décrite plus bas.
l'onglet par défaut est le premier, c'est à dire Narration.


**Narration**

C'est ici que le joueur intérragit avec le MJ, qu'il interragit avec le monde en somme.
L'ui est simple, c'est un fil de discussion. 

l'aventure se déroule en temps réelle (dans la plupart du temps sauf cas trés particulier) donc chague action prend du temps.
Donc c'est pourquoi il y'a un affichage "tête haute"(UI : t) de temporalité géré par un outil spécifique(outils : timeAventure) de lieu (outils : travelAventure) et de météo (pas d'outils).

Le fil de discussion n'est pas infinie (comme la mémoire) donc en fonction du temps passé les paroles et actes finissent par être journalisé grace à un outil narratif en lien avec tous les autres : memoriesAventure. sont fonctionnement simplifier : 
mémoire de discussion (au bout de 4 jours (en jeu) le fil de discussion ce résume (dans le fil lui même) puis au bout de 15 jours, ca disparait.)
mémoire journalisé : chaque repos long (sous-phase d'aventure) le journal est écrit (fil de discussion résumé) à chaque jour son entrée.

La narration est l'endroit ou réside l'IA narrative, elle est géré par iaRuntime elle à besoin de donnée pour correctement effectué ca tache, elle renvoie du texte et des commandes. explication simplifiée :
Donnée d'entrée : information issu du wiki indexé (contexte, lieu, pnj, race, lore, monstre...). rêgle de narration, rêgle du jeu, Outil de contexte(outils : contextEngine (sert à savoir à jaugé un contexte (propice au commerce, repos, combat, voyage...), en suivant le timeAventure et travelAventure)), Donnée personnage, Quête en cours
Donnée de sortie : texte narratif, Commande et modifieur de commande.

Shéma explicatif : 
iaRuntime : "que fais tu ?" -> pjoueur : "je traverse la rivière." -> iaRuntime : appel {"contextEngine" : true, "timeAventure" : 0}; REQ_THROW:DD14/FOR+COMP
REQ_THROW:DD14/FOR+COMP = demande un jet de compétence de difficulté 14. si le joueur accepte en cliquant sur lancer un dé avec compétence (à choisir) l'outil diceRoler récupère les information necessaire (commande plus donnée joueur)

outils : timeAventure, travelAventure, memoriesAventure, iaRuntime, contextEngine,

UI : timeAndLocation, 

---

**Fiche Personelle**

---

**Equipement / Inventaire**

---

**UI de classe : optionnel / modulaire**

---

**Journal**

---

**Quètes**

---

**Compagnon : optionnel**

---

**Wiki**
