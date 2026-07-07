# Contrat fournisseur IA OpenAI

Statut : `FIGE` — autorise l'implémentation I-05B sans branchement UI.

Version du contrat : `ai-provider-openai/1`

Ce document complète `ai-pipeline/1` pour le premier fournisseur réel. Il fixe la frontière serveur, la gestion de clé, l'appel OpenAI, la validation des réponses, les quotas, le test live optionnel et les critères minimaux avant tout usage en narration jouable.

Sources techniques vérifiées le 2026-07-07 :

- documentation OpenAI Quickstart : variable `OPENAI_API_KEY` côté environnement;
- documentation OpenAI Responses API : endpoint `/v1/responses`;
- documentation OpenAI Structured Outputs : schéma JSON strict avec `additionalProperties: false` et `strict: true`.

## 1. Résultat attendu

I-05B doit permettre d'appeler OpenAI depuis un adaptateur serveur contrôlé, pour un rôle IA déjà validé par I-05A.

Le module reçoit :

- un `AiCallRequestV1` validé;
- un `AiModelRouteV1` certifié pour `REMOTE_PROVIDER`;
- un schéma de sortie strict lié au rôle;
- une politique de timeout, budget et retry;
- une clé disponible uniquement côté serveur.

Il produit :

- une tentative fournisseur corrélée à `operationId`, `callId` et `attemptId`;
- une réponse brute jamais exposée au joueur;
- une enveloppe `AiRoleOutputEnvelopeV1` parsée et revalidée par les validateurs I-05A;
- un incident expurgé en cas d'échec;
- des métriques minimales de latence, tokens, modèle et statut.

## 2. Frontière de sécurité

La clé OpenAI :

- reste côté serveur;
- peut provenir de `process.env.OPENAI_API_KEY`;
- peut provenir d'un `.env` local ignoré par Git;
- ne peut jamais être envoyée au navigateur;
- ne peut jamais être stockée dans une campagne, un export, un incident ou une trace de dev par défaut.

L'adaptateur fournisseur ne lit ni écrit `CampaignRepository`. Il transforme une requête déjà validée en appel fournisseur puis renvoie une sortie candidate.

## 3. Emplacement et résolution `.env`

Résolution autorisée en développement local :

1. `process.env.OPENAI_API_KEY`;
2. `test-GAME-2D/.env`;
3. `.env` à la racine du dépôt, uniquement si le fichier est ignoré par Git.

La présence d'une clé active n'autorise pas automatiquement les tests live. Un test live doit exiger une variable d'opt-in distincte :

```text
NARRATION_OPENAI_LIVE=1
```

Sans cet opt-in, les suites doivent utiliser uniquement le faux fournisseur ou des fixtures HTTP.

## 4. API cible

L'adaptateur I-05B cible l'API OpenAI Responses.

Contraintes d'appel :

- méthode `POST`;
- endpoint `https://api.openai.com/v1/responses`;
- authentification `Authorization: Bearer <OPENAI_API_KEY>`;
- modèle lu depuis une configuration serveur, jamais depuis une entrée joueur;
- sortie demandée en JSON strict via schéma du rôle;
- aucun tool OpenAI activé par défaut;
- streaming interdit pour I-05B sauf contrat ultérieur.

Chat Completions peut rester utilisé par les routes historiques tactiques existantes, mais le module narration I-05B ne doit pas s'y accrocher.

## 5. Route modèle certifiée

```ts
interface OpenAiModelRouteV1 {
  schemaVersion: 1;
  routeId: string;
  role: AiRoleV1;
  providerKind: "REMOTE_PROVIDER";
  providerId: "openai";
  modelId: string;
  modelConfigVersion: string;
  certified: true;
  allowedContractVersions: string[];
  inputTokenLimit: number;
  outputTokenLimit: number;
  timeoutMs: number;
  maxRetries: number;
  fallbackRouteIds: string[];
  structuredOutputSchemaId: string;
  liveEnabled: boolean;
}
```

`liveEnabled` dépend de la configuration serveur et de l'opt-in. Un modèle non certifié ou une route dont le schéma ne correspond pas au rôle est refusé avant appel.

## 6. Schéma strict de sortie

Chaque rôle possède un schéma JSON fournisseur qui reproduit l'enveloppe commune I-05A et son payload.

Contraintes :

- `additionalProperties: false` à tous les niveaux d'objet;
- champs requis explicites;
- énumérations fermées;
- `strict: true`;
- taille de sortie maximale réservée avant appel;
- refus complet si le fournisseur renvoie un statut, un format ou une corrélation non conforme.

Le schéma fournisseur ne remplace pas les validateurs applicatifs. Il réduit les sorties invalides, puis le moteur revalide localement.

## 7. Port fournisseur

```ts
interface RemoteAiProviderV1 {
  call(request: AiCallRequestV1, route: OpenAiModelRouteV1): Promise<RemoteAiProviderResultV1>;
}

type RemoteAiProviderResultV1 =
  | {
      ok: true;
      output: AiRoleOutputEnvelopeV1;
      metrics: AiProviderMetricsV1;
    }
  | {
      ok: false;
      category: AiFailureCategoryV1;
      retryable: boolean;
      incident: AiIncidentRecordV1;
      metrics: AiProviderMetricsV1;
    };

interface AiProviderMetricsV1 {
  schemaVersion: 1;
  providerId: "openai";
  modelId: string;
  role: AiRoleV1;
  operationId: string;
  callId: string;
  attemptId: string;
  startedAt: string;
  endedAt: string;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostMinorUnits: number | null;
  finishReason: string | null;
}
```

`estimatedCostMinorUnits` peut rester `null` tant que le pricing réel n'est pas figé. La métrique doit exister pour recevoir le coût plus tard.

## 8. Timeouts, retries et circuit

I-05B utilise les compteurs I-05A :

- timeout réseau/fournisseur : retry technique borné;
- HTTP 429 ou quota : suspension propre ou file d'attente, pas succès partiel;
- HTTP 401/403 : incident bloquant, aucune retry automatique;
- réponse non JSON ou schéma refusé : correction/régénération selon rôle, sans mutation;
- circuit ouvert : échec rapide avant appel;
- fallback : uniquement vers route certifiée du même rôle.

Une réponse tardive est diagnostiquée puis ignorée.

## 9. Diagnostic et expurgation

L'incident peut contenir :

- code HTTP;
- catégorie d'échec;
- modèle;
- rôle;
- empreinte de requête;
- compteur de tentative;
- latence;
- champs expurgés.

L'incident ne contient pas :

- clé API;
- prompt complet;
- contexte complet;
- réponse brute complète;
- secret MJ;
- stack trace exposée au joueur;
- détails de fournisseur dans la narration.

## 10. Tests I-05B

Tests obligatoires sans réseau :

- clé absente : appel refusé proprement, pas de tentative réseau;
- clé présente : elle n'apparaît dans aucun incident ni log de test;
- route `REMOTE_PROVIDER` non certifiée : refus avant appel;
- schéma strict invalide : refus avant appel;
- HTTP 401/403/429/500 simulés : catégories et retries corrects;
- réponse fournisseur valide : sortie revalidée par I-05A;
- réponse fournisseur avec champ inconnu : rejet strict;
- timeout simulé : retry borné puis circuit si seuil atteint;
- fallback non certifié : refus;
- `NARRATION_OPENAI_LIVE` absent : aucun test live ne part sur Internet.

Test live optionnel :

- exécuté seulement si `NARRATION_OPENAI_LIVE=1` et `OPENAI_API_KEY` existent;
- un seul rôle à faible coût, de préférence `intent_interpreter`;
- payload minimal sans secret de campagne;
- budget et timeout courts;
- aucune assertion qualitative, seulement connectivité, schéma strict et expurgation.

## 11. Hors périmètre I-05B

- UI narrative;
- streaming;
- outils OpenAI;
- web search fournisseur;
- stockage long des prompts/réponses brutes;
- certification qualitative du corpus complet;
- équilibrage financier définitif;
- fallback multi-fournisseur;
- exposition d'une route navigateur appelant OpenAI directement.

Ces exclusions empêchent le fournisseur réel de devenir le runtime narration complet.
