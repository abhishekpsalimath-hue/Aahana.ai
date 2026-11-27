const IMAGE_HOSTS = new Set(["images.nasa.gov", "images-assets.nasa.gov", "science.nasa.gov", "upload.wikimedia.org", "commons.wikimedia.org", "images.unsplash.com"]);
const VIDEO_HOSTS = new Set(["www.youtube.com", "youtube.com", "youtu.be", "www.youtube-nocookie.com", "player.vimeo.com", "vimeo.com"]);

function parseHttpsUrl(value, hosts) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !hosts.has(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

export function normalizeLearningImage(image) {
  if (!image || typeof image !== "object") return null;
  const url = parseHttpsUrl(image.url, IMAGE_HOSTS);
  const alt = typeof image.alt === "string" ? image.alt.trim().slice(0, 180) : "";
  const caption = typeof image.caption === "string" ? image.caption.trim().slice(0, 180) : "";
  const source = typeof image.source === "string" ? image.source.trim().slice(0, 80) : "";
  if (!url || !alt) return null;
  return { url: url.href, alt, caption, source };
}

export function normalizeLearningVideo(video) {
  if (!video || typeof video !== "object") return null;
  const url = parseHttpsUrl(video.url, VIDEO_HOSTS);
  if (!url) return null;
  let embedUrl = null;
  if (url.hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) embedUrl = `https://www.youtube-nocookie.com/embed/${id}`;
  } else if (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") {
    const id = url.searchParams.get("v") || "";
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) embedUrl = `https://www.youtube-nocookie.com/embed/${id}`;
  } else if (url.hostname === "www.youtube-nocookie.com") {
    const match = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})$/);
    if (match) embedUrl = `https://www.youtube-nocookie.com/embed/${match[1]}`;
  } else if (url.hostname === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d+)$/);
    if (match) embedUrl = `https://player.vimeo.com/video/${match[1]}`;
  } else if (url.hostname === "vimeo.com") {
    const match = url.pathname.match(/^\/(\d+)$/);
    if (match) embedUrl = `https://player.vimeo.com/video/${match[1]}`;
  }
  if (!embedUrl) return null;
  const title = typeof video.title === "string" ? video.title.trim().slice(0, 120) : "";
  const source = typeof video.source === "string" ? video.source.trim().slice(0, 80) : "";
  if (!title) return null;
  return { url: embedUrl, title, source };
}

export function normalizeLearningMedia(media) {
  if (!media || typeof media !== "object") return null;
  const images = Array.isArray(media.images)
    ? media.images.slice(0, 2).map(normalizeLearningImage).filter(Boolean)
    : [];
  const video = normalizeLearningVideo(media.video);
  if (!images.length && !video) return null;
  return { images, video };
}
