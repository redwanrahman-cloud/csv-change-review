export const proposalStagingMigration = {version:2,name:'csv-proposal-staging-v2',sql:`ALTER TABLE csv_reviews ADD COLUMN IF NOT EXISTS proposals JSONB NOT NULL DEFAULT '[]';`};
