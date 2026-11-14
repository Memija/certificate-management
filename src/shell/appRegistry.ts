import { Shield } from 'lucide-react';
import type { RegisteredReactApp } from './types';

/**
 * Central Application Plugin Registry.
 *
 * To plug in a new React application on its own route:
 * 1. Create a self-contained folder under `src/apps/<your-app>/` with a default-exported root component.
 * 2. Add a `RegisteredReactApp` entry below with its `route` and lazy `load` function.
 *
 * The Root Shell automatically:
 * - Mounts `<Route path="<route>/*" />` with React.lazy code-splitting
 * - Displays the application in the 3D Servitor Head's holographic menu on `/`
 * - Adds it to the floating Servitor Head's quick-navigation switcher across all routes
 */
export const REGISTERED_APPS: RegisteredReactApp[] = [
  {
    id: 'certificate-management',
    route: '/certificate-management',
    title: 'Certificate Management',
    titleKey: 'app.title',
    subtitle: 'PKI, X.509 & UEFI Secure Boot Sanctum',
    subtitleKey: 'servitor.apps.certMgmt.subtitle',
    designation: 'Cipher-Mod // 01-PKI',
    designationKey: 'servitor.apps.certMgmt.designation',
    description:
      'Inspect UEFI Secure Boot NVRAM databases, Windows & Java trust stores, X.509 certificate chains, CSRs, CRLs, OCSP responders, TLS endpoints, and CT logs.',
    descriptionKey: 'servitor.apps.certMgmt.description',
    version: '1.4.0',
    accentColor: '#10b981',
    icon: Shield,
    subModules: [
      {
        id: 'secure-boot',
        label: 'UEFI Secure Boot',
        labelKey: 'app.nav.secure-boot',
        to: '/certificate-management?mode=secure-boot',
      },
      {
        id: 'win-cert-store',
        label: 'Windows Cert Store',
        labelKey: 'app.nav.win-cert-store',
        to: '/certificate-management?mode=win-cert-store',
      },
      {
        id: 'chain-validator',
        label: 'Chain Validator',
        labelKey: 'app.nav.chain-validator',
        to: '/certificate-management?mode=chain-validator',
      },
      {
        id: 'tls-scanner',
        label: 'TLS Scanner',
        labelKey: 'app.nav.tls-scanner',
        to: '/certificate-management?mode=tls-scanner',
      },
      {
        id: 'csr-inspector',
        label: 'CSR Inspector',
        labelKey: 'app.nav.csr-inspector',
        to: '/certificate-management?mode=csr-inspector',
      },
      {
        id: 'key-generator',
        label: 'Key Generator',
        labelKey: 'app.nav.key-generator',
        to: '/certificate-management?mode=key-generator',
      },
    ],
    load: () => import('../apps/certificate-management/CertificateManagementApp'),
  },
];

