import React from 'react';
import { Cpu, ArrowRight, Sparkles, Layers } from 'lucide-react';
import { REGISTERED_APPS } from './appRegistry';

export interface RootMenuPageProps {
  isTransitioningOut: boolean;
  voxMessage: string;
  onLaunchApp: (targetUrl: string, appTitle: string) => void;
  onHoverMenuTarget: (point: { x: number; y: number } | null, voxHint?: string) => void;
}

export const RootMenuPage: React.FC<RootMenuPageProps> = ({
  isTransitioningOut,
  voxMessage,
  onLaunchApp,
  onHoverMenuTarget,
}) => {
  const handleMouseEnterElement = (e: React.MouseEvent<HTMLElement>, hint: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onHoverMenuTarget(
      {
        x: rect.left + rect.width * 0.35,
        y: rect.top + rect.height * 0.5,
      },
      hint
    );
  };

  return (
    <div className="root-sanctum-page">
      <div className="root-sanctum-grid-backdrop" aria-hidden="true" />
      <div className="root-sanctum-scanlines" aria-hidden="true" />

      <header className="root-sanctum-topbar">
        <div className="root-sanctum-brand">
          <div className="root-sanctum-cog-badge" aria-hidden="true">
            <Cpu size={19} />
          </div>
          <div className="root-sanctum-brand-text">
            <h1>Adeptus Mechanicus // Servitorium</h1>
            <span>SERVITOR STASIS-ALCOVE // NOOSPHERE CONDUIT</span>
          </div>
        </div>

        <div className="root-sanctum-status-pill">
          <span className="root-sanctum-status-dot" />
          <span>
            {REGISTERED_APPS.length} {REGISTERED_APPS.length === 1 ? 'SANCTUM' : 'SANCTUMS'} CONSECRATED
          </span>
        </div>
      </header>

      <main className="root-sanctum-stage">
        {/* Left column reserves open stage space for the 3D Warhammer Servitor Head */}
        <div className="root-sanctum-servitor-pedestal">
          <div
            className="root-sanctum-vox-caption"
            style={{ opacity: isTransitioningOut ? 0 : 1 }}
          >
            <strong>++ SERVITOR UNIT IX // VOX-CASTER ++</strong>
            {voxMessage}
          </div>
        </div>

        {/* Right column displays the interactive Holographic Organizer Menu */}
        <section
          className={`root-sanctum-menu-panel ${isTransitioningOut ? 'is-transitioning-out' : ''}`}
          aria-label="Application Menu"
        >
          <div className="root-menu-eyebrow">
            <Sparkles size={13} />
            <span>++ AVE DEUS MECHANICUS // NOOSPHERE DIRECTORY ++</span>
          </div>
          <h2 className="root-menu-heading">Cogitator Route Sanctums</h2>
          <p className="root-menu-subtitle">
            Invoke a consecrated React application below. Cranial Servitor IX-Mortis will lock its
            auspex turret onto the route, transition into the sanctum, and maintain vigil.
          </p>

          <div className="root-menu-cards">
            {REGISTERED_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <div
                  key={app.id}
                  className="root-app-card"
                  role="button"
                  tabIndex={0}
                  onMouseEnter={(e) =>
                    handleMouseEnterElement(
                      e,
                      `++ OPTIC LOCK: ${app.title.toUpperCase()} [${app.route}] ++`
                    )
                  }
                  onMouseLeave={() => onHoverMenuTarget(null)}
                  onClick={() => onLaunchApp(app.route, app.title)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onLaunchApp(app.route, app.title);
                    }
                  }}
                >
                  <div className="root-app-card-top">
                    <div className="root-app-card-identity">
                      <div className="root-app-icon-box">
                        <Icon size={24} />
                      </div>
                      <div>
                        <div className="root-app-designation">{app.designation}</div>
                        <h3 className="root-app-title">{app.title}</h3>
                        <div className="root-app-subtitle">{app.subtitle}</div>
                      </div>
                    </div>
                    <span className="root-app-route-badge">{app.route}</span>
                  </div>

                  <p className="root-app-desc">{app.description}</p>

                  {app.subModules && app.subModules.length > 0 && (
                    <div
                      className="root-app-submodules"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {app.subModules.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className="root-app-submodule-chip"
                          onMouseEnter={(e) =>
                            handleMouseEnterElement(
                              e,
                              `++ SUB-ROUTINE READY: ${sub.label.toUpperCase()} ++`
                            )
                          }
                          onMouseLeave={() => onHoverMenuTarget(null)}
                          onClick={() => onLaunchApp(sub.to, `${app.title} — ${sub.label}`)}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="root-app-card-footer">
                    <span className="root-app-version">BUILD v{app.version}</span>
                    <span className="root-app-launch-cta">
                      <span>Enter Sanctum</span>
                      <ArrowRight size={16} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="root-plugin-slot-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Layers size={16} style={{ color: '#d97706', flexShrink: 0 }} />
              <span>
                Consecrate additional React applications on custom routes via the registry.
              </span>
            </div>
            <code className="root-plugin-slot-code">src/shell/appRegistry.ts</code>
          </div>
        </section>
      </main>
    </div>
  );
};

