import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Anchor, Compass, Crosshair, Home, RefreshCw, X } from 'lucide-react';
import { REGISTERED_APPS } from './appRegistry';
import { RootMenuPage } from './RootMenuPage';
import {
  ServitorSceneController,
  type RoamingSubState,
  type ScanTargetInfo,
  type ServitorMode,
} from './ServitorScene3D';
import './shell.css';

const DEFAULT_VOX_MESSAGE = '++ AWAITING DIRECTIVE // SELECT APPLICATION ROUTE ++';

const LITANY_STATUSES = [
  'SANCTITY VERIFIED // 01001111',
  'MACHINE SPIRIT APPEASED // OK',
  'CIPHER INTEGRITY NOMINAL',
  'NOOSPHERE CHECKSUM VALID',
];

function pickVisibleDomScanTarget(lastLabelRef: React.MutableRefObject<string>): ScanTargetInfo {
  const selectors =
    '.premium-header-panel, .glass-panel, .glass-card, .secboot-var-bar, .sidebar-category';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors));
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates: ScanTargetInfo[] = [];

  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (
      rect.width < 80 ||
      rect.height < 32 ||
      rect.bottom < 60 ||
      rect.top > vh - 60 ||
      rect.right < 40 ||
      rect.left > vw - 40
    ) {
      continue;
    }

    const heading = el.querySelector('h1, h2, h3, h4, strong');
    const rawText = (heading?.textContent || el.getAttribute('aria-label') || '').trim();
    const cleaned = rawText.replace(/\s+/g, ' ').slice(0, 34).toUpperCase();
    const label = cleaned || 'PKI COGITATOR PANEL';

    const targetX = THREE.ClampFallback(
      rect.left + rect.width * (0.3 + Math.random() * 0.4),
      60,
      vw - 60
    );
    const targetY = THREE.ClampFallback(
      rect.top + Math.min(rect.height * 0.45, 90),
      60,
      vh - 60
    );

    candidates.push({ x: targetX, y: targetY, label });
  }

  if (candidates.length > 0) {
    const filtered = candidates.filter((c) => c.label !== lastLabelRef.current);
    const pool = filtered.length > 0 ? filtered : candidates;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    lastLabelRef.current = chosen.label;
    return chosen;
  }

  return {
    x: vw * (0.28 + Math.random() * 0.44),
    y: vh * (0.25 + Math.random() * 0.45),
    label: 'VIEWPORT SECTOR TELEMETRY',
  };
}

const THREE = {
  ClampFallback(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  },
};

function ShellCoordinator() {
  const location = useLocation();
  const navigate = useNavigate();

  const isRootRoute = location.pathname === '/';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<ServitorSceneController | null>(null);
  const hitButtonRef = useRef<HTMLButtonElement | null>(null);
  const scanBadgeRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const lastSkullScreenRef = useRef<{ x: number; y: number }>({ x: 220, y: 180 });
  const lastScanLabelRef = useRef<string>('');
  const pendingNavTimerRef = useRef<number | null>(null);

  const [servitorMode, setServitorMode] = useState<ServitorMode>(() =>
    isRootRoute ? 'menu' : 'roaming'
  );
  const [roamingState, setRoamingState] = useState<RoamingSubState>('patrol');
  const [isDockedPreference, setIsDockedPreference] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState<{ left: number; top: number }>({
    left: 120,
    top: 120,
  });
  const [activeScanLabel, setActiveScanLabel] = useState<string | null>(null);
  const [litanyIndex, setLitanyIndex] = useState(0);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);
  const [voxMessage, setVoxMessage] = useState(DEFAULT_VOX_MESSAGE);

  // Build lazy components once from REGISTERED_APPS
  const lazyAppRoutes = useMemo(
    () =>
      REGISTERED_APPS.map((app) => ({
        app,
        Component: lazy(app.load),
      })),
    []
  );

  // Mount persistent Three.js Servitor Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialMode: ServitorMode = window.location.pathname === '/' ? 'menu' : 'roaming';
    let ctrl: ServitorSceneController | null = null;

    try {
      ctrl = new ServitorSceneController(canvas, {
        initialMode,
        onRequestScanTarget: () => pickVisibleDomScanTarget(lastScanLabelRef),
        onTelemetry: (t) => {
          lastSkullScreenRef.current = { x: t.screenX, y: t.screenY };

          if (hitButtonRef.current) {
            const diameter = Math.round(t.hitRadius * 2.05);
            hitButtonRef.current.style.width = `${diameter}px`;
            hitButtonRef.current.style.height = `${diameter}px`;
            hitButtonRef.current.style.marginLeft = `${-Math.round(diameter / 2)}px`;
            hitButtonRef.current.style.marginTop = `${-Math.round(diameter / 2)}px`;
            hitButtonRef.current.style.transform = `translate3d(${t.screenX.toFixed(1)}px, ${t.screenY.toFixed(1)}px, 0)`;
          }

          if (scanBadgeRef.current) {
            const placeLeft = t.screenX > window.innerWidth - 310;
            const bx = placeLeft ? t.screenX - 268 : t.screenX + t.hitRadius + 14;
            const by = Math.max(16, Math.min(window.innerHeight - 76, t.screenY - 26));
            scanBadgeRef.current.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
          }

          setServitorMode((prev) => (prev === t.mode ? prev : t.mode));
          setRoamingState((prev) => (prev === t.roamingState ? prev : t.roamingState));
          setActiveScanLabel((prev) => {
            if (prev !== t.activeScanLabel && t.activeScanLabel) {
              setLitanyIndex((idx) => (idx + 1) % LITANY_STATUSES.length);
            }
            return prev === t.activeScanLabel ? prev : t.activeScanLabel;
          });
        },
      });
      controllerRef.current = ctrl;
    } catch (err) {
      console.warn('WebGL Servitor scene fallback:', err);
    }

    const onResize = () => ctrl?.handleResize();
    const onPointerMove = (e: PointerEvent) => ctrl?.setPointerScreen(e.clientX, e.clientY);

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      if (pendingNavTimerRef.current !== null) {
        window.clearTimeout(pendingNavTimerRef.current);
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      ctrl?.dispose();
      controllerRef.current = null;
    };
  }, []);

  // Keep Servitor mode synchronized with URL changes (including browser Back/Forward or sidebar "Root Menu")
  useEffect(() => {
    setQuickMenuOpen(false);
    if (isRootRoute) {
      setIsTransitioningOut(false);
      setVoxMessage(DEFAULT_VOX_MESSAGE);
      controllerRef.current?.syncRouteMode('menu');
    } else {
      controllerRef.current?.syncRouteMode('roaming');
    }
  }, [isRootRoute]);

  const closeQuickMenu = useCallback(() => {
    setQuickMenuOpen(false);
    controllerRef.current?.setRoamingSubState(isDockedPreference ? 'docked' : 'patrol');
  }, [isDockedPreference]);

  // Close quick menu on Escape or outside click
  useEffect(() => {
    if (!quickMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeQuickMenu();
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        hitButtonRef.current &&
        !hitButtonRef.current.contains(target)
      ) {
        closeQuickMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [quickMenuOpen, closeQuickMenu]);

  const handleLaunchFromRootMenu = useCallback(
    (targetUrl: string, appTitle: string) => {
      if (isTransitioningOut) return;
      setIsTransitioningOut(true);
      setVoxMessage(`++ ENGAGING TRANSIT: ${appTitle.toUpperCase()} ++`);
      controllerRef.current?.setHoveredMenuTarget(null);

      if (controllerRef.current) {
        controllerRef.current.transitionToApp();
        pendingNavTimerRef.current = window.setTimeout(() => {
          navigate(targetUrl);
        }, 420);
      } else {
        navigate(targetUrl);
      }
    },
    [isTransitioningOut, navigate]
  );

  const handleHoverMenuTarget = useCallback(
    (point: { x: number; y: number } | null, voxHint?: string) => {
      controllerRef.current?.setHoveredMenuTarget(point);
      if (!isTransitioningOut) {
        setVoxMessage(voxHint ?? DEFAULT_VOX_MESSAGE);
      }
    },
    [isTransitioningOut]
  );

  const handleFloatingSkullClick = () => {
    if (quickMenuOpen) {
      closeQuickMenu();
      return;
    }
    const { x, y } = lastSkullScreenRef.current;
    const popW = 300;
    const popH = 270;
    const preferLeft = x > window.innerWidth - (popW + 90);
    const left = Math.max(
      14,
      Math.min(window.innerWidth - popW - 14, preferLeft ? x - popW - 58 : x + 58)
    );
    const top = Math.max(14, Math.min(window.innerHeight - popH - 14, y - 55));

    setPopoverCoords({ left, top });
    setQuickMenuOpen(true);
    controllerRef.current?.setRoamingSubState('menu-open');
  };

  const handleReturnToRootHub = () => {
    setQuickMenuOpen(false);
    setIsDockedPreference(false);
    controllerRef.current?.transitionToMenu();
    navigate('/');
  };

  const handleTriggerImmediateScan = () => {
    setQuickMenuOpen(false);
    setIsDockedPreference(false);
    const target = pickVisibleDomScanTarget(lastScanLabelRef);
    controllerRef.current?.triggerManualScan(target);
  };

  const handleToggleDock = () => {
    const nextDocked = !isDockedPreference;
    setIsDockedPreference(nextDocked);
    setQuickMenuOpen(false);
    controllerRef.current?.setRoamingSubState(nextDocked ? 'docked' : 'patrol');
  };

  const showFloatingHitTarget = !isRootRoute && servitorMode === 'roaming';

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <RootMenuPage
              isTransitioningOut={isTransitioningOut}
              voxMessage={voxMessage}
              onLaunchApp={handleLaunchFromRootMenu}
              onHoverMenuTarget={handleHoverMenuTarget}
            />
          }
        />

        {lazyAppRoutes.map(({ app, Component }) => (
          <Route
            key={app.id}
            path={`${app.route}/*`}
            element={
              <div className="subapp-route-stage">
                <Suspense
                  fallback={
                    <div className="subapp-loading-screen">
                      <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#10b981' }} />
                      <span>++ INITIALIZING {app.title.toUpperCase()} ++</span>
                    </div>
                  }
                >
                  <Component />
                </Suspense>
              </div>
            }
          />
        ))}

        {/* Redirect any unknown path back to the root organizer */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Persistent Full-Viewport Transparent 3D Servitor Layer */}
      <div className="servitor-canvas-wrap" aria-hidden="true">
        <canvas ref={canvasRef} className="servitor-webgl-canvas" />
      </div>

      {/* Interactive Hit-Target & Telemetry HUD when Floating Over Plugged-In Routes */}
      {showFloatingHitTarget && (
        <>
          <button
            ref={hitButtonRef}
            type="button"
            className={`servitor-roam-hit-target ${quickMenuOpen ? 'is-active' : ''}`}
            onClick={handleFloatingSkullClick}
            onMouseEnter={() => controllerRef.current?.setSkullHovered(true)}
            onMouseLeave={() => controllerRef.current?.setSkullHovered(false)}
            aria-label="Servitor Unit IX — Open Application Menu"
          >
            <span className="servitor-roam-hover-pill">
              {isDockedPreference ? 'Docked • Click for Menu' : 'Servitor IX • Menu'}
            </span>
          </button>

          {roamingState === 'scanning' && activeScanLabel && (
            <div ref={scanBadgeRef} className="servitor-scan-telemetry" role="status">
              <div className="servitor-scan-telemetry-eyebrow">
                <span className="servitor-scan-dot" />
                <span>AUSPEX OPTIC SCAN</span>
              </div>
              <div className="servitor-scan-telemetry-target">{activeScanLabel}</div>
              <div className="servitor-scan-telemetry-sub">{LITANY_STATUSES[litanyIndex]}</div>
            </div>
          )}

          {quickMenuOpen && (
            <div
              ref={popoverRef}
              className="servitor-quick-popover"
              style={{ left: `${popoverCoords.left}px`, top: `${popoverCoords.top}px` }}
              role="dialog"
              aria-label="Servitor Quick Navigation"
            >
              <div className="servitor-quick-header">
                <div className="servitor-quick-title-group">
                  <span className="servitor-quick-eyebrow">SERVITOR UNIT IX</span>
                  <span className="servitor-quick-title">Cogitator Route Matrix</span>
                </div>
                <button
                  type="button"
                  className="servitor-quick-close"
                  onClick={closeQuickMenu}
                  aria-label="Close menu"
                >
                  <X size={15} />
                </button>
              </div>

              <button
                type="button"
                className="servitor-quick-btn primary-hub"
                onClick={handleReturnToRootHub}
              >
                <Home size={16} />
                <span>Return to Root Organizer (/)</span>
              </button>

              <div className="servitor-quick-section-label">Plugged-In Applications</div>
              <div className="servitor-quick-app-list">
                {REGISTERED_APPS.map((app) => {
                  const Icon = app.icon;
                  const isCurrent = location.pathname.startsWith(app.route);
                  return (
                    <button
                      key={app.id}
                      type="button"
                      className={`servitor-quick-btn ${isCurrent ? 'is-current' : ''}`}
                      onClick={() => {
                        closeQuickMenu();
                        if (!isCurrent) navigate(app.route);
                      }}
                    >
                      <Icon size={16} style={{ color: app.accentColor }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div>{app.title}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 400 }}>
                          {app.route} {isCurrent ? '• Active' : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="servitor-quick-section-label">Servitor Directives</div>
              <div className="servitor-quick-actions-row">
                <button
                  type="button"
                  className="servitor-quick-mini-btn"
                  onClick={handleTriggerImmediateScan}
                >
                  <Crosshair size={13} />
                  <span>Auspex Scan</span>
                </button>
                <button
                  type="button"
                  className="servitor-quick-mini-btn"
                  onClick={handleToggleDock}
                >
                  {isDockedPreference ? <Compass size={13} /> : <Anchor size={13} />}
                  <span>{isDockedPreference ? 'Resume Patrol' : 'Dock Corner'}</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export function RootShell() {
  return (
    <BrowserRouter>
      <ShellCoordinator />
    </BrowserRouter>
  );
}

export default RootShell;
