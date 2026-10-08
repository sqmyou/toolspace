import type { Tool } from './types'
import { scoreQuery, tokenize } from './fuzzy'

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

export function toolsInCategory(category: string): Tool[] {
  return tools.filter((tool) => tool.category === category)
}

export interface SearchOptions {
  /** Restrict results to one category. Ignored when empty. */
  category?: string
  /** Cap the number of results, e.g. for a quick-look panel. */
  limit?: number
}

/**
 * Rank tools against a free-text query.
 *
 * Matching is fuzzy and weighted: the name counts most, then keywords, then
 * the category, with the description as the weakest signal. So "jasn" finds
 * a JSON tool, "64" finds the base64 codec, and word order does not matter.
 * An empty query returns everything in alphabetical order.
 */
export function searchTools(query: string, options: SearchOptions = {}): Tool[] {
  const tokens = tokenize(query)
  const pool = options.category ? toolsInCategory(options.category) : tools

  if (tokens.length === 0) {
    return options.limit ? pool.slice(0, options.limit) : pool
  }

  const ranked = pool
    .map((tool) => ({
      tool,
      score: scoreQuery(tokens, [
        { text: tool.name, weight: 1 },
        { text: (tool.keywords ?? []).join(' '), weight: 0.7 },
        { text: tool.category, weight: 0.5, fuzzy: false },
        { text: tool.slug.replace(/-/g, ' '), weight: 0.5 },
        { text: tool.description, weight: 0.3, fuzzy: false },
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    .map((entry) => entry.tool)

  return options.limit ? ranked.slice(0, options.limit) : ranked
}

