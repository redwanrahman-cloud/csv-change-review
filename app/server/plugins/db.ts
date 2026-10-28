import { proposalStagingMigration } from "../db/proposal-migration";
import { runMigrations } from '@agent-native/core/db';
export default runMigrations([{version:1,name:'csv-review-v1',sql:`CREATE TABLE IF NOT EXISTS csv_reviews (id TEXT PRIMARY KEY, before TEXT NOT NULL, after TEXT NOT NULL, key_column TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, decisions JSONB NOT NULL DEFAULT '{}');`},proposalStagingMigration], {table:'csv_review_migrations'});
