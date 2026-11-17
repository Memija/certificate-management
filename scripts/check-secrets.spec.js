import { describe, expect, it } from 'vitest'

import { scanDiff } from './check-secrets'

describe('check-secrets', () => {
  it('should return no violations for benign diffs', () => {
    const cleanDiff = `
diff --git a/src/test.ts b/src/test.ts
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,3 @@
 const a = 1;
+const greeting = 'Hello World';
-const old = 2;
`
    const violations = scanDiff(cleanDiff)
    expect(violations).toHaveLength(0)
  })

  it('should detect Google / Firebase API keys on added lines', () => {
    const key = ['AIza', 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'].join('')
    const diff = `
diff --git a/src/bad.ts b/src/bad.ts
--- a/src/bad.ts
+++ b/src/bad.ts
@@ -1,2 +1,3 @@
+const key = '${key}';
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(1)
    expect(violations[0].patternName).toBe('Google / Firebase API Key')
    expect(violations[0].file).toBe('src/bad.ts')
    expect(violations[0].snippet).toBe('AIza...5P6Q')
  })

  it('should detect GitHub tokens (PAT, fine-grained, OAuth, etc.)', () => {
    const patPrefix = 'gh' + 'p_'
    const oauthPrefix = 'gh' + 'o_'
    const fineGrainedPrefix = 'github_' + 'pat_'
    const diff = `
+++ b/src/token.ts
+const pat = "${patPrefix}1234567890abcdefghijklmnopqrstuvwxyz";
+const oauth = "${oauthPrefix}1234567890abcdefghijklmnopqrstuvwxyz";
+const fineGrained = "${fineGrainedPrefix}11AAAAAAA0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789012";
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(3)
    expect(violations.every((v) => v.patternName === 'GitHub Token')).toBe(true)
  })

  it('should detect various Private Key blocks outside fixture directories', () => {
    const diff = `
+++ b/secrets/key.pem
+-----BEGIN RSA PRIVATE KEY-----
+-----BEGIN ENCRYPTED PRIVATE KEY-----
+-----BEGIN PGP PRIVATE KEY BLOCK-----
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(3)
    expect(violations.every((v) => v.patternName === 'Private Key Block')).toBe(true)
  })

  it('should skip synthetic PKI sample/test fixture paths', () => {
    const diff = `
+++ b/test-certs/sample.pem
+-----BEGIN RSA PRIVATE KEY-----
+++ b/src/data/key-matcher-samples.ts
+-----BEGIN RSA PRIVATE KEY-----
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(0)
  })

  it('should detect Google OAuth Access Tokens', () => {
    const token = ['ya29', '.a0ARrdaM8123456789012345678901234567890'].join('')
    const diff = `
+++ b/src/auth.ts
+const token = '${token}';
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(1)
    expect(violations[0].patternName).toBe('Google OAuth Access Token')
  })

  it('should detect NPM Access Tokens', () => {
    const npmToken = ['npm', '_1234567890abcdefghijklmnopqrstuv'].join('')
    const diff = `
+++ b/src/npm.ts
+const npmToken = '${npmToken}';
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(1)
    expect(violations[0].patternName).toBe('NPM Access Token')
  })

  it('should detect JSON Web Tokens (JWT)', () => {
    const jwt = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0',
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    ].join('.')
    const diff = `
+++ b/src/jwt.ts
+const jwt = '${jwt}';
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(1)
    expect(violations[0].patternName).toBe('JSON Web Token (JWT)')
  })

  it('should ignore secrets on deleted lines (-)', () => {
    const removedKey = ['AIza', 'SyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'].join('')
    const diff = `
+++ b/src/cleanup.ts
-const removedKey = '${removedKey}';
+const newKey = process.env.API_KEY;
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(0)
  })

  it('should skip allowlisted files and placeholder values', () => {
    const diff = `
+++ b/scripts/check-secrets.js
+apiKey: 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
+++ b/src/config.ts
+const apiKey = 'YOUR_API_KEY';
`
    const violations = scanDiff(diff)
    expect(violations).toHaveLength(0)
  })
})
