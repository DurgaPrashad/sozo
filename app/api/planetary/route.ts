import { datasets, planetaryMetrics } from "../../../lib/planetary/manifest";
export async function GET() {
  return Response.json(
    { metrics: planetaryMetrics(), datasets },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
