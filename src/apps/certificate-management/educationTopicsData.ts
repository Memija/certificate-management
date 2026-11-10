import type { TermId } from './LearningTerm';

export interface TopicDetail {
  id: TermId;
  title: string;
  subtitle: string;
  category: 'secure-boot' | 'certificates' | 'protocols' | 'formats';
  standardRef?: string;
  standardUrl?: string;
  overview: string;
  keyPoints: string[];
  securityImpact: string;
  cliCommand?: {
    tool: string;
    command: string;
    explanation: string;
  };
  relatedAppMode?: {
    mode: string;
    label: string;
  };
}

export const EDUCATION_TOPICS: Record<TermId, TopicDetail> = {
  nvram: {
    id: 'nvram',
    title: 'NVRAM (Non-Volatile RAM)',
    subtitle: 'UEFI Non-Volatile Memory Storage for Boot Security Variables',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §3.2',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/03_Boot_Manager.html#globally-defined-variables',
    overview: 'Non-Volatile Random-Access Memory (NVRAM) is specialized persistent storage situated directly on the computer motherboard (often within the SPI flash chip alongside the UEFI BIOS). In Secure Boot, NVRAM stores the critical cryptographic databases (PK, KEK, db, dbx) and bootloader configurations. Unlike standard RAM, NVRAM variables persist across system power cycles, and unlike conventional disk partitions, they cannot be altered without platform-level authentication or physical firmware reprogramming.',
    keyPoints: [
      'Accessible in Windows via the GetFirmwareEnvironmentVariable Win32 API and PowerShell cmdlets (requires administrative elevation).',
      'Stores authenticated UEFI variables with flags like VARIABLE_ATTRIBUTE_NON_VOLATILE, BOOTSERVICE_ACCESS, and RUNTIME_ACCESS.',
      'Protected against unauthenticated tampering; changes to security variables require a cryptographic signature verified by the Platform Key or KEK.'
    ],
    securityImpact: 'If NVRAM is corrupt or reset via CMOS jumper/battery removal, Secure Boot setup mode may be engaged, temporarily allowing unsigned operating systems to boot. Modern motherboard vendors use tamper-resistant flash or hardware TPM protection to prevent malicious NVRAM rewrites.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name db',
      explanation: 'Reads the raw authorized signature database variable stored in UEFI NVRAM.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Secure Boot NVRAM Inspector'
    }
  },
  db: {
    id: 'db',
    title: 'db (Signature Database)',
    subtitle: 'UEFI Authorized Signatures & Certificate Whitelist',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.1',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#firmware-os-key-exchange-creating-trust-relationships',
    overview: 'The Signature Database (db) is the whitelist of trusted cryptographic certificates and binary hashes embedded in UEFI NVRAM. When the system initiates, the UEFI firmware inspects the digital signature of every EFI application (such as the Windows Boot Manager, bootia32.efi, or shimx64.efi) and PCIe Option ROM. If the binary\'s signature chains to a certificate in db—or its exact SHA-256 hash matches an entry in db—the firmware permits execution.',
    keyPoints: [
      'Contains X.509 certificates and binary hashes (SHA-256, SHA-384, SHA-512) authorized to execute pre-boot.',
      'Typically pre-loaded by OEMs with the Microsoft Windows Production PCA 2011/2023 and Microsoft Corporation UEFI CA.',
      'Can only be updated if the update payload is signed by a valid key present in the Key Exchange Key (KEK) database.'
    ],
    securityImpact: 'The replacement of the original 2011 Microsoft UEFI CA with the 2023 certificates is critical because 2011 certificates expire in 2026. Without modern db certificates, future bootloaders and Option ROMs will fail signature verification.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Confirm-SecureBootUEFI',
      explanation: 'Confirms whether Secure Boot is active and enforcing signatures from the db whitelist.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'View db Signatures in NVRAM'
    }
  },
  dbx: {
    id: 'dbx',
    title: 'dbx (Forbidden Signature Database)',
    subtitle: 'UEFI Pre-Boot Revocation Blacklist',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.2',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#signature-database-update',
    overview: 'The Forbidden Signature Database (dbx) serves as the pre-boot revocation list for UEFI firmware. It contains hashes of compromised bootloaders, vulnerable EFI binaries, and revoked signing certificates. Even if an EFI executable has a valid signature chained to a trusted CA in the db whitelist, the firmware will refuse to execute it if its hash or certificate thumbprint appears in dbx.',
    keyPoints: [
      'Takes absolute precedence over db: if a binary is present in both db and dbx, execution is blocked immediately.',
      'Stores EFI_CERT_SHA256_GUID hashes of vulnerable boot managers and bootkits.',
      'Distributed via Windows Update, Linux vendor firmware service (LVFS), and UEFI BIOS updates.'
    ],
    securityImpact: 'In 2023, the BlackLotus UEFI bootkit exploited CVE-2022-21894 (Baton Drop) to bypass Secure Boot by loading an older, vulnerable Microsoft boot manager. Mitigating BlackLotus required adding the vulnerable binary hashes to the dbx database.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: '(Get-SecureBootUEFI -Name dbx).bytes.Length',
      explanation: 'Displays the size in bytes of the current dbx revocation list stored in system firmware.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect dbx Revocations'
    }
  },
  kek: {
    id: 'kek',
    title: 'KEK (Key Exchange Key)',
    subtitle: 'Database Authority for Updating Pre-Boot Signatures',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.3',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#key-exchange-keys',
    overview: 'The Key Exchange Key (KEK) database forms the middle tier of the UEFI Secure Boot trust hierarchy. It contains certificates that have the authority to deliver cryptographically signed updates to the Signature Database (db) and the Forbidden Signature Database (dbx). Operating system vendors, such as Microsoft and Canonical, hold KEK private keys so they can distribute security revocation updates to millions of devices without requiring motherboard vendor intervention.',
    keyPoints: [
      'Bridges the OEM hardware vendor (Platform Key) and OS vendor updates (db/dbx).',
      'Allows OS updates to dynamically add revoked hashes (dbx) or new OS root certs (db).',
      'Any update to db or dbx must be accompanied by an authenticated EFI_VARIABLE_AUTHENTICATION_2 payload signed by a KEK certificate.'
    ],
    securityImpact: 'Without a valid KEK certificate corresponding to the OS vendor, the system cannot receive remote Secure Boot revocation updates, leaving firmware vulnerable to known bootkit exploits.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name KEK',
      explanation: 'Retrieves the Key Exchange Key signature list from UEFI NVRAM.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect KEK in NVRAM'
    }
  },
  pk: {
    id: 'pk',
    title: 'PK (Platform Key)',
    subtitle: 'Hardware Root of Trust for UEFI Secure Boot',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.4',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#platform-keys',
    overview: 'The Platform Key (PK) represents the supreme apex of trust in the UEFI Secure Boot architecture. Usually installed by the motherboard or device manufacturer (OEM) during production, the PK establishes an ownership relationship between the platform owner and the hardware firmware. It controls entry into Setup Mode and governs updates to both the PK itself and the Key Exchange Key (KEK) database.',
    keyPoints: [
      'Single root certificate: only one Platform Key can be active in the system at a time.',
      'Transitions the firmware from Setup Mode (unlocked, customizable) to User Mode (locked, enforced).',
      'Clearing the PK resets the firmware to Setup Mode, allowing users or enterprise administrators to enroll custom Secure Boot keys.'
    ],
    securityImpact: 'Possession of the PK private key grants total authority over the system\'s firmware security policies. If the PK private key is leaked (such as in the MSI firmware signing key leak of 2023), attackers can forge authorized updates to firmware components.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name PK',
      explanation: 'Inspects the Platform Key enrolled in the UEFI motherboard NVRAM.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect Platform Key'
    }
  },
  efi: {
    id: 'efi',
    title: 'UEFI / EFI',
    subtitle: 'Unified Extensible Firmware Interface Architecture',
    category: 'secure-boot',
    standardRef: 'UEFI Forum Specification',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/',
    overview: 'The Unified Extensible Firmware Interface (UEFI, historically EFI) is the modern industry specification defining the software interface between the operating system and platform firmware. Replacing the legacy 16-bit IBM PC BIOS dating back to 1981, UEFI provides a modular 32-bit/64-bit pre-boot environment with rich driver support, GUID Partition Tables (GPT) supporting drives over 2TB, fast boot times, and the cryptographic verification engine known as Secure Boot.',
    keyPoints: [
      'Replaces legacy BIOS INT 13h/INT 10h real-mode interrupts with modular C-language protocols.',
      'Supports GPT partitioning, removing the 4-partition limit and 2.2 TB boundary of MBR disks.',
      'Hosts pre-boot drivers (Option ROMs) for NVMe drives, GPUs, network cards (PXE/HTTP boot).'
    ],
    securityImpact: 'Because UEFI executes with ring 0/SMM (System Management Mode) access before the kernel loads, malicious code running at this layer (a UEFI rootkit) has complete invisibility from the operating system antivirus and kernel telemetry.',
    cliCommand: {
      tool: 'PowerShell',
      command: '$env:firmware_type',
      explanation: 'Displays whether the Windows OS was booted under modern UEFI or legacy BIOS.'
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Secure Boot NVRAM Inspector'
    }
  },
  uac: {
    id: 'uac',
    title: 'UAC (User Account Control)',
    subtitle: 'Windows Administrative Privilege Boundary',
    category: 'secure-boot',
    standardRef: 'Windows Security Architecture',
    standardUrl: 'https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/',
    overview: 'User Account Control (UAC) is a Windows security mechanism that enforces the principle of least privilege. Even when logged in as an administrator, applications run under standard user tokens by default. When an application attempts to perform system-level tasks—such as accessing UEFI NVRAM variables, modifying LocalMachine certificate stores, or installing drivers—Windows halts the action and presents a secure desktop elevation prompt.',
    keyPoints: [
      'Separates administrative permissions from standard daily operational workflows.',
      'Uses the Secure Desktop (dimmed screen) to prevent synthetic keyboard/mouse injection attacks.',
      'Essential for accessing privileged Win32 APIs like GetFirmwareEnvironmentVariableEx and CertOpenStore.'
    ],
    securityImpact: 'Without UAC, any script or background malware running under a user session could silently read and overwrite machine-wide trusted root certificates or modify system boot configurations without notice.',
    cliCommand: {
      tool: 'PowerShell',
      command: '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      explanation: 'Checks whether the current session holds elevated administrator privileges.'
    },
    relatedAppMode: {
      mode: 'win-cert-store',
      label: 'Win Cert Store Elevation'
    }
  },
  rootCa: {
    id: 'rootCa',
    title: 'Root CA (Certificate Authority)',
    subtitle: 'Anchor of Trust in the Public Key Infrastructure',
    category: 'certificates',
    standardRef: 'ITU-T X.509 / RFC 5280 §3.2',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-3.2',
    overview: 'A Root Certificate Authority (Root CA) is the apex anchor of trust in Public Key Infrastructure (PKI). A Root CA certificate is self-signed: its Subject and Issuer fields are identical, and its signature is verified using its own embedded public key. Operating systems (Windows, Linux, macOS) and web browsers maintain pre-audited collections of Root CAs known as "Trust Stores". Every certificate in the world derives its validity by chaining cryptographically back to one of these root trust anchors.',
    keyPoints: [
      'Self-signed: Subject and Issuer distinguished names (DN) match exactly.',
      'Has the Basic Constraints extension marked Critical with cA:TRUE.',
      'Kept in extreme physical and cryptographic isolation (offline, hardware security modules / HSMs, air-gapped).'
    ],
    securityImpact: 'If a Root CA private key is compromised, an attacker can issue forged, trusted certificates for any domain, user, or code-signing publisher on Earth without triggering browser warnings. Compromised Root CAs are immediately untrusted by major vendors via emergency browser and OS updates.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl x509 -in rootCA.crt -text -noout -subject -issuer',
      explanation: 'Verifies that the Subject and Issuer are identical, confirming a self-signed root.'
    },
    relatedAppMode: {
      mode: 'trust-store',
      label: 'Explore Root Trust Store'
    }
  },
  intermediateCa: {
    id: 'intermediateCa',
    title: 'Intermediate CA (Subordinate CA)',
    subtitle: 'Operational Issuing Authority Protecting the Root',
    category: 'certificates',
    standardRef: 'RFC 5280 §4.2.1.9',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-4.2.1.9',
    overview: 'An Intermediate Certificate Authority (also known as a Subordinate CA or Issuing CA) is a certificate that sits between the Root CA and the end-entity Leaf certificates. To protect the highly sensitive Root CA private key from exposure, the Root CA signs one or more Intermediate CAs, and is then placed offline in a secure vault. The Intermediate CAs handle day-to-day certificate signing, renewals, and revocation for end users and websites.',
    keyPoints: [
      'Signed by a Root CA or a higher-tier intermediate in the certificate hierarchy.',
      'Includes Basic Constraints: Critical, cA:TRUE, often with a pathLenConstraint limiting recursion depth.',
      'Servers must send intermediate certificates alongside their leaf certificate during the TLS handshake.'
    ],
    securityImpact: 'If an Intermediate CA is compromised, it can be revoked individually via CRL or OCSP without having to revoke and replace the top-level Root CA and redistribute it to billions of client devices worldwide.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl verify -CAfile rootCA.pem -untrusted intermediate.pem leaf.pem',
      explanation: 'Validates the complete chain from leaf through intermediate to root.'
    },
    relatedAppMode: {
      mode: 'chain-validator',
      label: 'Validate Intermediate Chains'
    }
  },
  leafCert: {
    id: 'leafCert',
    title: 'Leaf Certificate (End-Entity)',
    subtitle: 'Terminal Certificate for Servers, Users, and Signatures',
    category: 'certificates',
    standardRef: 'RFC 5280 §4',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-4',
    overview: 'A Leaf Certificate (also termed an End-Entity certificate) is the final certificate at the end of a trust chain. It is issued to a specific entity—such as a domain name (web server TLS), an email address (S/MIME), an individual (smart card authentication), or a software developer (code signing). A leaf certificate cannot be used to sign or issue other certificates.',
    keyPoints: [
      'Basic Constraints has cA:FALSE (or the extension is omitted entirely).',
      'Key Usage restricts cryptographic capabilities (e.g. digitalSignature, keyEncipherment).',
      'Extended Key Usage (EKU) specifies exact roles (e.g. Server Authentication, Code Signing).',
      'Subject Alternative Names (SAN) defines the legitimate hostnames, IP addresses, or emails.'
    ],
    securityImpact: 'Leaf certificates have short lifespans (typically 90 to 398 days) to limit exposure if a private key is leaked. Failure to renew leaf certificates before expiration leads to high-profile service outages and browser security warnings.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null | openssl x509 -text -noout',
      explanation: 'Connects to a remote server and prints the full parsed details of its leaf certificate.'
    },
    relatedAppMode: {
      mode: 'expiry-dashboard',
      label: 'Certificate Expiry Dashboard'
    }
  },
  csr: {
    id: 'csr',
    title: 'CSR (Certificate Signing Request)',
    subtitle: 'PKCS#10 Request Payload for Certificate Issuance',
    category: 'certificates',
    standardRef: 'PKCS#10 / RFC 2986',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc2986',
    overview: 'A Certificate Signing Request (CSR) is a standardized cryptographic message sent by an applicant to a Certificate Authority to apply for a digital certificate. It contains the applicant\'s public key, distinguished name (DN), requested Subject Alternative Names (SANs), and is digitally self-signed by the applicant\'s private key. This signature provides Proof-of-Possession (PoP), proving to the CA that the applicant holds the matching private key without ever transmitting or exposing the private key itself.',
    keyPoints: [
      'Never contains the private key: only the public key and applicant metadata are included.',
      'Contains a cryptographic signature made by the private key to prove ownership (Proof-of-Possession).',
      'Encoded in Base64 PEM format with header "-----BEGIN CERTIFICATE REQUEST-----".'
    ],
    securityImpact: 'A CSR is safe to transmit across public networks because it contains no secrets. However, if an attacker tricks a CA into signing a CSR with a key they control for a domain they do not own, they can perform man-in-the-middle attacks.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl req -in request.csr -text -noout -verify',
      explanation: 'Parses the CSR and verifies its self-contained cryptographic Proof-of-Possession signature.'
    },
    relatedAppMode: {
      mode: 'csr-inspector',
      label: 'CSR Inspector & Parser'
    }
  },
  crl: {
    id: 'crl',
    title: 'CRL (Certificate Revocation List)',
    subtitle: 'Periodic CA-Signed Distribution List of Revoked Serials',
    category: 'certificates',
    standardRef: 'RFC 5280 §5',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-5',
    overview: 'A Certificate Revocation List (CRL) is an authenticated list published periodically by a Certificate Authority that enumerates digital certificates that have been revoked before their planned expiration date. Each entry in a CRL specifies the certificate\'s serial number, revocation date, and optional reason code (such as keyCompromise or affiliationChanged). The entire list is digitally signed by the CA.',
    keyPoints: [
      'Referenced in certificates via the CRL Distribution Points (CDP) extension.',
      'Signed and timestamped with "thisUpdate" and "nextUpdate" validity windows.',
      'Can be full (Base CRL) or incremental (Delta CRL) to conserve bandwidth.'
    ],
    securityImpact: 'CRLs can grow massive (tens of megabytes for large CAs), causing latency and memory strain during TLS handshakes. Because clients cache CRLs until nextUpdate, there is a vulnerability window where a freshly revoked certificate may still be accepted.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl crl -in list.crl -inform DER -text -noout',
      explanation: 'Parses a binary DER Certificate Revocation List and displays all revoked serial numbers.'
    },
    relatedAppMode: {
      mode: 'crl-inspector',
      label: 'Inspect CRLs'
    }
  },
  ocsp: {
    id: 'ocsp',
    title: 'OCSP (Online Certificate Status Protocol)',
    subtitle: 'Real-Time Certificate Validity Query Protocol',
    category: 'protocols',
    standardRef: 'RFC 6960',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6960',
    overview: 'The Online Certificate Status Protocol (OCSP) is an HTTP-based network protocol designed as a lightweight, real-time alternative to downloading bulky CRLs. Instead of retrieving the entire list of all revoked certificates, the client sends a small query containing the target certificate\'s serial number and issuer hash to the CA\'s OCSP responder. The responder returns a signed response stating whether the certificate is "good", "revoked", or "unknown".',
    keyPoints: [
      'Located in the certificate\'s Authority Information Access (AIA) extension.',
      'Provides instantaneous status without transferring megabytes of revocation lists.',
      'Response is digitally signed with an OCSP Signing certificate authorized by the CA.'
    ],
    securityImpact: 'OCSP introduces privacy concerns (the CA learns what domains clients visit in real time) and performance overhead (extra network round-trip during TLS negotiation). To avoid breaking web browsing when responders go offline, many clients default to "soft-fail", ignoring unreached OCSP servers.',
    cliCommand: {
      tool: 'Windows certutil',
      command: 'certutil -verify -urlfetch cert.crt',
      explanation: 'Performs full network revocation verification against live AIA OCSP and CDP CRL endpoints.'
    },
    relatedAppMode: {
      mode: 'ocsp-checker',
      label: 'Online Revocation Checker'
    }
  },
  ocspStapling: {
    id: 'ocspStapling',
    title: 'OCSP Stapling',
    subtitle: 'Zero-Latency TLS Certificate Status Request Extension',
    category: 'protocols',
    standardRef: 'RFC 6066 §8 / RFC 6961',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6066#section-8',
    overview: 'OCSP Stapling (formally the TLS Certificate Status Request extension) solves the latency and privacy drawbacks of traditional OCSP. With stapling enabled, the web server itself periodically queries the CA\'s OCSP responder in the background, caches the cryptographically signed OCSP response, and "staples" it directly into the TLS handshake (CertificateStatus message) sent to connecting clients.',
    keyPoints: [
      'Eliminates client-side lookup latency during the TLS handshake.',
      'Protects client privacy: the CA never sees the client\'s IP address or browsing habits.',
      'Can be enforced using the OCSP Must-Staple extension (RFC 7633) in the certificate.'
    ],
    securityImpact: 'Without Must-Staple, an attacker performing a man-in-the-middle attack can block the stapled response, causing soft-fail clients to proceed without verification. Must-Staple forces clients to terminate the handshake if a valid stapled response is omitted.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl s_client -connect cloudflare.com:443 -status -tlsextdebug < /dev/null',
      explanation: 'Inspects whether the remote server delivers an OCSP stapled response during the TLS handshake.'
    },
    relatedAppMode: {
      mode: 'tls-scanner',
      label: 'Remote TLS Scanner'
    }
  },
  ctlog: {
    id: 'ctlog',
    title: 'Certificate Transparency (CT) Log',
    subtitle: 'Publicly Auditable Append-Only Certificate Ledger',
    category: 'protocols',
    standardRef: 'RFC 6962',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc6962',
    overview: 'Certificate Transparency (CT) is an open framework and network of publicly auditable, append-only, cryptographically verified ledgers (CT Logs) maintained by trusted operators like Google, Cloudflare, and DigiCert. Whenever a CA issues an SSL/TLS certificate, it must submit it to multiple independent CT logs. In return, the logs provide Signed Certificate Timestamps (SCTs) proving that the certificate has been publicly recorded.',
    keyPoints: [
      'Built on Merkle Tree cryptographic hash structures preventing retroactive alteration or removal.',
      'Browsers (Chrome, Edge, Safari) refuse to trust public TLS certificates that lack valid SCT proofs.',
      'Allows domain owners to monitor CT logs in real time and discover rogue or unauthorized certificates.'
    ],
    securityImpact: 'CT Logs transformed web security by ending the era where rogue CAs could secretly issue certificates for espionage or MITM attacks. Every certificate issued by a public CA is publicly visible to everyone within seconds of creation.',
    cliCommand: {
      tool: 'curl / REST',
      command: 'curl -s "https://crt.sh/?q=github.com&output=json" | jq \'.[0]\'',
      explanation: 'Queries the public crt.sh CT log aggregator for public records of certificates issued to a domain.'
    },
    relatedAppMode: {
      mode: 'ct-log-search',
      label: 'CT Log Search'
    }
  },
  x509: {
    id: 'x509',
    title: 'X.509 Standard',
    subtitle: 'ITU-T Standard for Public Key Certificates',
    category: 'formats',
    standardRef: 'ITU-T X.509 / RFC 5280',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280',
    overview: 'ITU-T Recommendation X.509 defines the international standard format for public key certificates and validation path models. Originally published in 1988 as part of the X.500 directory recommendations, X.509 Version 3 (standardized in RFC 5280) provides the cryptographic foundation for the Internet\'s Transport Layer Security (TLS/HTTPS), S/MIME email encryption, IPsec VPNs, code signing, and UEFI Secure Boot.',
    keyPoints: [
      'Defines certificate structure: Serial, Issuer, Validity (Not Before/Not After), Subject, Public Key, and Extensions.',
      'Uses Abstract Syntax Notation One (ASN.1) to define data schemas independent of machine architecture.',
      'V3 Extensions include Subject Alternative Names, Basic Constraints, Key Usage, AIA, and CDP.'
    ],
    securityImpact: 'Ambiguities in ASN.1 parsing have historically led to severe vulnerabilities, such as signature spoofing (CVE-2008-1386) and path validation bypasses. Modern implementations use strict ASN.1 DER decoding libraries.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl asn1parse -in certificate.pem',
      explanation: 'Dumps the raw ASN.1 tag-length-value (TLV) data structure of an X.509 certificate.'
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'Format Converter'
    }
  },
  pem: {
    id: 'pem',
    title: 'PEM (Privacy Enhanced Mail)',
    subtitle: 'Base64 Text Encoded Cryptographic Container',
    category: 'formats',
    standardRef: 'RFC 7468 / RFC 1421',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc7468',
    overview: 'Privacy Enhanced Mail (PEM) is the ubiquitous text-based encoding format used to represent cryptographic certificates, private keys, and CSRs. While the 1993 PEM secure email standard itself was superseded by S/MIME, its encoding format survived. A PEM file wraps raw binary DER ASN.1 data in Base64 characters, flanked by human-readable ASCII encapsulating boundaries like "-----BEGIN CERTIFICATE-----".',
    keyPoints: [
      'ASCII text-based format: safe for copy-pasting, email transmission, and configuration files.',
      'Encapsulated between clear boundary lines indicating the object type (CERTIFICATE, RSA PRIVATE KEY, etc.).',
      'Supports bundle files containing multiple certificates concatenated sequentially (certificate chains).'
    ],
    securityImpact: 'Easy to view and manipulate, but sensitive private keys in PEM format can easily be accidentally committed to public Git repositories or pasted into chat channels. Production keys must be stored with strict filesystem permissions (e.g. chmod 600).',
    cliCommand: {
      tool: 'Windows certutil',
      command: 'certutil -encode cert.der cert.pem',
      explanation: 'Converts a binary DER certificate into a standard Base64 PEM text file.'
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'PEM / DER Converter'
    }
  },
  der: {
    id: 'der',
    title: 'DER (Distinguished Encoding Rules)',
    subtitle: 'Canonical Binary ASN.1 Serialization Format',
    category: 'formats',
    standardRef: 'ITU-T X.690 / ASN.1 DER',
    standardUrl: 'https://www.itu.int/rec/T-REC-X.690/',
    overview: 'Distinguished Encoding Rules (DER) is a strict, unambiguous binary serialization standard for ASN.1 data structures. Unlike Basic Encoding Rules (BER) which allows multiple alternative encodings for the same data (such as variable length byte formats), DER enforces exact, canonical encoding rules so that every data structure produces exactly one unique byte stream. This property is mandatory for digital signatures.',
    keyPoints: [
      'Pure binary format: smaller footprint and faster parsing than text-based PEM.',
      'Deterministic: ensures that hashing the certificate produces an identical digest across all platforms.',
      'Standard format natively used inside Windows (.cer files), Java keystores, and hardware tokens.'
    ],
    securityImpact: 'Because DER is binary, it cannot be safely pasted into plain text editors or HTTP query parameters without corruption. It must be decoded or base64-encoded when transmitted through text-only mediums.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl x509 -in cert.pem -outform DER -out cert.der',
      explanation: 'Converts a Base64 PEM certificate into pure binary DER format.'
    },
    relatedAppMode: {
      mode: 'format-converter',
      label: 'DER to PEM Converter'
    }
  }
};
