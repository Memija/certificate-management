import * as THREE from 'three';

export type ServitorMode = 'menu' | 'transition-to-app' | 'roaming' | 'transition-to-menu';

export type RoamingSubState = 'patrol' | 'scanning' | 'docked' | 'menu-open';

export interface ScanTargetInfo {
  /** Viewport pixel X */
  x: number;
  /** Viewport pixel Y */
  y: number;
  /** Label shown in telemetry HUD */
  label: string;
}

export interface ServitorFrameTelemetry {
  /** Skull center in viewport pixels */
  screenX: number;
  screenY: number;
  /** Approximate pixel radius of skull on screen for hit-box sizing */
  hitRadius: number;
  mode: ServitorMode;
  roamingState: RoamingSubState;
  activeScanLabel: string | null;
  scanTargetScreen: { x: number; y: number } | null;
}

interface DynamicCable {
  mesh: THREE.Mesh;
  ribRings: THREE.Mesh[];
  basePoints: THREE.Vector3[];
  phaseOffset: number;
  amp: number;
  radialSegments: number;
  radius: number;
  tipGroup?: THREE.Group;
  tipSpinMesh?: THREE.Mesh;
}

interface FleshBoneTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function createGrimdarkFleshBoneTextures(): FleshBoneTextures {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Pallid corpse-flesh / aged bone gradient (Rakarth Flesh -> Ushabti -> Nuln Oil shadow)
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#c2b39c');
  grad.addColorStop(0.38, '#b09f86');
  grad.addColorStop(0.72, '#8b7962');
  grad.addColorStop(1, '#544536');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Mottled necrotic veins, bruised violet-crimson irritation near bionics, & grime
  for (let i = 0; i < 3600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 0.7 + Math.random() * 4.5;
    const roll = Math.random();
    if (roll < 0.42) {
      ctx.fillStyle = 'rgba(38, 26, 18, 0.08)';
    } else if (roll < 0.72) {
      ctx.fillStyle = 'rgba(232, 220, 198, 0.05)';
    } else {
      // Bruised livid purple/crimson around surgical zones
      ctx.fillStyle = 'rgba(92, 32, 44, 0.065)';
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine cranial fractures & dark oil streaks dripping from sockets
  ctx.strokeStyle = 'rgba(32, 20, 14, 0.48)';
  for (let c = 0; c < 14; c++) {
    let cx = 70 + Math.random() * 370;
    let cy = 80 + Math.random() * 280;
    ctx.lineWidth = 0.8 + Math.random() * 1.3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let step = 0; step < 9; step++) {
      cx += (Math.random() - 0.5) * 22;
      cy += 6 + Math.random() * 16;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  // Imperial / Mechanicus lobotomy brand & serial tattoo on brow/cheek
  ctx.fillStyle = 'rgba(28, 20, 16, 0.58)';
  ctx.font = 'bold 12px serif';
  ctx.fillText('IX-SERV // MORTIS-LOGIS', 268, 184);
  ctx.font = 'bold 9px monospace';
  ctx.fillText('01001111 01001101 01001110', 268, 198);
  ctx.fillText('ADEPTUS MECHANICUS', 268, 211);

  // Bump map canvas for gritty pores, scars, & crevices
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 0.5 + Math.random() * 2.4;
    const v = Math.random() > 0.5 ? 168 : 88;
    bCtx.fillStyle = `rgba(${v},${v},${v},0.18)`;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();
  }

  // Deep scar grooves in bump map
  bCtx.strokeStyle = '#282828';
  bCtx.lineWidth = 2.2;
  bCtx.beginPath();
  for (let x = 90; x < 420; x += 7) {
    const y = 148 + Math.sin(x * 0.35) * 4;
    if (x === 90) bCtx.moveTo(x, y);
    else bCtx.lineTo(x, y);
  }
  bCtx.stroke();

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  return { map, bumpMap };
}

function createPittedMetalBump(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  // Pitted foundry iron & scratch marks
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.random() > 0.55 ? 185 : 60;
    ctx.fillStyle = `rgba(${v},${v},${v},0.22)`;
    ctx.fillRect(x, y, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  ctx.strokeStyle = 'rgba(215,215,215,0.28)';
  for (let s = 0; s < 45; s++) {
    ctx.lineWidth = 0.7 + Math.random();
    ctx.beginPath();
    const sx = Math.random() * 256;
    const sy = Math.random() * 256;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 40, sy + (Math.random() - 0.5) * 40);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createMarsCowlTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep Mars-Crimson heavy robes shaded with Nuln Oil soot at folds & edges
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#7c1419');
  grad.addColorStop(0.55, '#5e0d12');
  grad.addColorStop(0.88, '#38070a');
  grad.addColorStop(1, '#1d0507');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Coarse heavy fabric weave
  ctx.strokeStyle = 'rgba(20, 4, 6, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 512; i += 4) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
  }

  // Soot & oil stains
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle =
      Math.random() > 0.3 ? 'rgba(15, 5, 5, 0.09)' : 'rgba(165, 38, 42, 0.06)';
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Iconic Adeptus Mechanicus Gold Cog-Tooth Trim along the front hood opening edges (u=0, u=1, and top crown v=0)
  ctx.fillStyle = '#b68938';
  // Top crown border
  ctx.fillRect(0, 0, 512, 18);
  // Left & Right front cowl opening borders
  ctx.fillRect(0, 0, 22, 512);
  ctx.fillRect(490, 0, 22, 512);
  ctx.fillRect(34, 0, 5, 512);
  ctx.fillRect(473, 0, 5, 512);
  for (let y = 0; y < 512; y += 26) {
    ctx.fillRect(22, y, 12, 13);
    ctx.fillRect(478, y, 12, 13);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c88a19';
  ctx.fillRect(0, 0, 256, 64);

  ctx.fillStyle = '#141517';
  for (let x = -64; x < 320; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 14, 0);
    ctx.lineTo(x + 42, 64);
    ctx.lineTo(x + 28, 64);
    ctx.closePath();
    ctx.fill();
  }

  // Heavy grime & chipped paint wear
  ctx.fillStyle = 'rgba(18, 12, 8, 0.36)';
  ctx.fillRect(0, 0, 256, 11);
  ctx.fillRect(0, 53, 256, 11);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = 'rgba(30, 25, 20, 0.35)';
    ctx.fillRect(Math.random() * 256, Math.random() * 64, 3, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createParchmentTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#d2be92');
  grad.addColorStop(0.65, '#b69c6d');
  grad.addColorStop(0.9, '#7d633d');
  grad.addColorStop(1, '#362614');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  // Scorched dark edges
  ctx.strokeStyle = 'rgba(38, 22, 10, 0.75)';
  ctx.lineWidth = 6;
  ctx.strokeRect(2, 2, 124, 508);

  // Crimson Mechanicus double rubric border
  ctx.strokeStyle = 'rgba(128, 16, 22, 0.68)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(10, 12, 108, 486);

  // Gothic skull/cog header icon + dense High Gothic blackletter lines
  ctx.fillStyle = 'rgba(125, 16, 22, 0.8)';
  ctx.beginPath();
  ctx.arc(64, 42, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d2be92';
  ctx.beginPath();
  ctx.arc(64, 42, 6, 0, Math.PI * 2);
  ctx.fill();

  for (let y = 72; y < 478; y += 13) {
    const isRubric = y % 78 === 72;
    ctx.fillStyle = isRubric ? 'rgba(135, 18, 24, 0.82)' : 'rgba(32, 22, 12, 0.74)';
    const lineW = 62 + ((y * 23) % 38);
    ctx.fillRect(18, y, lineW, isRubric ? 4.5 : 2.8);
    // Faux gothic serif ticks
    for (let lx = 20; lx < 18 + lineW; lx += 9) {
      ctx.fillRect(lx, y - 1.5, 2, 5.5);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGlowSpriteTexture(innerColor: string, midColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.28, midColor);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Sculpts a gaunt, menacing Warhammer 40k Servitor cranium & upper visage:
 * overhanging scowling supraorbital brow, sharp jutting zygomatic arches,
 * deeply excavated corpse-like cheeks, pitch-dark orbital & piriform cavities,
 * and bruised inflammation around surgical implant boundaries.
 */
function sculptWarhammerCraniumGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1.0, 64, 52);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const baseBone = new THREE.Color('#ffffff');
  const pitchVoid = new THREE.Color('#0c0807');
  const gauntShadow = new THREE.Color('#5e4d42');
  const surgicalBruise = new THREE.Color('#6e3d47');

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x;
    const ny = v.y;
    const nz = v.z;

    let x = nx * 0.86;
    let y = ny * 1.08;
    let z = nz * 1.05;
    const col = baseBone.clone();

    // 1. Deep temporal fossa indentations on sides of skull behind brow
    if (ny > -0.05 && ny < 0.58 && Math.abs(nx) > 0.52) {
      const indent =
        Math.exp(-Math.pow((ny - 0.24) / 0.24, 2)) *
        Math.exp(-Math.pow((nz - 0.22) / 0.45, 2)) *
        Math.max(0, Math.abs(nx) - 0.52);
      x -= Math.sign(nx) * indent * 0.42;
      col.lerp(gauntShadow, Math.min(1, indent * 1.6));
    }

    // 2. Elongated occipital skull vault at rear
    if (nz < -0.3) {
      z -= 0.12 * Math.exp(-Math.pow((ny - 0.08) / 0.45, 2));
    }

    // 3. Dramatic gaunt narrowing of lower face below zygoma
    if (ny < -0.08) {
      const t = Math.min(1, (-ny - 0.08) / 0.92);
      x *= 1.0 - t * 0.44;
      if (nz < 0.18) {
        y += t * 0.34;
        z *= 1.0 - t * 0.28;
      }
    }

    // 4. Bruised inflammation along left surgical lobotomy seam & right bionic mount
    const seamDist = Math.abs(nx + 0.12 - ny * 0.25);
    if (ny > 0.05 && nz > 0.2 && seamDist < 0.16) {
      col.lerp(surgicalBruise, (1 - seamDist / 0.16) * 0.55);
    }

    // 5. Front facial anatomy (angry scowling brow, sharp cheekbones, deep sockets)
    if (nz > 0.32) {
      // Menacing V-angled supraorbital brow ridge (slopes lower toward glabella x=0!)
      const browTargetY = 0.22 + Math.abs(nx) * 0.16;
      const browRidge =
        Math.exp(-Math.pow((ny - browTargetY) / 0.075, 2)) *
        Math.exp(-Math.pow(nx / 0.62, 2));
      z += browRidge * 0.19;
      y -= browRidge * 0.03;

      // Glabella furrow crease right between eyebrows
      const furrow =
        Math.exp(-Math.pow(nx / 0.055, 2)) * Math.exp(-Math.pow((ny - 0.24) / 0.09, 2));
      z -= furrow * 0.07;
      col.lerp(gauntShadow, furrow * 0.7);

      // High, sharp jutting zygomatic cheekbones
      const zygoma =
        Math.exp(-Math.pow((Math.abs(nx) - 0.48) / 0.13, 2)) *
        Math.exp(-Math.pow((ny + 0.04) / 0.095, 2));
      x += Math.sign(nx) * zygoma * 0.15;
      z += zygoma * 0.13;

      // Cadaverous, deeply sunken gaunt hollows beneath cheekbones
      const gauntCheek =
        Math.exp(-Math.pow((Math.abs(nx) - 0.35) / 0.14, 2)) *
        Math.exp(-Math.pow((ny + 0.29) / 0.15, 2));
      x -= Math.sign(nx) * gauntCheek * 0.15;
      z -= gauntCheek * 0.17;
      col.lerp(gauntShadow, Math.min(1, gauntCheek * 0.95));

      // Deep, angular eye sockets
      const leftOrbit = Math.hypot((nx + 0.33) / 0.21, (ny - 0.06) / 0.165);
      const rightOrbit = Math.hypot((nx - 0.33) / 0.22, (ny - 0.06) / 0.175);
      const minOrbit = Math.min(leftOrbit, rightOrbit);
      if (minOrbit < 1.0) {
        const depth = Math.pow(1.0 - minOrbit * minOrbit, 1.15);
        z -= depth * 0.44;
        col.lerp(pitchVoid, Math.min(1, depth * 1.45));
      } else if (minOrbit < 1.22) {
        // Sharp raised bony orbital rim
        const rim = Math.sin(((minOrbit - 1.0) / 0.22) * Math.PI);
        z += rim * 0.045;
      }

      // Deep triangular piriform nasal cavity
      const noseWidth = 0.05 + Math.max(0, -ny - 0.04) * 0.38;
      const noseDist = Math.hypot(nx / Math.max(0.06, noseWidth), (ny + 0.17) / 0.17);
      if (noseDist < 1.0 && ny < 0.0) {
        const nDepth = Math.pow(1.0 - noseDist * noseDist, 1.1);
        z -= nDepth * 0.36;
        col.lerp(pitchVoid, Math.min(1, nDepth * 1.5));
      }

      // Sharp nasal bone bridge above piriform aperture
      const nasalBridge =
        Math.exp(-Math.pow(nx / 0.065, 2)) * Math.exp(-Math.pow((ny - 0.06) / 0.09, 2));
      z += nasalBridge * 0.11;
    }

    // Flatten maxilla underside where respirator muzzle clamps in
    if (y < -0.48) {
      y = -0.48 + (y + 0.48) * 0.2;
      col.lerp(gauntShadow, 0.55);
    }

    pos.setXYZ(i, x, y, z);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

export class ServitorSceneController {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rootAnchor: THREE.Group;
  private headTiltGroup: THREE.Group;
  private jawPivot: THREE.Group;
  private voxFurnaceMat: THREE.MeshStandardMaterial;
  private turretRevolverGroup: THREE.Group;
  private eyeOuterRing: THREE.Group;
  private eyeBarrel: THREE.Group;
  private eyeLensMat: THREE.MeshStandardMaterial;
  private eyeGlowSprite: THREE.Sprite;
  private eyeTipMarker: THREE.Object3D;
  private bioVialMats: THREE.MeshStandardMaterial[] = [];
  private antennaLampMat: THREE.MeshStandardMaterial;
  private censerSwingGroup: THREE.Group;
  private censerCoreMat: THREE.MeshStandardMaterial;
  private holoOrbitRings: THREE.Group;
  private holoProjectorCone: THREE.Mesh;
  private scanBeamGroup: THREE.Group;
  private scanConeMesh: THREE.Mesh;
  private scanCoreLine: THREE.Mesh;
  private scanReticleGroup: THREE.Group;
  private parchmentStrips: Array<{
    mesh: THREE.Mesh;
    baseZ: Float32Array;
    baseX: Float32Array;
    phase: number;
  }> = [];
  private cables: DynamicCable[] = [];
  private emberParticles: THREE.Points;
  private emberVelocities: Float32Array;

  private mode: ServitorMode = 'menu';
  private roamingState: RoamingSubState = 'patrol';
  private pointerNorm = new THREE.Vector2(0, 0);
  private hoveredMenuPoint: { x: number; y: number } | null = null;
  private isSkullHovered = false;

  private currentPos = new THREE.Vector3(-2.2, 0.2, 0);
  private velocity = new THREE.Vector3();
  private currentScale = 1.05;
  private currentHeadQuat = new THREE.Quaternion();

  private transitionProgress = 0;
  private transitionDuration = 1.15;
  private transitionStartPos = new THREE.Vector3();
  private transitionStartScale = 1.0;
  private onTransitionComplete: (() => void) | null = null;

  private patrolTime = 0;
  private patrolSeed = Math.random() * 100;
  private nextScanCountdown = 3.0;
  private scanTimer = 0;
  private scanDuration = 3.2;
  private activeScanTarget: ScanTargetInfo | null = null;
  private requestScanTargetCallback: (() => ScanTargetInfo | null) | null = null;

  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private disposed = false;
  private disposableTextures: THREE.Texture[] = [];
  private onTelemetry: ((telemetry: ServitorFrameTelemetry) => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    options?: {
      initialMode?: ServitorMode;
      onTelemetry?: (t: ServitorFrameTelemetry) => void;
      onRequestScanTarget?: () => ScanTargetInfo | null;
    }
  ) {
    this.onTelemetry = options?.onTelemetry ?? null;
    this.requestScanTargetCallback = options?.onRequestScanTarget ?? null;
    this.mode = options?.initialMode ?? 'menu';

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      100
    );
    this.camera.position.set(0, 0, 12.2);

    // ─── Grimdark Chiaroscuro Lighting (Candle/Furnace Key + Blood Rim + Cold Steel Fill)
    const ambient = new THREE.AmbientLight('#4a433e', 0.58);
    this.scene.add(ambient);

    const warmForgeKey = new THREE.DirectionalLight('#ffdfa8', 2.85);
    warmForgeKey.position.set(4.2, 5.2, 7.2);
    this.scene.add(warmForgeKey);

    const crimsonRim = new THREE.DirectionalLight('#dc2626', 2.1);
    crimsonRim.position.set(-6.5, 2.2, -3.5);
    this.scene.add(crimsonRim);

    const coldCryptFill = new THREE.DirectionalLight('#64748b', 0.9);
    coldCryptFill.position.set(2.5, -5.5, 3.0);
    this.scene.add(coldCryptFill);

    this.rootAnchor = new THREE.Group();
    this.scene.add(this.rootAnchor);

    this.headTiltGroup = new THREE.Group();
    this.rootAnchor.add(this.headTiltGroup);

    // ─── Procedural Grimdark PBR Textures & Materials ─────────────────────────
    const { map: fleshMap, bumpMap: fleshBump } = createGrimdarkFleshBoneTextures();
    const metalBump = createPittedMetalBump();
    const cowlTex = createMarsCowlTexture();
    const hazardTex = createHazardTexture();
    const parchmentTex = createParchmentTexture();
    const crimsonFlareTex = createGlowSpriteTexture(
      'rgba(255, 235, 225, 1)',
      'rgba(235, 18, 32, 0.78)'
    );
    this.disposableTextures.push(
      fleshMap,
      fleshBump,
      metalBump,
      cowlTex,
      hazardTex,
      parchmentTex,
      crimsonFlareTex
    );

    const servitorFleshBoneMat = new THREE.MeshStandardMaterial({
      map: fleshMap,
      bumpMap: fleshBump,
      bumpScale: 0.032,
      vertexColors: true,
      roughness: 0.76,
      metalness: 0.05,
    });

    const leadbelcherIronMat = new THREE.MeshStandardMaterial({
      color: '#26292e',
      bumpMap: metalBump,
      bumpScale: 0.028,
      roughness: 0.44,
      metalness: 0.88,
    });

    const blackenedIronMat = new THREE.MeshStandardMaterial({
      color: '#131518',
      bumpMap: metalBump,
      bumpScale: 0.024,
      roughness: 0.52,
      metalness: 0.84,
    });

    const balthasarBrassMat = new THREE.MeshStandardMaterial({
      color: '#ab7b32',
      bumpMap: metalBump,
      bumpScale: 0.018,
      roughness: 0.34,
      metalness: 0.91,
    });

    const tarnishedCopperMat = new THREE.MeshStandardMaterial({
      color: '#8f4b29',
      bumpMap: metalBump,
      bumpScale: 0.02,
      roughness: 0.39,
      metalness: 0.86,
    });

    const marsCowlMat = new THREE.MeshStandardMaterial({
      map: cowlTex,
      bumpMap: metalBump,
      bumpScale: 0.022,
      side: THREE.DoubleSide,
      roughness: 0.88,
      metalness: 0.06,
    });

    const hazardMat = new THREE.MeshStandardMaterial({
      map: hazardTex,
      bumpMap: metalBump,
      bumpScale: 0.02,
      roughness: 0.52,
      metalness: 0.45,
    });

    // ─── 1. Gaunt Sculpted Servitor Cranium & Upper Teeth ─────────────────────
    const craniumMesh = new THREE.Mesh(sculptWarhammerCraniumGeometry(), servitorFleshBoneMat);
    this.headTiltGroup.add(craniumMesh);

    // Iron surgical bridge-clamp bolted across nose bridge
    const noseClamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.12), leadbelcherIronMat);
    noseClamp.position.set(0, 0.05, 0.98);
    this.headTiltGroup.add(noseClamp);

    // ─── 2. Adeptus Mechanicus Mars-Crimson Hood/Cowl & Heavy Brass Gorget ────
    // In Three.js SphereGeometry, phi=0.5*PI is +Z (front face) and phi=1.5*PI is -Z (back of head).
    // phiStart=0.84*PI, phiLength=1.32*PI wraps the right, back, and left while leaving +Z open!
    const cowlGeom = new THREE.SphereGeometry(
      1.14,
      44,
      32,
      Math.PI * 0.84,
      Math.PI * 1.32,
      0.04,
      Math.PI * 0.78
    );
    cowlGeom.scale(0.95, 1.12, 1.09);
    // Flare lower cowl skirt outward like heavy Mechanicus vestments
    const cowlPos = cowlGeom.attributes.position;
    for (let i = 0; i < cowlPos.count; i++) {
      const cx = cowlPos.getX(i);
      const cy = cowlPos.getY(i);
      const cz = cowlPos.getZ(i);
      if (cy < -0.15) {
        const flare = Math.pow((-cy - 0.15) / 1.1, 1.25);
        cowlPos.setX(i, cx * (1 + flare * 0.36));
        cowlPos.setZ(i, cz * (1 + flare * 0.2) - flare * 0.08);
      }
      // Pointed gothic peak at top crown of hood
      if (cy > 0.72) {
        const peak = Math.exp(-Math.pow(cx / 0.36, 2)) * ((cy - 0.72) / 0.5);
        cowlPos.setY(i, cy + peak * 0.24);
        cowlPos.setZ(i, cz + peak * 0.12);
      }
    }
    cowlGeom.computeVertexNormals();
    const cowlMesh = new THREE.Mesh(cowlGeom, marsCowlMat);
    this.headTiltGroup.add(cowlMesh);

    // Heavy Riveted Iron & Brass Mechanicus Gorget Collar around neck base
    const gorgetGroup = new THREE.Group();
    gorgetGroup.position.set(0, -0.78, 0.04);
    gorgetGroup.rotation.x = 0.16;
    this.headTiltGroup.add(gorgetGroup);

    const gorgetOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.86, 0.32, 24, 1, true),
      leadbelcherIronMat
    );
    gorgetGroup.add(gorgetOuter);

    const gorgetTopBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.038, 10, 28),
      balthasarBrassMat
    );
    gorgetTopBrassRim.rotation.x = Math.PI / 2;
    gorgetTopBrassRim.position.y = 0.15;
    gorgetGroup.add(gorgetTopBrassRim);

    const gorgetBottomBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.042, 10, 28),
      balthasarBrassMat
    );
    gorgetBottomBrassRim.rotation.x = Math.PI / 2;
    gorgetBottomBrassRim.position.y = -0.15;
    gorgetGroup.add(gorgetBottomBrassRim);

    // Conical brass studs around the front of the gorget
    for (let i = -4; i <= 4; i++) {
      const a = i * 0.26;
      const stud = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.065, 6), balthasarBrassMat);
      stud.position.set(Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78);
      stud.rotation.x = Math.PI / 2;
      stud.rotation.z = -a;
      gorgetGroup.add(stud);
    }

    // ─── 3. Bolted Left Lobotomy Plate & Surgical Staples ─────────────────────
    // phi in [-0.05*PI .. 0.45*PI] covers the left-frontal hemisphere (x < 0, z > 0) right up to the staple seam!
    const lobotomyGeom = new THREE.SphereGeometry(
      1.022,
      28,
      22,
      -Math.PI * 0.05,
      Math.PI * 0.5,
      0.1,
      Math.PI * 0.44
    );
    lobotomyGeom.scale(0.87, 1.085, 1.055);
    const lobotomyPlate = new THREE.Mesh(lobotomyGeom, leadbelcherIronMat);
    this.headTiltGroup.add(lobotomyPlate);

    // Row of surgical iron staples stitching flesh directly to cranial lobotomy seam
    for (let s = 0; s < 8; s++) {
      const t = s / 7;
      const sy = 0.26 + t * 0.56;
      const sx = -0.12 - t * 0.14;
      const sz = Math.sqrt(Math.max(0.1, 1.04 - sx * sx - (sy / 1.08) * (sy / 1.08)));
      const staple = new THREE.Mesh(
        new THREE.BoxGeometry(0.085, 0.018, 0.032),
        leadbelcherIronMat
      );
      staple.position.set(sx, sy, sz);
      staple.rotation.z = 0.28;
      staple.rotation.x = -sy * 0.5;
      this.headTiltGroup.add(staple);
    }

    // ─── 4. Forehead Opus Mechanicus Cog-and-Skull Crest ──────────────────────
    const opusGroup = new THREE.Group();
    opusGroup.position.set(0, 0.52, 0.96);
    opusGroup.rotation.x = -0.36;
    this.headTiltGroup.add(opusGroup);

    const opusRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.175, 0.03, 10, 24),
      balthasarBrassMat
    );
    opusGroup.add(opusRim);

    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const cogTooth = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.062, 0.036),
        balthasarBrassMat
      );
      cogTooth.position.set(Math.cos(a) * 0.205, Math.sin(a) * 0.205, 0);
      cogTooth.rotation.z = a + Math.PI / 2;
      opusGroup.add(cogTooth);
    }

    const opusDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.028, 20),
      blackenedIronMat
    );
    opusDisc.rotation.x = Math.PI / 2;
    opusGroup.add(opusDisc);

    // Split Bone/Iron Mechanicus Skull relief at center of forehead cog
    const crestSkull = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 14, 12),
      new THREE.MeshStandardMaterial({ color: '#d8cdb8', roughness: 0.45, metalness: 0.35 })
    );
    crestSkull.scale.set(0.84, 1.08, 0.55);
    crestSkull.position.set(0, 0.015, 0.022);
    opusGroup.add(crestSkull);

    const crestJaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.05, 0.05),
      balthasarBrassMat
    );
    crestJaw.position.set(0, -0.055, 0.022);
    opusGroup.add(crestJaw);

    // ─── 5. Right Orbit: Warhammer Tri-Lens Revolver Augmetic Turret ──────────
    const turretMount = new THREE.Group();
    turretMount.position.set(0.33, 0.06, 0.76);
    turretMount.rotation.y = 0.12;
    this.headTiltGroup.add(turretMount);

    // Brutalist octagonal iron cheek/brow armor plate bolted around right socket
    const socketArmor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.34, 0.18, 8),
      leadbelcherIronMat
    );
    socketArmor.rotation.x = Math.PI / 2;
    turretMount.add(socketArmor);

    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2 + Math.PI / 8;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6),
        balthasarBrassMat
      );
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(ba) * 0.28, Math.sin(ba) * 0.28, 0.085);
      turretMount.add(bolt);
    }

    this.turretRevolverGroup = new THREE.Group();
    this.turretRevolverGroup.position.z = 0.1;
    turretMount.add(this.turretRevolverGroup);

    const revolverPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.27, 0.055, 18),
      balthasarBrassMat
    );
    revolverPlate.rotation.x = Math.PI / 2;
    this.turretRevolverGroup.add(revolverPlate);

    // PRIMARY LENS: Mammoth Blood-Crimson Telescoping Auspex Barrel with Brass Crosshairs
    const primaryHousing = new THREE.Group();
    primaryHousing.position.set(-0.03, -0.02, 0.03);
    this.turretRevolverGroup.add(primaryHousing);

    this.eyeOuterRing = new THREE.Group();
    primaryHousing.add(this.eyeOuterRing);

    const knurledRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.028, 10, 24),
      balthasarBrassMat
    );
    this.eyeOuterRing.add(knurledRing);

    for (let k = 0; k < 12; k++) {
      const ka = (k / 12) * Math.PI * 2;
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.026, 0.048, 0.05),
        blackenedIronMat
      );
      lug.position.set(Math.cos(ka) * 0.205, Math.sin(ka) * 0.205, 0);
      lug.rotation.z = ka + Math.PI / 2;
      this.eyeOuterRing.add(lug);
    }

    this.eyeBarrel = new THREE.Group();
    this.eyeBarrel.position.z = 0.11;
    primaryHousing.add(this.eyeBarrel);

    const barrelCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.148, 0.172, 0.22, 20),
      blackenedIronMat
    );
    barrelCyl.rotation.x = Math.PI / 2;
    this.eyeBarrel.add(barrelCyl);

    const barrelBrassLip = new THREE.Mesh(
      new THREE.TorusGeometry(0.148, 0.02, 10, 24),
      balthasarBrassMat
    );
    barrelBrassLip.position.z = 0.105;
    this.eyeBarrel.add(barrelBrassLip);

    // Brass targeting crosshair etched across front of crimson lens
    for (let c = 0; c < 2; c++) {
      const hair = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.009, 0.012),
        balthasarBrassMat
      );
      hair.position.z = 0.142;
      hair.rotation.z = (c * Math.PI) / 2;
      this.eyeBarrel.add(hair);
    }

    this.eyeLensMat = new THREE.MeshStandardMaterial({
      color: '#ff1424',
      emissive: '#e60018',
      emissiveIntensity: 3.4,
      roughness: 0.1,
      metalness: 0.15,
    });
    const crimsonLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.132, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      this.eyeLensMat
    );
    crimsonLens.rotation.x = Math.PI / 2;
    crimsonLens.position.z = 0.085;
    this.eyeBarrel.add(crimsonLens);

    const hotCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ffebd6' })
    );
    hotCore.position.z = 0.19;
    this.eyeBarrel.add(hotCore);

    const flareMat = new THREE.SpriteMaterial({
      map: crimsonFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    });
    this.eyeGlowSprite = new THREE.Sprite(flareMat);
    this.eyeGlowSprite.scale.set(0.88, 0.88, 1);
    this.eyeGlowSprite.position.z = 0.24;
    this.eyeBarrel.add(this.eyeGlowSprite);

    const eyeBounceLight = new THREE.PointLight('#ff1828', 2.2, 3.6);
    eyeBounceLight.position.set(0, 0, 0.35);
    this.eyeBarrel.add(eyeBounceLight);

    this.eyeTipMarker = new THREE.Object3D();
    this.eyeTipMarker.position.set(0, 0, 0.23);
    this.eyeBarrel.add(this.eyeTipMarker);

    // SECONDARY TURRET LENS: Cathode-Amber Targeter at upper-right
    const secBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.078, 0.24, 14),
      balthasarBrassMat
    );
    secBarrel.rotation.x = Math.PI / 2;
    secBarrel.position.set(0.16, 0.14, 0.11);
    this.turretRevolverGroup.add(secBarrel);

    const secLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.054, 12, 10),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 2.6,
      })
    );
    secLens.position.set(0.16, 0.14, 0.22);
    this.turretRevolverGroup.add(secLens);

    // TERTIARY TURRET LENS: Long Needle Phosphor-Green Auspex Scope at lower-right
    const tertBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 0.32, 12),
      leadbelcherIronMat
    );
    tertBarrel.rotation.x = Math.PI / 2;
    tertBarrel.position.set(0.17, -0.14, 0.14);
    this.turretRevolverGroup.add(tertBarrel);

    const tertLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.033, 10, 10),
      new THREE.MeshStandardMaterial({
        color: '#4ade80',
        emissive: '#16a34a',
        emissiveIntensity: 2.8,
      })
    );
    tertLens.position.set(0.17, -0.14, 0.3);
    this.turretRevolverGroup.add(tertLens);

    // ─── 6. Left Eye: Grimdark Slit-Visor Bionic Plug in Hollow Orbit ─────────
    const leftEyeGroup = new THREE.Group();
    leftEyeGroup.position.set(-0.32, 0.06, 0.72);
    leftEyeGroup.rotation.y = -0.15;
    this.headTiltGroup.add(leftEyeGroup);

    const visorCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.175, 0.195, 0.11, 14),
      blackenedIronMat
    );
    visorCup.rotation.x = Math.PI / 2;
    leftEyeGroup.add(visorCup);

    const visorSlitBarTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.065, 0.05),
      leadbelcherIronMat
    );
    visorSlitBarTop.position.set(0, 0.042, 0.055);
    leftEyeGroup.add(visorSlitBarTop);

    const visorSlitBarBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.065, 0.05),
      leadbelcherIronMat
    );
    visorSlitBarBot.position.set(0, -0.042, 0.055);
    leftEyeGroup.add(visorSlitBarBot);

    const visorRedSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.022, 0.04),
      new THREE.MeshStandardMaterial({
        color: '#ff2436',
        emissive: '#dc2626',
        emissiveIntensity: 2.9,
      })
    );
    visorRedSlit.position.set(0, 0, 0.052);
    leftEyeGroup.add(visorRedSlit);

    // ─── 7. Brutalist Warhammer Vox-Respirator Jaw-Cage & Twin Canisters ──────
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.32, 0.16);
    this.headTiltGroup.add(this.jawPivot);

    // Hydraulic cheek-pistons clamping respirator mask onto zygomatic arches
    for (const side of [-1, 1]) {
      const pistonOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.36, 10),
        balthasarBrassMat
      );
      pistonOuter.position.set(side * 0.46, -0.08, 0.28);
      pistonOuter.rotation.x = 0.48;
      pistonOuter.rotation.z = side * 0.22;
      this.jawPivot.add(pistonOuter);
    }

    // Heavy trapezoidal iron respirator muzzle shell
    const muzzleGeom = new THREE.CylinderGeometry(
      0.34,
      0.42,
      0.44,
      6,
      1,
      false,
      -Math.PI * 0.5,
      Math.PI
    );
    const muzzleShell = new THREE.Mesh(muzzleGeom, leadbelcherIronMat);
    muzzleShell.position.set(0, -0.28, 0.44);
    this.jawPivot.add(muzzleShell);

    const muzzleBrassTrimTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.055, 0.32),
      balthasarBrassMat
    );
    muzzleBrassTrimTop.position.set(0, -0.07, 0.56);
    this.jawPivot.add(muzzleBrassTrimTop);

    const muzzleChinProw = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.11, 0.38),
      balthasarBrassMat
    );
    muzzleChinProw.position.set(0, -0.49, 0.56);
    this.jawPivot.add(muzzleChinProw);

    // Glowing Furnace-Amber / Cathode Vox-Core behind iron grille teeth
    this.voxFurnaceMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#ea580c',
      emissiveIntensity: 2.1,
      roughness: 0.3,
    });
    const voxCore = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.16), this.voxFurnaceMat);
    voxCore.position.set(0, -0.28, 0.62);
    this.jawPivot.add(voxCore);

    // 9 Brutalist vertical iron grille teeth bars across mouth grate
    for (let g = -4; g <= 4; g++) {
      const a = g * 0.115;
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.33, 0.055),
        blackenedIronMat
      );
      bar.position.set(Math.sin(a) * 0.39, -0.28, 0.69 + Math.cos(a) * 0.09);
      bar.rotation.y = a;
      this.jawPivot.add(bar);
    }

    // Twin Lateral Hazard-Striped Gas-Filter Canisters + Ribbed Throat Hoses
    for (const side of [-1, 1]) {
      const canisterGroup = new THREE.Group();
      canisterGroup.position.set(side * 0.46, -0.32, 0.48);
      canisterGroup.rotation.z = side * 0.48;
      canisterGroup.rotation.y = side * 0.42;
      this.jawPivot.add(canisterGroup);

      const canBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.125, 0.24, 16),
        hazardMat
      );
      canisterGroup.add(canBody);

      const canCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.045, 16),
        balthasarBrassMat
      );
      canCap.position.y = -0.12;
      canisterGroup.add(canCap);

      // Corrugated hose curving from canister into gorget
      const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.52, -0.4, 0.42),
        new THREE.Vector3(side * 0.66, -0.58, 0.28),
        new THREE.Vector3(side * 0.52, -0.74, 0.12),
      ]);
      const hoseMesh = new THREE.Mesh(
        new THREE.TubeGeometry(hoseCurve, 14, 0.058, 10, false),
        blackenedIronMat
      );
      this.headTiltGroup.add(hoseMesh);

      for (let r = 1; r <= 6; r++) {
        const pt = hoseCurve.getPoint(r / 7);
        const tangent = hoseCurve.getTangent(r / 7);
        const rib = new THREE.Mesh(
          new THREE.TorusGeometry(0.064, 0.014, 6, 14),
          tarnishedCopperMat
        );
        rib.position.copy(pt);
        rib.lookAt(pt.clone().add(tangent));
        this.headTiltGroup.add(rib);
      }
    }

    // ─── 8. Cranial Bio-Chem Stim Vials & Gothic Vox-Mast Antenna ─────────────
    // Glowing alchemical glass vials in brass cages bolted right through the upper-right cowl
    const vialConfigs = [
      { pos: [0.86, 0.84, 0.06] as const, rotZ: -0.56, rotX: -0.12, color: '#4ade80', em: '#16a34a' },
      { pos: [1.02, 0.54, -0.14] as const, rotZ: -0.86, rotX: -0.22, color: '#fbbf24', em: '#d97706' },
    ];

    vialConfigs.forEach((vc) => {
      const vGroup = new THREE.Group();
      vGroup.position.set(vc.pos[0], vc.pos[1], vc.pos[2]);
      vGroup.rotation.z = vc.rotZ;
      vGroup.rotation.x = vc.rotX;
      this.headTiltGroup.add(vGroup);

      const socketCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.11, 0.12, 12),
        balthasarBrassMat
      );
      vGroup.add(socketCollar);

      const fluidMat = new THREE.MeshStandardMaterial({
        color: vc.color,
        emissive: vc.em,
        emissiveIntensity: 2.4,
        roughness: 0.15,
      });
      this.bioVialMats.push(fluidMat);

      const fluidCore = new THREE.Mesh(
        new THREE.CylinderGeometry(0.062, 0.062, 0.28, 14),
        fluidMat
      );
      fluidCore.position.y = 0.18;
      vGroup.add(fluidCore);

      const topCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.088, 0.06, 12),
        balthasarBrassMat
      );
      topCap.position.y = 0.34;
      vGroup.add(topCap);

      // 4 protective brass cage bars around vial
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2;
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.28, 6),
          balthasarBrassMat
        );
        strut.position.set(Math.cos(ba) * 0.078, 0.18, Math.sin(ba) * 0.078);
        vGroup.add(strut);
      }
    });

    // Imperial Gothic Cross-Barred Vox-Mast Antenna bolted through Left Cowl
    const mastGroup = new THREE.Group();
    mastGroup.position.set(-0.84, 0.88, -0.06);
    mastGroup.rotation.z = 0.32;
    this.headTiltGroup.add(mastGroup);

    const mastSocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.1, 0.16, 10),
      balthasarBrassMat
    );
    mastGroup.add(mastSocket);

    const mastSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.032, 0.96, 8),
      leadbelcherIronMat
    );
    mastSpire.position.y = 0.52;
    mastGroup.add(mastSpire);

    // Gothic cross-bars on antenna mast
    for (const barY of [0.46, 0.72]) {
      const barW = barY > 0.6 ? 0.22 : 0.32;
      const crossBar = new THREE.Mesh(
        new THREE.BoxGeometry(barW, 0.022, 0.022),
        balthasarBrassMat
      );
      crossBar.position.y = barY;
      mastGroup.add(crossBar);
    }

    this.antennaLampMat = new THREE.MeshStandardMaterial({
      color: '#ff2436',
      emissive: '#dc2626',
      emissiveIntensity: 3.0,
    });
    const mastLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 10, 10),
      this.antennaLampMat
    );
    mastLamp.position.y = 1.02;
    mastGroup.add(mastLamp);

    // ─── 9. Double Crimson Wax Purity Seals & Long Ragged Litany Scrolls ──────
    const waxMat = new THREE.MeshStandardMaterial({
      color: '#840d18',
      bumpMap: metalBump,
      bumpScale: 0.025,
      roughness: 0.45,
      metalness: 0.1,
    });
    const parchmentMat = new THREE.MeshStandardMaterial({
      map: parchmentTex,
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0.02,
    });

    const sealPlacements = [
      { pos: [-0.66, -0.58, 0.56] as const, rotY: -0.45, rotZ: -0.08, lengths: [0.95, 0.76] },
      { pos: [0.68, -0.62, 0.48] as const, rotY: 0.52, rotZ: 0.1, lengths: [0.82] },
    ];

    sealPlacements.forEach((sp, spIdx) => {
      const sealAnchor = new THREE.Group();
      sealAnchor.position.set(sp.pos[0], sp.pos[1], sp.pos[2]);
      sealAnchor.rotation.y = sp.rotY;
      sealAnchor.rotation.z = sp.rotZ;
      this.headTiltGroup.add(sealAnchor);

      const waxStamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.145, 0.05, 18),
        waxMat
      );
      waxStamp.rotation.x = Math.PI / 2;
      waxStamp.position.z = 0.035;
      sealAnchor.add(waxStamp);

      const waxLip = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.026, 8, 18), waxMat);
      waxLip.position.z = 0.055;
      sealAnchor.add(waxLip);

      sp.lengths.forEach((len, lIdx) => {
        const stripGeom = new THREE.PlaneGeometry(0.175, len, 2, 16);
        stripGeom.translate(lIdx === 0 ? -0.03 : 0.055, -len * 0.5, lIdx === 0 ? 0.012 : -0.01);
        const posAttr = stripGeom.attributes.position;
        const baseZ = new Float32Array(posAttr.count);
        const baseX = new Float32Array(posAttr.count);
        for (let k = 0; k < posAttr.count; k++) {
          baseX[k] = posAttr.getX(k);
          baseZ[k] = posAttr.getZ(k);
        }
        const stripMesh = new THREE.Mesh(stripGeom, parchmentMat);
        stripMesh.rotation.z = (lIdx === 0 ? -0.08 : 0.11) + spIdx * 0.04;
        sealAnchor.add(stripMesh);
        this.parchmentStrips.push({
          mesh: stripMesh,
          baseZ,
          baseX,
          phase: spIdx * 2.1 + lIdx * 1.4,
        });
      });
    });

    // ─── 10. Underside Gothic Brass Grav-Thurible (Incense Censer) ────────────
    this.censerSwingGroup = new THREE.Group();
    this.censerSwingGroup.position.set(0, -0.94, 0.02);
    this.headTiltGroup.add(this.censerSwingGroup);

    // 3 Suspension chains connecting gorget underside to thurible
    for (let ch = 0; ch < 3; ch++) {
      const ca = (ch / 3) * Math.PI * 2;
      const chainRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.34, 6),
        blackenedIronMat
      );
      chainRod.position.set(Math.cos(ca) * 0.22, -0.15, Math.sin(ca) * 0.22);
      chainRod.rotation.z = Math.cos(ca) * 0.22;
      chainRod.rotation.x = -Math.sin(ca) * 0.22;
      this.censerSwingGroup.add(chainRod);
    }

    const thuribleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.14, 0.34, 8),
      balthasarBrassMat
    );
    thuribleBody.position.y = -0.4;
    this.censerSwingGroup.add(thuribleBody);

    const thuribleSpike = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.22, 8),
      balthasarBrassMat
    );
    thuribleSpike.rotation.x = Math.PI;
    thuribleSpike.position.y = -0.68;
    this.censerSwingGroup.add(thuribleSpike);

    this.censerCoreMat = new THREE.MeshStandardMaterial({
      color: '#fb923c',
      emissive: '#ea580c',
      emissiveIntensity: 3.2,
    });
    const censerEmberCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      this.censerCoreMat
    );
    censerEmberCore.position.y = -0.36;
    this.censerSwingGroup.add(censerEmberCore);

    const censerWarmLight = new THREE.PointLight('#f97316', 1.4, 3.0);
    censerWarmLight.position.set(0, -0.45, 0.2);
    this.censerSwingGroup.add(censerWarmLight);

    // ─── 11. Segmented Ribbed Mechadendrites (Servo-Claw + Chirurgeon Buzz-Saw)
    const cableDefs: Array<{
      pts: [number, number, number][];
      radius: number;
      mat: THREE.Material;
      tipType?: 'claw' | 'saw' | 'probe';
    }> = [
      {
        pts: [
          [0.54, -0.82, -0.12],
          [0.88, -1.24, -0.18],
          [0.82, -1.78, 0.06],
          [0.95, -2.22, 0.34],
        ],
        radius: 0.062,
        mat: leadbelcherIronMat,
        tipType: 'claw',
      },
      {
        pts: [
          [-0.54, -0.82, -0.12],
          [-0.86, -1.28, -0.22],
          [-0.78, -1.82, 0.04],
          [-0.88, -2.26, 0.3],
        ],
        radius: 0.058,
        mat: leadbelcherIronMat,
        tipType: 'saw',
      },
      {
        pts: [
          [0.24, -0.88, -0.34],
          [0.36, -1.46, -0.52],
          [0.22, -2.04, -0.38],
          [0.3, -2.52, -0.2],
        ],
        radius: 0.046,
        mat: hazardMat,
        tipType: 'probe',
      },
      {
        pts: [
          [-0.24, -0.88, -0.34],
          [-0.38, -1.48, -0.48],
          [-0.26, -2.06, -0.36],
          [-0.18, -2.55, -0.22],
        ],
        radius: 0.048,
        mat: tarnishedCopperMat,
      },
      {
        pts: [
          [0.0, -0.92, -0.42],
          [0.05, -1.55, -0.62],
          [-0.04, -2.18, -0.52],
          [0.02, -2.72, -0.35],
        ],
        radius: 0.068,
        mat: blackenedIronMat,
      },
    ];

    cableDefs.forEach((cfg, idx) => {
      const basePoints = cfg.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      const curve = new THREE.CatmullRomCurve3(basePoints);
      const geom = new THREE.TubeGeometry(curve, 20, cfg.radius, 8, false);
      const mesh = new THREE.Mesh(geom, cfg.mat);
      this.rootAnchor.add(mesh);

      // Segmented brass/steel vertebral rings along the mechadendrite
      const ribRings: THREE.Mesh[] = [];
      const ringCount = 6;
      for (let r = 1; r <= ringCount; r++) {
        const ringMesh = new THREE.Mesh(
          new THREE.TorusGeometry(cfg.radius * 1.24, 0.015, 6, 12),
          r % 2 === 0 ? balthasarBrassMat : leadbelcherIronMat
        );
        this.rootAnchor.add(ringMesh);
        ribRings.push(ringMesh);
      }

      let tipGroup: THREE.Group | undefined;
      let tipSpinMesh: THREE.Mesh | undefined;

      if (cfg.tipType === 'claw') {
        tipGroup = new THREE.Group();
        const wrist = new THREE.Mesh(
          new THREE.CylinderGeometry(0.095, 0.075, 0.14, 10),
          balthasarBrassMat
        );
        tipGroup.add(wrist);
        for (let p = 0; p < 3; p++) {
          const a = (p / 3) * Math.PI * 2;
          const talon = new THREE.Mesh(
            new THREE.ConeGeometry(0.032, 0.24, 5),
            leadbelcherIronMat
          );
          talon.position.set(Math.cos(a) * 0.08, -0.15, Math.sin(a) * 0.08);
          talon.rotation.x = Math.PI + Math.sin(a) * 0.38;
          talon.rotation.z = -Math.cos(a) * 0.38;
          tipGroup.add(talon);
        }
        this.rootAnchor.add(tipGroup);
      } else if (cfg.tipType === 'saw') {
        tipGroup = new THREE.Group();
        const housing = new THREE.Mesh(
          new THREE.BoxGeometry(0.13, 0.16, 0.09),
          balthasarBrassMat
        );
        tipGroup.add(housing);

        // Spinning toothed Chirurgeon bone-saw disc!
        const sawGroup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.018, 16),
          leadbelcherIronMat
        );
        sawGroup.rotation.z = Math.PI / 2;
        sawGroup.position.y = -0.15;
        for (let st = 0; st < 12; st++) {
          const sa = (st / 12) * Math.PI * 2;
          const tooth = new THREE.Mesh(
            new THREE.ConeGeometry(0.025, 0.055, 4),
            leadbelcherIronMat
          );
          tooth.position.set(Math.cos(sa) * 0.17, 0, Math.sin(sa) * 0.17);
          tooth.rotation.z = -Math.PI / 2;
          tooth.rotation.y = -sa;
          sawGroup.add(tooth);
        }
        tipGroup.add(sawGroup);
        tipSpinMesh = sawGroup;
        this.rootAnchor.add(tipGroup);
      } else if (cfg.tipType === 'probe') {
        tipGroup = new THREE.Group();
        const needle = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.28, 8),
          balthasarBrassMat
        );
        needle.rotation.x = Math.PI;
        needle.position.y = -0.12;
        tipGroup.add(needle);
        this.rootAnchor.add(tipGroup);
      }

      this.cables.push({
        mesh,
        ribRings,
        basePoints,
        phaseOffset: idx * 1.35,
        amp: 0.11 + idx * 0.018,
        radialSegments: 8,
        radius: cfg.radius,
        tipGroup,
        tipSpinMesh,
      });
    });

    // ─── 12. Mechanicus Brass/Crimson Noosphere Orbit Rings & Hololith Cone ───
    this.holoOrbitRings = new THREE.Group();
    this.rootAnchor.add(this.holoOrbitRings);

    const orbitRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.78, 0.011, 8, 64),
      new THREE.MeshBasicMaterial({
        color: '#dc2626',
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    orbitRing1.rotation.x = 1.18;
    orbitRing1.rotation.y = 0.28;
    this.holoOrbitRings.add(orbitRing1);

    const orbitRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.009, 8, 64),
      new THREE.MeshBasicMaterial({
        color: '#d97706',
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    orbitRing2.rotation.x = -0.95;
    orbitRing2.rotation.z = 0.42;
    this.holoOrbitRings.add(orbitRing2);

    const holoConeGeom = new THREE.ConeGeometry(1.3, 4.2, 28, 1, true);
    holoConeGeom.translate(0, -2.1, 0);
    holoConeGeom.rotateX(-Math.PI / 2);
    this.holoProjectorCone = new THREE.Mesh(
      holoConeGeom,
      new THREE.MeshBasicMaterial({
        color: '#dc2626',
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.eyeBarrel.add(this.holoProjectorCone);

    // ─── 13. World-Space Volumetric Blood-Crimson Auspex Scan Beam ────────────
    this.scanBeamGroup = new THREE.Group();
    this.scanBeamGroup.visible = false;
    this.scene.add(this.scanBeamGroup);

    const scanConeGeom = new THREE.ConeGeometry(0.35, 1.0, 28, 1, true);
    scanConeGeom.rotateX(-Math.PI / 2);
    scanConeGeom.translate(0, 0, 0.5);
    this.scanConeMesh = new THREE.Mesh(
      scanConeGeom,
      new THREE.MeshBasicMaterial({
        color: '#ef1a2d',
        transparent: true,
        opacity: 0.19,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scanBeamGroup.add(this.scanConeMesh);

    const coreCylGeom = new THREE.CylinderGeometry(0.018, 0.009, 1.0, 8);
    coreCylGeom.rotateX(Math.PI / 2);
    coreCylGeom.translate(0, 0, 0.5);
    this.scanCoreLine = new THREE.Mesh(
      coreCylGeom,
      new THREE.MeshBasicMaterial({
        color: '#ff858f',
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scanBeamGroup.add(this.scanCoreLine);

    this.scanReticleGroup = new THREE.Group();
    this.scanReticleGroup.visible = false;
    this.scene.add(this.scanReticleGroup);

    const retOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.365, 32),
      new THREE.MeshBasicMaterial({
        color: '#ef1a2d',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scanReticleGroup.add(retOuter);

    const retInner = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.165, 8),
      new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scanReticleGroup.add(retInner);

    // ─── 14. Rising Thurible Incense Embers & Forge Sparks ────────────────────
    const emberCount = 46;
    const emberPos = new Float32Array(emberCount * 3);
    this.emberVelocities = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = (Math.random() - 0.5) * 2.2;
      emberPos[i * 3 + 1] = -2.2 + Math.random() * 3.8;
      emberPos[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
      this.emberVelocities[i] = 0.25 + Math.random() * 0.45;
    }
    const emberGeom = new THREE.BufferGeometry();
    emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    this.emberParticles = new THREE.Points(
      emberGeom,
      new THREE.PointsMaterial({
        color: '#f59e0b',
        size: 0.052,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootAnchor.add(this.emberParticles);

    this.snapToModeInitialPose();
    this.startLoop();
  }

  private getMenuAnchorWorld(): { pos: THREE.Vector3; scale: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 960) {
      const pos = this.screenToWorld(w * 0.5, h * 0.23, 0);
      return { pos, scale: 0.62 };
    }
    const pos = this.screenToWorld(w * 0.27, h * 0.46, 0);
    return { pos, scale: 1.02 };
  }

  private computePatrolWorldPos(t: number): THREE.Vector3 {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const marginX = Math.min(130, w * 0.14);
    const marginY = Math.min(115, h * 0.14);

    const s = t * 0.25 + this.patrolSeed;
    const nx = 0.5 + 0.42 * Math.cos(s) + 0.08 * Math.cos(s * 3);
    const ny = 0.46 + 0.36 * Math.sin(s * 1.7) + 0.06 * Math.sin(s * 2.3);

    const px = THREE.MathUtils.clamp(nx * w, marginX, w - marginX);
    const py = THREE.MathUtils.clamp(ny * h, marginY, h - marginY);
    return this.screenToWorld(px, py, 0);
  }

  private computeDockedWorldPos(): THREE.Vector3 {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return this.screenToWorld(w - 94, h - 108, 0);
  }

  private snapToModeInitialPose() {
    if (this.mode === 'menu') {
      const { pos, scale } = this.getMenuAnchorWorld();
      this.currentPos.copy(pos);
      this.currentScale = scale;
    } else {
      const pos = this.computePatrolWorldPos(0);
      this.currentPos.copy(pos);
      this.currentScale = 0.34;
    }
    this.rootAnchor.position.copy(this.currentPos);
    this.rootAnchor.scale.setScalar(this.currentScale);
  }

  public screenToWorld(px: number, py: number, targetZ = 0): THREE.Vector3 {
    const ndcX = (px / Math.max(1, window.innerWidth)) * 2 - 1;
    const ndcY = -(py / Math.max(1, window.innerHeight)) * 2 + 1;
    const vec = new THREE.Vector3(ndcX, ndcY, 0.5);
    vec.unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const distance = (targetZ - this.camera.position.z) / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(distance));
  }

  public worldToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
    const projected = worldPos.clone().project(this.camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  public handleResize() {
    if (this.disposed) return;
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public setPointerScreen(px: number, py: number) {
    this.pointerNorm.set(
      (px / Math.max(1, window.innerWidth)) * 2 - 1,
      -(py / Math.max(1, window.innerHeight)) * 2 + 1
    );
  }

  public setHoveredMenuTarget(point: { x: number; y: number } | null) {
    this.hoveredMenuPoint = point;
  }

  public setSkullHovered(hovered: boolean) {
    this.isSkullHovered = hovered;
  }

  public setRoamingSubState(nextState: RoamingSubState) {
    this.roamingState = nextState;
    if (nextState !== 'scanning') {
      this.activeScanTarget = null;
    }
  }

  public triggerManualScan(target: ScanTargetInfo | null) {
    if (this.mode !== 'roaming') return;
    const resolved =
      target ??
      this.requestScanTargetCallback?.() ?? {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.42,
        label: 'COGITATOR VIEWPORT SANCTITY',
      };
    this.activeScanTarget = resolved;
    this.roamingState = 'scanning';
    this.scanTimer = 0;
  }

  public syncRouteMode(targetMode: 'menu' | 'roaming') {
    if (targetMode === 'menu' && this.mode !== 'menu' && this.mode !== 'transition-to-menu') {
      this.transitionToMenu();
    } else if (
      targetMode === 'roaming' &&
      this.mode !== 'roaming' &&
      this.mode !== 'transition-to-app'
    ) {
      this.mode = 'roaming';
      this.roamingState = 'patrol';
      this.nextScanCountdown = 2.4;
    }
  }

  public transitionToApp(onComplete?: () => void) {
    this.transitionStartPos.copy(this.currentPos);
    this.transitionStartScale = this.currentScale;
    this.transitionProgress = 0;
    this.transitionDuration = 1.15;
    this.onTransitionComplete = onComplete ?? null;
    this.mode = 'transition-to-app';
    this.activeScanTarget = null;
  }

  public transitionToMenu(onComplete?: () => void) {
    this.transitionStartPos.copy(this.currentPos);
    this.transitionStartScale = this.currentScale;
    this.transitionProgress = 0;
    this.transitionDuration = 0.95;
    this.onTransitionComplete = onComplete ?? null;
    this.mode = 'transition-to-menu';
    this.activeScanTarget = null;
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;
      this.update(dt, elapsed);
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number, elapsed: number) {
    const prevPos = this.currentPos.clone();
    let desiredScale = this.currentScale;
    const lookTargetWorld = new THREE.Vector3(0, 0, 9);
    let jawChatterAmount = 0;
    let lensSpinSpeed = 0.6;
    let barrelExtend = 0.11;
    let turretAngleTarget = 0;

    if (this.mode === 'menu') {
      const { pos: anchorPos, scale } = this.getMenuAnchorWorld();
      // Heavy mechanical antigrav bobbing
      const bobPos = anchorPos
        .clone()
        .add(new THREE.Vector3(Math.sin(elapsed * 0.95) * 0.08, Math.sin(elapsed * 1.75) * 0.13, 0));
      this.currentPos.lerp(bobPos, 1 - Math.exp(-4.2 * dt));
      desiredScale = scale;

      if (this.hoveredMenuPoint) {
        const wPt = this.screenToWorld(this.hoveredMenuPoint.x, this.hoveredMenuPoint.y, 2.5);
        lookTargetWorld.copy(wPt);
        lensSpinSpeed = 2.8;
        barrelExtend = 0.2;
        jawChatterAmount = 0.42;
        turretAngleTarget = 0.26;
      } else {
        lookTargetWorld.set(
          this.currentPos.x + 2.3 + this.pointerNorm.x * 2.1,
          this.currentPos.y + this.pointerNorm.y * 1.5,
          6.8
        );
        jawChatterAmount = 0.14;
        // Occasional mechanical turret index twitch
        turretAngleTarget = Math.sin(elapsed * 0.7) > 0.82 ? -0.32 : 0;
      }
    } else if (this.mode === 'transition-to-app') {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.transitionDuration);
      const p = this.transitionProgress;
      const ease = p < 0.5 ? 16 * p * p * p * p * p : 1 - Math.pow(-2 * p + 2, 5) / 2;

      const endPos = this.computePatrolWorldPos(this.patrolTime);
      const swoopZ = Math.sin(p * Math.PI) * 3.2;
      const arcLiftY = Math.sin(p * Math.PI) * 0.82;

      this.currentPos.lerpVectors(this.transitionStartPos, endPos, ease);
      this.currentPos.y += arcLiftY;
      this.currentPos.z = swoopZ;

      desiredScale = THREE.MathUtils.lerp(this.transitionStartScale, 0.34, ease);
      lookTargetWorld.set(0, 0, 12);
      lensSpinSpeed = 6.0;
      barrelExtend = 0.23;
      jawChatterAmount = 0.9;
      turretAngleTarget = Math.PI * 0.25;

      if (this.transitionProgress >= 1) {
        this.mode = 'roaming';
        this.roamingState = 'patrol';
        this.nextScanCountdown = 1.8;
        const cb = this.onTransitionComplete;
        this.onTransitionComplete = null;
        cb?.();
      }
    } else if (this.mode === 'transition-to-menu') {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.transitionDuration);
      const p = this.transitionProgress;
      const ease = 1 - Math.pow(1 - p, 4);
      const { pos: menuPos, scale: menuScale } = this.getMenuAnchorWorld();

      this.currentPos.lerpVectors(this.transitionStartPos, menuPos, ease);
      this.currentPos.z = Math.sin(p * Math.PI) * 2.1;
      desiredScale = THREE.MathUtils.lerp(this.transitionStartScale, menuScale, ease);
      lookTargetWorld.set(0, 0, 11);
      lensSpinSpeed = 4.0;
      jawChatterAmount = 0.55;

      if (this.transitionProgress >= 1) {
        this.mode = 'menu';
        const cb = this.onTransitionComplete;
        this.onTransitionComplete = null;
        cb?.();
      }
    } else {
      // ROAMING MODE
      desiredScale = this.isSkullHovered || this.roamingState === 'menu-open' ? 0.39 : 0.34;

      if (this.roamingState === 'patrol') {
        this.patrolTime += dt;
        const targetPos = this.computePatrolWorldPos(this.patrolTime);
        targetPos.y += Math.sin(elapsed * 2.4) * 0.08;
        this.currentPos.lerp(targetPos, 1 - Math.exp(-2.5 * dt));

        const futurePos = this.computePatrolWorldPos(this.patrolTime + 0.9);
        lookTargetWorld.set(
          futurePos.x * 0.75 + this.pointerNorm.x * 0.8,
          futurePos.y * 0.75 + this.pointerNorm.y * 0.6,
          5.8
        );

        this.nextScanCountdown -= dt;
        if (this.nextScanCountdown <= 0) {
          const candidate = this.requestScanTargetCallback?.() ?? null;
          if (candidate) {
            this.activeScanTarget = candidate;
            this.roamingState = 'scanning';
            this.scanTimer = 0;
          } else {
            this.nextScanCountdown = 4.0;
          }
        }
      } else if (this.roamingState === 'scanning') {
        this.scanTimer += dt;
        const hoverOffset = new THREE.Vector3(
          Math.sin(elapsed * 1.8) * 0.02,
          Math.cos(elapsed * 2.6) * 0.03,
          0
        );
        this.currentPos.addScaledVector(hoverOffset, dt * 2.4);

        if (this.activeScanTarget) {
          const sweepX = this.activeScanTarget.x + Math.sin(this.scanTimer * 3.6) * 44;
          const sweepY = this.activeScanTarget.y + Math.cos(this.scanTimer * 2.4) * 18;
          const targetWorld = this.screenToWorld(sweepX, sweepY, -0.4);
          lookTargetWorld.copy(targetWorld);
          lookTargetWorld.z = 2.9;
        }

        lensSpinSpeed = 5.0;
        barrelExtend = 0.22;
        jawChatterAmount = 0.75;
        turretAngleTarget = 0.18;

        if (this.scanTimer >= this.scanDuration) {
          this.roamingState = 'patrol';
          this.activeScanTarget = null;
          this.nextScanCountdown = 5.0 + Math.random() * 2.5;
        }
      } else if (this.roamingState === 'docked') {
        const dockPos = this.computeDockedWorldPos();
        dockPos.y += Math.sin(elapsed * 2.0) * 0.06;
        this.currentPos.lerp(dockPos, 1 - Math.exp(-4.0 * dt));
        lookTargetWorld.set(
          this.currentPos.x + this.pointerNorm.x * 1.4,
          this.currentPos.y + this.pointerNorm.y * 1.2,
          8.5
        );
      } else if (this.roamingState === 'menu-open') {
        this.currentPos.y += Math.sin(elapsed * 2.2) * 0.002;
        lookTargetWorld.set(this.currentPos.x * 0.6, this.currentPos.y * 0.6, 10.5);
        lensSpinSpeed = 1.8;
        barrelExtend = 0.17;
        jawChatterAmount = 0.3;
      }
    }

    if (dt > 0.0001) {
      const instantVel = this.currentPos.clone().sub(prevPos).divideScalar(dt);
      this.velocity.lerp(instantVel, 1 - Math.exp(-8 * dt));
    }

    this.currentScale = THREE.MathUtils.lerp(
      this.currentScale,
      desiredScale,
      1 - Math.exp(-7 * dt)
    );
    this.rootAnchor.position.copy(this.currentPos);
    this.rootAnchor.scale.setScalar(this.currentScale);

    // Head orientation + subtle inertial roll
    const dummy = new THREE.Object3D();
    dummy.position.copy(this.currentPos);
    dummy.lookAt(lookTargetWorld);
    const bankZ = THREE.MathUtils.clamp(-this.velocity.x * 0.06, -0.32, 0.32);
    const bankEuler = new THREE.Euler().setFromQuaternion(dummy.quaternion, 'YXZ');
    bankEuler.y = THREE.MathUtils.clamp(bankEuler.y, -0.8, 0.8);
    bankEuler.x = THREE.MathUtils.clamp(bankEuler.x, -0.55, 0.55);
    bankEuler.z += bankZ;
    const targetQuat = new THREE.Quaternion().setFromEuler(bankEuler);
    this.currentHeadQuat.slerp(targetQuat, 1 - Math.exp(-6.2 * dt));
    this.headTiltGroup.quaternion.copy(this.currentHeadQuat);

    // Respirator jaw heave & binary vox-furnace flicker
    const heavyRespiratorBreath = (Math.sin(elapsed * 1.6) * 0.5 + 0.5) * 0.045;
    const binaryBurst =
      Math.abs(Math.sin(elapsed * 22.0) * Math.cos(elapsed * 8.5)) * 0.13 * jawChatterAmount;
    this.jawPivot.rotation.x = heavyRespiratorBreath + binaryBurst;
    this.voxFurnaceMat.emissiveIntensity =
      1.5 + jawChatterAmount * 3.0 + Math.sin(elapsed * 17.0) * 0.4;

    // Revolver turret snap & augmetic lens rotation
    this.turretRevolverGroup.rotation.z = THREE.MathUtils.lerp(
      this.turretRevolverGroup.rotation.z,
      turretAngleTarget,
      1 - Math.exp(-7.5 * dt)
    );
    this.eyeOuterRing.rotation.z += dt * lensSpinSpeed;
    this.eyeBarrel.position.z = THREE.MathUtils.lerp(
      this.eyeBarrel.position.z,
      barrelExtend,
      1 - Math.exp(-9 * dt)
    );
    this.eyeLensMat.emissiveIntensity =
      3.0 + Math.sin(elapsed * 6.5) * 0.5 + (this.roamingState === 'scanning' ? 1.6 : 0);
    const flareSize = 0.82 + Math.sin(elapsed * 8.0) * 0.09 + (this.isSkullHovered ? 0.18 : 0);
    this.eyeGlowSprite.scale.set(flareSize, flareSize, 1);

    // Bubbling cranial stim-vial luminescence & blinking vox-mast rune lamp
    this.bioVialMats.forEach((mat, idx) => {
      mat.emissiveIntensity = 1.9 + Math.sin(elapsed * 4.5 + idx * 2.1) * 0.75;
    });
    this.antennaLampMat.emissiveIntensity = Math.sin(elapsed * 4.4) > 0.3 ? 3.5 : 0.45;

    // Swinging gothic incense thurible with inertial pendulum lag
    this.censerSwingGroup.rotation.z = THREE.MathUtils.clamp(
      -this.velocity.x * 0.12 + Math.sin(elapsed * 2.1) * 0.09,
      -0.45,
      0.45
    );
    this.censerSwingGroup.rotation.x = THREE.MathUtils.clamp(
      this.velocity.y * 0.08 + Math.cos(elapsed * 1.7) * 0.07,
      -0.35,
      0.35
    );
    this.censerCoreMat.emissiveIntensity = 2.6 + Math.sin(elapsed * 9.0) * 0.7;

    // Fluttering ragged parchment purity-seal litanies
    this.parchmentStrips.forEach((strip) => {
      const posAttr = strip.mesh.geometry.attributes.position;
      for (let k = 0; k < posAttr.count; k++) {
        const y = posAttr.getY(k);
        const weight = Math.min(1, Math.abs(y) / 0.85);
        const waveZ =
          Math.sin(elapsed * 4.8 - weight * 4.5 + strip.phase) * 0.085 * weight * weight;
        const waveX =
          Math.cos(elapsed * 3.2 - weight * 3.0 + strip.phase) * 0.032 * weight -
          this.velocity.x * 0.028 * weight;
        posAttr.setZ(k, strip.baseZ[k] + waveZ);
        posAttr.setX(k, strip.baseX[k] + waveX);
      }
      posAttr.needsUpdate = true;
      strip.mesh.geometry.computeVertexNormals();
    });

    // Undulating ribbed mechadendrites, servo-claw & spinning Chirurgeon bone-saw
    this.cables.forEach((cable) => {
      const livePts = cable.basePoints.map((bp, idx) => {
        const rotatedAnchor = bp.clone().applyQuaternion(this.currentHeadQuat);
        if (idx === 0) {
          return rotatedAnchor;
        }
        const tWeight = idx / (cable.basePoints.length - 1);
        const blendedBase = bp.clone().lerp(rotatedAnchor, Math.max(0, 1 - tWeight * 0.78));
        const swayX =
          Math.sin(elapsed * 2.2 + cable.phaseOffset - idx * 0.9) * cable.amp * tWeight -
          this.velocity.x * 0.09 * tWeight;
        const swayZ =
          Math.cos(elapsed * 1.85 + cable.phaseOffset - idx * 0.8) * cable.amp * 0.8 * tWeight;
        const swayY = -this.velocity.y * 0.05 * tWeight;
        return new THREE.Vector3(
          blendedBase.x + swayX,
          blendedBase.y + swayY,
          blendedBase.z + swayZ
        );
      });

      const curve = new THREE.CatmullRomCurve3(livePts);
      const nextGeom = new THREE.TubeGeometry(curve, 18, cable.radius, cable.radialSegments, false);
      cable.mesh.geometry.dispose();
      cable.mesh.geometry = nextGeom;

      cable.ribRings.forEach((ring, rIdx) => {
        const u = (rIdx + 1) / (cable.ribRings.length + 1);
        const pt = curve.getPoint(u);
        const tan = curve.getTangent(u);
        ring.position.copy(pt);
        ring.lookAt(pt.clone().add(tan));
      });

      if (cable.tipGroup) {
        const lastPt = livePts[livePts.length - 1];
        cable.tipGroup.position.copy(lastPt);
        cable.tipGroup.rotation.y = Math.sin(elapsed * 1.4 + cable.phaseOffset) * 0.6;
        cable.tipGroup.rotation.z = Math.sin(elapsed * 2.8 + cable.phaseOffset) * 0.22;
      }
      if (cable.tipSpinMesh) {
        // High-speed whirring Chirurgeon bone-saw!
        cable.tipSpinMesh.rotation.x += dt * (this.roamingState === 'scanning' ? 24.0 : 9.5);
      }
    });

    // Rising incense embers & forge sparks
    const emberAttr = this.emberParticles.geometry.attributes.position;
    for (let i = 0; i < emberAttr.count; i++) {
      let ey = emberAttr.getY(i) + this.emberVelocities[i] * dt;
      let ex = emberAttr.getX(i) + Math.sin(elapsed * 2.0 + i) * 0.15 * dt;
      if (ey > 1.85) {
        ey = -2.1;
        ex = (Math.random() - 0.5) * 1.6;
      }
      emberAttr.setX(i, ex);
      emberAttr.setY(i, ey);
    }
    emberAttr.needsUpdate = true;

    // Holographic projection rings in menu mode
    const showHolo = this.mode === 'menu' || this.mode === 'transition-to-menu';
    this.holoOrbitRings.visible = showHolo;
    this.holoProjectorCone.visible = showHolo;
    if (showHolo) {
      this.holoOrbitRings.rotation.y += dt * 0.28;
      this.holoOrbitRings.rotation.z -= dt * 0.16;
    }

    // Volumetric Blood-Crimson Auspex Scan Beam
    let scanTargetScreenOut: { x: number; y: number } | null = null;
    if (this.mode === 'roaming' && this.roamingState === 'scanning' && this.activeScanTarget) {
      const sweepX = this.activeScanTarget.x + Math.sin(this.scanTimer * 3.6) * 48;
      const sweepY = this.activeScanTarget.y + Math.cos(this.scanTimer * 2.4) * 20;
      scanTargetScreenOut = { x: sweepX, y: sweepY };

      const eyeWorld = new THREE.Vector3();
      this.eyeTipMarker.getWorldPosition(eyeWorld);
      const targetWorld = this.screenToWorld(sweepX, sweepY, -0.2);

      const dist = eyeWorld.distanceTo(targetWorld);
      this.scanBeamGroup.visible = true;
      this.scanBeamGroup.position.copy(eyeWorld);
      this.scanBeamGroup.lookAt(targetWorld);
      this.scanConeMesh.scale.set(1, 1, dist);
      this.scanCoreLine.scale.set(1, 1, dist);

      this.scanReticleGroup.visible = true;
      this.scanReticleGroup.position.copy(targetWorld);
      this.scanReticleGroup.rotation.z = elapsed * 2.8;
      const retPulse = 0.85 + Math.sin(elapsed * 10) * 0.14;
      this.scanReticleGroup.scale.setScalar(retPulse);
    } else {
      this.scanBeamGroup.visible = false;
      this.scanReticleGroup.visible = false;
    }

    if (this.onTelemetry) {
      const screenCenter = this.worldToScreen(this.currentPos);
      const edgeSample = this.worldToScreen(
        this.currentPos.clone().add(new THREE.Vector3(this.currentScale * 1.2, 0, 0))
      );
      const hitRadius = Math.max(44, Math.abs(edgeSample.x - screenCenter.x));

      this.onTelemetry({
        screenX: screenCenter.x,
        screenY: screenCenter.y,
        hitRadius,
        mode: this.mode,
        roamingState: this.roamingState,
        activeScanLabel: this.activeScanTarget?.label ?? null,
        scanTargetScreen: scanTargetScreenOut,
      });
    }
  }

  public dispose() {
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    this.disposableTextures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}
