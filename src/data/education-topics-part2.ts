import type { TermId, TopicDetail } from '@/types'

import type { EducationPart1Key } from './education-topics-part1'

export type EducationPart2Key = Exclude<TermId, EducationPart1Key>

export const EDUCATION_TOPICS_PART2: Record<EducationPart2Key, TopicDetail> = {
  leafCert: {
    id: 'leafCert',
    title: 'Leaf Certificate (End-Entity)',
    subtitle: 'Terminal Certificate for Servers, Users, and Signatures',
    category: 'certificates',
    standardRef: 'RFC 5280 §4',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-4',
    overview:
      'A Leaf Certificate (also termed an End-Entity certificate) is the final certificate at the end of a trust chain. It is issued to a specific entity—such as a domain name (web server TLS), an email address (S/MIME), an individual (smart card authentication), or a software developer (code signing). A leaf certificate cannot be used to sign or issue other certificates.',
    keyPoints: [
      'Basic Constraints has cA:FALSE (or the extension is omitted entirely).',
      'Key Usage restricts cryptographic capabilities (e.g. digitalSignature, keyEncipherment).',
      'Extended Key Usage (EKU) specifies exact roles (e.g. Server Authentication, Code Signing).',
      'Subject Alternative Names (SAN) defines the legitimate hostnames, IP addresses, or emails.',
    ],
    securityImpact:
      'Leaf certificates have short lifespans (typically 90 to 398 days) to limit exposure if a private key is leaked. Failure to renew leaf certificates before expiration leads to high-profile service outages and browser security warnings.',
    cliCommand: {
      tool: 'OpenSSL',
      command:
        'openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null | openssl x509 -text -noout',
      explanation:
        'Connects to a remote server and prints the full parsed details of its leaf certificate.',
    },
    relatedAppMode: {
      mode: 'expiry-dashboard',
      label: 'Certificate Expiry Dashboard',
    },
  },
  csr: {
    id: 'csr',
    title: 'CSR (Certificate Signing Request)',
    subtitle: 'PKCS#10 Request Payload for Certificate Issuance',
    category: 'certificates',
    standardRef: 'PKCS#10 / RFC 2986',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc2986',
    overview:
      "A Certificate Signing Request (CSR) is a standardized cryptographic message sent by an applicant to a Certificate Authority to apply for a digital certificate. It contains the applicant's public key, distinguished name (DN), requested Subject Alternative Names (SANs), and is digitally self-signed by the applicant's private key. This signature provides Proof-of-Possession (PoP), proving to the CA that the applicant holds the matching private key without ever transmitting or exposing the private key itself.",
    keyPoints: [
      'Never contains the private key: only the public key and applicant metadata are included.',
      'Contains a cryptographic signature made by the private key to prove ownership (Proof-of-Possession).',
      'Encoded in Base64 PEM format with header "-----BEGIN CERTIFICATE REQUEST-----".',
    ],
    securityImpact:
      'A CSR is safe to transmit across public networks because it contains no secrets. However, if an attacker tricks a CA into signing a CSR with a key they control for a domain they do not own, they can perform man-in-the-middle attacks.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl req -in request.csr -text -noout -verify',
      explanation:
        'Parses the CSR and verifies its self-contained cryptographic Proof-of-Possession signature.',
    },
    relatedAppMode: {
      mode: 'csr-inspector',
      label: 'CSR Inspector & Parser',
    },
  },
  crl: {
    id: 'crl',
    title: 'CRL (Certificate Revocation List)',
    subtitle: 'Periodic CA-Signed Distribution List of Revoked Serials',
    category: 'certificates',
    standardRef: 'RFC 5280 §5',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-5',
    overview:
      "A Certificate Revocation List (CRL) is an authenticated list published periodically by a Certificate Authority that enumerates digital certificates that have been revoked before their planned expiration date. Each entry in a CRL specifies the certificate's serial number, revocation date, and optional reason code (such as keyCompromise or affiliationChanged). The entire list is digitally signed by the CA.",
    keyPoints: [
      'Referenced in certificates via the CRL Distribution Points (CDP) extension.',
      'Signed and timestamped with "thisUpdate" and "nextUpdate" validity windows.',
      'Can be full (Base CRL) or incremental (Delta CRL) to conserve bandwidth.',
    ],
    securityImpact:
      'CRLs can grow massive (tens of megabytes for large CAs), causing latency and memory strain during TLS handshakes. Because clients cache CRLs until nextUpdate, there is a vulnerability window where a freshly revoked certificate may still be accepted.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl crl -in list.crl -inform DER -text -noout',
      explanation:
        'Parses a binary DER Certificate Revocation List and displays all revoked serial numbers.',
    },
    relatedAppMode: {
      mode: 'crl-inspector',
      label: 'Inspect CRLs',
    },
  },
  ocsp: {
    id: 'ocsp',
    title: 'OCSP (Online Certificate Status Protocol)',
    subtitle: 'Real-Time Certificate Validity Query Protocol',
    category: 'protocols',
    standardRef: 'RFC 6960',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6960',
    overview:
      'The Online Certificate Status Protocol (OCSP) is an HTTP-based network protocol designed as a lightweight, real-time alternative to downloading bulky CRLs. Instead of retrieving the entire list of all revoked certificates, the client sends a small query containing the target certificate\'s serial number and issuer hash to the CA\'s OCSP responder. The responder returns a signed response stating whether the certificate is "good", "revoked", or "unknown".',
    keyPoints: [
      "Located in the certificate's Authority Information Access (AIA) extension.",
      'Provides instantaneous status without transferring megabytes of revocation lists.',
      'Response is digitally signed with an OCSP Signing certificate authorized by the CA.',
    ],
    securityImpact:
      'OCSP introduces privacy concerns (the CA learns what domains clients visit in real time) and performance overhead (extra network round-trip during TLS negotiation). To avoid breaking web browsing when responders go offline, many clients default to "soft-fail", ignoring unreached OCSP servers.',
    cliCommand: {
      tool: 'Windows certutil',
      command: 'certutil -verify -urlfetch cert.crt',
      explanation:
        'Performs full network revocation verification against live AIA OCSP and CDP CRL endpoints.',
    },
    relatedAppMode: {
      mode: 'ocsp-checker',
      label: 'Online Revocation Checker',
    },
  },
  ocspStapling: {
    id: 'ocspStapling',
    title: 'OCSP Stapling',
    subtitle: 'Zero-Latency TLS Certificate Status Request Extension',
    category: 'protocols',
    standardRef: 'RFC 6066 §8 / RFC 6961',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6066#section-8',
    overview:
      'OCSP Stapling (formally the TLS Certificate Status Request extension) solves the latency and privacy drawbacks of traditional OCSP. With stapling enabled, the web server itself periodically queries the CA\'s OCSP responder in the background, caches the cryptographically signed OCSP response, and "staples" it directly into the TLS handshake (CertificateStatus message) sent to connecting clients.',
    keyPoints: [
      'Eliminates client-side lookup latency during the TLS handshake.',
      "Protects client privacy: the CA never sees the client's IP address or browsing habits.",
      'Can be enforced using the OCSP Must-Staple extension (RFC 7633) in the certificate.',
    ],
    securityImpact:
      'Without Must-Staple, an attacker performing a man-in-the-middle attack can block the stapled response, causing soft-fail clients to proceed without verification. Must-Staple forces clients to terminate the handshake if a valid stapled response is omitted.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl s_client -connect cloudflare.com:443 -status -tlsextdebug < /dev/null',
      explanation:
        'Inspects whether the remote server delivers an OCSP stapled response during the TLS handshake.',
    },
    relatedAppMode: {
      mode: 'tls-scanner',
      label: 'Remote TLS Scanner',
    },
  },
  ctlog: {
    id: 'ctlog',
    title: 'Certificate Transparency (CT) Log',
    subtitle: 'Publicly Auditable Append-Only Certificate Ledger',
    category: 'protocols',
    standardRef: 'RFC 6962',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6962',
    overview:
      'Certificate Transparency (CT) is an open framework and network of publicly auditable, append-only, cryptographically verified ledgers (CT Logs) maintained by trusted operators like Google, Cloudflare, and DigiCert. Whenever a CA issues an SSL/TLS certificate, it must submit it to multiple independent CT logs. In return, the logs provide Signed Certificate Timestamps (SCTs) proving that the certificate has been publicly recorded.',
    keyPoints: [
      'Built on Merkle Tree cryptographic hash structures preventing retroactive alteration or removal.',
      'Browsers (Chrome, Edge, Safari) refuse to trust public TLS certificates that lack valid SCT proofs.',
      'Allows domain owners to monitor CT logs in real time and discover rogue or unauthorized certificates.',
    ],
    securityImpact:
      'CT Logs transformed web security by ending the era where rogue CAs could secretly issue certificates for espionage or MITM attacks. Every certificate issued by a public CA is publicly visible to everyone within seconds of creation.',
    cliCommand: {
      tool: 'curl / REST',
      command: 'curl -s "https://crt.sh/?q=github.com&output=json" | jq \'.[0]\'',
      explanation:
        'Queries the public crt.sh CT log aggregator for public records of certificates issued to a domain.',
    },
    relatedAppMode: {
      mode: 'ct-log-search',
      label: 'CT Log Search',
    },
  },
  x509: {
    id: 'x509',
    title: 'X.509 Standard',
    subtitle: 'ITU-T Standard for Public Key Certificates',
    category: 'formats',
    standardRef: 'ITU-T X.509 / RFC 5280',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280',
    overview:
      "ITU-T Recommendation X.509 defines the international standard format for public key certificates and validation path models. Originally published in 1988 as part of the X.500 directory recommendations, X.509 Version 3 (standardized in RFC 5280) provides the cryptographic foundation for the Internet's Transport Layer Security (TLS/HTTPS), S/MIME email encryption, IPsec VPNs, code signing, and UEFI Secure Boot.",
    keyPoints: [
      'Defines certificate structure: Serial, Issuer, Validity (Not Before/Not After), Subject, Public Key, and Extensions.',
      'Uses Abstract Syntax Notation One (ASN.1) to define data schemas independent of machine architecture.',
      'V3 Extensions include Subject Alternative Names, Basic Constraints, Key Usage, AIA, and CDP.',
    ],
    securityImpact:
      'Ambiguities in ASN.1 parsing have historically led to severe vulnerabilities, such as signature spoofing (CVE-2008-1386) and path validation bypasses. Modern implementations use strict ASN.1 DER decoding libraries.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl asn1parse -in certificate.pem',
      explanation:
        'Dumps the raw ASN.1 tag-length-value (TLV) data structure of an X.509 certificate.',
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'Format Converter',
    },
  },
  pem: {
    id: 'pem',
    title: 'PEM (Privacy Enhanced Mail)',
    subtitle: 'Base64 Text Encoded Cryptographic Container',
    category: 'formats',
    standardRef: 'RFC 7468 / RFC 1421',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc7468',
    overview:
      'Privacy Enhanced Mail (PEM) is the ubiquitous text-based encoding format used to represent cryptographic certificates, private keys, and CSRs. While the 1993 PEM secure email standard itself was superseded by S/MIME, its encoding format survived. A PEM file wraps raw binary DER ASN.1 data in Base64 characters, flanked by human-readable ASCII encapsulating boundaries like "-----BEGIN CERTIFICATE-----".',
    keyPoints: [
      'ASCII text-based format: safe for copy-pasting, email transmission, and configuration files.',
      'Encapsulated between clear boundary lines indicating the object type (CERTIFICATE, RSA PRIVATE KEY, etc.).',
      'Supports bundle files containing multiple certificates concatenated sequentially (certificate chains).',
    ],
    securityImpact:
      'Easy to view and manipulate, but sensitive private keys in PEM format can easily be accidentally committed to public Git repositories or pasted into chat channels. Production keys must be stored with strict filesystem permissions (e.g. chmod 600).',
    cliCommand: {
      tool: 'Windows certutil',
      command: 'certutil -encode cert.der cert.pem',
      explanation: 'Converts a binary DER certificate into a standard Base64 PEM text file.',
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'PEM / DER Converter',
    },
  },
  der: {
    id: 'der',
    title: 'DER (Distinguished Encoding Rules)',
    subtitle: 'Canonical Binary ASN.1 Serialization Format',
    category: 'formats',
    standardRef: 'ITU-T X.690 / ASN.1 DER',
    standardUrl: 'https://www.itu.int/rec/T-REC-X.690/',
    overview:
      'Distinguished Encoding Rules (DER) is a strict, unambiguous binary serialization standard for ASN.1 data structures. Unlike Basic Encoding Rules (BER) which allows multiple alternative encodings for the same data (such as variable length byte formats), DER enforces exact, canonical encoding rules so that every data structure produces exactly one unique byte stream. This property is mandatory for digital signatures.',
    keyPoints: [
      'Pure binary format: smaller footprint and faster parsing than text-based PEM.',
      'Deterministic: ensures that hashing the certificate produces an identical digest across all platforms.',
      'Standard format natively used inside Windows (.cer files), Java keystores, and hardware tokens.',
    ],
    securityImpact:
      'Because DER is binary, it cannot be safely pasted into plain text editors or HTTP query parameters without corruption. It must be decoded or base64-encoded when transmitted through text-only mediums.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl x509 -in cert.pem -outform DER -out cert.der',
      explanation: 'Converts a Base64 PEM certificate into pure binary DER format.',
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'DER to PEM Converter',
    },
  },
} satisfies Record<EducationPart2Key, TopicDetail>
