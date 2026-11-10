import type React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface AppSubModuleLink {
  id: string;
  label: string;
  /** Full path + optional query string, e.g. "/certificate-management?mode=tls-scanner" */
  to: string;
}

export interface RegisteredReactApp {
  /** Unique plugin identifier */
  id: string;
  /** Base route mounted by the root router (e.g. "/certificate-management") */
  route: string;
  /** Display name in the root organizer menu */
  title: string;
  /** Short technical/thematic subtitle */
  subtitle: string;
  /** Organizer slot / cogitator designation */
  designation: string;
  /** Brief description shown in the menu */
  description: string;
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

