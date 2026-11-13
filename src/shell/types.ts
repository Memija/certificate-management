import type React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AppSubModuleLink {
  id: string;
  label: string;
  /** Optional i18n translation key for localized sub-module label */
  labelKey?: string;
  /** Full path + optional query string, e.g. "/certificate-management?mode=tls-scanner" */
  to: string;
}

export interface RegisteredReactApp {
  /** Unique plugin identifier */
  id: string;
  /** Base route mounted by the root router (e.g. "/certificate-management") */
  route: string;
  /** Display name fallback in the root organizer menu */
  title: string;
  /** Optional i18n key for localized title */
  titleKey?: string;
  /** Short technical/thematic subtitle fallback */
  subtitle: string;
  /** Optional i18n key for localized subtitle */
  subtitleKey?: string;
  /** Organizer slot / cipher module designation fallback */
  designation: string;
  /** Optional i18n key for localized designation */
  designationKey?: string;
  /** Brief description fallback shown in the menu */
  description: string;
  /** Optional i18n key for localized description */
  descriptionKey?: string;
  /** Semantic version string */
  version: string;
  /** Accent color for holographic menu projection */
  accentColor: string;
  /** Icon rendered in menu cards and quick-switcher */
  icon: LucideIcon;
  /** Optional deep-links into specific views of this React app */
  subModules?: AppSubModuleLink[];
  /** Lazy dynamic import returning the root component of the sub-application */
  load: () => Promise<{ default: React.ComponentType }>;
}

export type ServitorRelayState =
  | { kind: 'awaiting' }
  | { kind: 'opticLock'; title: string; route: string }
  | { kind: 'subRoutine'; label: string }
  | { kind: 'transit'; title: string };

