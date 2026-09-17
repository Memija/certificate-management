# Key Pair Modulus Matcher Test Files (`test-certs/`)

This directory contains test pairs specifically designed for testing and verifying the **Key Pair Modulus Matcher** tool in this application.

In Public Key Cryptography (specifically RSA), a Certificate or Certificate Signing Request (CSR) embeds the **Public Key Modulus ($n$)**. A Private Key embeds the **Private Key Modulus ($n$)**. If they belong to the same cryptographic key pair, their moduli are mathematically identical ($n_{\text{cert}} = n_{\text{key}}$).

---

## 📁 Available Test Files

| File | Type | Key Size | Format | Description |
|---|---|---|---|---|
| `matcher-valid-cert.pem` | X.509 Certificate | RSA 2048-bit | PEM | Subject: `CN=matcher.example.com`. Belongs to **Pair A**. |
| `matcher-valid-csr.pem` | PKCS#10 CSR | RSA 2048-bit | PEM | Subject: `CN=matcher.example.com`. Belongs to **Pair A**. |
| `matcher-valid-key.pem` | RSA Private Key | RSA 2048-bit | PKCS#1 (`BEGIN RSA PRIVATE KEY`) | Matches `matcher-valid-cert.pem` and `matcher-valid-csr.pem`. |
| `matcher-pkcs8-key.pem` | RSA Private Key | RSA 2048-bit | PKCS#8 (`BEGIN PRIVATE KEY`) | PKCS#8 version of **Pair A** private key. |
| `matcher-mismatch-cert.pem` | X.509 Certificate | RSA 2048-bit | PEM | Subject: `CN=different-domain.org`. Belongs to **Pair B**. |
| `matcher-mismatch-key.pem` | RSA Private Key | RSA 2048-bit | PKCS#1 | Belongs to **Pair B**. Used to test **mismatch** against Pair A. |
| `matcher-rsa4096-cert.pem` | X.509 Certificate | RSA 4096-bit | PEM | Subject: `CN=vault.internal.sec`. Belongs to **Pair C**. |
| `matcher-rsa4096-key.pem` | RSA Private Key | RSA 4096-bit | PKCS#1 | High-security 4096-bit key matching `matcher-rsa4096-cert.pem`. |
| `matcher-samples.json` | JSON Catalog | Mixed | JSON | Aggregated JSON with all test pairs and modulus hashes. |

---

## 🧪 Test Cases Matrix

### 1. Test Case 1: Matching RSA 2048 Certificate & Private Key (SUCCESS)
- **Left Input (`certInput`):** `test-certs/matcher-valid-cert.pem`
- **Right Input (`keyInput`):** `test-certs/matcher-valid-key.pem`
- **Modulus SHA-256:** `3dccc0627a1dc06974f4a8589fcea4d183738c54603b8f3d0dd1f00898e3bf26`
- **Expected Status:**
  - Certificate: `Valid Certificate parsed.`
  - Private Key: `Valid RSA Private Key parsed.`
  - Result: 🟢 **The Private Key matches the Certificate/CSR!**

### 2. Test Case 2: Matching RSA 2048 CSR & Private Key (SUCCESS)
- **Left Input (`certInput`):** `test-certs/matcher-valid-csr.pem`
- **Right Input (`keyInput`):** `test-certs/matcher-valid-key.pem`
- **Modulus SHA-256:** `3dccc0627a1dc06974f4a8589fcea4d183738c54603b8f3d0dd1f00898e3bf26`
- **Expected Status:**
  - Certificate: `Valid CSR parsed.`
  - Private Key: `Valid RSA Private Key parsed.`
  - Result: 🟢 **The Private Key matches the Certificate/CSR!**

### 3. Test Case 3: PKCS#8 Private Key Matching (SUCCESS)
- **Left Input (`certInput`):** `test-certs/matcher-valid-cert.pem`
- **Right Input (`keyInput`):** `test-certs/matcher-pkcs8-key.pem` (`-----BEGIN PRIVATE KEY-----`)
- **Expected Status:**
  - Result: 🟢 **The Private Key matches the Certificate/CSR!**

### 4. Test Case 4: Mismatched Certificate & Private Key (MISMATCH)
- **Left Input (`certInput`):** `test-certs/matcher-valid-cert.pem` (Pair A)
- **Right Input (`keyInput`):** `test-certs/matcher-mismatch-key.pem` (Pair B)
- **Modulus Hashes:**
  - Cert Modulus SHA-256: `3dccc0627a1dc06974f4a8589fcea4d183738c54603b8f3d0dd1f00898e3bf26`
  - Key Modulus SHA-256: `25b17e71577401e000b9dad81e6e0fed9dd1569a22a5baf9e1b0a5c6ceb56c24`
- **Expected Status:**
  - Certificate: `Valid Certificate parsed.`
  - Private Key: `Valid RSA Private Key parsed.`
  - Result: 🔴 **The Private Key DOES NOT match the Certificate/CSR.**

### 5. Test Case 5: High-Security RSA 4096-bit Pair (SUCCESS)
- **Left Input (`certInput`):** `test-certs/matcher-rsa4096-cert.pem`
- **Right Input (`keyInput`):** `test-certs/matcher-rsa4096-key.pem`
- **Modulus SHA-256:** `2423f6df13c255da48eec1de2ac3337fc4bf8cf1e55bc3a509fd81406d1485ba`
- **Expected Status:**
  - Certificate: `Valid Certificate parsed.`
  - Private Key: `Valid RSA Private Key parsed.`
  - Result: 🟢 **The Private Key matches the Certificate/CSR!**

---

## 🔁 Automated Test Runner

You can execute the automated test verification script at any time:

```bash
node test-key-pair-matcher.mjs
```

Or regenerate the test files with:

```bash
node generate-matcher-test-files.mjs
```
