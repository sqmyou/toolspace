/**
 * The contract every tool implements.
 *
 * A tool is intentionally tiny: metadata plus a `render` function that
 * receives a container element and draws itself into it. There is no
 * framework to learn, no base class to extend, and no lifecycle to
 * memorise. If you can write a function that fills a div, you can add a
 * tool to toolspace.
 */
export interface Tool {
  /** URL-safe id. Must match the folder name under `src/tools/`. */
  slug: string
  /** Short title shown in the sidebar and search. */
  name: string
  /** One sentence describing what the tool does. */
  description: string
  /** Grouping label, e.g. "Security", "Text", "Data". */
  category: string
  /** Extra words the search should match, beyond name/description. */
  keywords?: string[]
  /** Draw the tool into `root`. Called once per mount. */
  render(root: HTMLElement): void
}
