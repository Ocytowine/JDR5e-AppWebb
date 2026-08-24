import { useEffect, useRef, useState } from "react";
import {
  IndexedDbPlayerPrivateNotebookRepositoryV1,
  PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1,
  PLAYER_PRIVATE_NOTEBOOK_TITLE_LIMIT_V1,
  PlayerPrivateNotebookErrorV1,
  PlayerPrivateNotebookServiceV1,
  type PlayerPrivateNotebookDocumentV1,
  type PlayerPrivateNotebookScopeV1
} from "./playerPrivateNotebook";

export function PlayerPrivateNotebookPanel(props: {
  scope: PlayerPrivateNotebookScopeV1;
}) {
  const [expanded, setExpanded] = useState(false);
  const [document, setDocument] = useState<PlayerPrivateNotebookDocumentV1 | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ouverture du carnet privé…");
  const [unavailable, setUnavailable] = useState(false);
  const serviceRef = useRef<PlayerPrivateNotebookServiceV1 | null>(null);
  const repositoryRef = useRef<IndexedDbPlayerPrivateNotebookRepositoryV1 | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    setDocument(null);
    setSelectedTabId(null);
    setUnavailable(false);
    setStatus("Ouverture du carnet privé…");
    void IndexedDbPlayerPrivateNotebookRepositoryV1.open().then(async repository => {
      if (cancelled) {
        repository.close();
        return;
      }
      repositoryRef.current = repository;
      const service = new PlayerPrivateNotebookServiceV1(repository);
      serviceRef.current = service;
      const loaded = await service.read(props.scope);
      if (cancelled) return;
      setDocument(loaded);
      setSelectedTabId(loaded.tabs[0]?.tabId ?? null);
      setStatus(loaded.tabs.length === 0 ? "Carnet vide." : "Carnet restauré.");
    }).catch(() => {
      if (!cancelled) {
        setUnavailable(true);
        setStatus("Le carnet privé est indisponible. La campagne reste jouable.");
      }
    });
    return () => {
      cancelled = true;
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
      repositoryRef.current?.close();
      repositoryRef.current = null;
      serviceRef.current = null;
    };
  }, [props.scope.campaignId, props.scope.characterRef]);

  const selected = document?.tabs.find(tab => tab.tabId === selectedTabId) ?? null;

  async function run(
    operation: (service: PlayerPrivateNotebookServiceV1, current: PlayerPrivateNotebookDocumentV1) => Promise<PlayerPrivateNotebookDocumentV1>,
    success: string
  ): Promise<PlayerPrivateNotebookDocumentV1 | undefined> {
    const service = serviceRef.current;
    if (service === null) return;
    try {
      const queued = operationQueueRef.current.then(async () => {
        const current = await service.read(props.scope);
        return operation(service, current);
      });
      operationQueueRef.current = queued.then(() => undefined, () => undefined);
      const next = await queued;
      setDocument(next);
      setStatus(success);
      return next;
    } catch (error) {
      if (error instanceof PlayerPrivateNotebookErrorV1 && error.code === "STALE_REVISION") {
        const reloaded = await service.read(props.scope);
        setDocument(reloaded);
        setSelectedTabId(reloaded.tabs[0]?.tabId ?? null);
        setStatus("Le carnet a changé dans un autre onglet ; sa version récente a été restaurée.");
        return;
      }
      setStatus("La modification privée n’a pas pu être enregistrée. La campagne n’est pas affectée.");
    }
  }

  async function addTab() {
    const next = await run(
      (service, current) => service.createTab({
        scope: props.scope,
        expectedRevision: current.revision
      }),
      "Nouvel intercalaire enregistré."
    );
    if (next) setSelectedTabId(next.tabs.at(-1)?.tabId ?? null);
  }

  function scheduleTextSave(tabId: string, text: string) {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    setStatus("Enregistrement…");
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveText(tabId, text);
    }, 450);
  }

  function saveText(tabId: string, text: string) {
    return run((service, current) => service.updateTabText({
      scope: props.scope,
      expectedRevision: current.revision,
      tabId,
      text
    }), "Notes enregistrées.");
  }

  return (
    <section aria-label="Carnet privé du joueur" style={styles.shell}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
        style={styles.toggle}
      >
        <span>Mon carnet</span>
        <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>
      {expanded && (
        <div style={styles.body}>
          <p style={styles.privacy}>
            Notes privées à ce navigateur. Elles ne sont ni lues par le MJ ni envoyées à l’IA.
          </p>
          <p role="status" aria-live="polite" style={styles.status}>{status}</p>
          {!unavailable && document !== null && (
            <>
              <div role="tablist" aria-label="Intercalaires du carnet" style={styles.tabs}>
                {document.tabs.map((tab, index) => (
                  <button
                    key={tab.tabId}
                    type="button"
                    role="tab"
                    aria-selected={tab.tabId === selectedTabId}
                    onClick={() => setSelectedTabId(tab.tabId)}
                    style={tab.tabId === selectedTabId ? styles.activeTab : styles.tab}
                  >
                    {tab.title || `Notes ${index + 1}`}
                  </button>
                ))}
                <button type="button" onClick={() => void addTab()} style={styles.addTab}>
                  + Intercalaire
                </button>
              </div>
              {selected !== null ? (
                <div role="tabpanel" aria-label={`Intercalaire ${selected.title}`} style={styles.editor}>
                  <label style={styles.label}>
                    Titre
                    <input
                      aria-label="Titre de l’intercalaire"
                      maxLength={PLAYER_PRIVATE_NOTEBOOK_TITLE_LIMIT_V1}
                      defaultValue={selected.title}
                      key={`${selected.tabId}:${selected.title}`}
                      onBlur={event => {
                        const title = event.currentTarget.value.trim();
                        if (title && title !== selected.title) {
                          void run((service, current) => service.renameTab({
                            scope: props.scope,
                            expectedRevision: current.revision,
                            tabId: selected.tabId,
                            title
                          }), "Titre enregistré.");
                        }
                      }}
                      style={styles.titleInput}
                    />
                  </label>
                  <label style={styles.label}>
                    Notes
                    <textarea
                      aria-label="Notes privées"
                      maxLength={PLAYER_PRIVATE_NOTEBOOK_TEXT_LIMIT_V1}
                      value={selected.text}
                      onChange={event => {
                        const text = event.currentTarget.value;
                        setDocument(current => current === null ? current : {
                          ...current,
                          tabs: current.tabs.map(tab => tab.tabId === selected.tabId ? { ...tab, text } : tab)
                        });
                        scheduleTextSave(selected.tabId, text);
                      }}
                      onBlur={event => {
                        if (saveTimerRef.current === null) return;
                        clearTimeout(saveTimerRef.current);
                        saveTimerRef.current = null;
                        void saveText(selected.tabId, event.currentTarget.value);
                      }}
                      style={styles.textarea}
                    />
                  </label>
                  <div style={styles.actions}>
                    <button
                      type="button"
                      disabled={document.tabs.findIndex(tab => tab.tabId === selected.tabId) === 0}
                      onClick={() => void run((service, current) => service.reorderTab({
                        scope: props.scope,
                        expectedRevision: current.revision,
                        tabId: selected.tabId,
                        toIndex: Math.max(0, current.tabs.findIndex(tab => tab.tabId === selected.tabId) - 1)
                      }), "Ordre enregistré.")}
                    >Déplacer à gauche</button>
                    <button
                      type="button"
                      disabled={document.tabs.findIndex(tab => tab.tabId === selected.tabId) === document.tabs.length - 1}
                      onClick={() => void run((service, current) => service.reorderTab({
                        scope: props.scope,
                        expectedRevision: current.revision,
                        tabId: selected.tabId,
                        toIndex: Math.min(current.tabs.length - 1, current.tabs.findIndex(tab => tab.tabId === selected.tabId) + 1)
                      }), "Ordre enregistré.")}
                    >Déplacer à droite</button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Supprimer l’intercalaire « ${selected.title} » ?`)) return;
                        void run((service, current) => service.deleteTab({
                          scope: props.scope,
                          expectedRevision: current.revision,
                          tabId: selected.tabId
                        }), "Intercalaire supprimé.").then(next => {
                          if (next) setSelectedTabId(next.tabs[0]?.tabId ?? null);
                        });
                      }}
                      style={styles.deleteButton}
                    >Supprimer</button>
                  </div>
                </div>
              ) : (
                <p style={styles.empty}>Crée un intercalaire pour commencer à prendre des notes.</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

const styles = {
  shell: { borderRadius: 14, border: "1px solid rgba(213,185,121,0.30)", background: "rgba(26,21,13,0.78)", overflow: "hidden" },
  toggle: { width: "100%", display: "flex", justifyContent: "space-between", padding: "12px 14px", border: 0, background: "transparent", color: "#f3ddb0", fontWeight: 800, cursor: "pointer" },
  body: { padding: "0 14px 14px" },
  privacy: { margin: "0 0 6px", color: "rgba(255,255,255,0.72)", fontSize: 12 },
  status: { minHeight: 18, margin: "0 0 8px", color: "#b8c3d6", fontSize: 11 },
  tabs: { display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 10 },
  tab: { border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, padding: "7px 10px", background: "rgba(255,255,255,0.04)", color: "#ddd", cursor: "pointer" },
  activeTab: { border: "1px solid #d5b979", borderRadius: 8, padding: "7px 10px", background: "rgba(213,185,121,0.18)", color: "#fff2d1", cursor: "pointer" },
  addTab: { border: "1px dashed rgba(213,185,121,0.55)", borderRadius: 8, padding: "7px 10px", background: "transparent", color: "#e5ca91", cursor: "pointer" },
  editor: { display: "grid", gap: 8 },
  label: { display: "grid", gap: 5, fontSize: 12, color: "#d8dbe2" },
  titleInput: { borderRadius: 8, border: "1px solid rgba(255,255,255,0.18)", padding: "8px 10px", background: "rgba(4,6,10,0.62)", color: "white" },
  textarea: { boxSizing: "border-box" as const, width: "100%", minHeight: 150, resize: "vertical" as const, borderRadius: 9, border: "1px solid rgba(255,255,255,0.18)", padding: 10, background: "rgba(4,6,10,0.62)", color: "white", lineHeight: 1.5 },
  actions: { display: "flex", flexWrap: "wrap" as const, gap: 8 },
  deleteButton: { marginLeft: "auto", color: "#ffb8b8" },
  empty: { margin: "10px 0", color: "#c3c6ce", fontSize: 13 }
};
