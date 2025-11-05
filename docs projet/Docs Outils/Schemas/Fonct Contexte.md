# Fonctionnement de l'outil context

iaRuntime à besoin d'un contexte cohérent pour fonctionner.
Pour créer un contexte cohérent, il faut que l'ia (via l'outil contextEngine) appel des sous-outils de récupération d'information
```mermaid
flowchart TD;
    B{iaRuntime}-->Cctx(Commande émmise: REQ_CONTEXTE)
    Cctx-->CtxStart{contextEngine};

    CtxStart-->CtxK(kndgePj);
    CtxK-->CtxK1(Récupère les données connaissance du joueur);

    CtxStart-->CtxT(timeAventure)
    CtxT-->CtxT1(fetch de donnée time dans CORE)
    CtxT1-->CtxT2(Convertie l'infos en date / heure / minute / météo)

    CtxStart-->CtxL(locationPj);
    CtxL-->CtxL1(fetch de donnée location dans Personnages)
    CtxL1-->CtxL2(Récupère la valeur correspondante dans infoMap)

    CtxStart-->CtxM(Récupère les derniers message de conversation)
    CtxM-->CtxM1(ia Résume les faits, pour en déduire un potentiel danger/risque...)


    CtxL2-->CtxW(wikiTag)
    CtxW-->CtxW1(ia, extraits des tags des données récoltées)
   