import { defineAction, NoWriteError } from "@agent-native/core/action";
import { getDb } from "../server/db";
import { ReviewStoreError, stageReviewProposals } from "../server/db/csv-review-store";
import { proposalStageSchema } from "../shared/csv-proposals";
export default defineAction({
  description: "Stage PROPOSED evidence-linked grouping/explanations for an existing CSV review at its exact revision; never changes human decisions or sources; provenance unverified.",
  mcpTool: true,
  schema: proposalStageSchema,
  run: async (args) => {
    try {
      const row = await stageReviewProposals(getDb(), args);
      return { id: row.id, revision: row.revision, proposals: row.proposals,
        _receipt: { changed: true, verified: true, subject: row.id, summary: "SQL returned saved PROPOSED groups; provenance unverified; no human decision made." } };
    } catch (error) {
      if (error instanceof ReviewStoreError) throw new NoWriteError(error.message, {
        errorCode: error.code, statusCode: error.code === "review_not_found" ? 404 : 409,
        details: { actualRevision: error.actualRevision }
      });
      throw error;
    }
  }
});
