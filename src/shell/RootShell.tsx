import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Anchor,
  Compass,
  Cpu,
  Crosshair,
  Eye,
  EyeOff,
  Home,
  RefreshCw,
  X,
} from 'lucide-react';
import i18n from '../apps/certificate-management/i18n';
import {
  detectSystemLanguage,
  getInitialThemePreference,
  isLanguageCustomized,
  isThemeCustomized,
  normalizeLanguageTag,
  resolveEffectiveTheme,
  setUserThemePreference,
  syncSystemSettingsFromApi,
  THEME_CHANGED_EVENT,
  type ThemePreference,
} from '../apps/certificate-management/utils/systemSettings';
import { REGISTERED_APPS } from './appRegistry';
import { RootMenuPage } from './RootMenuPage';
import {
  ServitorSceneController,
  type RoamingSubState,
  type ScanTargetInfo,
  type ServitorMode,
} from './ServitorScene3D';
import type { ServitorRelayState } from './types';
import './shell.css';

interface ErrorBoundaryProps {
  onReturnHome: () => void;
  headerText: string;
  defaultErrorText: string;
  reinitializeText: string;
  returnHomeText: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class RouteStageErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Sub-application runtime fault:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="shell-error-fallback" role="alert">
          <div className="shell-error-card">
            <div className="shell-error-header">
              <AlertTriangle size={22} />
              <span>{this.props.headerText}</span>
            </div>
            <p className="shell-error-msg">
              {this.state.error.message || this.props.defaultErrorText}
            </p>
            <div className="shell-error-actions">
              <button
                type="button"
                className="servitor-quick-btn"
                onClick={() => this.setState({ error: null })}
              >
                <RefreshCw size={15} />
                <span>{this.props.reinitializeText}</span>
              </button>
              <button
                type="button"
                className="servitor-quick-btn primary-hub"
                style={{ marginBottom: 0 }}
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onReturnHome();
                }}
              >
                <Home size={15} />
                <span>{this.props.returnHomeText}</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const WORK_IDLE_COOLDOWN_MS = 5500;
const CLOAK_STORAGE_KEY = 'servitor-cloaked-preference';

const SCAN_SENTINEL_DEFAULT_PANEL = '__DEFAULT_PANEL__';
const SCAN_SENTINEL_PERIMETER = '__PERIMETER_SECTOR__';
const SCAN_SENTINEL_VIEWPORT = '__VIEWPORT_SANCTITY__';

const SCAN_STATUS_KEYS = [
  'servitor.scan.status1',
  'servitor.scan.status2',
  'servitor.scan.status3',
  'servitor.scan.status4',
] as const;

function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function isEditableElement(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

function detectSubAppModalOpen(): boolean {
  const modalSelectors =
    '.modal-overlay, .modal-backdrop, [aria-modal="true"], [role="dialog"]:not(.servitor-quick-popover)';
  const matches = document.querySelectorAll<HTMLElement>(modalSelectors);
  for (const el of matches) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 40 && rect.height > 40) {
      return true;
    }
  }
  return false;
}

function pickVisibleDomScanTarget(lastLabelRef: React.MutableRefObject<string>): ScanTargetInfo {
  const selectors = '.premium-header-panel, .glass-panel, .glass-card';
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selectors));
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const candidates: ScanTargetInfo[] = [];

  for (const el of nodes) {
    const rect = el.getBoundingClientRect();
    if (
      rect.width < 80 ||
      rect.height < 32 ||
      rect.bottom < 80 ||
      rect.top > vh - 80 ||
      rect.right < vw * 0.45 ||
      rect.left > vw - 40
    ) {
      continue;
    }

    const heading = el.querySelector('h1, h2, h3, h4, strong');
    const rawText = (heading?.textContent || el.getAttribute('aria-label') || '').trim();
    const cleaned = rawText.replace(/\s+/g, ' ').slice(0, 36);
    const label = cleaned || SCAN_SENTINEL_DEFAULT_PANEL;

    // Aim cleanly near the right edge of the panel so the scan cone never cuts across the whole screen
    const targetX = clampNum(rect.right - Math.min(rect.width * 0.2, 110), vw * 0.55, vw - 90);
    const targetY = clampNum(rect.top + Math.min(rect.height * 0.45, 75), 90, vh - 90);

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
    x: vw - 160,
    y: vh * (0.3 + Math.random() * 0.4),
    label: SCAN_SENTINEL_PERIMETER,
  };
}

function ShellCoordinator() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const isRootRoute = location.pathname === '/';

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<ServitorSceneController | null>(null);
  const dockPillRef = useRef<HTMLButtonElement | null>(null);
  const scanBadgeRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const lastScanLabelRef = useRef<string>('');
  const pendingNavTimerRef = useRef<number | null>(null);
  const idleWorkTimerRef = useRef<number | null>(null);
  const lastTelemetryRef = useRef<{
    mode: ServitorMode;
    roamingState: RoamingSubState;
    activeScanLabel: string | null;
    bx: number;
    by: number;
  }>({
    mode: isRootRoute ? 'menu' : 'roaming',
    roamingState: 'patrol',
    activeScanLabel: null,
    bx: -1,
    by: -1,
  });

  const [sceneEpoch, setSceneEpoch] = useState(0);
  const [servitorMode, setServitorMode] = useState<ServitorMode>(() =>
    isRootRoute ? 'menu' : 'roaming'
  );
  const [roamingState, setRoamingState] = useState<RoamingSubState>('patrol');
  const [isDockedPreference, setIsDockedPreference] = useState(false);
  const [isCloaked, setIsCloaked] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLOAK_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isUserWorking, setIsUserWorking] = useState(false);
  const [isSubAppModalOpen, setIsSubAppModalOpen] = useState(false);
  const [subAppFooterSlot, setSubAppFooterSlot] = useState<HTMLElement | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeScanLabel, setActiveScanLabel] = useState<string | null>(null);
  const [scanStatusIndex, setScanStatusIndex] = useState(0);
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);
  const [relayState, setRelayState] = useState<ServitorRelayState>({ kind: 'awaiting' });
  const [themePref, setThemePref] = useState<ThemePreference>(() => getInitialThemePreference());
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>(() =>
    resolveEffectiveTheme(getInitialThemePreference())
  );
  const effectiveThemeRef = useRef<'dark' | 'light'>(effectiveTheme);
  effectiveThemeRef.current = effectiveTheme;

  const lazyAppRoutes = useMemo(
    () =>
      REGISTERED_APPS.map((app) => ({
        app,
        Component: lazy(app.load),
      })),
    []
  );

  // Synchronize theme preference across shell & sub-apps + OS media query
  useEffect(() => {
    const onThemeEvent = (e: Event) => {
      const next = (e as CustomEvent<ThemePreference>).detail;
      if (next === 'dark' || next === 'light' || next === 'system') {
        setThemePref((prev) => (prev === next ? prev : next));
      }
    };
    window.addEventListener(THEME_CHANGED_EVENT, onThemeEvent);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, onThemeEvent);
  }, []);

  useEffect(() => {
    const apply = () => {
      const resolved = resolveEffectiveTheme(themePref);
      setEffectiveTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();

    if (themePref === 'system' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (window.__SYSTEM_SETTINGS__) {
          window.__SYSTEM_SETTINGS__.colorScheme = e.matches ? 'dark' : 'light';
        }
        apply();
      };
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themePref]);

  // Sync OS language & theme preference on initial mount (even when landing directly on `/`)
  useEffect(() => {
    let cancelled = false;
    syncSystemSettingsFromApi().then((sys) => {
      if (cancelled || !sys) return;
      if (!isLanguageCustomized()) {
        const osLang = detectSystemLanguage(sys);
        const currentLang = normalizeLanguageTag(i18n.resolvedLanguage || i18n.language);
        if (osLang && osLang !== currentLang) {
          i18n.changeLanguage(osLang);
        }
      }
      if (!isThemeCustomized()) {
        const resolved = resolveEffectiveTheme('system', sys);
        setEffectiveTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mount persistent Three.js Servitor Scene (and auto-recover if WebGL context is restored)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initialMode: ServitorMode = window.location.pathname === '/' ? 'menu' : 'roaming';
    let ctrl: ServitorSceneController | null = null;

    try {
      ctrl = new ServitorSceneController(canvas, {
        initialMode,
        initialTheme: effectiveThemeRef.current,
        onRequestScanTarget: () => pickVisibleDomScanTarget(lastScanLabelRef),
        onContextRestored: () => {
          setSceneEpoch((n) => n + 1);
        },
        onTelemetry: (telemetry) => {
          const prev = lastTelemetryRef.current;

          if (scanBadgeRef.current) {
            const bx = Math.max(16, telemetry.screenX - 248);
            const by = clampNum(telemetry.screenY - 22, 72, window.innerHeight - 92);
            if (Math.abs(bx - prev.bx) > 0.4 || Math.abs(by - prev.by) > 0.4) {
              prev.bx = bx;
              prev.by = by;
              scanBadgeRef.current.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
            }
          }

          if (telemetry.mode !== prev.mode) {
            prev.mode = telemetry.mode;
            setServitorMode(telemetry.mode);
          }
          if (telemetry.roamingState !== prev.roamingState) {
            prev.roamingState = telemetry.roamingState;
            setRoamingState(telemetry.roamingState);
          }
          if (telemetry.activeScanLabel !== prev.activeScanLabel) {
            prev.activeScanLabel = telemetry.activeScanLabel;
            setActiveScanLabel(telemetry.activeScanLabel);
            if (telemetry.activeScanLabel) {
              setScanStatusIndex((idx) => (idx + 1) % SCAN_STATUS_KEYS.length);
            }
          }
        },
      });
      controllerRef.current = ctrl;
    } catch (err) {
      console.warn('WebGL Servitor scene fallback:', err);
    }

    const onResize = () => ctrl?.handleResize();
    const onPointerMove = (e: PointerEvent) => ctrl?.setPointerScreen(e.clientX, e.clientY);
    const onPointerLeave = () => ctrl?.clearPointer();

    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);

    return () => {
      if (pendingNavTimerRef.current !== null) {
        window.clearTimeout(pendingNavTimerRef.current);
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mouseleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
      ctrl?.dispose();
      controllerRef.current = null;
    };
  }, [sceneEpoch]);

  // Push active theme & workspace obstruction state into the 3D controller whenever they change
  useEffect(() => {
    controllerRef.current?.setTheme(effectiveTheme);
  }, [effectiveTheme, sceneEpoch]);

  useEffect(() => {
    controllerRef.current?.setWorkspaceObstructionState({
      userWorking: !isRootRoute && isUserWorking,
      modalOpen: !isRootRoute && isSubAppModalOpen,
      cloaked: !isRootRoute && isCloaked,
    });
  }, [isRootRoute, isUserWorking, isSubAppModalOpen, isCloaked, sceneEpoch]);

  // Detect active user work (typing, scrolling, clicking, focused inputs, and open modals) inside sub-apps
  useEffect(() => {
    if (isRootRoute) {
      setIsUserWorking(false);
      setIsSubAppModalOpen(false);
      setSubAppFooterSlot(null);
      return;
    }

    const scheduleIdleRelease = () => {
      if (idleWorkTimerRef.current !== null) {
        window.clearTimeout(idleWorkTimerRef.current);
      }
      idleWorkTimerRef.current = window.setTimeout(() => {
        if (!isEditableElement(document.activeElement)) {
          setIsUserWorking(false);
        }
      }, WORK_IDLE_COOLDOWN_MS);
    };

    const flagWorkingActivity = (e?: Event) => {
      if (e && e.target instanceof Node) {
        if (
          dockPillRef.current?.contains(e.target) ||
          popoverRef.current?.contains(e.target) ||
          (e.target instanceof Element &&
            Boolean(e.target.closest('.lang-picker, .theme-toggle')))
        ) {
          return;
        }
      }
      setIsUserWorking(true);
      scheduleIdleRelease();
    };

    const handleFocusChange = () => {
      if (isEditableElement(document.activeElement)) {
        setIsUserWorking(true);
        if (idleWorkTimerRef.current !== null) {
          window.clearTimeout(idleWorkTimerRef.current);
        }
      } else {
        scheduleIdleRelease();
      }
    };

    let rafModalCheck: number | null = null;
    const scheduleModalCheck = () => {
      if (rafModalCheck !== null) return;
      rafModalCheck = window.requestAnimationFrame(() => {
        rafModalCheck = null;
        setIsSubAppModalOpen(detectSubAppModalOpen());
        const footerSlot =
          document.querySelector<HTMLElement>('.app-footer-right') ??
          document.querySelector<HTMLElement>('.app-footer-inner');
        setSubAppFooterSlot((prev) => (prev === footerSlot ? prev : footerSlot));
      });
    };

    const isServitorInternalNode = (node: Node): boolean =>
      Boolean(
        canvasWrapRef.current?.contains(node) ||
          scanBadgeRef.current?.contains(node) ||
          dockPillRef.current?.contains(node) ||
          popoverRef.current?.contains(node)
      );

    scheduleModalCheck();
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        if (!isServitorInternalNode(mutations[i].target)) {
          scheduleModalCheck();
          break;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'aria-hidden'],
    });

    window.addEventListener('wheel', flagWorkingActivity, { passive: true, capture: true });
    window.addEventListener('scroll', flagWorkingActivity, { passive: true, capture: true });
    window.addEventListener('pointerdown', flagWorkingActivity, { passive: true, capture: true });
    window.addEventListener('keydown', flagWorkingActivity, { passive: true, capture: true });
    window.addEventListener('input', flagWorkingActivity, { passive: true, capture: true });
    document.addEventListener('focusin', handleFocusChange, true);
    document.addEventListener('focusout', handleFocusChange, true);

    return () => {
      if (idleWorkTimerRef.current !== null) {
        window.clearTimeout(idleWorkTimerRef.current);
      }
      if (rafModalCheck !== null) {
        window.cancelAnimationFrame(rafModalCheck);
      }
      observer.disconnect();
      window.removeEventListener('wheel', flagWorkingActivity, true);
      window.removeEventListener('scroll', flagWorkingActivity, true);
      window.removeEventListener('pointerdown', flagWorkingActivity, true);
      window.removeEventListener('keydown', flagWorkingActivity, true);
      window.removeEventListener('input', flagWorkingActivity, true);
      document.removeEventListener('focusin', handleFocusChange, true);
      document.removeEventListener('focusout', handleFocusChange, true);
    };
  }, [isRootRoute]);

  // Keep Servitor mode synchronized with URL changes
  useEffect(() => {
    setQuickMenuOpen(false);
    if (isRootRoute) {
      setIsTransitioningOut(false);
      setRelayState({ kind: 'awaiting' });
      controllerRef.current?.syncRouteMode('menu');
    } else {
      controllerRef.current?.syncRouteMode('roaming');
    }
  }, [isRootRoute, sceneEpoch]);

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
        dockPillRef.current &&
        !dockPillRef.current.contains(target)
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
      setRelayState({ kind: 'transit', title: appTitle });
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
    (point: { x: number; y: number } | null, relayHint?: ServitorRelayState) => {
      controllerRef.current?.setHoveredMenuTarget(point);
      if (!isTransitioningOut) {
        setRelayState(relayHint ?? { kind: 'awaiting' });
      }
    },
    [isTransitioningOut]
  );

  const handleDockPillClick = () => {
    if (quickMenuOpen) {
      closeQuickMenu();
      return;
    }
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
    setIsUserWorking(false);
    if (isCloaked) {
      setIsCloaked(false);
      try {
        localStorage.setItem(CLOAK_STORAGE_KEY, 'false');
      } catch {
        // ignore storage errors
      }
    }
    const target = pickVisibleDomScanTarget(lastScanLabelRef);
    controllerRef.current?.triggerManualScan(target);
  };

  const handleToggleDock = () => {
    const nextDocked = !isDockedPreference;
    setIsDockedPreference(nextDocked);
    if (!quickMenuOpen) {
      controllerRef.current?.setRoamingSubState(nextDocked ? 'docked' : 'patrol');
    }
  };

  const handleToggleCloak = () => {
    const nextCloaked = !isCloaked;
    setIsCloaked(nextCloaked);
    try {
      localStorage.setItem(CLOAK_STORAGE_KEY, String(nextCloaked));
    } catch {
      // ignore storage errors
    }
    if (!quickMenuOpen) {
      controllerRef.current?.setRoamingSubState(isDockedPreference ? 'docked' : 'patrol');
    }
  };

  const handleToggleTheme = useCallback(() => {
    const next: ThemePreference =
      themePref === 'dark' ? 'light' : themePref === 'light' ? 'system' : 'dark';
    setThemePref(next);
    setUserThemePreference(next);
  }, [themePref]);

  const showSubAppControls = !isRootRoute && servitorMode === 'roaming';
  const showScanTelemetry =
    showSubAppControls &&
    roamingState === 'scanning' &&
    Boolean(activeScanLabel) &&
    !isUserWorking &&
    !isSubAppModalOpen &&
    !isCloaked;

  let resolvedScanTargetLabel = activeScanLabel ?? '';
  if (activeScanLabel === SCAN_SENTINEL_DEFAULT_PANEL) {
    resolvedScanTargetLabel = t('servitor.scan.defaultPanel');
  } else if (activeScanLabel === SCAN_SENTINEL_PERIMETER) {
    resolvedScanTargetLabel = t('servitor.scan.perimeterSector');
  } else if (activeScanLabel === SCAN_SENTINEL_VIEWPORT) {
    resolvedScanTargetLabel = t('servitor.scan.viewportSanctity');
  }

  let statusStateClass = 'is-vigil';
  if (isCloaked) statusStateClass = 'is-cloaked';
  else if (roamingState === 'scanning') statusStateClass = 'is-scanning';
  else if (isUserWorking || isSubAppModalOpen || isDockedPreference) statusStateClass = 'is-standby';

  const activeFooterPortalTarget =
    showSubAppControls && subAppFooterSlot && subAppFooterSlot.isConnected
      ? subAppFooterSlot
      : null;

  const dockPillButton = (
    <button
      ref={dockPillRef}
      type="button"
      className={`servitor-dock-pill ${activeFooterPortalTarget ? 'is-in-footer' : ''} ${
        quickMenuOpen ? 'is-active' : ''
      } ${statusStateClass}`}
      onClick={handleDockPillClick}
      onMouseEnter={() => controllerRef.current?.setUnitHovered(true)}
      onMouseLeave={() => controllerRef.current?.setUnitHovered(false)}
      title={t('servitor.controls.dockPillTooltip')}
      aria-label={t('servitor.controls.dockPillTooltip')}
    >
      <span className="servitor-dock-led" />
      {isCloaked ? <EyeOff size={12} /> : <Cpu size={12} />}
      <span>{t('servitor.controls.dockPillLabel')}</span>
    </button>
  );

  return (
    <>
      <RouteStageErrorBoundary
        key={location.pathname.split('/')[1] || 'servitorium'}
        onReturnHome={handleReturnToRootHub}
        headerText={t('servitor.error.header')}
        defaultErrorText={t('servitor.error.defaultMsg')}
        reinitializeText={t('servitor.error.reinitialize')}
        returnHomeText={t('servitor.controls.returnToServitorium')}
      >
        <Routes>
          <Route
            path="/"
            element={
              <RootMenuPage
                isTransitioningOut={isTransitioningOut}
                relayState={relayState}
                theme={themePref}
                onToggleTheme={handleToggleTheme}
                onLaunchApp={handleLaunchFromRootMenu}
                onHoverMenuTarget={handleHoverMenuTarget}
              />
            }
          />

          {lazyAppRoutes.map(({ app, Component }) => {
            const localizedAppTitle = app.titleKey ? t(app.titleKey) : app.title;
            return (
              <Route
                key={app.id}
                path={`${app.route}/*`}
                element={
                  <div className="subapp-route-stage">
                    <Suspense
                      fallback={
                        <div className="subapp-loading-screen">
                          <RefreshCw size={28} className="subapp-loading-spinner" />
                          <span>
                            {t('servitor.loading.initializing', {
                              title: localizedAppTitle,
                            })}
                          </span>
                        </div>
                      }
                    >
                      <Component />
                    </Suspense>
                  </div>
                }
              />
            );
          })}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouteStageErrorBoundary>

      {/* Persistent Full-Viewport Transparent 3D Servitor Layer (100% pointer-events: none) */}
      <div ref={canvasWrapRef} className="servitor-canvas-wrap" aria-hidden="true">
        <canvas ref={canvasRef} className="servitor-webgl-canvas" />
      </div>

      {/* Non-Obstructive Footer-Edge Control Pill & HUD on Plugged-In Routes */}
      {showSubAppControls && (
        <>
          {activeFooterPortalTarget
            ? createPortal(dockPillButton, activeFooterPortalTarget)
            : dockPillButton}

          {showScanTelemetry && (
            <div ref={scanBadgeRef} className="servitor-scan-telemetry" role="status">
              <div className="servitor-scan-telemetry-eyebrow">
                <span className="servitor-scan-dot" />
                <span>{t('servitor.scan.eyebrow')}</span>
              </div>
              <div className="servitor-scan-telemetry-target">{resolvedScanTargetLabel}</div>
              <div className="servitor-scan-telemetry-sub">
                {t(SCAN_STATUS_KEYS[scanStatusIndex])}
              </div>
            </div>
          )}

          {quickMenuOpen && (
            <div
              ref={popoverRef}
              className="servitor-quick-popover servitor-quick-popover-docked"
              role="dialog"
              aria-label={t('servitor.controls.quickNavAria')}
            >
              <div className="servitor-quick-header">
                <div className="servitor-quick-title-group">
                  <span className="servitor-quick-eyebrow">
                    {t('servitor.controls.unitEyebrow')}
                  </span>
                  <span className="servitor-quick-title">
                    {t('servitor.controls.routeMatrixTitle')}
                  </span>
                </div>
                <button
                  type="button"
                  className="servitor-quick-close"
                  onClick={closeQuickMenu}
                  aria-label={t('servitor.controls.closeMenuAria')}
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
                <span>{t('servitor.controls.returnToServitorium')}</span>
              </button>

              <div className="servitor-quick-section-label">
                {t('servitor.controls.consecratedSanctums')}
              </div>
              <div className="servitor-quick-app-list">
                {REGISTERED_APPS.map((app) => {
                  const Icon = app.icon;
                  const isCurrent = location.pathname.startsWith(app.route);
                  const appTitle = app.titleKey ? t(app.titleKey) : app.title;
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
                      <Icon
                        size={16}
                        className="servitor-quick-app-icon"
                        style={{ '--app-accent': app.accentColor } as React.CSSProperties}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div>{appTitle}</div>
                        <div className="servitor-quick-route-meta">
                          {app.route}{' '}
                          {isCurrent ? `• ${t('servitor.controls.activeRouteBadge')}` : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="servitor-quick-section-label">
                {t('servitor.controls.directivesSection')}
              </div>
              <div className="servitor-quick-actions-row">
                <button
                  type="button"
                  className="servitor-quick-mini-btn"
                  onClick={handleTriggerImmediateScan}
                >
                  <Crosshair size={13} />
                  <span>{t('servitor.controls.opticScanBtn')}</span>
                </button>
                <button
                  type="button"
                  className={`servitor-quick-mini-btn ${isDockedPreference ? 'is-toggled' : ''}`}
                  aria-pressed={isDockedPreference}
                  onClick={handleToggleDock}
                >
                  {isDockedPreference ? <Compass size={13} /> : <Anchor size={13} />}
                  <span>
                    {isDockedPreference
                      ? t('servitor.controls.perimeterVigilBtn')
                      : t('servitor.controls.holdCornerBtn')}
                  </span>
                </button>
              </div>

              <button
                type="button"
                className={`servitor-quick-mini-btn ${isCloaked ? 'is-toggled' : ''}`}
                aria-pressed={isCloaked}
                style={{ width: '100%', marginTop: '6px' }}
                onClick={handleToggleCloak}
              >
                {isCloaked ? <Eye size={13} /> : <EyeOff size={13} />}
                <span>
                  {isCloaked
                    ? t('servitor.controls.summonOverlayBtn')
                    : t('servitor.controls.cloakWhileWorkingBtn')}
                </span>
              </button>
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
