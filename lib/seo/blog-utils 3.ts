export interface BlogHeading {
  text: string;
  id: string;
  level: 2 | 3;
}

/** Convert heading text to a URL-safe id. Must match the id generated in BlogToC. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/** Parse h2 and h3 headings out of a markdown string. */
export function extractHeadings(markdown: string): BlogHeading[] {
  return markdown
    .split("\n")
    .filter((line) => /^#{2,3}\s/.test(line))
    .map((line) => {
      const match = line.match(/^(#{2,3})\s+(.+)$/);
      if (!match) return null;
      const level = match[1].length as 2 | 3;
      const text = match[2].trim();
      return { text, id: slugify(text), level };
    })
    .filter(Boolean) as BlogHeading[];
}
