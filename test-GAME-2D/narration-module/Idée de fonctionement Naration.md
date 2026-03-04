## Création du module narration

idée général :

le module naration, sert à driver le MJ (Ia, chatgpt) pour qu'il puisse gérer la naration de manière optimal.
sur le plan contextuel
sur le plan compréhension d'intention
sur le plan d'arbitrage
sur le plan scenaristique
sur le plan memoire

idée mécanique (theorique)

la mécanique général est un pipeline simple, une intention du joueur part dans un bloc de code.
ce bloc sert d'assembleur, il recupere le contexte (qui, ou, comment, pourquoi...), le texte emis par le joueur et le contrat (liste de code à renvoyer, avec découpage de clé généré voir exemple)
    exemple : 
        Prompt :Contexte : lysenthe, aprés midi ensolieillé, sur le parvis de l'archives. db : [lysenthe] [archives] intention : "je veux entrer dans les archives".
avec ceci, 

    il envoie : (idée à ameliorer, juste un exemple literal)
        si l'intention détecté est une volonté de déplacement dans un endroit proche (évoqué par le contexte) alors execute la commande runtime : moveLocal + db.lieu + addtime(1)

        si l'intention est une volonté d'observation

        si l'intention est une action volontairement interdite (ex: je veux voler un truc dans les archives) alors execute la commande runtime : interdiction [degré dedifficulté estimé, competence accossié parmi (....)] + db.lieu + addtime(1)

        si l'intention est un element hors contexte, demandé des précisions. et jugé la plausibilité selon lore

        si l'intention ... alors execute la commande runtime :

le paquet part pour un traitement ia, puis revient structuré selon le contrat, le runtime peut maintenant déclenché des action mécanique, tel que créé une entrée de journal, faire avancer le temps, déclencher un combat, faire des recherche dans la database etc... afin de renvoyer une nouveau paquet à l'ia qui lui permettra de créer une réponse appuyer par de reelle action mécanique, en rééditant le contexte au besoin, crééer des profil de pnj, avancé le temps de facon réaliste, etc...

le contexte peut avoir plusieurs aspect, le monde local, les trames de fond, les quetes en cours, les relations entre les personnages, les éléments de lore, la temporalité, etc... le but est d'avoir une base de donnée riche et structurée pour que l'ia puisse s'appuyer dessus pour générer des réponses cohérentes et immersives.

le personnage interagis avec le monde grace à ces compétences, et ces caractéristique, et ces features. puis en terme d'intéraction social, les pnj ne voient que l'aspect visible du personnage, c'est à dire son apparence, son comportement, sa réputation, etc... et non pas ses caractéristique ou ses compétences. cela permet de créer une dynamique intéressante entre le personnage et les pnj, où le personnage doit faire attention à son comportement et à sa réputation pour ne pas se faire rejeter ou maltraiter par les pnj.

la mémoire ingame : 

