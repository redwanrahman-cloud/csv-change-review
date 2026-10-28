import type { Proposal } from "../../shared/csv-proposals";
import { pgTable, text, integer, jsonb } from 'drizzle-orm/pg-core';
export const reviews = pgTable('csv_reviews', { id: text('id').primaryKey(), before: text('before').notNull(), after: text('after').notNull(), keyColumn: text('key_column').notNull(), revision: integer('revision').notNull().default(0), proposals: jsonb('proposals').$type<Proposal[]>().notNull().default([]), decisions: jsonb('decisions').notNull().default({}) });
