import { describe, expect, it } from 'vitest'
import { inspectPrivateKey, inspectPublicKey, isPrivateKey, parseKnownHosts, SshError } from './ssh'

const ED25519 = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHoQHKLJFmwFXwAp2U/EUAudoQdwazQqtzbjBOIASzHl ed@toolspace'
const RSA = 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCbrxzAb9jpQP/bVH7AqtSwlRsXzWzhSyKjoLfi4jChXRxhJX5kUJoLRGhJCu7sBhd9+3YqgCyQHOY2SS5S/IhHv89xeRdmpaX75fgL6Z+Z+5atFsUc7N3aL0exQTvqB/GtalVexDGWz7YuEHdHZMljX4MMUZyYQ/ctfzvkV+wmSDOjm8fvD2RuqJTSY2zE7oNjqizew94PmMHAAjtRXTJaWBwuHbMpAdH7WgMoPVC/vbW8/xBUhzsub4JSrvx63fXlLvZf00EVlgEG+WIUU+fgGhLVQMOJ45hgYHn9hl2ONSAlXqX4FvLTyPH2nH8MiSwb/48s9doAMPfEu8exja83 rsa@toolspace'
const ECDSA = 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBJKrBtHak2v+ttOzHtLH4ThgLIJRTXlCPqOsIVCy+VRRhmVHGybhxeJUNhHiv84kni7cA3UF2+MxAOOs/dKkFeE= ec@toolspace'

const ED25519_PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
c2gtZWQyNTUxOQAAACB6EByiyRZsBV8AKdlPxFALnaEHcGs0Krc24wTiAEsx5QAA
AIhLlXz/S5V8/wAAAAtzc2gtZWQyNTUxOQAAACB6EByiyRZsBV8AKdlPxFALnaEH
cGs0Krc24wTiAEsx5QAAAEAa5ThOvIO5rATgdlJGAuTX8U2/Gl3RiiSlxc42BLzU
CHoQHKLJFmwFXwAp2U/EUAudoQdwazQqtzbjBOIASzHlAAAAAAECAwQF
-----END OPENSSH PRIVATE KEY-----`

describe('inspectPublicKey', () => {
  it('reads an Ed25519 key', async () => {
    const key = await inspectPublicKey(ED25519)
    expect(key.kind).toBe('public')
    expect(key.type).toBe('ssh-ed25519')
    expect(key.label).toBe('Ed25519')
    expect(key.bits).toBe(256)
    expect(key.comment).toBe('ed@toolspace')
  })

  it('matches the known SHA256 and MD5 fingerprints', async () => {
    const key = await inspectPublicKey(ED25519)
    expect(key.fingerprints.sha256).toBe('SHA256:U/r3zLb/eyU/TxaFRBMIIg/wPzMe68e9XwMuXkUox8M')
    expect(key.fingerprints.md5).toBe('MD5:ba:93:e2:8b:55:57:c8:1f:64:c3:97:99:4b:f2:56:13')
  })

  it('reads the RSA key size', async () => {
    const key = await inspectPublicKey(RSA)
    expect(key.type).toBe('ssh-rsa')
    expect(key.bits).toBe(2048)
    expect(key.fingerprints.sha256).toBe('SHA256:CcHmc9aPai53Z0iFMD93lx5HE7EIeLj1OD/0IwSPmPE')
    expect(key.fingerprints.md5).toBe('MD5:72:36:e1:01:bd:9f:cd:75:4b:99:42:56:b6:11:40:84')
  })

  it('warns about the legacy ssh-rsa format', async () => {
    expect((await inspectPublicKey(RSA)).warnings.join(' ')).toMatch(/ssh-rsa is the legacy/)
  })

  it('reads an ECDSA key and its curve', async () => {
    const key = await inspectPublicKey(ECDSA)
    expect(key.label).toBe('ECDSA P-256')
    expect(key.curve).toBe('P-256')
    expect(key.bits).toBe(256)
    expect(key.fingerprints.sha256).toBe('SHA256:lqFBKO1XBHIG9JHQew0ipg9mb+ko4gCqm1ZMaeFzHko')
  })

  it('tolerates a missing comment', async () => {
    const key = await inspectPublicKey(ED25519.split(' ').slice(0, 2).join(' '))
    expect(key.comment).toBe('')
  })

  it('tolerates authorized_keys options before the type', async () => {
    const key = await inspectPublicKey(`command="echo hi",no-pty ${ED25519}`)
    expect(key.type).toBe('ssh-ed25519')
  })

  it('rejects a mismatched declared type', async () => {
    await expect(inspectPublicKey(ED25519.replace('ssh-ed25519', 'ssh-rsa'))).rejects.toThrow(SshError)
  })

  it('rejects lines with no key', async () => {
    await expect(inspectPublicKey('hello world')).rejects.toThrow(SshError)
  })
})

describe('inspectPrivateKey', () => {
  it('detects and reads an unencrypted OpenSSH key', async () => {
    expect(isPrivateKey(ED25519_PRIVATE)).toBe(true)
    const key = await inspectPrivateKey(ED25519_PRIVATE)
    expect(key.kind).toBe('private')
    expect(key.type).toBe('ssh-ed25519')
    expect(key.encrypted).toBe(false)
    expect(key.fingerprints.sha256).toBe('SHA256:U/r3zLb/eyU/TxaFRBMIIg/wPzMe68e9XwMuXkUox8M')
  })

  it('warns that the key is private and unencrypted', async () => {
    const key = await inspectPrivateKey(ED25519_PRIVATE)
    const messages = key.warnings.join(' ')
    expect(messages).toMatch(/PRIVATE key/)
    expect(messages).toMatch(/unencrypted/)
  })

  it('rejects a non-OpenSSH PEM block', async () => {
    await expect(inspectPrivateKey('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----')).rejects.toThrow(SshError)
  })
})

describe('parseKnownHosts', () => {
  it('parses host entries and skips comments', () => {
    const entries = parseKnownHosts(`# a comment\ngithub.com ssh-ed25519 AAAA\n\nbad line`)
    expect(entries).toEqual([{ host: 'github.com', type: 'ssh-ed25519', key: 'AAAA' }])
  })
})
