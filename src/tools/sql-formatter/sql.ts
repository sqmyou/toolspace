/**
 * SQL formatting.
 *
 * `sql-formatter` is a large dependency (~80 kB gzipped), so it is imported
 * dynamically. That keeps it out of the initial page bundle and loads it only
 * when someone actually opens this tool. Everything the sidebar needs lives in
 * this module without touching the dependency.
 */

/** Dialects offered in the dropdown, in rough order of popularity. */
export const DIALECTS = [
  'sql',
  'postgresql',
  'mysql',
  'mariadb',
  'sqlite',
  'transactsql',
  'plsql',
  'bigquery',
  'snowflake',
  'redshift',
  'spark',
  'db2',
  'duckdb',
  'hive',
  'trino',
] as const

export type Dialect = (typeof DIALECTS)[number]

export interface FormatOptions {
  dialect: Dialect
  keywordCase: 'upper' | 'lower' | 'preserve'
  indent: number
  linesBetweenQueries: number
}

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  dialect: 'sql',
  keywordCase: 'upper',
  indent: 2,
  linesBetweenQueries: 1,
}

export class SqlFormatError extends Error {}

/**
 * Pretty-print a SQL query. Throws `SqlFormatError` with a readable message
 * rather than letting the formatter's parse errors escape raw.
 */
export async function formatSql(sql: string, options: FormatOptions = DEFAULT_FORMAT_OPTIONS): Promise<string> {
  if (!sql.trim()) return ''
  const { format } = await import('sql-formatter')
  try {
    return format(sql, {
      language: options.dialect,
      keywordCase: options.keywordCase,
      tabWidth: options.indent,
      linesBetweenQueries: options.linesBetweenQueries,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new SqlFormatError(message.replace(/^Parse error:\s*/i, 'Could not parse: '))
  }
}
