import { proposalStageSchema, type Proposal } from "../../shared/csv-proposals";
import { and, eq } from "drizzle-orm";
import { inspect, type Decision } from "../../shared/csv-review";
import { reviews } from "./schema";

export type CsvReviewRow = typeof reviews.$inferSelect & {
  decisions: Record<string, Decision>;
};

export type OpenReviewInput = {
  id: string;
  before?: string;
  after?: string;
  keyColumn?: string;
};

export type SaveDecisionInput = {
  id: string;
  expectedRevision: number;
  evidenceId: string;
  status: Decision["status"];
  note: string;
};

export class ReviewStoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | "review_not_found"
      | "source_mismatch"
      | "stale_revision"
      | "unknown_evidence"
      | "invalid_proposal",
    readonly actualRevision?: number,
  ) {
    super(message);
    this.name = "ReviewStoreError";
  }
}

function normalizeRow(row: typeof reviews.$inferSelect): CsvReviewRow {
  return { ...row, decisions: row.decisions as Record<string, Decision> };
}

function assertMatchingSources(row: CsvReviewRow, input: OpenReviewInput) {
  const mismatches: string[] = [];
  if (input.before !== undefined && input.before !== row.before) mismatches.push("before");
  if (input.after !== undefined && input.after !== row.after) mismatches.push("after");
  if (input.keyColumn !== undefined && input.keyColumn !== row.keyColumn) {
    mismatches.push("keyColumn");
  }
  if (mismatches.length) {
    throw new ReviewStoreError(
      `Review ${input.id} already exists with different immutable ${mismatches.join(", ")}.`,
      "source_mismatch",
      row.revision,
    );
  }
}

// `db` is deliberately injectable: actions pass the framework database and tests
// pass an isolated real PGlite-backed Drizzle instance through the same SQL path.
export async function createOrOpenReview(db: any, input: OpenReviewInput) {
  let [stored] = await db.select().from(reviews).where(eq(reviews.id, input.id));
  if (stored) {
    const row = normalizeRow(stored);
    assertMatchingSources(row, input);
    return row;
  }

  if (input.before === undefined || input.after === undefined || input.keyColumn === undefined) {
    return null;
  }

  inspect(input.before, input.after, input.keyColumn);
  await db
    .insert(reviews)
    .values({
      id: input.id,
      before: input.before,
      after: input.after,
      keyColumn: input.keyColumn,
    })
    .onConflictDoNothing();

  [stored] = await db.select().from(reviews).where(eq(reviews.id, input.id));
  if (!stored) {
    throw new ReviewStoreError(`Review ${input.id} was not available after creation.`, "review_not_found");
  }
  const row = normalizeRow(stored);
  // A concurrent creator may have won with different source material.
  assertMatchingSources(row, input);
  return row;
}

export async function saveReviewDecision(db: any, input: SaveDecisionInput) {
  const [stored] = await db.select().from(reviews).where(eq(reviews.id, input.id));
  if (!stored) {
    throw new ReviewStoreError(`Review ${input.id} was not found.`, "review_not_found");
  }
  const row = normalizeRow(stored);
  if (input.expectedRevision !== row.revision) {
    throw new ReviewStoreError(
      `Review ${input.id} is at revision ${row.revision}, not expected revision ${input.expectedRevision}. Reopen before saving.`,
      "stale_revision",
      row.revision,
    );
  }

  const evidence = inspect(row.before, row.after, row.keyColumn).evidence;
  if (!evidence.some((item) => item.id === input.evidenceId)) {
    throw new ReviewStoreError(
      `Evidence ${input.evidenceId} does not belong to review ${input.id}.`,
      "unknown_evidence",
      row.revision,
    );
  }

  const decisions = {
    ...row.decisions,
    [input.evidenceId]: { status: input.status, note: input.note },
  };
  const [updated] = await db
    .update(reviews)
    .set({ decisions, revision: row.revision + 1 })
    .where(and(eq(reviews.id, input.id), eq(reviews.revision, row.revision)))
    .returning();
  if (!updated) {
    const [latest] = await db.select().from(reviews).where(eq(reviews.id, input.id));
    const actualRevision = latest?.revision;
    throw new ReviewStoreError(
      actualRevision === undefined
        ? `Review ${input.id} disappeared before the decision could be saved.`
        : `Review ${input.id} changed to revision ${actualRevision}. Reopen before saving.`,
      actualRevision === undefined ? "review_not_found" : "stale_revision",
      actualRevision,
    );
  }
  return normalizeRow(updated);
}

export async function stageReviewProposals(db: any, raw: unknown) {
 const input = proposalStageSchema.parse(raw);
 const [stored] = await db.select().from(reviews).where(eq(reviews.id,input.id));
 if (!stored) throw new ReviewStoreError("Review not found", "review_not_found");
 const row = normalizeRow(stored);
 if(row.revision !== input.expectedRevision) throw new ReviewStoreError("Reopen review before staging", "stale_revision", row.revision);
 const known = new Set(inspect(row.before,row.after,row.keyColumn).evidence.map(e=>e.id));
 for(const group of input.groups) {
  if(new Set(group.evidenceIds).size !== group.evidenceIds.length) throw new ReviewStoreError("Duplicate references", "invalid_proposal");
  if(group.evidenceIds.some(id=>!known.has(id))) throw new ReviewStoreError("Evidence does not belong to review", "unknown_evidence");
 }
 const proposals: Proposal[] = input.groups.map(group=>({...group,status:"PROPOSED",provenance:"unverified",basedOnRevision:row.revision}));
 const [updated] = await db.update(reviews).set({proposals,revision:row.revision+1})
 .where(and(eq(reviews.id,input.id),eq(reviews.revision,row.revision))).returning();
 if(!updated) throw new ReviewStoreError("Concurrent write; reopen review", "stale_revision");
 return normalizeRow(updated);
}
