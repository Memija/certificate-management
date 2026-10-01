/**
 * Sample Certificates for Online Revocation Checker (OCSP & CRL).
 * Includes live revoked, valid commercial (OCSP & CRL), DV (OCSP only), Let's Encrypt (CRL), and offline/self-signed certificates.
 */

export interface OcspSamplePreset {
  id: string;
  name: string;
  badge: string;
  badgeType: 'danger' | 'success' | 'warning' | 'info';
  expectedStatus: 'revoked' | 'good' | 'unknown';
  description: string;
  category: string;
  subject: string;
  issuer: string;
  ocspUrl: string | null;
  crlUrl: string | null;
  certificatePem: string;
}

export const OcspSamplePreset = {};

export const SAMPLE_REVOKED_BADSSL_PEM = `-----BEGIN CERTIFICATE-----
MIIDjzCCAxagAwIBAgISBQpyt66QwuHGG7fRVoAy95VJMAoGCCqGSM49BAMDMDMx
CzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNZ
RTIwHhcNMjYwOTE1MjAwMjUxWhcNMjYxMjE0MjAwMjUwWjAdMRswGQYDVQQDExJy
ZXZva2VkLmJhZHNzbC5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAT6GIvk
BcwuWiVlvcvMrLpR3Fe/XUwCglt00blUeMgM758OlBllvXqxkWv8ZCPdkCbAdmvm
srn0g5AMIquXoA1to4ICHjCCAhowDgYDVR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoG
CCsGAQUFBwMBMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFL/doGHiNKfN4tic3QxD
S8dDDuLaMB8GA1UdIwQYMBaAFLlZ8o7PIvCG0zdI/3YUGLqC2FWHMDMGCCsGAQUF
BwEBBCcwJTAjBggrBgEFBQcwAoYXaHR0cDovL3llMi5pLmxlbmNyLm9yZy8wHQYD
VR0RBBYwFIIScmV2b2tlZC5iYWRzc2wuY29tMBMGA1UdIAQMMAowCAYGZ4EMAQIB
MC4GA1UdHwQnMCUwI6AhoB+GHWh0dHA6Ly95ZTIuYy5sZW5jci5vcmcvNzQuY3Js
MIIBCgYKKwYBBAHWeQIEAgSB+wSB+AD2AHUAyzj3FYl8hKFEX1vB3fvJbvKaWc1H
CmkFhbDLFMMUWOcAAAGgpt/TVQAABAMARjBEAiApNcX8knJz1Q9aMonFV7VUniIv
n5Qcltzd//7O80u7LQIgew6FAB248/CgtK7iZMEmSsTKv0ixlx2mUOEdCZImvfcA
fQBGr4Y9Oz7ln6V33qgkXTaw2e0ioiP0YXdBIpRS7pVQXwAAAaCm39N+AAgAAAUA
L0WzigQDAEYwRAIgO2rwvPsoa4+BhAka85u67UJx6FLl8vTwypO22aYPXugCIH++
nCpcXstPhjjKbsSiFygzeD+dzL1HzLOTQvIQgG73MAoGCCqGSM49BAMDA2cAMGQC
MG8CMfaoyqfGZ4aWHc2CsT5QZ+7Rw8gHoPwXCECeZmV7HBkRCnIH0EIis8z0eS0E
OwIwKT+3LRFRjpTruOMN85elz0OOVJ2NpUOtLLP2+Ez3AcKiiiRLKmGb1AVsLniZ
HrMC
-----END CERTIFICATE-----`;

export const SAMPLE_VALID_DIGICERT_PEM = `-----BEGIN CERTIFICATE-----
MIIG7DCCBdSgAwIBAgIQCuwkkfAcjFoNGfQfm6PkzTANBgkqhkiG9w0BAQsFADBE
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMR4wHAYDVQQDExVE
aWdpQ2VydCBFViBSU0EgQ0EgRzIwHhcNMjYwOTEwMDAwMDAwWhcNMjYxMDI2MjM1
OTU5WjCBwTETMBEGCysGAQQBgjc8AgEDEwJVUzEVMBMGCysGAQQBgjc8AgECEwRV
dGFoMR0wGwYDVQQPDBRQcml2YXRlIE9yZ2FuaXphdGlvbjEVMBMGA1UEBRMMNTI5
OTUzNy0wMTQyMQswCQYDVQQGEwJVUzENMAsGA1UECBMEVXRhaDENMAsGA1UEBxME
TGVoaTEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xGTAXBgNVBAMTEHd3dy5kaWdp
Y2VydC5jb20wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDcfZWPC/sc
nFQU+h+ld+SnVaEQIVbd0kiJW5rYDQjIOYW1qWie+PR/74/Whd0fmFA8A8o3r9gt
xCZDG6x7r50MN+puVOrqlkd+5PWfMK79hfhwF3s5LKE2WXUIeN0meFqT3rxwrLLA
r9qh/LczmREani6gUDe3+fvDE2xYLA10qwplbtGbmAZBFLtVWWMcBF6FT/Y02IdC
03tJqxiOpEGXdK7DLJiX5uG1pl9ij2clP//Ci1IuKgojyRpKP5N9C90odjegI9Ra
LuLOSHD1CpVj13NsIggW99Sa3mVjgGgytQs5fy5ZJBrm7zdvbKH56+R8MeePal0H
rad5dJGU5915AgMBAAGjggNaMIIDVjAfBgNVHSMEGDAWgBRqTlC/mGidW3sgddRZ
AXlIZpIyBjAdBgNVHQ4EFgQU/w+Y40vrV1K7P6vlSGSAijfyCf4wKQYDVR0RBCIw
IIIQd3d3LmRpZ2ljZXJ0LmNvbYIMZGlnaWNlcnQuY29tMEoGA1UdIARDMEEwCwYJ
YIZIAYb9bAIBMDIGBWeBDAEBMCkwJwYIKwYBBQUHAgEWG2h0dHA6Ly93d3cuZGln
aWNlcnQuY29tL0NQUzAOBgNVHQ8BAf8EBAMCBaAwEwYDVR0lBAwwCgYIKwYBBQUH
AwEwdQYDVR0fBG4wbDA0oDKgMIYuaHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0Rp
Z2lDZXJ0RVZSU0FDQUcyLmNybDA0oDKgMIYuaHR0cDovL2NybDQuZGlnaWNlcnQu
Y29tL0RpZ2lDZXJ0RVZSU0FDQUcyLmNybDBzBggrBgEFBQcBAQRnMGUwJAYIKwYB
BQUHMAGGGGh0dHA6Ly9vY3NwLmRpZ2ljZXJ0LmNvbTA9BggrBgEFBQcwAoYxaHR0
cDovL2NhY2VydHMuZGlnaWNlcnQuY29tL0RpZ2lDZXJ0RVZSU0FDQUcyLmNydDAM
BgNVHRMBAf8EAjAAMIIBfAYKKwYBBAHWeQIEAgSCAWwEggFoAWYAdgDCMX5XRRmj
Re5/ON6ykEHrx8IhWiK/f9W1rXaa2Q5SzQAAAaCJ9G5sAAAEAwBHMEUCIFU+FG0l
S0lDgQvBGpjY0vGJSap3N3f1dFlX+gVw7LUzAiEAurvbGojLryWnmbgVjMrI7EDx
xWYedCRf3pzeLU459cIAdQDYCVU7lE96/8gWGW+UT4WrsPj8XodVJg8V0S5yu0VL
FAAAAaCJ9G6WAAAEAwBGMEQCIAvec/isXt6e3IsCgauHou1n6oZABoFKL/YYenBU
5Z7IAiBJpu2XIJSuDxagTwJHtNws2HSsAC9pr0NeP887TJAewgB1AJROQ4f67MHv
gfMZJCaoGGUBx9NfOAIBP3JnfVU3LhnYAAABoIn0bn4AAAQDAEYwRAIgdbtTbVQ5
hhMuobCX5cAT5OMJmVHh4ruBi5SzcYYfGx0CIEX2nwWyeJCFjohjSkbBAFCGroNO
j1fcWUGI6+odndkjMA0GCSqGSIb3DQEBCwUAA4IBAQCG4PQjpYKzuAUU3h7g/NVZ
Zf13aQLxVmG1KRAPk4Ln3+l8nqUHQRyaLfhK9RurNch6dQlPejBBs6XVn6evVcxC
u+HpTeOu+mJlMQxxLrrBdnhAimQGZVv7yZVFoIx7eLuFF3vvbT2+/gLIRuwdKliq
gcmIAasWpjPhj65g6WbEcSVzGv94TyUc8KYcnYqjBsg+H7vEf2Sk+/gCIZ4PpcU8
IkJ7S4GFJpjyhuDszXhqsw0HZCTedG+z/uwbTWKpmF3A/DogpHTNGVDUannCWFo1
Hxpb7V3y6AoTc5YsZWHoOSzIxXUQEArrnBD/Lq2I8yFkI4Cih6hCDGXYjpk+CAhy
-----END CERTIFICATE-----`;

export const SAMPLE_VALID_GITHUB_PEM = `-----BEGIN CERTIFICATE-----
MIID7TCCA5SgAwIBAgIRAKWevbWWdR239cCVB5YTlTwwCgYIKoZIzj0EAwIwYDEL
MAkGA1UEBhMCR0IxGDAWBgNVBAoTD1NlY3RpZ28gTGltaXRlZDE3MDUGA1UEAxMu
U2VjdGlnbyBQdWJsaWMgU2VydmVyIEF1dGhlbnRpY2F0aW9uIENBIERWIEUzNjAe
Fw0yNjA5MDEwMDAwMDBaFw0yNjExMjkyMzU5NTlaMBUxEzARBgNVBAMTCmdpdGh1
Yi5jb20wWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASFNhs0vLNR9yDpqprL6Cct
YNExex040djH16D6WrHxLyjnmVFGYSI4sj6wK3V17ADiaabPE04vQk76djW0DT8q
o4ICeDCCAnQwHwYDVR0jBBgwFoAUF5moBMFv5C1wqAoQPQPT6Rq4JmMwHQYDVR0O
BBYEFGaY7EwRNfdLUISLqBw2ZdAXVtTgMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMB
Af8EAjAAMBMGA1UdJQQMMAoGCCsGAQUFBwMBMEkGA1UdIARCMEAwNAYLKwYBBAGy
MQECAgcwJTAjBggrBgEFBQcCARYXaHR0cHM6Ly9zZWN0aWdvLmNvbS9DUFMwCAYG
Z4EMAQIBMIGEBggrBgEFBQcBAQR4MHYwTwYIKwYBBQUHMAKGQ2h0dHA6Ly9jcnQu
c2VjdGlnby5jb20vU2VjdGlnb1B1YmxpY1NlcnZlckF1dGhlbnRpY2F0aW9uQ0FE
VkUzNi5jcnQwIwYIKwYBBQUHMAGGF2h0dHA6Ly9vY3NwLnNlY3RpZ28uY29tMIIB
BAYKKwYBBAHWeQIEAgSB9QSB8gDwAHYA1219ENGn9XfCx+lf1wC/+YLJM1pl4dCz
AXMXwMjFaXcAAAGgWk2g0QAABAMARzBFAiB6u6CCyQsap+pmTuz7Ab9THPLWVtQR
PTqSNuC8ZWO6eQIhALM3rJpdu0XVcvSW2985RjODh+9BBR5n8fB5lL7LOXnmAHYA
yKPEf8ezrbk1awE/anoSbeM6TkOlxkb5l605dZkdz5oAAAGgWk2grQAABAMARzBF
AiBwsQvwfVSuEcGqKp4lN/jWPUUuudUX+St4fImVDxCKmQIhANHJvWdzsXH/A9uC
rSz1sQ4k3yowTYxtVtfTJc91oze2MCUGA1UdEQQeMByCCmdpdGh1Yi5jb22CDnd3
dy5naXRodWIuY29tMAoGCCqGSM49BAMCA0cAMEQCIBdBV7Y/5t2o988vMBDGLJEl
LWALzPJkt3dphmsZk9CEAiAJqxa/1c8JYYWHsGy1rQNUb3ffuCJU7pnjjqJfdiim
hQ==
-----END CERTIFICATE-----`;

export const SAMPLE_VALID_LETSENCRYPT_PEM = `-----BEGIN CERTIFICATE-----
MIIERjCCA8ygAwIBAgISBUOTO+OGs6KzrdU08hA7yLZfMAoGCCqGSM49BAMDMDMx
CzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQDEwNZ
RTIwHhcNMjYwOTA0MTQzNDMyWhcNMjYxMjAzMTQzNDMxWjAaMRgwFgYDVQQDEw9s
ZXRzZW5jcnlwdC5vcmcwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATp5UB7Qx5G
uY5F5KrLQKvmP5knuLeB4zJW5xR0X/pDW1LGprVmxVYOByFW40z+NVVP8JIv6yJK
8Xo5UTkEwrMNo4IC1zCCAtMwDgYDVR0PAQH/BAQDAgeAMBMGA1UdJQQMMAoGCCsG
AQUFBwMBMAwGA1UdEwEB/wQCMAAwHQYDVR0OBBYEFBZojR4qMkiMtfEQChYINwg7
nTAjMB8GA1UdIwQYMBaAFLlZ8o7PIvCG0zdI/3YUGLqC2FWHMDMGCCsGAQUFBwEB
BCcwJTAjBggrBgEFBQcwAoYXaHR0cDovL3llMi5pLmxlbmNyLm9yZy8wgdMGA1Ud
EQSByzCByIISY3AubGV0c2VuY3J5cHQub3JnghpjcC5yb290LXgxLmxldHNlbmNy
eXB0Lm9yZ4ITY3BzLmxldHNlbmNyeXB0Lm9yZ4IbY3BzLnJvb3QteDEubGV0c2Vu
Y3J5cHQub3JngglsZW5jci5vcmeCD2xldHNlbmNyeXB0LmNvbYIPbGV0c2VuY3J5
cHQub3Jngg13d3cubGVuY3Iub3JnghN3d3cubGV0c2VuY3J5cHQuY29tghN3d3cu
bGV0c2VuY3J5cHQub3JnMBMGA1UdIAQMMAowCAYGZ4EMAQIBMC4GA1UdHwQnMCUw
I6AhoB+GHWh0dHA6Ly95ZTIuYy5sZW5jci5vcmcvOTYuY3JsMIIBDAYKKwYBBAHW
eQIEAgSB/QSB+gD4AHcA2AlVO5RPev/IFhlvlE+Fq7D4/F6HVSYPFdEucrtFSxQA
AAGgbQ1JKQAABAMASDBGAiEA0C4lpJ1/yBjWe16/I137doODEVKvcSJFXJ8ioiZG
aQECIQDWQjeqdmhAM4eaHWB0wUKMtjmH1bHdcSEUbkdN0T8fFQB9AEavhj07PuWf
pXfeqCRdNrDZ7SKiI/Rhd0EilFLulVBfAAABoG0NSdgACAAABQAk39sMBAMARjBE
AiAxL4PWQmUmDVjX3cOZtq28GdU5lq3195NQuF+2RYfCjQIgC4OZ2HT0Bv0blVhH
n8petcUkgzhwS/2HeZopg+hLsJowCgYIKoZIzj0EAwMDaAAwZQIxAO4dsHw1iJgV
V7iIcyOSqb9Av+iuAkjm9HotGPxDUtOAmv/O4CoNSinmgKKU9U8U2QIwNQiZO7yJ
WyOg72Qk4rKzuMLY1ZVF3vMD6OeCeKWewh+t6xT8OVHH4RjpFrSlSN4J
-----END CERTIFICATE-----`;

export const SAMPLE_OFFLINE_SELFSIGNED_PEM = `-----BEGIN CERTIFICATE-----
MIIDtjCCAp6gAwIBAgIHAaS1xtfo+TANBgkqhkiG9w0BAQsFADBGMRwwGgYDVQQD
ExNLZXkgTWF0Y2hlciBSb290IENBMRkwFwYDVQQKExBLZXkgTWF0Y2hlciBDb3Jw
MQswCQYDVQQGEwJVUzAeFw0yNjA5MTcxMDAyMTJaFw0yODA5MTcxMDAyMTJaMIGG
MRwwGgYDVQQDExNtYXRjaGVyLmV4YW1wbGUuY29tMRkwFwYDVQQKExBLZXkgTWF0
Y2hlciBDb3JwMR0wGwYDVQQLExRTZWN1cml0eSBFbmdpbmVlcmluZzEPMA0GA1UE
BxMGQXVzdGluMQ4wDAYDVQQIEwVUZXhhczELMAkGA1UEBhMCVVMwggEiMA0GCSqG
SIb3DQEBAQUAA4IBDwAwggEKAoIBAQC4aF5bdEaKxZu9GdgMoJMKWvFbdyGgOwqA
JLglYVNv5Z1FFpVL7wJXhecTEq4uwP2ap+ebd3szlss3qOiOp9Ao4QFfqBt7cs62
Fr7mICJmshAF3xMwQJmaO35cheq/ULI+G2CBUYN7+EWFzoH3ovaexoemJjg/Z3Uk
OOmbBJrPJq7qFWRetMXahtR/1XHxDwLtl2H7+uB7Pohpcj6I3dMw1hlgqCztWwcb
FhcEgDD8vgOyvjzR3SZ3z13iA0rNv+OLnI44gWYurETr5gJKyW4+04KKxPW22MmA
L2B3fZ+ydeLljIyBBNuv4iKki82bRwi6u+LS8Igjt6+XvRtlLKTTAgMBAAGjaDBm
MAkGA1UdEwQCMAAwCwYDVR0PBAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMBMDcG
A1UdEQQwMC6CE21hdGNoZXIuZXhhbXBsZS5jb22CF3d3dy5tYXRjaGVyLmV4YW1w
bGUuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQACP7L4zQ3gbEiqEDfSDvjcdJTbO1Vx
wFfzRNGu5XHszdPhioxQrrN0Yj3Rl0m6IJe32GKeXOFZ5sYzbo6IH9WGHqtX+QkQ
DxgeockIFLlp9KcpGSNRm7r3GFCmmZg1p7hLsqszqt004OStPtz8cVPKI3lI19FS
Csng6I9FgeFzh7kcxiP3GkFDiSOucbq0J+KIhayJMWXM0Y+R0Zn2D9zouFsj4o36
wFtQu6t34fuTVoaKuBI3tiQ7mOHZrbuw2E163oHLQ65daeYf4AhTsVCiK09NV8u1
kQzEtbWTeB2mYx+QYm/MrwgoDPzPl8WKvoTgfSoY7H2l2Wg+ulqiL8gE
-----END CERTIFICATE-----`;

export const OCSP_SAMPLE_PRESETS: OcspSamplePreset[] = [
  {
    id: 'revoked-badssl',
    name: 'Revoked Certificate (BadSSL)',
    badge: 'Revoked',
    badgeType: 'danger',
    expectedStatus: 'revoked',
    category: 'Live Revocation Test',
    description: 'Live test certificate issued to revoked.badssl.com by Let\'s Encrypt. The issuing CA has revoked this certificate and published it in its active Certificate Revocation List (CRL).',
    subject: 'CN=revoked.badssl.com',
    issuer: 'CN=YE2, O=Let\'s Encrypt, C=US',
    ocspUrl: null,
    crlUrl: 'http://ye2.c.lencr.org/74.crl',
    certificatePem: SAMPLE_REVOKED_BADSSL_PEM
  },
  {
    id: 'valid-digicert',
    name: 'DigiCert EV RSA (OCSP & CRL)',
    badge: 'Valid (OCSP & CRL)',
    badgeType: 'success',
    expectedStatus: 'good',
    category: 'Enterprise / Commercial CA',
    description: 'High-assurance Extended Validation (EV) certificate for www.digicert.com. Configured with both live OCSP responder and redundant CRL distribution points.',
    subject: 'CN=www.digicert.com, O=DigiCert, Inc.',
    issuer: 'CN=DigiCert EV RSA CA G2, O=DigiCert Inc, C=US',
    ocspUrl: 'http://ocsp.digicert.com',
    crlUrl: 'http://crl3.digicert.com/DigiCertEVRSACAG2.crl',
    certificatePem: SAMPLE_VALID_DIGICERT_PEM
  },
  {
    id: 'valid-github-sectigo',
    name: 'GitHub / Sectigo DV (OCSP)',
    badge: 'Valid (OCSP)',
    badgeType: 'success',
    expectedStatus: 'good',
    category: 'Domain Validated CA',
    description: 'Standard Domain Validated (DV) certificate for github.com issued by Sectigo. Revocation is verified in real-time against Sectigo\'s dedicated OCSP responder.',
    subject: 'CN=github.com',
    issuer: 'CN=Sectigo Public Server Authentication CA DV E36, O=Sectigo Limited',
    ocspUrl: 'http://ocsp.sectigo.com',
    crlUrl: null,
    certificatePem: SAMPLE_VALID_GITHUB_PEM
  },
  {
    id: 'valid-letsencrypt',
    name: 'Let\'s Encrypt (CRL)',
    badge: 'Valid (CRL)',
    badgeType: 'success',
    expectedStatus: 'good',
    category: 'Modern Web CA',
    description: 'Production Let\'s Encrypt certificate for letsencrypt.org. Uses modern lightweight CRL distribution endpoints for high-throughput revocation checking.',
    subject: 'CN=letsencrypt.org',
    issuer: 'CN=YE2, O=Let\'s Encrypt, C=US',
    ocspUrl: null,
    crlUrl: 'http://ye2.c.lencr.org/74.crl',
    certificatePem: SAMPLE_VALID_LETSENCRYPT_PEM
  },
  {
    id: 'offline-selfsigned',
    name: 'Internal / Self-Signed (No URLs)',
    badge: 'Offline / Unknown',
    badgeType: 'warning',
    expectedStatus: 'unknown',
    category: 'Private PKI / Intranet',
    description: 'Private enterprise certificate without Authority Information Access (AIA) or CRL Distribution Points (CDP). Verifies how the tool handles certificates with no online revocation endpoints.',
    subject: 'CN=matcher.example.com, O=Key Matcher Corp',
    issuer: 'CN=Key Matcher Root CA, O=Key Matcher Corp',
    ocspUrl: null,
    crlUrl: null,
    certificatePem: SAMPLE_OFFLINE_SELFSIGNED_PEM
  }
];
