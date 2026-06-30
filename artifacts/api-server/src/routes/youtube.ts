import { Router } from "express";

const router = Router();

/**
 * GET /api/youtube/search?q=meal+name
 * Searches YouTube for cooking videos.
 * Requires YOUTUBE_API_KEY environment variable.
 *
 * TODO: Set YOUTUBE_API_KEY in Replit Secrets to enable this feature.
 * Get a free key at: https://console.cloud.google.com/apis/library/youtube.googleapis.com
 */
router.get("/search", async (req, res) => {
  const apiKey = process.env["YOUTUBE_API_KEY"];
  const query = req.query["q"] as string | undefined;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter: q" });
  }

  if (!apiKey) {
    // Return placeholder so the app still works without the key
    return res.json({
      videoId: null,
      title: null,
      thumbnail: null,
      configured: false,
    });
  }

  try {
    const searchQuery = encodeURIComponent(`how to make ${query} recipe`);
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=video&maxResults=1&key=${apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      items?: Array<{
        id: { videoId: string };
        snippet: { title: string; thumbnails: { medium: { url: string } } };
      }>;
    };

    const item = data.items?.[0];
    if (!item) {
      return res.json({ videoId: null, title: null, thumbnail: null, configured: true });
    }

    res.json({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? null,
      configured: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "YouTube search failed" });
  }
});

export default router;
