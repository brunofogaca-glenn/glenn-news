/**
 * Reading-history storage and profile aggregation.
 *
 * Performance contract:
 * - The browser queues reads and uploads bounded batches; do not add Blob writes per click.
 * - New batches are consolidated into the ledger, and the daytime profile normally comes
 *   from the compact profile snapshot rather than listing/downloading historical batches.
 * - A failed ledger read must remain distinguishable from an empty ledger so it cannot
 *   accidentally replace valid history. Batch processing is idempotent.
 *
 * See docs/architecture.md before changing the batch -> ledger -> profile flow.
 */

import { get, list, put } from "@vercel/blob";
import { recordDiagnostic } from "./diagnosticLog";

export type ReaderProfile = {
  category: Record<string, number>;
  articleType: Record<string, number>;
  source: Record<string, number>;
  topic: Record<string, number>;
  semanticCategory?: Record<string, number>;
  semanticArticleType?: Record<string, number>;
  semanticTopic?: Record<string, number>;
  semanticTag?: Record<string, number>;
  entity?: Record<string, number>;
  geography?: Record<string, number>;
  eventKey?: Record<string, number>;
  semanticClicks?: number;
  totalClicks: number;
  lastUpdated: string | null;
};

export type SemanticReaderClassification = {
  broadCategory: string;
  mainTopic: string;
  tags: string[];
  entities: Array<{ name: string; kind: string }>;
  geography: {
    country: string | null;
    region: string | null;
    city: string | nu¶»§q«^