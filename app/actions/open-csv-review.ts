import { defineAction, NoWriteError } from "@agent-native/core/action";
import { z } from "zod";
import { getDb } from "../server/db";
import { createOrOpenReview, ReviewStoreError } from "../server/db/csv-review-store";
import { exportReview, inspect } from "../shared/csv-review";

export default defineAction({
  description:
    "Create or reopen a deterministic CSV review; supplied sources must match immutable saved sources and export includes human status and evidence anchors.",
  mcpTool: true,
  schema: z.object({
    id: z.string().trim().min(1).max(128).default("synthetic-demo").describe("Local synthetic review ID; defaults synthetic-demo"),
    before: z.string().max(65_536).optional().describe("Before text; required for a new review and must match when reopening"),
    after: z.string().max(65_536).optional().describe("After text; required for a new review and must match when reopening"),
    keyColumn: z.string().min(1).max(256).optional().describe("Key header; required for a new review and must match when reopening"),
    format: z.enum(["html", "markdown"]).optional().describe("Optional safe export format"),
  }),
  run: async (args) => {
    try {
      const row = await createOrOpenReview(getDb(), args);
      if (!row) return { review: null };
      const result = inspect(row.before, row.after, row.keyColumn);
      return {
        review: { ...row, ...result },
        export: args.format
          ? exportReview(result.evidence, row.decisions, args.format, row.proposals as import("../shared/csv-proposals").Proposal[])
          : undefined,
      };
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
