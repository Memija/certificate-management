# Extracting Private Keys from JKS Files

JKS (Java KeyStore) files use a proprietary algorithm (SunJCE) to encrypt private keys. The encryption relies on a custom stream cipher constructed by repeatedly hashing a password and a salt using SHA-1, and XORing this keystream against a PKCS#8 payload.

## User Review Required

Currently, when a JKS file is uploaded, we immediately show all public certificates because they are not encrypted. If we add a password prompt to decrypt private keys, we have two main options for the User Experience:

**Option A (Consistent with PKCS#12)**: 
When a JKS file contains private keys, we completely block access and show the "Password Required" input. The user MUST enter the correct password to view the file's contents (certificates and private keys). This matches how `.p12` files work.

**Option B (Progressive Enhancement)**: 
We immediately show the public certificates (as we do now). But for the private key entries, instead of just a warning, we add a new "Unlock Private Key" button next to each entry that prompts for the password inline, or we add a global "Enter password to decrypt private keys" input at the top of the file view.

Option A is much simpler to implement and keeps the UI consistent. Which do you prefer?

## Proposed Changes

### `src/utils/trustStoreParser.ts`
- Modify `parseJks` to accept a `password` parameter.
- Implement the `SunJCE` decryption routine using `node-forge` (`forge.md.sha1`, XOR loops, and ASN.1 parsing of the `EncryptedPrivateKeyInfo` payload).
- Extract the PKCS#8 private key and convert it to PEM.
- Parse the certificate chain associated with the private key (currently we skip this block).
- Calculate and verify the JKS MAC at the end of the file to ensure the password is correct.

### `src/TrustStoreInspector.tsx`
- Based on your choice above, update the UI to either prompt for a password at the file level (Option A) or handle it gracefully (Option B).

## Verification Plan

### Manual Verification
- Test loading a JKS file that contains private keys.
- Ensure the user is prompted for a password.
- Verify that entering the correct password extracts and displays the private key in PEM format.
- Verify that entering an incorrect password shows the localized "Incorrect password." warning.
