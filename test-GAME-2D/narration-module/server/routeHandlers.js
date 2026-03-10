function createRouteHandlers(deps) {
  const {
    openAiApiKey,
    callOpenAiJson,
    parseJsonBody,
    sendJson,
    cryptoImpl,
    safeString,
    toStringArray,
    cloneForDebug,
    sanitizePendingClarification,
    buildInputContract,
    analyzeIntentPacket,
    buildPlanAndOutputContracts,
    buildLocationRuntimeSeed,
    buildObserveSelectedLoreForNarration,
    buildInteractionLanguageState,
    primeTalkActorInteractionState,
    collectEntityEnrichmentRequests,
    reevaluatePendingEntityEnrichments,
    buildTalkNarrationHandoff,
    updateTalkActorAfterNarration,
    isClarificationHandoff,
    shouldDeferEntityEnrichment,
    sanitizeEntityEnrichmentProposal,
    sanitizeEntityPatchProposal,
    mergeEntityPatch,
    localizeResolvedEntityPayload,
    buildFallbackNarrationFromHandoff,
    sanitizeNextTurnHintsFromPerception,
    looksLikeDirectSpeechNarration,
    buildTalkDirectSpeechFallback,
    buildPendingTalkClarification,
    ensureTalkActorEntity,
    ensureAmbientSceneActors,
    ensureObservedSceneActors,
    resolveTalkIntentPrelude,
    resolveTalkTargetHintContext,
    resolvePerceptiveIntentFocus,
    resolveMoveIntentContext,
    intentResolvers,
    wikiLoreHelper,
    localLoreHelper,
    isPresenceScanRequest,
    isObservableDescriptionRequest,
    isApproachActorIntent,
    initNarrationRuntime,
    getNarrationRuntime,
    getNarrationRuntimeInitError,
    getRuntimeNarrationPlaceholder
  } = deps;

  async function handleProcessTurn(req, res) {
    let activeProcessTurnCampaignId = "";
    try {
      initNarrationRuntime();
      const narrationRuntime = getNarrationRuntime();
      if (!narrationRuntime) {
        const narrationRuntimeInitError = getNarrationRuntimeInitError();
        const details = narrationRuntimeInitError
          ? String(narrationRuntimeInitError.message || narrationRuntimeInitError)
          : "runtime unavailable";
        return sendJson(res, 503, { error: "Narration module runtime unavailable", details });
      }

      const body = await parseJsonBody(req);
      const campaignId = safeString(body.campaign_id, "setup-campaign-default");
      activeProcessTurnCampaignId = campaignId;
      const turnId = safeString(body.turn_id, `turn-${cryptoImpl.randomUUID()}`);
      const locationId = safeString(body.location_id, "setup_zone");
      const memoryBeforeRaw =
        typeof narrationRuntime.memoryStore.read === "function"
          ? narrationRuntime.memoryStore.read()
          : null;
      const memoryDebugBefore = {
        wiki_world_state: cloneForDebug(memoryBeforeRaw?.wiki?.world_state ?? null),
        campaign: cloneForDebug(memoryBeforeRaw?.campaigns?.[campaignId] ?? null)
      };
      narrationRuntime.memoryService.beginTurnSession(campaignId, turnId);
      const campaignAtTurnStart = narrationRuntime.memoryService.advanceCampaignTurn(campaignId, turnId);
      const reevaluatedEntityUpdates = narrationRuntime.memoryService
        ? reevaluatePendingEntityEnrichments(
            narrationRuntime.memoryService,
            campaignId,
            locationId,
            turnId
          )
        : [];

      narrationRuntime.memoryService.cleanupExpiredEntities(
        campaignId,
        Number(campaignAtTurnStart?.clock?.turn_index ?? 0),
        turnId
      );

      const projectedBeforeIntent = narrationRuntime.memoryService.project(campaignId, {
        location_id: locationId,
        intent_hint: safeString(body.intent_hint),
        target_actor_id: safeString(body.target_actor_id)
      });
      let inputContract = buildInputContract(body, projectedBeforeIntent);
      const campaignBefore = narrationRuntime.memoryService.getCampaign(campaignId);
      const activePendingClarification = sanitizePendingClarification(
        campaignBefore?.world_overrides?.pending_clarification
      );
      const activeTalkActorId = safeString(campaignBefore?.world_overrides?.active_talk_actor_id);
      const intentPacket = await analyzeIntentPacket(body, inputContract);
      intentResolvers.normalizeIntentBoundaries({
        intentPacket,
        body,
        deps: {
          safeString,
          toStringArray,
          isPresenceScanRequest,
          isObservableDescriptionRequest,
          isApproachActorIntent
        }
      });
      intentResolvers.resolveTalkIntentContext({
        intentPacket,
        body,
        campaignBefore,
        locationId,
        activePendingClarification,
        activeTalkActorId,
        deps: {
          resolveTalkIntentPrelude,
          resolveTalkTargetHintContext
        }
      });
      let selectedLore = wikiLoreHelper.selectLore({
        intentType: intentPacket.intent_type,
        playerInput: body.player_input,
        locationId,
        destinationId: intentPacket.destination_id
      });
      narrationRuntime.memoryService.ensureLocationRuntimeState(
        campaignId,
        locationId,
        buildLocationRuntimeSeed(locationId, selectedLore.selected_entries),
        turnId
      );
      if (intentPacket.intent_type === "observe") {
        ensureAmbientSceneActors({
          memoryService: narrationRuntime.memoryService,
          campaignId,
          locationId,
          turnId,
          narrationContext: safeString(body.narration_context),
          maxActors: 2
        });
      }
      const campaignBeforeTalkResolution = narrationRuntime.memoryService.getCampaign(campaignId);
      let talkRolePlausibility = null;
      let pendingClarificationRecord = null;
      if (intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_hint)) {
        const actorResolution = ensureTalkActorEntity({
          memoryService: narrationRuntime.memoryService,
          campaignId,
          campaignBefore: campaignBeforeTalkResolution,
          locationId,
          actorHint: intentPacket.target_actor_hint,
          targetActorId: safeString(intentPacket.target_actor_id),
          turnId,
          selectedLoreEntries: selectedLore.selected_entries
        });
        talkRolePlausibility = actorResolution?.rolePlausibility || null;
        if (actorResolution?.kind === "ambiguous") {
          intentPacket.requires_clarification = true;
          intentPacket.clarification_question =
            safeString(actorResolution.clarificationQuestion) ||
            safeString(intentPacket.clarification_question) ||
            "Precise quel interlocuteur tu vises.";
          intentPacket.target_actor_id = null;
          pendingClarificationRecord = buildPendingTalkClarification({
            locationId,
            actorHint: intentPacket.target_actor_hint,
            clarificationQuestion: intentPacket.clarification_question,
            candidateOptions: actorResolution.candidateOptions,
            turnId
          });
        } else if (actorResolution?.kind === "out_of_profile") {
          intentPacket.requires_clarification = true;
          intentPacket.clarification_question =
            safeString(actorResolution.clarificationQuestion) ||
            "Le role demande ne semble pas correspondre au lieu actuel.";
          intentPacket.target_actor_id = null;
          pendingClarificationRecord = buildPendingTalkClarification({
            locationId,
            actorHint: intentPacket.target_actor_hint,
            clarificationQuestion: intentPacket.clarification_question,
            candidateOptions: [],
            turnId
          });
        } else if (actorResolution?.kind === "not_contactable") {
          intentPacket.requires_clarification = true;
          intentPacket.clarification_question =
            safeString(actorResolution.clarificationQuestion) ||
            "Aucun interlocuteur clairement abordable n'est a portee immediate.";
          intentPacket.target_actor_id = null;
          pendingClarificationRecord = buildPendingTalkClarification({
            locationId,
            actorHint: intentPacket.target_actor_hint,
            clarificationQuestion: intentPacket.clarification_question,
            candidateOptions: [],
            turnId
          });
        } else if (actorResolution?.entityId) {
          intentPacket.target_actor_id = actorResolution.entityId;
          intentPacket.requires_clarification = false;
          intentPacket.clarification_question = null;
        }
      }
      intentResolvers.resolveObserveIntentContext({
        intentPacket,
        campaign: campaignBeforeTalkResolution,
        locationId,
        deps: {
          resolvePerceptiveIntentFocus
        }
      });
      intentResolvers.resolveAskInfoIntentContext({
        intentPacket,
        campaign: campaignBeforeTalkResolution,
        locationId,
        deps: {
          resolvePerceptiveIntentFocus
        }
      });
      const locationRuntimeStateForMove = narrationRuntime.memoryService.getEntity(campaignId, locationId);
      selectedLore = intentResolvers.resolveMoveLocalIntentContext({
        intentPacket,
        body,
        selectedLore,
        locationRuntimeState: locationRuntimeStateForMove,
        locationId,
        deps: {
          resolveMoveIntentContext
        }
      });
      const selectedLocalLore = localLoreHelper.selectLocalLore({
        campaignMemory: campaignBefore,
        intentType: intentPacket.intent_type,
        playerInput: body.player_input,
        locationId
      });
      const mergedTopicIds = [];
      const seenTopicIds = new Set();
      for (const topicId of [...selectedLore.topic_ids, ...selectedLocalLore.topic_ids]) {
        const normalized = String(topicId ?? "").trim();
        if (!normalized || seenTopicIds.has(normalized)) continue;
        seenTopicIds.add(normalized);
        mergedTopicIds.push(normalized);
      }
      const mergedLoreDb = {
        ...selectedLore.lore_db,
        ...selectedLocalLore.lore_db
      };
      const mergedSelectedLore = {
        topic_ids: mergedTopicIds,
        lore_db: mergedLoreDb,
        selected_entries: [...selectedLore.selected_entries, ...selectedLocalLore.selected_entries]
      };
      if (intentPacket.intent_type === "observe") {
        ensureObservedSceneActors({
          memoryService: narrationRuntime.memoryService,
          campaignId,
          locationId,
          turnId,
          narrationContext: safeString(body.narration_context)
        });
      }
      const projected = narrationRuntime.memoryService.project(campaignId, {
        location_id: locationId,
        intent_type: intentPacket.intent_type,
        target_actor_id: safeString(intentPacket.target_actor_id),
        intent_hint: safeString(body.intent_hint)
      });
      const talkActorEntity =
        intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_id)
          ? narrationRuntime.memoryService.getEntity(campaignId, safeString(intentPacket.target_actor_id))
          : null;
      const talkActorInteractionLanguageState =
        intentPacket.intent_type === "talk" && talkActorEntity
          ? buildInteractionLanguageState(body?.player_narrative_snapshot, talkActorEntity)
          : null;
      if (intentPacket.intent_type === "talk" && talkActorEntity && talkActorInteractionLanguageState) {
        const primedTalkActor = primeTalkActorInteractionState(
          JSON.parse(JSON.stringify(talkActorEntity)),
          talkActorInteractionLanguageState
        );
        narrationRuntime.memoryService.upsertEntity(campaignId, primedTalkActor, turnId);
      }
      const refreshedTalkActorEntity =
        intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_id)
          ? narrationRuntime.memoryService.getEntity(campaignId, safeString(intentPacket.target_actor_id))
          : null;
      inputContract = buildInputContract(body, projected);
      const { outputContract, decisionReason } = buildPlanAndOutputContracts(
        body,
        intentPacket,
        projected,
        turnId,
        mergedSelectedLore,
        refreshedTalkActorEntity,
        talkRolePlausibility
      );
      const stateBefore = narrationRuntime.memoryService.buildRuntimeStateBefore(campaignId, {
        location_id: locationId,
        intent_type: intentPacket.intent_type,
        target_actor_id: safeString(intentPacket.target_actor_id)
      });

      const trace = narrationRuntime.processor.processTurn(
        turnId,
        inputContract,
        outputContract,
        stateBefore,
        { loreDb: mergedLoreDb }
      );
      narrationRuntime.memoryService.syncCampaignFromRuntimeState(
        campaignId,
        trace.state_after,
        turnId
      );
      narrationRuntime.memoryService.setWorldOverride(
        campaignId,
        "pending_clarification",
        outputContract?.requires_clarification ? pendingClarificationRecord : null,
        turnId
      );
      narrationRuntime.memoryService.setWorldOverride(
        campaignId,
        "active_talk_actor_id",
        intentPacket.intent_type === "talk" && safeString(intentPacket.target_actor_id)
          ? safeString(intentPacket.target_actor_id)
          : null,
        turnId
      );

      for (const fact of outputContract.narrative_output.hidden_truth_updates ?? []) {
        narrationRuntime.memoryService.appendKnowledgeTruthView(
          campaignId,
          { turn_id: turnId, fact: String(fact) },
          turnId
        );
      }

      const projectedAfter = narrationRuntime.memoryService.project(campaignId, {
        location_id: trace.state_after?.location_id ?? locationId,
        intent_type: intentPacket.intent_type,
        target_actor_id: safeString(intentPacket.target_actor_id)
      });
      const truthAfter = narrationRuntime.memoryService.resolveEffectiveTruth(campaignId, {
        location_id: trace.state_after?.location_id ?? locationId,
        intent_type: intentPacket.intent_type,
        target_actor_id: safeString(intentPacket.target_actor_id)
      });
      const entityEnrichmentRequests = collectEntityEnrichmentRequests(
        narrationRuntime.memoryService,
        campaignId,
        intentPacket
      );
      const narrationSelectedLore =
        intentPacket.intent_type === "observe"
          ? buildObserveSelectedLoreForNarration(selectedLore.selected_entries, locationId)
          : selectedLore.selected_entries;
      const aiHandoff =
        intentPacket.intent_type === "talk"
          ? buildTalkNarrationHandoff({
              turnId,
              campaignId,
              decisionReason,
              intentPacket,
              inputContract,
              outputContract,
              trace,
              truthAfter,
              projectedAfter,
              selectedLore: narrationSelectedLore,
              selectedLocalLore: selectedLocalLore.selected_entries,
              entityEnrichmentRequests,
              reevaluatedEntityUpdates
            })
          : {
              turn_id: turnId,
              campaign_id: campaignId,
              decision_reason: decisionReason,
              narrative_generation_required: true,
              intent_packet: intentPacket,
              input_contract: inputContract,
              output_contract: outputContract,
              runtime_result: {
                runtime_actions: trace.runtime_actions,
                state_diff: trace.state_diff,
                truth_snapshot: truthAfter,
                projected_memory: projectedAfter,
                selected_lore: narrationSelectedLore,
                selected_local_lore: selectedLocalLore.selected_entries,
                entity_enrichment_requests: entityEnrichmentRequests,
                entity_profile_updates: reevaluatedEntityUpdates
              }
            };

      narrationRuntime.memoryService.flushTurnSession(campaignId);
      const memoryAfterRaw =
        typeof narrationRuntime.memoryStore.read === "function"
          ? narrationRuntime.memoryStore.read()
          : null;
      const memoryDebug = {
        campaign_id: campaignId,
        turn_id: turnId,
        before: memoryDebugBefore,
        after: {
          wiki_world_state: cloneForDebug(memoryAfterRaw?.wiki?.world_state ?? null),
          campaign: cloneForDebug(memoryAfterRaw?.campaigns?.[campaignId] ?? null)
        },
        io_summary: {
          request_player_input: safeString(body.player_input),
          request_location_id: locationId,
          intent_type: safeString(intentPacket.intent_type),
          runtime_action_count: Array.isArray(trace?.runtime_actions) ? trace.runtime_actions.length : 0,
          entity_profile_update_count: Array.isArray(reevaluatedEntityUpdates)
            ? reevaluatedEntityUpdates.length
            : 0
        }
      };

      return sendJson(res, 200, {
        turn_id: turnId,
        campaign_id: campaignId,
        decision_reason: decisionReason,
        narrative_generation_required: true,
        intent_packet: intentPacket,
        input_contract: inputContract,
        output_contract: outputContract,
        trace: {
          runtime_actions: trace.runtime_actions,
          state_diff: trace.state_diff
        },
        projected_memory: projectedAfter,
        memory_debug: memoryDebug,
        entity_profile_updates: reevaluatedEntityUpdates,
        ai_handoff: aiHandoff
      });
    } catch (err) {
      const narrationRuntime = getNarrationRuntime();
      if (typeof narrationRuntime?.memoryService?.discardTurnSession === "function") {
        narrationRuntime.memoryService.discardTurnSession(activeProcessTurnCampaignId);
      }
      const code = err?.code || "process_turn_failed";
      const details = Array.isArray(err?.details) ? err.details : [String(err?.message || err)];
      return sendJson(res, 400, { error: code, details });
    }
  }

  async function handleGenerateNarration(req, res) {
    try {
      if (!openAiApiKey) {
        return sendJson(res, 503, {
          error: "openai_key_missing",
          details: ["OPENAI_API_KEY missing: narration generation is disabled."]
        });
      }
      initNarrationRuntime();
      const narrationRuntime = getNarrationRuntime();
      const body = await parseJsonBody(req);
      const aiHandoff = body?.ai_handoff;
      if (!aiHandoff || typeof aiHandoff !== "object") {
        return sendJson(res, 400, {
          error: "ai_handoff_missing",
          details: ["ai_handoff object is required"]
        });
      }

      const campaignId = safeString(aiHandoff.campaign_id, safeString(body?.campaign_id, "setup-campaign-default"));
      const turnId = safeString(
        aiHandoff.turn_id,
        safeString(body?.turn_id, `turn-${cryptoImpl.randomUUID()}`)
      );
      const fallbackText = buildFallbackNarrationFromHandoff(aiHandoff);

      const model = process.env.NARRATION_MODULE_MODEL || "gpt-4.1-mini";
      const systemPrompt =
        "Tu es l'IA narratrice aval d'un JDR. " +
        "Tu recois un paquet runtime fiable (actions executees, diff d'etat, memoire projetee). " +
        "Produis une narration joueur concise et coherente avec ce paquet, sans inventer d'actions non executees. " +
        "Ne revele pas la verite cachee au joueur. " +
        "Si intent_type=observe, decris uniquement ce qui est immediatement perceptible depuis la scene: visible, audible, ambiance, acces apparent, posture des personnes presentes. " +
        "Si runtime_result.projected_memory montre visible_actors vide pour le lieu courant, n'invente aucun interlocuteur a portee immediate: une foule diffuse, des silhouettes lointaines ou une activite ambiante sont autorisees, mais pas une personne clairement abordable. " +
        "Si le paquet ne materialise aucune personne visible mais contient des ambient_markers ou des points d'interet, fais sentir une presence humaine lointaine ou dispersee sans transformer cela en PNJ deja disponible pour parler. " +
        "Si intent_type=observe, interdiction de citer des scores, niveaux numeriques, proprietaires, factions, gouvernance ou metadonnees non perceptibles. " +
        "Quand des acteurs visibles ont un display_name distinctif, une scene_presence.current_activity, ou des details d'apparence, utilise ces marqueurs pour les differencier immediatement au lieu de les decrire comme un groupe uniforme. " +
        "Si intent_type=talk et qu'une cible contient payload.interaction, utilise ce bloc comme memoire conversationnelle compacte: evite de rejouer une premiere rencontre, respecte last_interaction_outcome, et n'invente pas de continuite contradictoire. " +
        "Si intent_type=talk et que social.social_rank, authority_level ou hospitality_style sont presents, laisse ces marqueurs influencer le ton, la distance sociale et la retenue de l'echange. " +
        "Si intent_type=talk, privilegie un rendu de dialogue au discours direct quand c'est possible: fais entendre au moins une replique du PJ et une replique de l'interlocuteur, au lieu d'un simple resume narratif. " +
        "Si runtime_result.talk_context.scene_mode vaut with_bystanders ou small_group, laisse sentir la presence des autres acteurs visibles: regards, reactions, interruptions breves, travail poursuivi en arriere-plan, ou repartie d'un second acteur si le paquet le soutient. " +
        "Si plusieurs acteurs visibles sont fournis dans runtime_result.talk_context, ne fusionne pas leurs voix: garde une cible principale claire et utilise les autres comme temoins, soutien, contrepoint ou bruit social. " +
        "Si runtime_result.talk_context.scene_roles est fourni, utilise-le pour distribuer la scene: primary parle ou repond en premier; secondary peut reagir brievement; background reste surtout en arriere-plan sauf raison claire. " +
        "Si runtime_result.talk_context.speaker_cues est fourni, appuie-toi dessus pour nuancer la facon de parler, la retenue, l'autorite, la familiarite et les micro-reactions de chaque intervenant. " +
        "Si runtime_result.talk_context.dialogue_guidance.direct_speech_required=true, ne rends pas la scene en pur resume indirect: il faut au minimum une ligne du PJ et une reponse explicite de l'acteur principal. " +
        "Si runtime_result.talk_context.dialogue_guidance.include_secondary_reaction=true, un acteur secondaire peut reagir une seule fois, brievement, sans voler la scene. " +
        "Si runtime_result.talk_context.dialogue_guidance.include_background_motion=true, laisse sentir les autres presences par des gestes, regards, taches poursuivies ou une tension d'arriere-plan, pas par une conversation parallele envahissante. " +
        "Quand un secondary ou un background intervient, garde l'echange lisible: l'acteur primary reste le centre du tour. " +
        "Quand le joueur salue, questionne ou interpelle directement un interlocuteur, rends ce geste en scene avec une ou deux phrases de dialogue travaillees, sauf si la comprehension linguistique l'empeche. " +
        "Si output_contract contient interaction_language_state et que comprehension_state=limited ou none, la narration de talk doit refleter cette friction linguistique sans inventer une comprehension parfaite. " +
        "Si intent_type=talk et que runtime_result.talk_context.embedded_player_request est present, ne t'arrete pas a une simple amorce: fais deja repondre le PNJ dans ce meme tour, au moins brievement, en restant coherent avec son ton et ses limites. " +
        "Si comprehension_state=none, ne raconte pas un dialogue fluide: fais sentir l'incomprehension, les gestes, la reformulation ou le blocage. " +
        "Si le paquet contient entity_enrichment_requests, tu peux proposer un enrichissement prudent des profils sous forme de patch structure, sans imposer une verite finale. " +
        "Utilise des valeurs propres et non ambigues. Interdiction de renvoyer des formulations avec 'ou', des fourchettes vagues, ou des categories floues pour les champs structures. " +
        "Pour les enums, utilise de preference: gender_presentation=unknown|masculine|feminine|androgynous|non_binary ; authority_level=unknown|none|low|medium|high|elite ; social_rank=unknown|low_common|working_common|respected_craft|institutional_respectable|local_notable|elite ; disposition_to_player=friendly|neutral|wary|hostile ; interaction_state=available|busy|blocked|fleeing|absent ; duty_state=unknown|on_post|on_patrol|off_duty|active_service ; familiarity_level=unknown|seen_once|known|recurrent ; last_interaction_outcome=brief_contact|polite_refusal|partial_help|useful_answer|withheld_sensitive_info|hostile_warning|trust_opened. " +
        "Ne propose pas plus de 2 enrichissements. " +
        `Repond STRICTEMENT en JSON: { "player_text": "...", "mj_notes": ["..."], "next_turn_hints": ["..."], "entity_enrichment_proposals": [{ "entity_id": "...", "proposal_type": "actor_profile_enrichment", "confidence": 0.0, "based_on": ["..."], "proposed_patch": { "payload": {} } }] }.`;
      const parsed = await callOpenAiJson({
        model,
        systemPrompt,
        userPayload: { ai_handoff: aiHandoff }
      });
      const rawPlayerText =
        safeString(parsed?.player_text ?? parsed?.player_facing_text, fallbackText).trim() || fallbackText;
      const talkContext = aiHandoff?.runtime_result?.talk_context ?? {};
      const directSpeechRequired =
        safeString(aiHandoff?.output_contract?.intent_type) === "talk" &&
        Boolean(talkContext?.dialogue_guidance?.direct_speech_required);
      const playerText =
        directSpeechRequired && !looksLikeDirectSpeechNarration(rawPlayerText)
          ? buildTalkDirectSpeechFallback(aiHandoff)
          : rawPlayerText;
      const mjNotes = toStringArray(parsed?.mj_notes);
      const nextTurnHints = sanitizeNextTurnHintsFromPerception(aiHandoff, parsed?.next_turn_hints);
      const rawProposals = Array.isArray(parsed?.entity_enrichment_proposals)
        ? parsed.entity_enrichment_proposals
        : [];
      const entityEnrichmentProposals = rawProposals
        .map((proposal) => sanitizeEntityEnrichmentProposal(proposal))
        .filter(Boolean);
      const profileUpdateDecisions = [];

      if (narrationRuntime && campaignId && turnId) {
        const runtimeLocationId =
          safeString(aiHandoff?.runtime_result?.truth_snapshot?.effective_world_state?.location_id) ||
          safeString(aiHandoff?.input_contract?.world_state?.location_id) ||
          null;
        const linkedEntityIds = Array.isArray(aiHandoff?.output_contract?.targets)
          ? aiHandoff.output_contract.targets.map((item) => safeString(item)).filter(Boolean)
          : [];
        const clarificationHandoff = isClarificationHandoff(aiHandoff);
        if (!clarificationHandoff) {
          narrationRuntime.memoryService.appendAutoPlayerSummary(
            campaignId,
            {
              turn_id: turnId,
              text: playerText,
              location_id: runtimeLocationId,
              linked_entity_ids: linkedEntityIds,
              tags: [
                safeString(aiHandoff?.output_contract?.intent_type),
                "auto_summary"
              ].filter(Boolean)
            },
            turnId
          );
          for (const hint of nextTurnHints.slice(0, 3)) {
            narrationRuntime.memoryService.appendAutoPlayerLead(
              campaignId,
              {
                turn_id: turnId,
                text: hint,
                location_id: runtimeLocationId,
                linked_entity_ids: linkedEntityIds,
                tags: [
                  safeString(aiHandoff?.output_contract?.intent_type),
                  "next_turn_hint"
                ].filter(Boolean)
              },
              turnId
            );
          }
        }
        const talkInteractionUpdate = clarificationHandoff
          ? null
          : updateTalkActorAfterNarration(
              narrationRuntime.memoryService,
              campaignId,
              turnId,
              aiHandoff,
              playerText,
              nextTurnHints
            );
        if (talkInteractionUpdate) {
          profileUpdateDecisions.push({
            entity_id: talkInteractionUpdate.entity_id,
            profile_update_decision: "interaction_updated",
            reserve_reason: null
          });
        }
        for (const proposal of entityEnrichmentProposals) {
          const entity = narrationRuntime.memoryService.getEntity(campaignId, proposal.entity_id);
          if (!entity) {
            profileUpdateDecisions.push({
              entity_id: proposal.entity_id,
              profile_update_decision: "rejected",
              reserve_reason: "entity_not_found"
            });
            continue;
          }
          if (shouldDeferEntityEnrichment(entity, proposal)) {
            const deferredEntity = JSON.parse(JSON.stringify(entity));
            const sanitizedPatch = sanitizeEntityPatchProposal(proposal.proposed_patch);
            deferredEntity.payload = {
              ...(deferredEntity.payload && typeof deferredEntity.payload === "object"
                ? deferredEntity.payload
                : {}),
              profile_state: "pending_enrichment",
              pending_enrichment: {
                ...proposal,
                proposed_patch: sanitizedPatch || proposal.proposed_patch
              }
            };
            narrationRuntime.memoryService.upsertEntity(campaignId, deferredEntity, turnId);
            profileUpdateDecisions.push({
              entity_id: proposal.entity_id,
              profile_update_decision: "deferred",
              reserve_reason: "wiki_or_runtime_validation_needed"
            });
            continue;
          }

          const sanitizedPatch = sanitizeEntityPatchProposal(proposal.proposed_patch);
          if (!sanitizedPatch) {
            profileUpdateDecisions.push({
              entity_id: proposal.entity_id,
              profile_update_decision: "rejected",
              reserve_reason: "proposal_invalid_after_runtime_review"
            });
            continue;
          }
          const mergedEntity = localizeResolvedEntityPayload(
            mergeEntityPatch(entity, sanitizedPatch)
          );
          mergedEntity.payload = {
            ...(mergedEntity.payload && typeof mergedEntity.payload === "object"
              ? mergedEntity.payload
              : {}),
            profile_state: "resolved",
            pending_enrichment: null
          };
          narrationRuntime.memoryService.upsertEntity(campaignId, mergedEntity, turnId);
          profileUpdateDecisions.push({
            entity_id: proposal.entity_id,
            profile_update_decision: "accepted_now",
            reserve_reason: null
          });
        }
      }

      return sendJson(res, 200, {
        campaign_id: campaignId,
        turn_id: turnId,
        source: "llm",
        player_text: playerText,
        mj_notes: mjNotes,
        next_turn_hints: nextTurnHints,
        entity_enrichment_proposals: entityEnrichmentProposals,
        proposal_update_decisions: profileUpdateDecisions,
        profile_update_decisions: profileUpdateDecisions
      });
    } catch (err) {
      return sendJson(res, 400, {
        error: "generate_narration_failed",
        details: [String(err?.message || err)]
      });
    }
  }

  return {
    handleProcessTurn,
    handleGenerateNarration
  };
}

module.exports = { createRouteHandlers };
