# CSR Inspector Test Files (`test-certs/`)

This directory contains a suite of test Certificate Signing Requests (CSR / PKCS#10) specifically designed for testing all features, cryptographic verifications, extension parsers, and edge cases in the **CSR Inspector**.

---

## Available Test Files

### 1. `test.csr` / `test-standard-rsa2048.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit
- **Signature Algorithm:** `sha256WithRSAEncryption` (OID: `1.2.840.113549.1.1.11`)
- **Subject:** `CN=example.com, O=Acme Corporation, OU=IT Infrastructure, L=San Francisco, ST=California, C=US, emailAddress=admin@example.com`
- **Requested Extensions:**
  - **Subject Alternative Name:** `DNS: example.com, DNS: www.example.com, DNS: api.example.com, IP: 192.168.1.50`
  - **Key Usage:** `Digital Signature, Key Encipherment`
  - **Extended Key Usage:** `Server Authentication, Client Authentication`
- **Expected UI Result:** Green **Self-Signature Valid** badge, all subject fields filled, requested extensions rendered with human-readable values.

---

### 2. `test-rsa4096.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 4096-bit (High Security)
- **Signature Algorithm:** `sha384WithRSAEncryption` (OID: `1.2.840.113549.1.1.12`)
- **Subject:** `CN=secure-vault.internal, O=Enterprise Security Corp, OU=Cyber Defense, C=DE`
- **Requested Extensions:**
  - **SAN:** `DNS: secure-vault.internal, DNS: cluster.vault.internal`
  - **Key Usage:** `Digital Signature, Key Encipherment, Data Encipherment`
  - **Extended Key Usage:** `Server Authentication`
- **Expected UI Result:** Green **Self-Signature Valid** badge, `RSA (4096 bits)` in Public Key row, SHA-384 signature algorithm.

---

### 3. `test-rsa1024-legacy.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 1024-bit (Legacy)
- **Signature Algorithm:** `sha1WithRSAEncryption` (OID: `1.2.840.113549.1.1.5`)
- **Subject:** `CN=legacy-terminal.intranet, O=Legacy Banking Network, C=GB`
- **Requested Extensions:** None
- **Expected UI Result:** Green **Self-Signature Valid** badge, `RSA (1024 bits)`, Requested Purposes shows `None specified` / `Not specified`.

---

### 4. `test-san-multidomain.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit
- **Subject:** `CN=*.cloudservices.org, O=Global Cloud Network, C=NL`
- **Requested Extensions:**
  - **SAN with 4 Types:** Wildcard DNS (`*.cloudservices.org`), Apex DNS (`cloudservices.org`, `auth.cloudservices.org`), IPv4 (`10.200.1.1`), Email (`security@cloudservices.org`), URI (`https://cloudservices.org/api/v1`)
  - **Key Usage:** `Digital Signature, Key Encipherment`
  - **Extended Key Usage:** `Server Authentication, Client Authentication, Code Signing`
- **Expected UI Result:** Green **Self-Signature Valid** badge, formatted SAN table displaying DNS, IP, Email, and URI entries.

---

### 5. `test-der.csr` / `test-csr.der`
- **Format:** Raw Binary DER (ASN.1 binary format, not PEM)
- **Key:** RSA 2048-bit
- **Subject:** `CN=binary-der-service.local, O=Binary Protocol Systems, C=CH`
- **Expected UI Result:** Verified binary ASN.1 parser branch; loads directly when dragged onto the drop zone or browsed as `.der` / `.csr`.

---

### 6. `test-new-header.csr` / `test-new-header.req`
- **Format:** PEM with `-----BEGIN NEW CERTIFICATE REQUEST-----` (Windows / IIS / legacy certreq format)
- **Key:** RSA 2048-bit
- **Subject:** `CN=iis-server01.corp.internal, O=Enterprise Directory Services, OU=Domain Controllers, C=US`
- **Requested Extensions:** SAN, Key Usage, Server Auth
- **Expected UI Result:** Successfully normalizes the legacy header and parses without errors; green valid signature badge.

---

### 7. `test-invalid-signature.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit (Key Pair A)
- **Signature:** Computed with Key Pair B (mismatched private key)
- **Subject:** `CN=untrusted-signature.example.com, O=Mismatched Signer Corp, C=US`
- **Expected UI Result:** Red **Self-Signature Invalid** badge (`XCircle`); subject and public key are still displayed so the user can inspect the request.

---

### 8. `test-minimal.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit
- **Subject:** `CN=minimal-device.local` (only 1 attribute)
- **Requested Extensions:** None
- **Expected UI Result:** Green valid signature badge; single Common Name row; empty extensions handled gracefully.

---

### 9. `test-code-signing.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit
- **Subject:** `CN=Acme Software Release Signing, O=Acme Corporation, OU=Release Engineering, C=US`
- **Requested Extensions:** Key Usage `Digital Signature`, Extended Key Usage `Code Signing, Time Stamping`
- **Expected UI Result:** Requested Purposes highlights `Code Signing, Time Stamping`.

---

### 10. `test-client-auth.csr`
- **Format:** PEM (`.csr`)
- **Key:** RSA 2048-bit
- **Subject:** `CN=jane.doe@securecorp.com, O=SecureCorp, OU=Identity Management, C=US, serialNumber=EMP-84920`
- **Requested Extensions:** Key Usage, Extended Key Usage `Client Authentication, Email Protection`
- **Expected UI Result:** Subject grid includes `Serial Number: EMP-84920`; purposes shows `Client Authentication, Email Protection`.

---

### 11. `test-corrupt.csr`
- **Format:** Corrupted PEM / truncated Base64 data
- **Expected UI Result:** Red **ErrorCard** in the UI with error message `Failed to parse PEM CSR: Invalid PEM formatted message.` and a dismiss button.

---

## Automated Verification

You can run the automated verification script from the repository root:

```bash
node --experimental-strip-types test-csr-parser.mjs
```
