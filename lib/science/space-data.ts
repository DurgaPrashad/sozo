import { getJSON, plainText } from "./retrieval";
export type SpaceRecord = {
  id: string;
  title: string;
  description: string;
  date: string;
  center: string;
  creator: string;
  kind: "image" | "video";
  thumbnail: string | null;
  sourceUrl: string;
  metadataUrl: string;
  keywords: string[];
};
export type SpaceSearch = {
  query: string;
  provider: string;
  retrievedAt: string;
  records: SpaceRecord[];
  totalAvailable: number | null;
  requestUrl: string;
  limitations: string[];
};
function nasaImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" &&
      (u.hostname === "images-assets.nasa.gov" ||
        u.hostname === "images.nasa.gov")
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}
export async function searchSpaceArchive(
  query: string,
  media: "image" | "video" | "all" = "all",
  fetcher = getJSON,
): Promise<SpaceSearch> {
  const term = query.trim();
  if (term.length < 2 || term.length > 160)
    throw new Error("Use a space archive query of 2–160 characters.");
  if (!["image", "video", "all"].includes(media))
    throw new Error("Unsupported media type.");
  const url = new URL("https://images-api.nasa.gov/search");
  url.searchParams.set("q", term);
  url.searchParams.set("media_type", media === "all" ? "image,video" : media);
  url.searchParams.set("page_size", "12");
  const data = await fetcher(url.toString());
  const seen = new Set<string>();
  const records: SpaceRecord[] = (
    Array.isArray(data.collection?.items) ? data.collection.items : []
  )
    .slice(0, 12)
    .flatMap((item: Record<string, any>) => {
      const meta = item.data?.[0];
      const id = typeof meta?.nasa_id === "string" ? meta.nasa_id : "";
      if (!id || seen.has(id) || !["image", "video"].includes(meta.media_type))
        return [];
      seen.add(id);
      return [
        {
          id,
          title: plainText(meta.title) || id,
          description: plainText(meta.description).slice(0, 6000),
          date: plainText(meta.date_created),
          center: plainText(meta.center) || "NASA",
          creator: plainText(
            meta.photographer || meta.secondary_creator || "NASA",
          ),
          kind: meta.media_type,
          thumbnail: nasaImage(
            item.links?.find(
              (link: Record<string, any>) => link.rel === "preview",
            )?.href,
          ),
          sourceUrl:
            "https://images.nasa.gov/details/" + encodeURIComponent(id),
          metadataUrl:
            "https://images-api.nasa.gov/metadata/" + encodeURIComponent(id),
          keywords: Array.isArray(meta.keywords)
            ? meta.keywords.slice(0, 12).map(plainText)
            : [],
        },
      ];
    });
  const total = data.collection?.metadata?.total_hits;
  return {
    query: term,
    provider: "NASA Image and Video Library",
    retrievedAt: new Date().toISOString(),
    records,
    totalAvailable:
      typeof total === "number" && Number.isFinite(total) ? total : null,
    requestUrl: url.toString(),
    limitations: [
      "Archive media and captions are historical records, not live spacecraft telemetry or a native-resolution terrain grid.",
      "Search ranking and original captions require scientific review. Follow the original record and its usage terms.",
    ],
  };
}
