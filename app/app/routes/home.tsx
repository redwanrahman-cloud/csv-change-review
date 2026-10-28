import { writeClientAppState, deleteClientAppState, useChangeVersions, callAction } from "@agent-native/core/client/hooks";
import { useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { Evidence, Decision } from "../../shared/csv-review";
import { TAB_ID } from "@/lib/tab-id";
import { CsvProposals } from "@/components/csv-proposals";
import { CsvDiscardDialog } from "@/components/csv-discard-dialog";
import { ReviewDrafts } from "@/lib/csv-review-drafts";
const sampleBefore =
  "id,item,price\n001,Notebook,4.00\n002,Pencil,1.00\n003,Eraser,2.00";
const sampleAfter =
  "id,item,price\n001,Notebook,4.50\n002,Pencil,1.00\n004,Ruler,3.00";
export default function HomeRoute() {
  const [before, B] = useState(sampleBefore),
    [after, A] = useState(sampleAfter),
    [headers, H] = useState<string[]>([]),
    [key, K] = useState(""),
    [review, R] = useState<any>(null),
    [error, E] = useState(""),
    [working, S] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const busy = working || confirmOpen;
  const pendingDiscard = useRef<{ run: () => void; generation: number; epoch: number } | null>(null);
  const drafts = useRef(new ReviewDrafts()).current;
  const [, redraw] = useState(0);
  function editDraft(key: string, value: string) { drafts.edit(key, value); redraw(n => n + 1); }
  // Only navigation/inspection callbacks enter this gate; never human writes.
  function requestDiscard(run: () => void) {
    if (!mounted.current || active.current || pendingDiscard.current) return;
    if (!drafts.dirty) { run(); return; }
    pendingDiscard.current = { run, generation: generation.current, epoch: drafts.epoch };
    setConfirmOpen(true);
  }
  function resolveDiscard(confirmed: boolean) {
    const pending = pendingDiscard.current;
    pendingDiscard.current = null; // Consume before callbacks and primitive close events.
    setConfirmOpen(false);
    if (!confirmed || !pending || !mounted.current || active.current ||
        pending.generation !== generation.current || pending.epoch !== drafts.epoch) return;
    drafts.discard(); // Text only; accepted persisted read/leaving clears recovery.
    redraw(n => n + 1);
    pending.run();
  }
  const generation = useRef(0),
    active = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pendingDiscard.current = null;
      generation.current++;
    };
  }, []);
  const actionVersions = useChangeVersions(["action"]);
  const priorVersions = useRef(actionVersions);
  useEffect(() => {
    if (priorVersions.current === actionVersions) return;
    priorVersions.current = actionVersions;
    if (review && !active.current) {
      if (drafts.dirty) { drafts.recover(); redraw(n => n + 1); }
      else void task(current => reopen(review.id, current));
    }
  }, [actionVersions]);
  useEffect(() => {
    const stateKey = "csv-review-selection:" + TAB_ID;
    const operation = review
      ? writeClientAppState(stateKey, { id: review.id, revision: review.revision,
          keyColumn: review.keyColumn.slice(0, 256), counts: review.counts }, { requestSource: TAB_ID })
      : deleteClientAppState(stateKey, { requestSource: TAB_ID });
    void operation.catch(() => { if (mounted.current) E("Review context sync failed; reload before relying on agent selection."); });
    return () => {
      // Installed helpers serialize writes/deletes per key, including remounts.
      void deleteClientAppState(stateKey, { requestSource: TAB_ID, keepalive: true }).catch(() => {});
    };
  }, [review]);
  // Source edits invalidate pending reads, comparisons, reloads and exports.
  function invalidate() {
    drafts.select("");
    generation.current++;
    R(null);
    E("");
    return true;
  }
  function source(value: string, set: (s: string) => void) {
    requestDiscard(() => {
      invalidate();
      set(value);
      H([]);
      K("");
    });
  }
  async function task(fn: (current: () => boolean) => Promise<void>) {
    if (active.current || pendingDiscard.current || !mounted.current) return;
    active.current = true;
    const token = generation.current;
    S(true);
    E("");
    const current = () => mounted.current && generation.current === token;
    try {
      await fn(current);
    } catch (e) {
      if (current()) E(e instanceof Error ? e.message : String(e));
    } finally {
      active.current = false;
      if (mounted.current) S(false);
    }
  }
  function display(r: any) {
    if (!r.review) throw Error("Review not found");
    const saved = r.review;
    if (
      typeof saved.before !== "string" ||
      typeof saved.after !== "string" ||
      !saved.keyColumn
    )
      throw Error("Saved source provenance unavailable");
    drafts.select(saved.id);
    B(saved.before);
    A(saved.after);
    H(saved.headers);
    K(saved.keyColumn);
    R(saved);
  }
  async function reopen(id: string, current: () => boolean) {
    try {
      // Request identity is guarded by generation/current; explicit navigation
      // can select a different review. Validate/display before clearing stale.
      await drafts.read(current,
        () => callAction("open-csv-review", { id }, { timeoutMs: 30000 }), display);
    } finally {
      if (current()) redraw(n => n + 1);
    }
  }

  async function file(f: File | undefined, set: (s: string) => void) {
    if (!f) return;
    invalidate();
    H([]);
    K("");
    await task(async current => {
      if (f.size > 65536) {
        E("Synthetic imports are limited to 64 KiB.");
        return;
      }
      const text = await f.text();
      if (current()) set(text);
    });
  }
  async function download(format: "html" | "markdown", current: () => boolean) {
    const r = await callAction(
      "open-csv-review",
      { id: review.id, format },
      { timeoutMs: 30000 },
    );
    if (!current()) return;
    if (!r.export) throw Error("Export unavailable");
    const url = URL.createObjectURL(
      new Blob([r.export], {
        type: format === "html" ? "text/html" : "text/markdown",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "csv-review." + (format === "html" ? "html" : "md");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="mx-auto max-w-5xl p-6 space-y-6">
      <CsvDiscardDialog open={confirmOpen} onConfirm={() => resolveDiscard(true)}
        onCancel={() => resolveDiscard(false)} />
      <header className="border-b pb-5">
        <h1 className="text-3xl font-semibold">CSV Change Review</h1>
        <p className="mt-2 text-muted-foreground">
          Synthetic inventory · deterministic evidence · human decisions
        </p>
      </header>
      <p className="rounded-lg border p-3 text-sm">
        Built-in agent chat is unavailable/unverified. A separate external
        native-agent read → propose → stage → readback route was verified by recorded
        synthetic receipts. Saved proposals remain PROPOSED with unverified provenance;
        manual staging is not inference. Exact model identity and cryptographic
        model provenance are not established.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const id = new FormData(e.currentTarget).get("savedId") as string;
          requestDiscard(() => void task((current) => reopen(id, current)));
        }}
      >
        <Input
          disabled={busy}
          required
          name="savedId"
          aria-label="Saved review to reopen"
          placeholder="Saved review ID"
        />
        <Button variant="outline" disabled={busy}>
          Reopen saved review
        </Button>
      </form>
      <section className="grid gap-4 md:grid-cols-2">
        {(["Before", "After"] as const).map((label, i) => (
          <label key={label} className="space-y-2 font-medium">
            {label} CSV
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const selected = e.currentTarget.files?.[0];
                if (selected) requestDiscard(() => void file(selected, i ? A : B));
              }}
            />
            <textarea
              aria-label={label + " CSV source"}
              className="w-full min-h-40 rounded-lg border bg-background p-3 font-mono text-sm"
              disabled={busy}
              value={i ? after : before}
              onChange={(e) => {
                source(e.target.value, i ? A : B);
              }}
            />
          </label>
        ))}
      </section>
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          disabled={busy}
          onClick={() =>
            requestDiscard(() => void task(async (current) => {
              const r = await callAction(
                "inspect-csv",
                { before, after },
                { timeoutMs: 30000 },
              );
              if (current()) {
                H(r.headers);
                K(r.headers[0] ?? "");
              }
            }))
          }
        >
          1. Validate sources
        </Button>
        {headers.length > 0 && (
          <>
            <label>
              Key column{" "}
              <select
                aria-label="Key column"
                className="border rounded p-2"
                value={key}
                disabled={busy}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  requestDiscard(() => { invalidate(); K(value); });
                }}
              >
                {headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <Button
              disabled={busy || !key}
              onClick={() =>
                requestDiscard(() => void task(async (current) => {
                  const r = await callAction(
                    "open-csv-review",
                    { id: crypto.randomUUID(), before, after, keyColumn: key },
                    { timeoutMs: 30000 },
                  );
                  if (current()) display(r);
                }))
              }
            >
              2. Compare and save
            </Button>
          </>
        )}
      </div>
      {working && <p role="status">Working…</p>}
      {error && (
        <p
          role="alert"
          className="border border-destructive p-3 text-destructive"
        >
          {error}
        </p>
      )}
      {review && (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <h2 className="text-xl font-semibold">Saved evidence review</h2>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void task((current) => download("markdown", current))
              }
            >
              Export Markdown
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void task((current) => download("html", current))}
            >
              Export HTML
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const id = review.id;
                requestDiscard(() => void task((current) => reopen(id, current)));
              }}
            >
              Reload saved review
            </Button>
          </div>
          <p className="text-sm">
            {review.counts?.added} added · {review.counts?.removed} removed ·{" "}
            {review.counts?.cells} changed cells · revision {review.revision}
          </p>
          <Input aria-label="Saved review ID" readOnly value={review.id} />
          <p className="text-sm">
            Saved source provenance: the editors above show this review’s
            persisted Before and After CSVs, with key “{review.keyColumn}”.
            Editing either source or the key clears this review from the screen.
            Keep this ID to reopen after restart.
          </p>
          {drafts.stale && <p role="status">Saved state may be newer or conflicting. Drafts remain on revision {review.revision}; writes are blocked. Reload saved review explicitly discards drafts and reads fresh evidence before resubmission. No automatic rebase or replay.</p>}
          <CsvProposals key={review.id} draft={drafts.values.get("manual") ?? ""}
            editDraft={value => editDraft("manual", value)} proposals={review.proposals ?? []}
            evidence={review.evidence} busy={busy || drafts.stale} stage={groups => {
              if (drafts.stale) return;
              const submitted = drafts.values.get("manual");
              void task(async current => {
              try {
                await callAction("stage-csv-proposals", { id: review.id,
                  expectedRevision: review.revision, groups }, { timeoutMs: 30000 });
              } catch (error) {
                // Read fresh after rejection; never retry or replay a proposal write.
                if (current()) { drafts.recover(); redraw(n => n + 1); await reopen(review.id, current); }
                throw error;
              }
              if (current()) {
                if (submitted !== undefined) drafts.submitted("manual", submitted);
                await reopen(review.id, current);
              }
            }); }} />
          {review.evidence.length === 0 && <p>No changes found.</p>}
          {review.evidence.map((x: Evidence) => (
            <EvidenceCard
              key={review.id + ":" + x.id}
              x={x}
              decision={review.decisions[x.id]}
              note={drafts.values.get("note:" + x.id) ?? review.decisions[x.id]?.note ?? ""}
              edit={value => editDraft("note:" + x.id, value)}
              busy={busy || drafts.stale}
              save={(status, note) =>
                !drafts.stale && void task(async (current) => {
                  try { await callAction(
                    "review-csv-evidence",
                    {
                      id: review.id,
                      revision: review.revision,
                      evidenceId: x.id,
                      status,
                      note,
                    },
                    { timeoutMs: 30000, uiOnly: true },
                  );
                  } catch (error) {
                    if (current()) { drafts.recover(); redraw(n => n + 1); await reopen(review.id, current); }
                    throw error;
                  }
                  if (current()) {
                    drafts.submitted("note:" + x.id, note);
                    R((previous: any) => previous?.id === review.id ? { ...previous, decisions: { ...previous.decisions, [x.id]: { status, note } } } : previous);
                    await reopen(review.id, current);
                  }
                })
              }
            />
          ))}
        </section>
      )}
    </main>
  );
}
function EvidenceCard({
  x,
  decision,
  note, edit,
  busy,
  save,
}: {
  x: Evidence;
  decision?: Decision;
  note: string; edit: (value: string) => void;
  busy: boolean;
  save: (s: Decision["status"], n: string) => void;
}) {
  return (
    <article id={x.id} className="rounded-xl border p-4 space-y-3">
      <div className="flex justify-between">
        <a href={"#" + x.id} className="font-semibold underline">
          {x.kind}: {x.key} / {x.column}
        </a>
        <span>{decision?.status ?? "pending human review"}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <pre className="whitespace-pre-wrap break-all rounded bg-muted p-3">
          Before: {x.before || "∅"}
        </pre>
        <pre className="whitespace-pre-wrap break-all rounded bg-muted p-3">
          After: {x.after || "∅"}
        </pre>
      </div>
      <label className="block">
        Human interpretation / correction
        <textarea
          aria-label={"Correction " + x.key + " " + x.column}
          className="block w-full rounded border bg-background p-2"
          disabled={busy}
          maxLength={4000}
          value={note}
          onChange={(e) => edit(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        {(["accepted", "rejected", "pending"] as const).map((s) => (
          <Button
            key={s}
            variant={s === "accepted" ? "default" : "outline"}
            disabled={busy}
            onClick={() => save(s, note)}
          >
            {s === "accepted"
              ? "Accept"
              : s === "rejected"
                ? "Reject"
                : "Save as pending"}
          </Button>
        ))}
      </div>
    </article>
  );
}

export function meta() {
  return [{ title: "CSV Change Review" }];
}
