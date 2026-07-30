# Contrat du routeur d'événements orchestrateur

Statut : `LIVRÉ`
Sous-lot : `6B`
Contrat cible : `orchestration-event-router/1`

## Objectif

Transporter un événement métier déjà committé vers des hooks déclarés, sans
transformer le routeur en propriétaire des domaines traversés.

Le premier cas réel est le résultat terminal d'un repos :

```text
RestDomain committe
  -> événement rest_interrupted ou rest_completed_pending_benefits
  -> tâche d'outbox liée à cet événement
  -> routeur
  -> hook rest.lifecycle-signal
  -> signal typé, sans mutation métier
```

## Autorité

Le routeur peut :

- valider une enveloppe d'événement ;
- sélectionner les hooks abonnés au type exact ;
- leur remettre une copie bornée du résultat public ;
- enregistrer la réussite ou l'échec de livraison dans l'outbox.

Le routeur ne peut pas :

- modifier `rest.process`, l'horloge ou un personnage ;
- accorder ou refuser un bénéfice ;
- créer une mission, une relation, une progression ou une intrigue ;
- transformer un événement public en vérité cachée ;
- inventer une conséquence si aucun domaine destinataire ne la produit.

Un hook de 6B retourne uniquement un signal ou une décision de livraison. Toute
future mutation appartiendra au domaine destinataire et utilisera sa propre
opération et son propre commit.

## Émission

Seuls les résultats terminaux du repos créent une tâche :

- `rest_interrupted` ;
- `rest_completed_pending_benefits`.

Un segment encore `ACTIVE` ne déclenche aucun hook transversal.

La tâche cite obligatoirement l'identifiant de l'événement source. Son payload
contient uniquement :

- le type et l'identifiant de l'événement ;
- le domaine source `REST` ;
- le processus et son statut ;
- le temps de repos écoulé ;
- le fingerprint du checkpoint ;
- le nombre de bénéfices encore en attente, sans leur détail ;
- l'état public de l'interruption, sans fingerprint de contrôle.

Le profil de danger, la graine déterministe et les informations monde privées
ne sont jamais transportés. Un domaine destinataire ayant besoin du détail
relit lui-même l'agrégat source avec sa propre autorité.

## Livraison et rejeu

La transaction de repos crée l'événement et la tâche d'outbox atomiquement.
Un worker dédié réclame ensuite une tâche avec un bail et remet cette tâche
déjà réclamée au routeur. Le routeur ne réclame pas lui-même la prochaine tâche
générique : il ne peut donc pas capturer l'outbox d'un autre domaine.

- succès : tâche `COMPLETED` ;
- erreur temporaire : `FAILED_RETRYABLE` avec date de reprise ;
- erreur finale : `FAILED_FINAL` ;
- expiration du bail : un autre worker peut reprendre la même tâche.

Le rejeu d'une livraison ne rejoue jamais le commit du repos. Un hook doit
produire le même signal pour la même enveloppe.

## Premier hook

`rest.lifecycle-signal/1` accepte les deux événements terminaux et retourne :

- `INTERRUPTED`, ou
- `COMPLETED_PENDING_BENEFITS`.

Ce signal prépare les futurs abonnements progression, monde et narration. Dans
6B, aucun de ces domaines n'est encore muté.

## Oracles

- aucun outbox orchestration sur un segment `ACTIVE` ;
- une tâche atomique sur chaque résultat terminal ;
- source event obligatoire et type exact ;
- aucun champ privé du profil de sécurité ;
- aucun write métier effectué par le routeur ou le hook ;
- sélection déterministe des hooks ;
- absence de hook traitée sans mutation ;
- succès, échec temporaire et reprise ;
- livraison répétée sans double temps ni double bénéfice.

## Preuves livrées

- `narration-module:build` ;
- `narration-module:test:tactical-rest-handoff` : 14/14 ;
- segment actif sans tâche, résultat terminal avec tâche unique ;
- livraison multi-hook ordonnée par `hookId` ;
- absence des champs `safetyProfile`, `dangerPercent`, `deterministicSeed`,
  détail des bénéfices et fingerprint du contrôle d'interruption ;
- erreur `CAMPAIGN_BUSY`, statut `FAILED_RETRYABLE`, nouvelle réclamation et
  clôture `COMPLETED` ;
- cas sans abonné clôturé avec `NO_SUBSCRIBER`, sans mutation métier.
