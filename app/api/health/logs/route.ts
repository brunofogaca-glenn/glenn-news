import { getDiagnosticEvents } from "@/lib/diagnosticLog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Diagnostic data is only served on Vercel-hosted domains, which are covered
  // by this project's Vercel Deployment Protection/SSO policy.
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (!hostname.endsWith(".vercel.app")) {
    return Response.json(
      { ok: false, message: "Loggar kan bara hämtas via den skyddade Vercel-adressen." },
      { status: 404 }
    );
  }

  const days = new URL(request.url).searchParams.get("days") === "7" ? 7 : 1;
  try {
    const result = await getDiagnosticEvents(days);
    return Response.json({
      ok: result.available,
      ...result,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      generatedAt: new Date().toISOString(),
    }, {
      status: result.available ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    // Do not return raw internals from the diagnostics endpoint or log recursively.
    console.error("Hälsosidans diagnostikloggar kunde inte läsas:", error);
    return Response.json({
      ok: false,
      message: "Loggarkivet kunde inte läsas. Kontrollera Vercel- och Blob-status.",
    }, {
      status: 500,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
