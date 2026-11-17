import type { TermId, TopicDetail } from '@/types'

export type EducationPart1Key =
  'nvram' | 'db' | 'dbx' | 'kek' | 'pk' | 'efi' | 'uac' | 'rootCa' | 'intermediateCa'

export const EDUCATION_TOPICS_PART1: Record<EducationPart1Key, TopicDetail> = {
  nvram: {
    id: 'nvram',
    title: 'NVRAM (Non-Volatile RAM)',
    subtitle: 'UEFI Non-Volatile Memory Storage for Boot Security Variables',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §3.2',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/03_Boot_Manager.html#globally-defined-variables',
    overview:
      'Non-Volatile Random-Access Memory (NVRAM) is specialized persistent storage situated directly on the computer motherboard (often within the SPI flash chip alongside the UEFI BIOS). In Secure Boot, NVRAM stores the critical cryptographic databases (PK, KEK, db, dbx) and bootloader configurations. Unlike standard RAM, NVRAM variables persist across system power cycles, and unlike conventional disk partitions, they cannot be altered without platform-level authentication or physical firmware reprogramming.',
    keyPoints: [
      'Accessible in Windows via the GetFirmwareEnvironmentVariable Win32 API and PowerShell cmdlets (requires administrative elevation).',
      'Stores authenticated UEFI variables with flags like VARIABLE_ATTRIBUTE_NON_VOLATILE, BOOTSERVICE_ACCESS, and RUNTIME_ACCESS.',
      'Protected against unauthenticated tampering; changes to security variables require a cryptographic signature verified by the Platform Key or KEK.',
    ],
    securityImpact:
      'If NVRAM is corrupt or reset via CMOS jumper/battery removal, Secure Boot setup mode may be engaged, temporarily allowing unsigned operating systems to boot. Modern motherboard vendors use tamper-resistant flash or hardware TPM protection to prevent malicious NVRAM rewrites.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name db',
      explanation: 'Reads the raw authorized signature database variable stored in UEFI NVRAM.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Secure Boot NVRAM Inspector',
    },
  },
  db: {
    id: 'db',
    title: 'db (Signature Database)',
    subtitle: 'UEFI Authorized Signatures & Certificate Whitelist',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.1',
    standardUrl:
      'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#firmware-os-key-exchange-creating-trust-relationships',
    overview:
      "The Signature Database (db) is the whitelist of trusted cryptographic certificates and binary hashes embedded in UEFI NVRAM. When the system initiates, the UEFI firmware inspects the digital signature of every EFI application (such as the Windows Boot Manager, bootia32.efi, or shimx64.efi) and PCIe Option ROM. If the binary's signature chains to a certificate in db—or its exact SHA-256 hash matches an entry in db—the firmware permits execution.",
    keyPoints: [
      'Contains X.509 certificates and binary hashes (SHA-256, SHA-384, SHA-512) authorized to execute pre-boot.',
      'Typically pre-loaded by OEMs with the Microsoft Windows Production PCA 2011/2023 and Microsoft Corporation UEFI CA.',
      'Can only be updated if the update payload is signed by a valid key present in the Key Exchange Key (KEK) database.',
    ],
    securityImpact:
      'The replacement of the original 2011 Microsoft UEFI CA with the 2023 certificates is critical because 2011 certificates expire in 2026. Without modern db certificates, future bootloaders and Option ROMs will fail signature verification.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Confirm-SecureBootUEFI',
      explanation:
        'Confirms whether Secure Boot is active and enforcing signatures from the db whitelist.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'View db Signatures in NVRAM',
    },
  },
  dbx: {
    id: 'dbx',
    title: 'dbx (Forbidden Signature Database)',
    subtitle: 'UEFI Pre-Boot Revocation Blacklist',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.2',
    standardUrl:
      'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#signature-database-update',
    overview:
      'The Forbidden Signature Database (dbx) serves as the pre-boot revocation list for UEFI firmware. It contains hashes of compromised bootloaders, vulnerable EFI binaries, and revoked signing certificates. Even if an EFI executable has a valid signature chained to a trusted CA in the db whitelist, the firmware will refuse to execute it if its hash or certificate thumbprint appears in dbx.',
    keyPoints: [
      'Takes absolute precedence over db: if a binary is present in both db and dbx, execution is blocked immediately.',
      'Stores EFI_CERT_SHA256_GUID hashes of vulnerable boot managers and bootkits.',
      'Distributed via Windows Update, Linux vendor firmware service (LVFS), and UEFI BIOS updates.',
    ],
    securityImpact:
      'In 2023, the BlackLotus UEFI bootkit exploited CVE-2022-21894 (Baton Drop) to bypass Secure Boot by loading an older, vulnerable Microsoft boot manager. Mitigating BlackLotus required adding the vulnerable binary hashes to the dbx database.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: '(Get-SecureBootUEFI -Name dbx).bytes.Length',
      explanation:
        'Displays the size in bytes of the current dbx revocation list stored in system firmware.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect dbx Revocations',
    },
  },
  kek: {
    id: 'kek',
    title: 'KEK (Key Exchange Key)',
    subtitle: 'Database Authority for Updating Pre-Boot Signatures',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.3',
    standardUrl:
      'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#key-exchange-keys',
    overview:
      'The Key Exchange Key (KEK) database forms the middle tier of the UEFI Secure Boot trust hierarchy. It contains certificates that have the authority to deliver cryptographically signed updates to the Signature Database (db) and the Forbidden Signature Database (dbx). Operating system vendors, such as Microsoft and Canonical, hold KEK private keys so they can distribute security revocation updates to millions of devices without requiring motherboard vendor intervention.',
    keyPoints: [
      'Bridges the OEM hardware vendor (Platform Key) and OS vendor updates (db/dbx).',
      'Allows OS updates to dynamically add revoked hashes (dbx) or new OS root certs (db).',
      'Any update to db or dbx must be accompanied by an authenticated EFI_VARIABLE_AUTHENTICATION_2 payload signed by a KEK certificate.',
    ],
    securityImpact:
      'Without a valid KEK certificate corresponding to the OS vendor, the system cannot receive remote Secure Boot revocation updates, leaving firmware vulnerable to known bootkit exploits.',
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name KEK',
      explanation: 'Retrieves the Key Exchange Key signature list from UEFI NVRAM.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect KEK in NVRAM',
    },
  },
  pk: {
    id: 'pk',
    title: 'PK (Platform Key)',
    subtitle: 'Hardware Root of Trust for UEFI Secure Boot',
    category: 'secure-boot',
    standardRef: 'UEFI Spec 2.10 §32.4.4',
    standardUrl:
      'https://uefi.org/specs/UEFI/2.10/32_Secure_Boot_and_Driver_Signing.html#platform-keys',
    overview:
      'The Platform Key (PK) represents the supreme apex of trust in the UEFI Secure Boot architecture. Usually installed by the motherboard or device manufacturer (OEM) during production, the PK establishes an ownership relationship between the platform owner and the hardware firmware. It controls entry into Setup Mode and governs updates to both the PK itself and the Key Exchange Key (KEK) database.',
    keyPoints: [
      'Single root certificate: only one Platform Key can be active in the system at a time.',
      'Transitions the firmware from Setup Mode (unlocked, customizable) to User Mode (locked, enforced).',
      'Clearing the PK resets the firmware to Setup Mode, allowing users or enterprise administrators to enroll custom Secure Boot keys.',
    ],
    securityImpact:
      "Possession of the PK private key grants total authority over the system's firmware security policies. If the PK private key is leaked (such as in the MSI firmware signing key leak of 2023), attackers can forge authorized updates to firmware components.",
    cliCommand: {
      tool: 'PowerShell (Administrator)',
      command: 'Get-SecureBootUEFI -Name PK',
      explanation: 'Inspects the Platform Key enrolled in the UEFI motherboard NVRAM.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Inspect Platform Key',
    },
  },
  efi: {
    id: 'efi',
    title: 'UEFI / EFI',
    subtitle: 'Unified Extensible Firmware Interface Architecture',
    category: 'secure-boot',
    standardRef: 'UEFI Forum Specification',
    standardUrl: 'https://uefi.org/specs/UEFI/2.10/',
    overview:
      'The Unified Extensible Firmware Interface (UEFI, historically EFI) is the modern industry specification defining the software interface between the operating system and platform firmware. Replacing the legacy 16-bit IBM PC BIOS dating back to 1981, UEFI provides a modular 32-bit/64-bit pre-boot environment with rich driver support, GUID Partition Tables (GPT) supporting drives over 2TB, fast boot times, and the cryptographic verification engine known as Secure Boot.',
    keyPoints: [
      'Replaces legacy BIOS INT 13h/INT 10h real-mode interrupts with modular C-language protocols.',
      'Supports GPT partitioning, removing the 4-partition limit and 2.2 TB boundary of MBR disks.',
      'Hosts pre-boot drivers (Option ROMs) for NVMe drives, GPUs, network cards (PXE/HTTP boot).',
    ],
    securityImpact:
      'Because UEFI executes with ring 0/SMM (System Management Mode) access before the kernel loads, malicious code running at this layer (a UEFI rootkit) has complete invisibility from the operating system antivirus and kernel telemetry.',
    cliCommand: {
      tool: 'PowerShell',
      command: '$env:firmware_type',
      explanation: 'Displays whether the Windows OS was booted under modern UEFI or legacy BIOS.',
    },
    relatedAppMode: {
      mode: 'secure-boot',
      label: 'Secure Boot NVRAM Inspector',
    },
  },
  uac: {
    id: 'uac',
    title: 'UAC (User Account Control)',
    subtitle: 'Windows Administrative Privilege Boundary',
    category: 'secure-boot',
    standardRef: 'Windows Security Architecture',
    standardUrl:
      'https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/',
    overview:
      'User Account Control (UAC) is a Windows security mechanism that enforces the principle of least privilege. Even when logged in as an administrator, applications run under standard user tokens by default. When an application attempts to perform system-level tasks—such as accessing UEFI NVRAM variables, modifying LocalMachine certificate stores, or installing drivers—Windows halts the action and presents a secure desktop elevation prompt.',
    keyPoints: [
      'Separates administrative permissions from standard daily operational workflows.',
      'Uses the Secure Desktop (dimmed screen) to prevent synthetic keyboard/mouse injection attacks.',
      'Essential for accessing privileged Win32 APIs like GetFirmwareEnvironmentVariableEx and CertOpenStore.',
    ],
    securityImpact:
      'Without UAC, any script or background malware running under a user session could silently read and overwrite machine-wide trusted root certificates or modify system boot configurations without notice.',
    cliCommand: {
      tool: 'PowerShell',
      command:
        '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      explanation: 'Checks whether the current session holds elevated administrator privileges.',
    },
    relatedAppMode: {
      mode: 'win-cert-store',
      label: 'Win Cert Store Elevation',
    },
  },
  rootCa: {
    id: 'rootCa',
    title: 'Root CA (Certificate Authority)',
    subtitle: 'Anchor of Trust in the Public Key Infrastructure',
    category: 'certificates',
    standardRef: 'ITU-T X.509 / RFC 5280 §3.2',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-3.2',
    overview:
      'A Root Certificate Authority (Root CA) is the apex anchor of trust in Public Key Infrastructure (PKI). A Root CA certificate is self-signed: its Subject and Issuer fields are identical, and its signature is verified using its own embedded public key. Operating systems (Windows, Linux, macOS) and web browsers maintain pre-audited collections of Root CAs known as "Trust Stores". Every certificate in the world derives its validity by chaining cryptographically back to one of these root trust anchors.',
    keyPoints: [
      'Self-signed: Subject and Issuer distinguished names (DN) match exactly.',
      'Has the Basic Constraints extension marked Critical with cA:TRUE.',
      'Kept in extreme physical and cryptographic isolation (offline, hardware security modules / HSMs, air-gapped).',
    ],
    securityImpact:
      'If a Root CA private key is compromised, an attacker can issue forged, trusted certificates for any domain, user, or code-signing publisher on Earth without triggering browser warnings. Compromised Root CAs are immediately untrusted by major vendors via emergency browser and OS updates.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl x509 -in rootCA.crt -text -noout -subject -issuer',
      explanation:
        'Verifies that the Subject and Issuer are identical, confirming a self-signed root.',
    },
    relatedAppMode: {
      mode: 'trust-store',
      label: 'Explore Root Trust Store',
    },
  },
  intermediateCa: {
    id: 'intermediateCa',
    title: 'Intermediate CA (Subordinate CA)',
    subtitle: 'Operational Issuing Authority Protecting the Root',
    category: 'certificates',
    standardRef: 'RFC 5280 §4.2.1.9',
    standardUrl: 'https://datatracker.ietf.org/doc/html/rfc5280#section-4.2.1.9',
    overview:
      'An Intermediate Certificate Authority (also known as a Subordinate CA or Issuing CA) is a certificate that sits between the Root CA and the end-entity Leaf certificates. To protect the highly sensitive Root CA private key from exposure, the Root CA signs one or more Intermediate CAs, and is then placed offline in a secure vault. The Intermediate CAs handle day-to-day certificate signing, renewals, and revocation for end users and websites.',
    keyPoints: [
      'Signed by a Root CA or a higher-tier intermediate in the certificate hierarchy.',
      'Includes Basic Constraints: Critical, cA:TRUE, often with a pathLenConstraint limiting recursion depth.',
      'Servers must send intermediate certificates alongside their leaf certificate during the TLS handshake.',
    ],
    securityImpact:
      'If an Intermediate CA is compromised, it can be revoked individually via CRL or OCSP without having to revoke and replace the top-level Root CA and redistribute it to billions of client devices worldwide.',
    cliCommand: {
      tool: 'OpenSSL',
      command: 'openssl verify -CAfile rootCA.pem -untrusted intermediate.pem leaf.pem',
      explanation: 'Validates the complete chain from leaf through intermediate to root.',
    },
    relatedAppMode: {
      mode: 'chain-validator',
      label: 'Validate Intermediate Chains',
    },
  },
} satisfies Record<Extract<TermId, EducationPart1Key>, TopicDetail>
