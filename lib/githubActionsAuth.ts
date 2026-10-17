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
} as const;

export type RefreshWorkflow = keyof typeof ALLOWED_WORKFLOWS;

/**
 * Validate a short-lived GitHub Actions OIDC token for one specific scheduled
 * workflow. This avoids storing a reusable shared cron secret in GitHub/Vercel.
 */
export async function authorizeGitHubActionsRefresh(
  request: Request,
  workflow: RefreshWorkflow
): Promise<boolean> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) return false;

  try {
    const { payload } = await jwtVerify(match[1], GITHUB_ACTIONS_JWKS, {
      issuer: GITHUB_ACTIONS_ISSUER,
      audience: GITHUB_ACTIONS_AUDIENCE,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });

    return (
      payload.repository === REPOSITORY &&
      payload.repository_owner === OWNER &&
      payload.ref === MAIN_REF &&
      (
        payload.event_name === "schedule" ||
        payload.event_name === "workflow_dispatch" ||
        ((workflow === "borasEvents" || workflow === "fotbollskanalenArticles") && payload.event_name === "push")
      ) &&
      payload.workflow_ref === ALLOWED_WORKFLOWS[workflow]
    );
  } catch {
    // Deliberately fail closed. Never log the bearer token.
    return false;
  }
}
