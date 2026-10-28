import { defineAction } from '@agent-native/core/action';
import { z } from 'zod';
import { inspect } from '../shared/csv-review';
export default defineAction({description:'Validate two synthetic CSV texts and inspect common keys or deterministic evidence.',mcpTool:true,schema:z.object({before:z.string().max(65536).describe('Before synthetic CSV, max 64K characters'),after:z.string().max(65536).describe('After synthetic CSV, max 64K characters'),keyColumn:z.string().optional().describe('Exact key header; omit to list common headers')}),run:async a=>inspect(a.before,a.after,a.keyColumn)});
