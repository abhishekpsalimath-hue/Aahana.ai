import { baseUrl } from "@/lib/site-url";

export default function sitemap() {
  return [
    {
      url: `${baseUrl}/discover`,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
