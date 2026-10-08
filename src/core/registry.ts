import type { Tool } from './types'

/**
 * Tool discovery.
 *
 * Every folder under `src/tools/` that exports a default `Tool` from its
 * `index.ts` is picked up automatically. Adding a tool means adding a
 * folder — there is no central list to edit and therefore no merge
 * conflicts when several people contribute at once.
 */
const modules = import.meta.glob<{ default: Tool }>('../tools/*/index.ts', {
  eager: true,
})

export const tools: Tool[] = Object.values(modules)
  .map((mod) => mod.default)
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name))

export function findTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug)
}

export function categories(): string[] {
  return [...new Set(tools.map((tool) => tool.category))].sort()
}

/** Case-insensitive search across name, description, category and keywords. */
export function searchTools(query: string): Tool[] {
  const q = query.trim().toLowerCase()
  if (!q) return tools
  return tools.filter((tool) => {
    const haystack = [
      tool.name,
      tool.description,
      tool.category,
      ...(tool.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
