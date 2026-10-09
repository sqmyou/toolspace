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
  /** Short emoji or symbol shown on cards and headings. */
  icon?: string
  /**
   * Set this if the tool talks to a third-party origin. It drives the
   * "Needs the network" notice on the tool page and the network tag in the
   * index, so the site's "runs locally" promise stays honest by construction
   * rather than by remembering to update a hardcoded list. The `host` is the
   * origin the CSP has to allow; `note` explains what leaves the tab.
   */
  remote?: {
    /** The third-party origin contacted, e.g. `i.ytimg.com`. */
    host: string
    /** One sentence on what is sent, in plain language. */
    note: string
  }
  /** Draw the tool into `root`. Called once per mount. */
  render(root: HTMLElement): void
}
