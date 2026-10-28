import { defineAction, NoWriteError } from "@agent-native/core/action";
import { z } from "zod";
import { getDb } from "../server/db";
import { ReviewStoreError, saveReviewDecision } from "../server/db/csv-review-store";

export default defineAction({
  description:
    "Human-only accept, reject, reset, or correct one known evidence interpretation with atomic revision conflict protection.",
  uiOnly: true,
  agentTool: false,
  schema: z.object({
    id: z.string().trim().min(1).max(128).describe("Review ID"),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).describe("Exact expected revision read from the open review"),
    evidenceId: z.string().min(1).max(1024).describe("Existing evidence anchor from this review"),
    status: z.enum(["pending", "accepted", "rejected"]).describe("Explicit human decision; no status is accepted automatically"),
    note: z.string().max(4000).describe("Human correction or explanation"),
  }),
  run: async (args) => {
    try {
      const saved = await saveReviewDecision(getDb(), {
        id: args.id,
        expectedRevision: args.revision,
        evidenceId: args.evidenceId,
        status: args.status,
        note: args.note,
      });
      return { revision: saved.revision };
    } catch (error) {
      if (error instanceof ReviewStoreError) {
        throw new NoWriteError(error.message, {
          errorCode: error.code,
          statusCode: error.code === "review_not_found" ? 404 : 409,
          details: { actualRevision: error.actualRevision },
        });
      }
      throw error;
    }
  },
});
