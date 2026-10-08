/** Content-Security-Policy builder: model a policy, serialise it, audit it. */

export interface Directive {
  name: string
  values: string[]
  /** Shown as a hint in the UI. */
  hint: string
}

export const KNOWN_DIRECTIVES: Directive[] = [
  { name: 'default-src', values: ["'self'"], hint: 'Fallback for the other fetch directives' },
  { name: 'script-src', values: ["'self'"], hint: 'Scripts the page may run' },
  { name: 'style-src', values: ["'self'"], hint: 'Stylesheets and inline styles' },
  { name: 'img-src', values: ["'self'", 'data:'], hint: 'Image sources' },
  { name: 'font-src', values: ["'self'"], hint: 'Web fonts' },
  { name: 'connect-src', values: ["'self'"], hint: 'fetch/XHR/WebSocket targets' },
  { name: 'media-src', values: ["'self'"], hint: 'Audio and video' },
  { name: 'object-src', values: ["'none'"], hint: 'Plugins such as <object>' },
  { name: 'frame-src', values: ["'none'"], hint: 'Nested browsing contexts' },
  { name: 'frame-ancestors', values: ["'none'"], hint: 'Who may embed this page' },
  { name: 'base-uri', values: ["'self'"], hint: 'Allowed <base> targets' },
  { name: 'form-action', values: ["'self'"], hint: 'Where forms may submit' },
  { name: 'worker-src', values: ["'self'"], hint: 'Workers and shared workers' },
  { name: 'manifest-src', values: ["'self'"], hint: 'Web app manifest' },
  { name: 'upgrade-insecure-requests', values: [], hint: 'Rewrite http:// requests to https://' },
  { name: 'block-all-mixed-content', values: [], hint: 'Block any http:// subresource' },
]

export interface Policy {
  /** Directive name → space-separated source list. */
  directives: Record<string, string[]>
}

export function emptyPolicy(): Policy {
  return { directives: {} }
}

export function withDefaults(): Policy {
  const policy: Policy = { directives: {} }
  for (const directive of KNOWN_DIRECTIVES) policy.directives[directive.name] = [...directive.values]
  return policy
}

export function setDirective(policy: Policy, name: string, values: string[]): Policy {
  return { directives: { ...policy.directives, [name]: values } }
}

export function removeDirective(policy: Policy, name: string): Policy {
  const next = { ...policy.directives }
  delete next[name]
  return { directives: next }
}

export function serialize(policy: Policy, name?: string): string {
  const order = ['default-src', ...Object.keys(policy.directives).filter((key) => key !== 'default-src').sort()]
  const body = order
    .filter((key) => policy.directives[key])
    .map((key) => [key, ...policy.directives[key]].join(' '))
    .join('; ')
  return name ? `${name}: ${body}` : body
}

export interface Finding {
  severity: 'error' | 'warning' | 'info'
  message: string
}

/** A small, opinionated audit — not a replacement for testing in the browser. */
export function audit(policy: Policy): Finding[] {
  const findings: Finding[] = []
  const has = (name: string) => Boolean(policy.directives[name])
  const includes = (name: string, token: string) => policy.directives[name]?.includes(token) ?? false

  if (!has('default-src')) {
    findings.push({ severity: 'info', message: 'No default-src: other directives fall back to a permissive default.' })
  }
  if (has('script-src') && (includes('script-src', "'unsafe-inline'") || includes('script-src', "'unsafe-eval'"))) {
    findings.push({ severity: 'warning', message: "script-src allows 'unsafe-inline' or 'unsafe-eval', which weakens XSS protection." })
  }
  if (has('script-src') && policy.directives['script-src'].includes('*')) {
    findings.push({ severity: 'error', message: 'script-src allows every origin (*).' })
  }
  if (!has('object-src') && !includes('default-src', "'none'")) {
    findings.push({ severity: 'warning', message: "Add object-src 'none' unless default-src already restricts plugins." })
  }
  if (!has('base-uri')) {
    findings.push({ severity: 'warning', message: "Set base-uri 'self' to stop <base> tag hijacking." })
  }
  if (!has('frame-ancestors')) {
    findings.push({ severity: 'info', message: 'Consider frame-ancestors to control clickjacking.' })
  }
  if (findings.length === 0) {
    findings.push({ severity: 'info', message: 'No obvious weaknesses found in this policy.' })
  }
  return findings
}

/** Collect every distinct source token used, for a quick review list. */
export function usedSources(policy: Policy): string[] {
  const sources = new Set<string>()
  for (const values of Object.values(policy.directives)) {
    for (const value of values) sources.add(value)
  }
  return [...sources].sort()
}
