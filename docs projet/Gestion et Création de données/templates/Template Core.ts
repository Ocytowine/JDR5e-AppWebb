
export type Core = {
    partieId: string;
    personnagePjId: string;
    personnagePnjcId: { [personnagePnjId: string]: true}
    Temps: {
    seconde: number,
    minute: number,
    heure: number,
    jour: number,
    annee: number
  },
  Tons: { [tonId: string]: {
      nom: string,
      description: string
    }
  },
  Quetes: { [queteId: string]: {//a revoir
      nom: string,
      description: string,
      terminee: boolean,
        etapes: { [etapeId: string]: {
        nom: string,
        descriptionpj: string,
        terminee: boolean
            }
          }
        }
      },
  kndgePJ:
    {
      wikiTag: string,
    },
    relationPJ:
    {
      PNJId: string,
      niveauRelation: number
      description: string
    }
  }
