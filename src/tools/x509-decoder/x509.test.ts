import { describe, expect, it } from 'vitest'
import { derToPem, fingerprints, parseCertificate, pemToDer, X509Error } from './x509'

// A self-signed RSA certificate generated for the test suite:
//   openssl req -x509 -newkey rsa:2048 -days 365 -nodes \
//     -subj "/C=GB/ST=London/L=London/O=Toolspace/OU=Testing/CN=toolspace.example/emailAddress=hello@example.com" \
//     -addext "subjectAltName=DNS:toolspace.example,DNS:www.toolspace.example,IP:127.0.0.1" \
//     -addext "keyUsage=digitalSignature,keyEncipherment" \
//     -addext "extendedKeyUsage=serverAuth,clientAuth"
const PEM = `-----BEGIN CERTIFICATE-----
MIIEcjCCA1qgAwIBAgIUVyBvS2LMubyXET8UAID4Ikk2tPcwDQYJKoZIhvcNAQEL
BQAwgZMxCzAJBgNVBAYTAkdCMQ8wDQYDVQQIDAZMb25kb24xDzANBgNVBAcMBkxv
bmRvbjESMBAGA1UECgwJVG9vbHNwYWNlMRAwDgYDVQQLDAdUZXN0aW5nMRowGAYD
VQQDDBF0b29sc3BhY2UuZXhhbXBsZTEgMB4GCSqGSIb3DQEJARYRaGVsbG9AZXhh
bXBsZS5jb20wHhcNMjYxMDA4MTMzMjEzWhcNMjcxMDA4MTMzMjEzWjCBkzELMAkG
A1UEBhMCR0IxDzANBgNVBAgMBkxvbmRvbjEPMA0GA1UEBwwGTG9uZG9uMRIwEAYD
VQQKDAlUb29sc3BhY2UxEDAOBgNVBAsMB1Rlc3RpbmcxGjAYBgNVBAMMEXRvb2xz
cGFjZS5leGFtcGxlMSAwHgYJKoZIhvcNAQkBFhFoZWxsb0BleGFtcGxlLmNvbTCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAIjrDRHjrQ+YTXaGuhjXMKjI
2xlyxrEioHOlOM5bl5osHvJsVSLQhLXsfQlKiKzs9jy1Y95BAUZnCEkYXdGgP+AD
Ij7YBc/wkOBAjb0K3f04/cGe5kNkFxIHcJ6rr7mbkQLs05QAgTgjPlgyP9EHSOdD
pRDohlqQhQDb4tQiHeTMHrWqD0WvnCfgU+9g71bziyXHmCeDOOKukDJFIiHdoyXo
pej7QagVWWjExjaQ28mcpv/3fC0R3ci6P6bM8lMGVbyfFRhq8UlRpyOLS0s/IeK8
e4TDC1HP0RU1SQX2/0aT9Ll/zVC05UklhLebT3qvAdSkTV8ZWkhygy3dfeKV0z0C
AwEAAaOBuzCBuDAdBgNVHQ4EFgQUItE8kxeykSvz9d5ZCZ8ZKqS5/cswHwYDVR0j
BBgwFoAUItE8kxeykSvz9d5ZCZ8ZKqS5/cswDwYDVR0TAQH/BAUwAwEB/zA5BgNV
HREEMjAwghF0b29sc3BhY2UuZXhhbXBsZYIVd3d3LnRvb2xzcGFjZS5leGFtcGxl
hwR/AAABMAsGA1UdDwQEAwIFoDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUH
AwIwDQYJKoZIhvcNAQELBQADggEBACGOCYXVVwguXfb8lLE0lV7RZXvsmr3cgAE1
94JgPfgtR5cc8czHmuLcf5N8yJb+0uV/3thcgLcD/Cr2PY6JROFAqWLb3Suh3E+2
A6MMzqd5dGF9AEVzcngJyIMrhx1Ok2fZ8QtyUhd0ueW85oS02di4FbQ35WhBpK92
/FOTj+zesBf/o+etf/OHj6eBpPRyEMJDgCoNmQ8Z8ZD2Cgr0MULEjAzcxUTLUIek
7yFbYnjLG3bl8vct65PRgOh24ZTxw1EdsK1jy/JPHszhVy3GqoldXEW6RTnTwD51
lmVzLm0Q32Bi1IyeUISenZxfRJNdrPZ1Lh0lfoo1HTAZoF7Ci/w=
-----END CERTIFICATE-----`

const NOW = Date.parse('2026-10-08T14:00:00Z')

describe('pemToDer', () => {
  it('decodes a PEM block', () => {
    const der = pemToDer(PEM)
    expect(der[0]).toBe(0x30)
    expect(der.length).toBeGreaterThan(900)
  })

  it('round-trips through derToPem', () => {
    const der = pemToDer(PEM)
    const again = pemToDer(derToPem(der))
    expect([...again]).toEqual([...der])
  })

  it('rejects garbage', () => {
    expect(() => pemToDer('not base64 !!!')).toThrow(X509Error)
  })
})

describe('parseCertificate', () => {
  const der = pemToDer(PEM)
  const certificate = parseCertificate(der, NOW)

  it('reads version and serial number', () => {
    expect(certificate.version).toBe(3)
    expect(certificate.serialNumber).toMatch(/^([0-9a-f]{2}:)*[0-9a-f]{2}$/)
  })

  it('names the signature algorithm', () => {
    expect(certificate.signatureAlgorithm).toBe('SHA-256 with RSA')
  })

  it('formats the subject and issuer', () => {
    expect(certificate.subject).toContain('CN=toolspace.example')
    expect(certificate.subject).toContain('O=Toolspace')
    expect(certificate.issuer).toBe(certificate.subject)
    expect(certificate.subjectRdns[0].value).toBe('C=GB')
  })

  it('parses validity dates', () => {
    expect(certificate.notBefore.toISOString()).toBe('2026-10-08T13:32:13.000Z')
    expect(certificate.notAfter.toISOString()).toBe('2027-10-08T13:32:13.000Z')
    expect(certificate.expired).toBe(false)
    expect(certificate.daysRemaining).toBe(364)
  })

  it('reads the RSA public key size', () => {
    expect(certificate.publicKey.algorithm).toBe('RSA')
    expect(certificate.publicKey.keySizeBits).toBe(2048)
  })

  it('detects a CA certificate', () => {
    expect(certificate.isCa).toBe(true)
    expect(certificate.basicConstraints).toContain('CA')
  })

  it('reads the key usage bits', () => {
    expect(certificate.keyUsage).toEqual(['digitalSignature', 'keyEncipherment'])
  })

  it('reads the extended key usage', () => {
    expect(certificate.extendedKeyUsage).toContain('TLS Web Server Authentication')
    expect(certificate.extendedKeyUsage).toContain('TLS Web Client Authentication')
  })

  it('reads the subject alternative names', () => {
    expect(certificate.subjectAltNames).toEqual([
      'DNS:toolspace.example',
      'DNS:www.toolspace.example',
      'IP:127.0.0.1',
    ])
  })

  it('flags an expired certificate', () => {
    const later = Date.parse('2028-01-01T00:00:00Z')
    expect(parseCertificate(der, later).expired).toBe(true)
  })

  it('rejects data that is not a certificate', () => {
    expect(() => parseCertificate(new Uint8Array(200).fill(0x41), NOW)).toThrow(X509Error)
    expect(() => parseCertificate(new Uint8Array(10), NOW)).toThrow(X509Error)
  })
})

describe('fingerprints', () => {
  it('formats colon-separated uppercase hex', async () => {
    const result = await fingerprints(pemToDer(PEM))
    expect(result.sha256).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    expect(result.sha1).toMatch(/^([0-9A-F]{2}:){19}[0-9A-F]{2}$/)
  })
})
