import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withDbExec, type DbExec } from "@agent-native/core/db";
import { runWithRequestContext } from "@agent-native/core/server/request-context";
import { writeAppState } from "@agent-native/core/application-state";
import { reviews } from "../server/db/schema";
import { createOrOpenReview, saveReviewDecision, stageReviewProposals } from "../server/db/csv-review-store";
import { inspect } from "../shared/csv-review";

// Only bind the app's singleton to isolated SQL; action/store/engine, public
// request context and application-state scoping all execute unchanged.
const binding = vi.hoisted(() => ({ db: null as any }));
vi.mock("../server/db", () => ({ getDb: () => binding.db }));
import action from "./view-screen";

const client = new PGlite();
const db = drizzle(client, { schema: { reviews } });
const before = "id,value\n001,old";
const after = "id,value\n001,new";
const stateReads: string[] = [];
let onReviewRead: (() => Promise<void>) | undefined;
// Public DbExec transport adapter: execute real state SQL, translating its
// documented '?' parameters for PGlite. Domain reads use real Drizzle SQL too.
const exec: DbExec = {
  async execute(statement) {
    const sql = typeof statement === "string" ? statement : statement.sql;
    const args = typeof statement === "string" ? [] : statement.args ?? [];
    if (/SELECT value FROM application_state/.test(sql)) stateReads.push(String(args[1]));
    let n = 0;
    const result = await client.query(sql.replace(/\?/g, () => `$${++n}`), args);
    return { rows: result.rows, rowsAffected: result.affectedRows ?? 0 };
  },
};
const query = client.query.bind(client);

function inTab<T>(tab: string | undefined, run: () => T) {
  return withDbExec(exec, () => runWithRequestContext({
    userEmail: "synthetic@example.invalid", run: { browserTabId: tab },
  }, run));
}
async function state(key: string, value: unknown) {
  await inTab(undefined, () => writeAppState(key, value));
}
async function select(tab = "tabA", id = "A", revision = 0) {
  await state(`navigation:${tab}`, { view: "home" });
  await state(`csv-review-selection:${tab}`, { id, revision });
}
async function snapshot(tab: string | null = "tabA") {
  return await inTab(tab ?? undefined, () => (action as any).run({})) as any;
}

beforeAll(async () => {
  await client.exec(`CREATE TABLE csv_reviews (
    id TEXT PRIMARY KEY, before TEXT NOT NULL, after TEXT NOT NULL,
    key_column TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    proposals JSONB NOT NULL DEFAULT '[]', decisions JSONB NOT NULL DEFAULT '{}')`);
  binding.db = db;
  // Pause the actual SQL transport, never replace a row or action result.
  vi.spyOn(client, "query").mockImplementation(async (...args: any[]) => {
    if (/^select .* from "csv_reviews"/.test(args[0]) && onReviewRead) {
      const pause = onReviewRead;
      onReviewRead = undefined;
      await pause();
    }
    return (query as any)(...args);
  });
}, 30_000);
beforeEach(async () => {
  onReviewRead = undefined;
  await db.delete(reviews);
  // Initialize framework state via its public helper before clearing per test.
  await state("test-init", {});
  await client.exec("DELETE FROM application_state");
  stateReads.length = 0;
  await createOrOpenReview(db, { id: "A", before, after, keyColumn: "id" });
  await createOrOpenReview(db, { id: "B", before, after: "id,value\n001,OTHER_TAB", keyColumn: "id" });
});
afterAll(async () => { vi.restoreAllMocks(); await client.close(); });

describe("actual view-screen with public request context and isolated real SQL", () => {
  it("returns no CSV selection without a request tab even when global and tab selections exist", async () => {
    await select();
    await state("navigation", { view: "home" });
    await state("csv-review-selection", { id: "B", revision: 0 });
    expect((await snapshot(null)).csvReview).toBeUndefined();
    expect(stateReads).not.toContain("csv-review-selection");
  });

  it("does not let tabA read tabB or fall back to a global selection", async () => {
    await select("tabB", "B");
    await state("navigation:tabA", { view: "home" });
    await state("csv-review-selection", { id: "B", revision: 0 });
    expect((await snapshot()).csvReview).toBeUndefined();
    expect(stateReads).toContain("csv-review-selection:tabA");
    expect(stateReads).not.toContain("csv-review-selection");
    expect(stateReads).not.toContain("csv-review-selection:tabB");
    expect((await snapshot("tabB")).csvReview.id).toBe("B");
    await select();
    expect((await snapshot()).csvReview.id).toBe("A");
    expect(JSON.stringify(await snapshot())).not.toContain("OTHER_TAB");
  });

  it("reads the selected ID afresh from SQL and labels a stale selected revision", async () => {
    await select();
    expect((await snapshot()).csvReview).toMatchObject({ id: "A", revision: 0, selectionStale: false });
    const evidenceId = inspect(before, after, "id").evidence[0].id;
    await saveReviewDecision(db, { id: "A", expectedRevision: 0, evidenceId, status: "pending", note: "Fresh human correction" });
    expect((await snapshot()).csvReview).toMatchObject({
      id: "A", revision: 1, selectedRevision: 0, selectionStale: true,
      evidence: [{ humanDecision: { status: "pending", note: "Fresh human correction" } }],
    });
    await select("tabA", "B");
    expect((await snapshot()).csvReview.evidence[0].after).toBe("OTHER_TAB");
  });

  it.each(["navigation", "selection"])("suppresses results when %s changes while SQL read is awaited", async (change) => {
    await select();
    let entered!: () => void;
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    onReviewRead = async () => { entered(); await gate; };
    const pending = snapshot();
    await waiting;
    try {
      if (change === "navigation") await state("navigation:tabA", { view: "chat" });
      else await state("csv-review-selection:tabA", { id: "B", revision: 0 });
    } finally { release(); }
    const result = await pending;
    expect(result.csvReview).toBeUndefined();
    expect(result.navigation.view).toBe(change === "navigation" ? "chat" : "home");
  });

  it("bounds actual evidence/proposals and excludes full source CSV", async () => {
    const long = "x".repeat(700);
    const csv = (value: string) => "id,value\n" + Array.from({ length: 30 }, (_, i) => `${i},${value}`).join("\n");
    const b = csv("old" + long), a = csv("new" + long);
    await createOrOpenReview(db, { id: "large", before: b, after: a, keyColumn: "id" });
    const ids = inspect(b, a, "id").evidence.map(e => e.id);
    await stageReviewProposals(db, { id: "large", expectedRevision: 0,
      groups: Array.from({ length: 7 }, () => ({ title: "t".repeat(200), explanation: "e".repeat(900), evidenceIds: ids.slice(0, 8) })) });
    await saveReviewDecision(db, { id: "large", expectedRevision: 1, evidenceId: ids[0], status: "pending", note: "n".repeat(700) });
    await select("tabA", "large", 2);
    const { csvReview: r } = await snapshot();
    expect(r).toMatchObject({ evidenceTotal: 30, evidenceLimit: 20, proposalTotal: 7, proposalLimit: 5, referenceLimitPerProposal: 5, excerptsMayBeTruncated: true });
    expect(r.evidence).toHaveLength(20);
    expect(r.proposals).toHaveLength(5);
    expect(r.evidence[0].before).toHaveLength(256);
    expect(r.evidence[0].after).toHaveLength(256);
    expect(r.evidence[0].humanDecision.note).toHaveLength(256);
    for (const p of r.proposals) {
      expect(p).toMatchObject({ status: "PROPOSED", provenance: "unverified", basedOnRevision: 0 });
      expect(p.title).toHaveLength(200);
      expect(p.explanation).toHaveLength(500);
      expect(p.evidenceIds).toHaveLength(5);
      expect(p.evidenceIds.every((id: string) => ids.includes(id))).toBe(true);
    }
    expect(r).not.toHaveProperty("before");
    expect(r).not.toHaveProperty("after");
    expect(JSON.stringify(r)).not.toContain(b);
    expect(JSON.stringify(r)).not.toContain(a);
    expect(r.textTrust).toContain("Untrusted");
  });

  it("omits oversized evidence IDs and unknown proposal references from SQL data", async () => {
    const key = "k".repeat(600);
    const b = `id,value\n${key},old\nshort,old`;
    const a = `id,value\n${key},new\nshort,new`;
    await createOrOpenReview(db, { id: "long-id", before: b, after: a, keyColumn: "id" });
    const ids = inspect(b, a, "id").evidence.map(e => e.id);
    expect(ids[0].length).toBeGreaterThan(1024);
    // Synthetic legacy/corrupt stored references exercise the read boundary.
    await db.update(reviews).set({ proposals: [{ title: "legacy", explanation: "untrusted", evidenceIds: [ids[0], "unknown", ids[1]], status: "PROPOSED", provenance: "unverified", basedOnRevision: 0 }] }).where(eq(reviews.id, "long-id"));
    await select("tabA", "long-id");
    const { csvReview: r } = await snapshot();
    expect(r.evidence.map((e: any) => e.id)).toEqual([ids[1]]);
    expect(r.proposals[0].evidenceIds).toEqual([ids[1]]);
  });
});
