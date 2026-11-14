import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, ArrowRight, Sparkles, Layers, ChevronDown, Moon, Sun, Monitor } from 'lucide-react';
import { REGISTERED_APPS } from './appRegistry';
import type { ServitorRelayState } from './types';
import {
  normalizeLanguageTag,
  setUserLanguagePreference,
  type SupportedLanguage,
  type ThemePreference,
} from '../apps/certificate-management/utils/systemSettings';

const SANCTUM_LANGUAGES: ReadonlyArray<{
  code: SupportedLanguage;
  flag: string;
  label: string;
}> = [
  { code: 'id', flag: 'id', label: 'Bahasa Indonesia' },
  { code: 'bs', flag: 'ba', label: 'Bosanski' },
  { code: 'de', flag: 'de', label: 'Deutsch' },
  { code: 'en', flag: 'gb', label: 'English' },
  { code: 'pl', flag: 'pl', label: 'Polski' },
  { code: 'sr-Cyrl', flag: 'rs', label: 'Српски' },
];

export interface RootMenuPageProps {
  isTransitioningOut: boolean;
  relayState: ServitorRelayState;
  theme: ThemePreference;
  onToggleTheme: () => void;
  onLaunchApp: (targetUrl: string, appTitle: string) => void;
  onHoverMenuTarget: (
    point: { x: number; y: number } | null,
    relayHint?: ServitorRelayState
  ) => void;
}

export const RootMenuPage: React.FC<RootMenuPageProps> = ({
  isTransitioningOut,
  relayState,
  theme,
  onToggleTheme,
  onLaunchApp,
  onHoverMenuTarget,
}) => {
  const { t, i18n } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langPickerRef = useRef<HTMLDivElement | null>(null);

  const normalizedLang = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language) || 'en';
  const currentLang =
    SANCTUM_LANGUAGES.find((l) => l.code === normalizedLang) ??
    SANCTUM_LANGUAGES.find((l) => l.code === 'en') ??
    SANCTUM_LANGUAGES[0];

  useEffect(() => {
    if (!langMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [langMenuOpen]);

  const handleMouseEnterElement = (e: React.MouseEvent<HTMLElement>, hint: ServitorRelayState) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHoverMenuTarget(
      {
        x: rect.left + rect.width * 0.35,
        y: rect.top + rect.height * 0.5,
      },
      hint
    );
  };

  let renderedRelayText: string;
  switch (relayState.kind) {
    case 'opticLock':
      renderedRelayText = t('servitor.relay.opticLock', {
        title: relayState.title,
        route: relayState.route,
      });
      break;
    case 'subRoutine':
      renderedRelayText = t('servitor.relay.subRoutineReady', {
        label: relayState.label,
      });
      break;
    case 'transit':
      renderedRelayText = t('servitor.relay.engagingTransit', {
        title: relayState.title,
      });
      break;
    default:
      renderedRelayText = t('servitor.relay.awaitingDirective');
      break;
  }

  const sanctumCount = REGISTERED_APPS.length;
  const sanctumStatusText =
    sanctumCount === 1
      ? t('servitor.status.sanctumsOne', { count: sanctumCount })
      : t('servitor.status.sanctumsOther', { count: sanctumCount });

  return (
    <div className="root-sanctum-page">
      <div className="root-sanctum-grid-backdrop" aria-hidden="true" />
      <div className="root-sanctum-scanlines" aria-hidden="true" />

      <header className="root-sanctum-topbar">
        <div className="root-sanctum-brand">
          <div className="root-sanctum-cipher-badge" aria-hidden="true">
            <Cpu size={19} />
          </div>
          <div className="root-sanctum-brand-text">
            <h1>{t('servitor.brand.title')}</h1>
            <span>{t('servitor.brand.subtitle')}</span>
          </div>
        </div>

        <div className="root-sanctum-topbar-actions">
          <div
            ref={langPickerRef}
            className="root-sanctum-lang-picker"
            title={t('app.language.switch')}
          >
            <button
              type="button"
              className="root-sanctum-lang-trigger"
              onClick={() => setLangMenuOpen((o) => !o)}
              aria-label={t('app.language.switch')}
              aria-expanded={langMenuOpen}
            >
              <img
                src={`/flags/${currentLang.flag}.png`}
                alt={currentLang.label}
                className="root-sanctum-lang-flag"
              />
              <span>{currentLang.label}</span>
              <ChevronDown
                size={13}
                className={`root-sanctum-lang-chevron ${langMenuOpen ? 'is-open' : ''}`}
              />
            </button>

            {langMenuOpen && (
              <ul className="root-sanctum-lang-menu" role="listbox">
                {SANCTUM_LANGUAGES.map((lang) => (
                  <li key={lang.code}>
                    <button
                      type="button"
                      className={`root-sanctum-lang-option ${
                        lang.code === currentLang.code ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        setUserLanguagePreference(lang.code);
                        i18n.changeLanguage(lang.code);
                        setLangMenuOpen(false);
                      }}
                    >
                      <img
                        src={`/flags/${lang.flag}.png`}
                        alt={lang.label}
                        className="root-sanctum-lang-flag"
                      />
                      <span>{lang.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="root-sanctum-theme-toggle"
            onClick={onToggleTheme}
            title={t('app.aria.toggleTheme')}
            aria-label={t('app.aria.toggleTheme')}
          >
            {theme === 'dark' ? (
              <Moon size={15} />
            ) : theme === 'light' ? (
              <Sun size={15} />
            ) : (
              <Monitor size={15} />
            )}
          </button>

          <div className="root-sanctum-status-pill">
            <span className="root-sanctum-status-dot" />
            <span>{sanctumStatusText}</span>
          </div>
        </div>
      </header>

      <main className="root-sanctum-stage">
        {/* Left column reserves open stage space for the 3D Servitor Head */}
        <div className="root-sanctum-servitor-pedestal">
          <div
            className="root-sanctum-relay-caption"
            style={{ opacity: isTransitioningOut ? 0 : 1 }}
          >
            <strong>{t('servitor.relay.header')}</strong>
            {renderedRelayText}
          </div>
        </div>

        {/* Right column displays the interactive Holographic Organizer Menu */}
        <section
          className={`root-sanctum-menu-panel ${isTransitioningOut ? 'is-transitioning-out' : ''}`}
          aria-label={t('servitor.menu.ariaLabel')}
        >
          <div className="root-menu-eyebrow">
            <Sparkles size={13} />
            <span>{t('servitor.menu.eyebrow')}</span>
          </div>
          <h2 className="root-menu-heading">{t('servitor.menu.heading')}</h2>
          <p className="root-menu-subtitle">{t('servitor.menu.subtitle')}</p>

          <div className="root-menu-cards">
            {REGISTERED_APPS.map((app) => {
              const Icon = app.icon;
              const appTitle = app.titleKey ? t(app.titleKey) : app.title;
              const appSubtitle = app.subtitleKey ? t(app.subtitleKey) : app.subtitle;
              const appDesignation = app.designationKey
                ? t(app.designationKey)
                : app.designation;
              const appDesc = app.descriptionKey ? t(app.descriptionKey) : app.description;

              return (
                <div
                  key={app.id}
                  className="root-app-card"
                  role="button"
                  tabIndex={0}
                  onMouseEnter={(e) =>
                    handleMouseEnterElement(e, {
                      kind: 'opticLock',
                      title: appTitle,
                      route: app.route,
                    })
                  }
                  onMouseLeave={() => onHoverMenuTarget(null)}
                  onClick={() => onLaunchApp(app.route, appTitle)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onLaunchApp(app.route, appTitle);
                    }
                  }}
                >
                  <div className="root-app-card-top">
                    <div className="root-app-card-identity">
                      <div className="root-app-icon-box">
                        <Icon size={24} />
                      </div>
                      <div>
                        <div className="root-app-designation">{appDesignation}</div>
                        <h3 className="root-app-title">{appTitle}</h3>
                        <div className="root-app-subtitle">{appSubtitle}</div>
                      </div>
                    </div>
                    <span className="root-app-route-badge">{app.route}</span>
                  </div>

                  <p className="root-app-desc">{appDesc}</p>

                  {app.subModules && app.subModules.length > 0 && (
                    <div
                      className="root-app-submodules"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {app.subModules.map((sub) => {
                        const subLabel = sub.labelKey ? t(sub.labelKey) : sub.label;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            className="root-app-submodule-chip"
                            onMouseEnter={(e) =>
                              handleMouseEnterElement(e, {
                                kind: 'subRoutine',
                                label: subLabel,
                              })
                            }
                            onMouseLeave={() => onHoverMenuTarget(null)}
                            onClick={() => onLaunchApp(sub.to, `${appTitle} — ${subLabel}`)}
                          >
                            {subLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="root-app-card-footer">
                    <span className="root-app-version">
                      {t('servitor.menu.buildVersion', { version: app.version })}
                    </span>
                    <span className="root-app-launch-cta">
                      <span>{t('servitor.menu.enterSanctum')}</span>
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="root-plugin-slot-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Layers size={16} className="root-plugin-slot-icon" />
              <span>{t('servitor.menu.pluginBanner')}</span>
            </div>
            <code className="root-plugin-slot-code">src/shell/appRegistry.ts</code>
          </div>
        </section>
      </main>
    </div>
  );
};
