import { createRemoteJWKSet, jwtVerify } from "jose";

const GITHUB_ACTIONS_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_ACTIONS_AUDIENCE = "https://glenn-news.vercel.app";
const REPOSITORY = "brunofogaca-glenn/glenn-news";
const OWNER = "brunofogaca-glenn";
const MAIN_REF = "refs/heads/main";

const GITHUB_ACTIONS_JWKS = createRemoteJWKSet(
  new URL(`${GITHUB_ACTIONS_ISSUER}/.well-known/jwks`)
);

const ALLOWED_WORKFLOWS = {
  supplemental:
    `${REPOSITORY}/.github/workflows/refresh-supplemental-data.yml@${MAIN_REF}`,
  editorial:
    `${REPOSITORY}/.github/workflows/refresh-editorial-articles.yml@${MAIN_REF}`,
  borasEvents:
    `${REPOSITORY}/.github/workflows/refresh-boras-events.yml@${MAIN_REF}`,
  fotbollskanalenArticles:
    `${REPOSITORY}/.github/workflows/refresh-fotbollskanalen-articles.yml@${MAIN_REF}`,
  readerHistory:
    `${REPOSITORY}/.github/workflows/process-reader-history.yml@${MAIN_REF}`,
} as const;

export type RefreshWorkflow = keyof typeof ALLOWED_WORKFLOWS;

/**
 * Authorize Vercel Cron with the project CRON_SECRET, or a manual recovery
 * workflow with a short-lived GitHub Actions OIDC token scoped to this repo.
 */
export async function authorizeGitHubActionsRefresh(
  request: Request,
  workflow: RefreshWorkflow
): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron uses the project-level CRON_SECRET. GitHub manual recovery
¶»§q«^