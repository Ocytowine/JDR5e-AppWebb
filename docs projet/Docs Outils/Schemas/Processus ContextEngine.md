# Processus de l'outil contextEngine

iaRuntime à besoin d'un contexte cohérent pour fonctionner.
Pour créer un contexte cohérent, il faut que l'ia (via l'outil contextEngine) appel des sous-outils de récupération d'information

```mermaid
flowchart TD;
    B{iaRuntime}-->Cctx(Commande émmise: REQ_CONTEXTE)
    Cctx-->CtxStart{contextEngine};

    CtxStart-->CtxK(kndgePj);
    CtxK-->CtxK1(Récupère les données connaissance du joueur);
    CtxK1-->CtxW
    CtxStart-->CtxT(timeAventure)
    CtxT-->CtxT1(fetch de donnée time dans CORE)
    CtxT1-->CtxT2(Convertie l'infos en date / heure / minute / météo)
    CtxT2-->CctxF1

    CtxStart-->CtxL(locationPj);
    CtxL-->CtxL1(fetch de donnée location dans Personnages)
    CtxL1-->CtxL2(Récupère la valeur correspondante dans infoMap)
    CtxL2-->CctxF1

    CtxStart-->CtxM(Récupère les derniers message de conversation)
    CtxM-->CtxM1(ia Résume les faits, et déduire un état: discussion/danger/risque...)
    CtxM1-->CctxF1


    CtxL2-->CtxW(wikiTag)
    CtxW-->CtxW1(ia, devine les tags en lien au données récoltées)
    CtxW1-->CtxW2(extrait les données des fiches wiki ciblées)
    CtxW2-->CctxF1

    CctxF1(Compile les éléments)-->CctxF2(sauvegarde en cache, fin)
```