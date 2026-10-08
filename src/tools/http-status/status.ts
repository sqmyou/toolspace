/**
 * HTTP status codes.
 *
 * The table is intentionally plain data so the tool can render it without a
 * build step. Category comes from the hundreds digit, which also covers codes
 * that are not in the table.
 */

export type StatusCategory = 'informational' | 'success' | 'redirect' | 'client-error' | 'server-error' | 'unknown'

export interface HttpStatus {
  code: number
  name: string
  description: string
  category: StatusCategory
  /** Shown as a caution because the meaning is ambiguous or deprecated. */
  deprecated?: boolean
}

export const CATEGORY_LABELS: Record<StatusCategory, string> = {
  informational: 'Informational',
  success: 'Success',
  redirect: 'Redirection',
  'client-error': 'Client error',
  'server-error': 'Server error',
  unknown: 'Unknown',
}

export const STATUSES: HttpStatus[] = [
  { code: 100, name: 'Continue', description: 'The server has received the request headers and the client should send the body.', category: 'informational' },
  { code: 101, name: 'Switching Protocols', description: 'The client asked to change protocol and the server agreed, for example to WebSocket.', category: 'informational' },
  { code: 102, name: 'Processing', description: 'The server is working on the request and no response is available yet.', category: 'informational' },
  { code: 103, name: 'Early Hints', description: 'Hints for preloading resources while the final response is prepared.', category: 'informational' },
  { code: 200, name: 'OK', description: 'The request succeeded and the response body carries the result.', category: 'success' },
  { code: 201, name: 'Created', description: 'The request succeeded and a new resource was created.', category: 'success' },
  { code: 202, name: 'Accepted', description: 'The request was accepted for processing but is not finished.', category: 'success' },
  { code: 203, name: 'Non-Authoritative Information', description: 'The response is a copy modified by a proxy.', category: 'success' },
  { code: 204, name: 'No Content', description: 'The request succeeded and there is no body to return.', category: 'success' },
  { code: 205, name: 'Reset Content', description: 'The client should reset the document view that sent the request.', category: 'success' },
  { code: 206, name: 'Partial Content', description: 'A range of the resource is returned, usually for downloads and media.', category: 'success' },
  { code: 300, name: 'Multiple Choices', description: 'Several representations of the resource are available.', category: 'redirect' },
  { code: 301, name: 'Moved Permanently', description: 'The resource now lives at a new URL and clients should update their links.', category: 'redirect' },
  { code: 302, name: 'Found', description: 'A temporary redirect. The method may change on the follow-up request.', category: 'redirect' },
  { code: 303, name: 'See Other', description: 'The response is at another URL and the follow-up should use GET.', category: 'redirect' },
  { code: 304, name: 'Not Modified', description: 'The cached copy is still current, so the body is omitted.', category: 'redirect' },
  { code: 307, name: 'Temporary Redirect', description: 'A temporary redirect that keeps the original method and body.', category: 'redirect' },
  { code: 308, name: 'Permanent Redirect', description: 'A permanent redirect that keeps the original method and body.', category: 'redirect' },
  { code: 400, name: 'Bad Request', description: 'The server cannot process the request because the syntax or data is wrong.', category: 'client-error' },
  { code: 401, name: 'Unauthorized', description: 'Authentication is required or the credentials failed.', category: 'client-error' },
  { code: 402, name: 'Payment Required', description: 'Reserved for paid access, rarely used on the open web.', category: 'client-error' },
  { code: 403, name: 'Forbidden', description: 'The server understood the request but will not authorise it.', category: 'client-error' },
  { code: 404, name: 'Not Found', description: 'The server found no resource matching the URL.', category: 'client-error' },
  { code: 405, name: 'Method Not Allowed', description: 'The URL exists but does not accept that HTTP method.', category: 'client-error' },
  { code: 406, name: 'Not Acceptable', description: 'No representation matches the Accept headers.', category: 'client-error' },
  { code: 407, name: 'Proxy Authentication Required', description: 'The client must authenticate with the proxy first.', category: 'client-error' },
  { code: 408, name: 'Request Timeout', description: 'The server gave up waiting for the request.', category: 'client-error' },
  { code: 409, name: 'Conflict', description: 'The request conflicts with the current state of the resource.', category: 'client-error' },
  { code: 410, name: 'Gone', description: 'The resource is permanently gone and no forwarding address is known.', category: 'client-error' },
  { code: 411, name: 'Length Required', description: 'The request needs a Content-Length header.', category: 'client-error' },
  { code: 412, name: 'Precondition Failed', description: 'A conditional header such as If-Match did not hold.', category: 'client-error' },
  { code: 413, name: 'Content Too Large', description: 'The request body is larger than the server will accept.', category: 'client-error' },
  { code: 414, name: 'URI Too Long', description: 'The URL is longer than the server will handle.', category: 'client-error' },
  { code: 415, name: 'Unsupported Media Type', description: 'The request body format is not supported.', category: 'client-error' },
  { code: 416, name: 'Range Not Satisfiable', description: 'The requested byte range cannot be served.', category: 'client-error' },
  { code: 418, name: "I'm a Teapot", description: 'An April Fools status kept in the spec as a joke that stuck.', category: 'client-error' },
  { code: 422, name: 'Unprocessable Content', description: 'The syntax is fine but the content failed validation.', category: 'client-error' },
  { code: 425, name: 'Too Early', description: 'The server will not risk replaying a request that might be repeated.', category: 'client-error' },
  { code: 426, name: 'Upgrade Required', description: 'The client must switch to a different protocol.', category: 'client-error' },
  { code: 428, name: 'Precondition Required', description: 'The server wants the request to be conditional.', category: 'client-error' },
  { code: 429, name: 'Too Many Requests', description: 'The client is being rate limited.', category: 'client-error' },
  { code: 431, name: 'Request Header Fields Too Large', description: 'The headers are too big for the server to process.', category: 'client-error' },
  { code: 451, name: 'Unavailable For Legal Reasons', description: 'The resource is blocked for legal reasons.', category: 'client-error' },
  { code: 500, name: 'Internal Server Error', description: 'The server hit an unexpected condition.', category: 'server-error' },
  { code: 501, name: 'Not Implemented', description: 'The server does not support the functionality required.', category: 'server-error' },
  { code: 502, name: 'Bad Gateway', description: 'An upstream server returned an invalid response.', category: 'server-error' },
  { code: 503, name: 'Service Unavailable', description: 'The server is overloaded or down for maintenance.', category: 'server-error' },
  { code: 504, name: 'Gateway Timeout', description: 'An upstream server did not respond in time.', category: 'server-error' },
  { code: 505, name: 'HTTP Version Not Supported', description: 'The HTTP version used in the request is not supported.', category: 'server-error' },
  { code: 506, name: 'Variant Also Negotiates', description: 'Content negotiation for the resource is misconfigured.', category: 'server-error' },
  { code: 507, name: 'Insufficient Storage', description: 'The server cannot store what the request needs.', category: 'server-error' },
  { code: 508, name: 'Loop Detected', description: 'The server found an infinite loop while processing the request.', category: 'server-error' },
  { code: 510, name: 'Not Extended', description: 'Further extensions to the request are required.', category: 'server-error' },
  { code: 511, name: 'Network Authentication Required', description: 'The client needs to authenticate to gain network access.', category: 'server-error' },
]

const BY_CODE = new Map(STATUSES.map((status) => [status.code, status]))

/** Category from the hundreds digit, so unknown codes still classify. */
export function categoryOf(code: number): StatusCategory {
  if (!Number.isInteger(code) || code < 100 || code > 599) return 'unknown'
  if (code < 200) return 'informational'
  if (code < 300) return 'success'
  if (code < 400) return 'redirect'
  if (code < 500) return 'client-error'
  return 'server-error'
}

/** Read a code from text, rejecting anything outside 100-599. */
export function parseStatus(input: string): number {
  const code = Number(input.trim())
  if (!Number.isInteger(code)) throw new Error('A status code is a whole number')
  if (code < 100 || code > 599) throw new Error('A status code is between 100 and 599')
  return code
}

export function lookupStatus(code: number): HttpStatus | undefined {
  return BY_CODE.get(code)
}

/** Search by code or by text in the name and description. */
export function searchStatuses(query: string): HttpStatus[] {
  const text = query.trim().toLowerCase()
  if (!text) return STATUSES
  return STATUSES.filter((status) => String(status.code).includes(text) || status.name.toLowerCase().includes(text) || status.description.toLowerCase().includes(text))
}

export function statusesByCategory(category: StatusCategory): HttpStatus[] {
  return STATUSES.filter((status) => status.category === category)
}
