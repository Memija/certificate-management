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

const CABLE_SEGMENT_COUNT = 14;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

interface ArticulatedCable {
  segmentMeshes: THREE.Mesh[];
  jointMeshes: THREE.Mesh[];
  ribRings: THREE.Mesh[];
  basePoints: THREE.Vector3[];
  livePoints: THREE.Vector3[];
  phaseOffset: number;
  amp: number;
  radius: number;
  tipGroup?: THREE.Group;
  tipSpinMesh?: THREE.Mesh;
}

interface ArticulatedParchmentStrip {
  pivots: THREE.Group[];
  baseRotZ: number;
  phase: number;
}

interface EmberCloudLayer {
  points: THREE.Points;
  material: THREE.PointsMaterial;
  phaseOffset: number;
  swaySeed: number;
}

/**
 * Zero-allocation 4-point Catmull-Rom spline evaluator (u in [0, 1]).
 */
function evalFourPointCatmullRom(
  pts: readonly THREE.Vector3[],
  u: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const clamped = u <= 0 ? 0 : u >= 1 ? 1 : u;
  const scaled = clamped * 3;
  const span = scaled >= 2 ? 2 : Math.floor(scaled);
  const t = scaled - span;
  const t2 = t * t;
  const t3 = t2 * t;

  const p0 = pts[0];
  const p1 = pts[1];
  const p2 = pts[2];
  const p3 = pts[3];

  const c1 = pts[span];
  const c2 = pts[span + 1];

  const c0x = span === 0 ? 2 * p0.x - p1.x : pts[span - 1].x;
  const c0y = span === 0 ? 2 * p0.y - p1.y : pts[span - 1].y;
  const c0z = span === 0 ? 2 * p0.z - p1.z : pts[span - 1].z;

  const c3x = span === 2 ? 2 * p3.x - p2.x : pts[span + 2].x;
  const c3y = span === 2 ? 2 * p3.y - p2.y : pts[span + 2].y;
  const c3z = span === 2 ? 2 * p3.z - p2.z : pts[span + 2].z;

  out.set(
    0.5 *
      (2 * c1.x +
        (-c0x + c2.x) * t +
        (2 * c0x - 5 * c1.x + 4 * c2.x - c3x) * t2 +
        (-c0x + 3 * c1.x - 3 * c2.x + c3x) * t3),
    0.5 *
      (2 * c1.y +
        (-c0y + c2.y) * t +
        (2 * c0y - 5 * c1.y + 4 * c2.y - c3y) * t2 +
        (-c0y + 3 * c1.y - 3 * c2.y + c3y) * t3),
    0.5 *
      (2 * c1.z +
        (-c0z + c2.z) * t +
        (2 * c0z - 5 * c1.z + 4 * c2.z - c3z) * t2 +
        (-c0z + 3 * c1.z - 3 * c2.z + c3z) * t3)
  );
  return out;
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
  private parchmentStrips: ArticulatedParchmentStrip[] = [];
  private cables: ArticulatedCable[] = [];
  private emberClouds: EmberCloudLayer[] = [];

  private mode: ServitorMode = 'menu';
  private roamingState: RoamingSubState = 'patrol';
  private pointerNorm = new THREE.Vector2(0, 0);
  private pointerPx = -9999;
  private pointerPy = -9999;
  private hoveredMenuPoint: { x: number; y: number } | null = null;
  private isSkullHovered = false;
  private userWorking = false;
  private overlayModalOpen = false;
  private cloaked = false;
  private currentCanvasOpacity = 1.0;
  private appliedCanvasOpacity = -1;

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

  // Pre-allocated zero-GC scratch objects reused every animation frame
  private scratchPrevPos = new THREE.Vector3();
  private scratchLookTarget = new THREE.Vector3();
  private scratchAnchor = new THREE.Vector3();
  private scratchVecA = new THREE.Vector3();
  private scratchVecB = new THREE.Vector3();
  private scratchVecC = new THREE.Vector3();
  private scratchUnproject = new THREE.Vector3();
  private scratchProject = new THREE.Vector3();
  private scratchEyeWorld = new THREE.Vector3();
  private scratchTargetWorld = new THREE.Vector3();
  private scratchInstantVel = new THREE.Vector3();
  private scratchDummyObj = new THREE.Object3D();
  private scratchEuler = new THREE.Euler();
  private scratchQuat = new THREE.Quaternion();
  private scratchScreenA = { x: 0, y: 0 };
  private scratchScreenB = { x: 0, y: 0 };
  private scratchSplineSamples: THREE.Vector3[] = Array.from(
    { length: CABLE_SEGMENT_COUNT + 1 },
    () => new THREE.Vector3()
  );

  private clock = new THREE.Clock();
  private rafId: number | null = null;
  private disposed = false;
  private contextLost = false;
  private canvasEl: HTMLCanvasElement;
  private disposableTextures: THREE.Texture[] = [];
  private onTelemetry: ((telemetry: ServitorFrameTelemetry) => void) | null = null;
  private onContextRestored: (() => void) | null = null;
  private handleContextLostBound: (e: Event) => void;
  private handleContextRestoredBound: () => void;
  private handleVisibilityChangeBound: () => void;

  constructor(
    canvas: HTMLCanvasElement,
    options?: {
      initialMode?: ServitorMode;
      onTelemetry?: (t: ServitorFrameTelemetry) => void;
      onRequestScanTarget?: () => ScanTargetInfo | null;
      onContextRestored?: () => void;
    }
  ) {
    this.canvasEl = canvas;
    this.onTelemetry = options?.onTelemetry ?? null;
    this.requestScanTargetCallback = options?.onRequestScanTarget ?? null;
    this.onContextRestored = options?.onContextRestored ?? null;
    this.mode = options?.initialMode ?? 'menu';

    // Ensure canvas is visible on fresh mount
    canvas.style.visibility = 'visible';

    this.handleContextLostBound = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      // Hide canvas immediately so a lost WebGL context never paints a white sheet over the UI
      this.canvasEl.style.opacity = '0';
      this.canvasEl.style.visibility = 'hidden';
    };
    this.handleContextRestoredBound = () => {
      if (this.disposed) return;
      this.onContextRestored?.();
    };
    this.handleVisibilityChangeBound = () => {
      if (!document.hidden) {
        // Discard accumulated background delta so animation resumes cleanly without a jump
        this.clock.getDelta();
      }
    };

    canvas.addEventListener('webglcontextlost', this.handleContextLostBound, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestoredBound, false);
    document.addEventListener('visibilitychange', this.handleVisibilityChangeBound);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
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
        const segCount = 4;
        const segLen = len / segCount;
        const pivots: THREE.Group[] = [];
        const baseRotZ = (lIdx === 0 ? -0.08 : 0.11) + spIdx * 0.04;

        let parentNode: THREE.Object3D = sealAnchor;
        for (let s = 0; s < segCount; s++) {
          const pivot = new THREE.Group();
          if (s === 0) {
            pivot.position.set(lIdx === 0 ? -0.03 : 0.055, 0, lIdx === 0 ? 0.012 : -0.01);
            pivot.rotation.z = baseRotZ;
          } else {
            pivot.position.set(0, -segLen, 0);
          }
          parentNode.add(pivot);
          pivots.push(pivot);

          const sliceGeom = new THREE.PlaneGeometry(0.175, segLen, 1, 1);
          const uvAttr = sliceGeom.attributes.uv;
          const vTop = 1 - s / segCount;
          const vBot = 1 - (s + 1) / segCount;
          for (let k = 0; k < uvAttr.count; k++) {
            uvAttr.setY(k, uvAttr.getY(k) > 0.5 ? vTop : vBot);
          }
          sliceGeom.translate(0, -segLen * 0.5, 0);

          const sliceMesh = new THREE.Mesh(sliceGeom, parchmentMat);
          pivot.add(sliceMesh);
          parentNode = pivot;
        }

        this.parchmentStrips.push({
          pivots,
          baseRotZ,
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

    // ─── 11. Segmented Ribbed Mechadendrites (Zero-Allocation Static Links) ───
    const sharedCableCylGeom = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
    const sharedCableJointGeom = new THREE.SphereGeometry(1.06, 8, 6);
    const sharedCableRibGeom = new THREE.TorusGeometry(1.24, 0.24, 6, 12);
    sharedCableRibGeom.rotateX(Math.PI / 2);

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
      const livePoints = basePoints.map((p) => p.clone());

      const segmentMeshes: THREE.Mesh[] = [];
      for (let s = 0; s < CABLE_SEGMENT_COUNT; s++) {
        const segMesh = new THREE.Mesh(sharedCableCylGeom, cfg.mat);
        this.rootAnchor.add(segMesh);
        segmentMeshes.push(segMesh);
      }

      const jointMeshes: THREE.Mesh[] = [];
      for (let j = 0; j < CABLE_SEGMENT_COUNT - 1; j++) {
        const jMesh = new THREE.Mesh(sharedCableJointGeom, blackenedIronMat);
        jMesh.scale.setScalar(cfg.radius);
        this.rootAnchor.add(jMesh);
        jointMeshes.push(jMesh);
      }

      // Segmented brass/steel vertebral rings along the mechadendrite
      const ribRings: THREE.Mesh[] = [];
      const ringCount = 6;
      for (let r = 1; r <= ringCount; r++) {
        const ringMesh = new THREE.Mesh(
          sharedCableRibGeom,
          r % 2 === 0 ? balthasarBrassMat : leadbelcherIronMat
        );
        ringMesh.scale.setScalar(cfg.radius);
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
        segmentMeshes,
        jointMeshes,
        ribRings,
        basePoints,
        livePoints,
        phaseOffset: idx * 1.35,
        amp: 0.11 + idx * 0.018,
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

    // ─── 14. Rising Thurible Incense Embers (Static Buffer Dual-Phase Drift) ──
    for (let layer = 0; layer < 2; layer++) {
      const emberCount = 24;
      const emberPos = new Float32Array(emberCount * 3);
      for (let i = 0; i < emberCount; i++) {
        emberPos[i * 3] = (Math.random() - 0.5) * 2.1;
        emberPos[i * 3 + 1] = -1.6 + Math.random() * 2.4;
        emberPos[i * 3 + 2] = (Math.random() - 0.5) * 1.7;
      }
      const emberGeom = new THREE.BufferGeometry();
      emberGeom.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
      const emberMat = new THREE.PointsMaterial({
        color: layer === 0 ? '#f59e0b' : '#fb923c',
        size: 0.052,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(emberGeom, emberMat);
      this.rootAnchor.add(points);
      this.emberClouds.push({
        points,
        material: emberMat,
        phaseOffset: layer * 0.5,
        swaySeed: layer * 2.4,
      });
    }

    this.snapToModeInitialPose();
    this.startLoop();
  }

  private getMenuAnchorWorld(out: THREE.Vector3): { pos: THREE.Vector3; scale: number } {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w < 960) {
      this.screenToWorld(w * 0.5, h * 0.23, 0, out);
      return { pos: out, scale: 0.62 };
    }
    this.screenToWorld(w * 0.27, h * 0.46, 0, out);
    return { pos: out, scale: 1.02 };
  }

  private computePatrolWorldPos(t: number, out: THREE.Vector3): THREE.Vector3 {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = t * 0.22 + this.patrolSeed;

    if (w < 960) {
      const px = w - 48 - Math.sin(s * 1.5) * 10;
      const py = THREE.MathUtils.lerp(104, Math.max(140, h - 82), 0.5 + 0.5 * Math.sin(s));
      return this.screenToWorld(px, py, 0, out);
    }

    // Strictly hug the unobstructed right-hand & bottom-right outer gutter
    // (clear of the 270px left sidebar, top-right controls capsule, and central reading column)
    const verticalWave = 0.5 + 0.5 * Math.sin(s);
    const topSafe = 114;
    const bottomSafe = Math.max(topSafe + 60, h - 84);
    const py = THREE.MathUtils.lerp(topSafe, bottomSafe, verticalWave);

    // Subtle horizontal drift only near the bottom-right margin
    const bottomDrift = Math.max(0, verticalWave - 0.65) / 0.35;
    const maxDriftPx = Math.min(160, Math.max(0, (w - 1180) * 0.45));
    const px =
      w -
      64 -
      Math.sin(s * 2.1) * 14 -
      bottomDrift * maxDriftPx * (0.5 + 0.5 * Math.cos(s * 1.3));

    return this.screenToWorld(px, py, 0, out);
  }

  private computeDockedWorldPos(out: THREE.Vector3): THREE.Vector3 {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return this.screenToWorld(w - 54, Math.max(100, h - 78), 0, out);
  }

  private applyCursorEvasion(desiredWorld: THREE.Vector3, outWorld: THREE.Vector3): number {
    outWorld.copy(desiredWorld);
    if (this.pointerPx < -1000 || this.pointerPy < -1000) {
      return 9999;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const screenPt = this.worldToScreen(desiredWorld, this.scratchScreenA);
    const dx = screenPt.x - this.pointerPx;
    const dy = screenPt.y - this.pointerPy;
    const dist = Math.hypot(dx, dy);
    const repelRadius = 195;

    if (dist >= repelRadius) {
      return dist;
    }

    let targetX = screenPt.x;
    let targetY = screenPt.y;

    // If cursor moves into the bottom-right corner, lift the Servitor cleanly upward out of the corner
    if (this.pointerPx > w - 240 && this.pointerPy > h - 240 && screenPt.x > w - 200) {
      const lift = Math.pow(1 - dist / repelRadius, 1.15) * 210;
      targetY = Math.max(104, screenPt.y - lift);
      targetX = w - 54;
    } else {
      const ux = dist > 1 ? dx / dist : 0;
      const uy = dist > 1 ? dy / dist : -1;
      const push = Math.pow(1 - dist / repelRadius, 1.35) * 175;
      const minSafeX = w >= 960 ? 320 : 48;
      targetX = THREE.MathUtils.clamp(screenPt.x + ux * push, minSafeX, w - 48);
      targetY = THREE.MathUtils.clamp(screenPt.y + uy * push, 98, Math.max(110, h - 72));
    }

    this.screenToWorld(targetX, targetY, 0, outWorld);
    return dist;
  }

  private snapToModeInitialPose() {
    if (this.mode === 'menu') {
      const { pos, scale } = this.getMenuAnchorWorld(this.scratchAnchor);
      this.currentPos.copy(pos);
      this.currentScale = scale;
      this.currentCanvasOpacity = 1.0;
    } else {
      const pos = this.computePatrolWorldPos(0, this.scratchAnchor);
      this.currentPos.copy(pos);
      this.currentScale = 0.25;
      this.currentCanvasOpacity = 0.86;
    }
    this.rootAnchor.position.copy(this.currentPos);
    this.rootAnchor.scale.setScalar(this.currentScale);
  }

  public screenToWorld(
    px: number,
    py: number,
    targetZ = 0,
    out?: THREE.Vector3
  ): THREE.Vector3 {
    const result = out ?? new THREE.Vector3();
    const safePx = Number.isFinite(px) ? px : window.innerWidth * 0.5;
    const safePy = Number.isFinite(py) ? py : window.innerHeight * 0.5;
    const ndcX = (safePx / Math.max(1, window.innerWidth)) * 2 - 1;
    const ndcY = -(safePy / Math.max(1, window.innerHeight)) * 2 + 1;
    this.scratchUnproject.set(ndcX, ndcY, 0.5).unproject(this.camera);
    const dir = this.scratchUnproject.sub(this.camera.position).normalize();
    const safeDirZ = Math.abs(dir.z) > 1e-5 ? dir.z : -1;
    const distance = (targetZ - this.camera.position.z) / safeDirZ;
    return result.copy(this.camera.position).addScaledVector(dir, distance);
  }

  public worldToScreen(
    worldPos: THREE.Vector3,
    out?: { x: number; y: number }
  ): { x: number; y: number } {
    const target = out ?? { x: 0, y: 0 };
    this.scratchProject.copy(worldPos).project(this.camera);
    target.x = (this.scratchProject.x * 0.5 + 0.5) * window.innerWidth;
    target.y = (-this.scratchProject.y * 0.5 + 0.5) * window.innerHeight;
    return target;
  }

  public handleResize() {
    if (this.disposed || this.contextLost) return;
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  public setPointerScreen(px: number, py: number) {
    this.pointerPx = px;
    this.pointerPy = py;
    this.pointerNorm.set(
      (px / Math.max(1, window.innerWidth)) * 2 - 1,
      -(py / Math.max(1, window.innerHeight)) * 2 + 1
    );
  }

  public clearPointer() {
    this.pointerPx = -9999;
    this.pointerPy = -9999;
  }

  public setWorkspaceObstructionState(state: {
    userWorking: boolean;
    modalOpen: boolean;
    cloaked: boolean;
  }) {
    this.userWorking = state.userWorking;
    this.overlayModalOpen = state.modalOpen;
    this.cloaked = state.cloaked;

    // Immediately abort any active scan beam if the user starts working, opens a modal, or cloaks
    if ((state.userWorking || state.modalOpen || state.cloaked) && this.roamingState === 'scanning') {
      this.roamingState = 'patrol';
      this.activeScanTarget = null;
      this.nextScanCountdown = 6.0;
    }
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

      if (this.contextLost || document.hidden) {
        return;
      }

      const rawDt = this.clock.getDelta();
      const dt = Number.isFinite(rawDt) ? THREE.MathUtils.clamp(rawDt, 0.0001, 0.05) : 0.016;
      const elapsed = this.clock.elapsedTime;
      this.update(dt, elapsed);
      if (this.currentCanvasOpacity > 0.01) {
        this.renderer.render(this.scene, this.camera);
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private update(dt: number, elapsed: number) {
    const prevPos = this.scratchPrevPos.copy(this.currentPos);
    let desiredScale = this.currentScale;
    const lookTargetWorld = this.scratchLookTarget.set(0, 0, 9);
    let jawChatterAmount = 0;
    let lensSpinSpeed = 0.6;
    let barrelExtend = 0.11;
    let turretAngleTarget = 0;

    if (this.mode === 'menu') {
      const { pos: anchorPos, scale } = this.getMenuAnchorWorld(this.scratchAnchor);
      // Heavy mechanical antigrav bobbing
      this.scratchVecA.set(
        anchorPos.x + Math.sin(elapsed * 0.95) * 0.08,
        anchorPos.y + Math.sin(elapsed * 1.75) * 0.13,
        anchorPos.z
      );
      this.currentPos.lerp(this.scratchVecA, 1 - Math.exp(-4.2 * dt));
      desiredScale = scale;

      if (this.hoveredMenuPoint) {
        this.screenToWorld(
          this.hoveredMenuPoint.x,
          this.hoveredMenuPoint.y,
          2.5,
          lookTargetWorld
        );
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

      const endPos = this.computePatrolWorldPos(this.patrolTime, this.scratchAnchor);
      const swoopZ = Math.sin(p * Math.PI) * 3.2;
      const arcLiftY = Math.sin(p * Math.PI) * 0.82;

      this.currentPos.lerpVectors(this.transitionStartPos, endPos, ease);
      this.currentPos.y += arcLiftY;
      this.currentPos.z = swoopZ;

      desiredScale = THREE.MathUtils.lerp(this.transitionStartScale, 0.25, ease);
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
      const { pos: menuPos, scale: menuScale } = this.getMenuAnchorWorld(this.scratchAnchor);

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
      // ROAMING MODE (Non-obstructive perimeter vigil + active-work retreat + cursor evasion)
      const shouldRetreatForWork =
        (this.userWorking || this.overlayModalOpen) && this.roamingState !== 'menu-open';

      if (this.roamingState === 'menu-open') {
        desiredScale = 0.28;
      } else if (shouldRetreatForWork || this.roamingState === 'docked') {
        desiredScale = 0.19;
      } else {
        desiredScale = this.isSkullHovered ? 0.28 : 0.25;
      }

      let cursorDist = 9999;

      if (this.roamingState === 'menu-open') {
        const dockPos = this.computeDockedWorldPos(this.scratchAnchor);
        dockPos.y += 0.28 + Math.sin(elapsed * 2.2) * 0.03;
        this.currentPos.lerp(dockPos, 1 - Math.exp(-5.0 * dt));
        lookTargetWorld.set(this.currentPos.x * 0.6, this.currentPos.y * 0.6, 10.5);
        lensSpinSpeed = 1.8;
        barrelExtend = 0.17;
        jawChatterAmount = 0.25;
      } else if (shouldRetreatForWork || this.roamingState === 'docked') {
        const baseDock = this.computeDockedWorldPos(this.scratchAnchor);
        baseDock.y += Math.sin(elapsed * 1.8) * 0.04;
        cursorDist = this.applyCursorEvasion(baseDock, this.scratchVecA);
        this.currentPos.lerp(this.scratchVecA, 1 - Math.exp(-5.2 * dt));
        lookTargetWorld.set(
          this.currentPos.x - 0.6,
          this.currentPos.y + 0.15,
          8.8
        );
        lensSpinSpeed = 0.35;
      } else if (this.roamingState === 'patrol') {
        this.patrolTime += dt;
        const rawPatrol = this.computePatrolWorldPos(this.patrolTime, this.scratchAnchor);
        rawPatrol.y += Math.sin(elapsed * 2.2) * 0.06;
        cursorDist = this.applyCursorEvasion(rawPatrol, this.scratchVecA);
        this.currentPos.lerp(this.scratchVecA, 1 - Math.exp(-3.4 * dt));

        const futurePos = this.computePatrolWorldPos(this.patrolTime + 0.9, this.scratchVecB);
        lookTargetWorld.set(
          futurePos.x * 0.7 - 0.8,
          futurePos.y * 0.75 + this.pointerNorm.y * 0.4,
          6.2
        );

        if (!this.cloaked) {
          this.nextScanCountdown -= dt;
          if (this.nextScanCountdown <= 0 && cursorDist > 210) {
            const candidate = this.requestScanTargetCallback?.() ?? null;
            if (candidate) {
              this.activeScanTarget = candidate;
              this.roamingState = 'scanning';
              this.scanTimer = 0;
            } else {
              this.nextScanCountdown = 5.5;
            }
          }
        }
      } else if (this.roamingState === 'scanning') {
        this.scanTimer += dt;
        const rawHover = this.computePatrolWorldPos(this.patrolTime, this.scratchAnchor);
        cursorDist = this.applyCursorEvasion(rawHover, this.scratchVecA);
        this.currentPos.lerp(this.scratchVecA, 1 - Math.exp(-4.0 * dt));

        // If user moves cursor near the Servitor or near the scanned target, yield immediately!
        const targetCursorDist = this.activeScanTarget
          ? Math.hypot(
              this.activeScanTarget.x - this.pointerPx,
              this.activeScanTarget.y - this.pointerPy
            )
          : 9999;

        if (cursorDist < 170 || targetCursorDist < 180) {
          this.roamingState = 'patrol';
          this.activeScanTarget = null;
          this.nextScanCountdown = 6.5;
        } else if (this.activeScanTarget) {
          const sweepX = this.activeScanTarget.x + Math.sin(this.scanTimer * 3.2) * 36;
          const sweepY = this.activeScanTarget.y + Math.cos(this.scanTimer * 2.1) * 14;
          this.screenToWorld(sweepX, sweepY, -0.4, lookTargetWorld);
          lookTargetWorld.z = 3.2;
        }

        lensSpinSpeed = 4.5;
        barrelExtend = 0.21;
        jawChatterAmount = 0.65;
        turretAngleTarget = 0.18;

        if (this.scanTimer >= this.scanDuration) {
          this.roamingState = 'patrol';
          this.activeScanTarget = null;
          this.nextScanCountdown = 8.0 + Math.random() * 4.0;
        }
      }

      // Compute non-obstructive canvas opacity for roaming mode
      let targetOpacity = 0.86;
      if (this.cloaked) {
        targetOpacity = 0.0;
      } else if (this.roamingState === 'menu-open') {
        targetOpacity = 0.96;
      } else if (this.overlayModalOpen) {
        targetOpacity = 0.1;
      } else if (this.userWorking) {
        targetOpacity = 0.28;
      } else if (cursorDist < 195) {
        targetOpacity = THREE.MathUtils.lerp(0.22, 0.86, cursorDist / 195);
      }
      this.currentCanvasOpacity = THREE.MathUtils.lerp(
        this.currentCanvasOpacity,
        targetOpacity,
        1 - Math.exp(-7.5 * dt)
      );
    }

    if (this.mode !== 'roaming') {
      this.currentCanvasOpacity = THREE.MathUtils.lerp(
        this.currentCanvasOpacity,
        1.0,
        1 - Math.exp(-9.0 * dt)
      );
    }

    if (Math.abs(this.currentCanvasOpacity - this.appliedCanvasOpacity) > 0.004) {
      this.appliedCanvasOpacity = this.currentCanvasOpacity;
      this.renderer.domElement.style.opacity = this.currentCanvasOpacity.toFixed(3);
    }

    if (dt > 0.0001) {
      this.scratchInstantVel.copy(this.currentPos).sub(prevPos).divideScalar(dt);
      this.velocity.lerp(this.scratchInstantVel, 1 - Math.exp(-8 * dt));
    }

    this.currentScale = THREE.MathUtils.lerp(
      this.currentScale,
      desiredScale,
      1 - Math.exp(-7 * dt)
    );
    this.rootAnchor.position.copy(this.currentPos);
    this.rootAnchor.scale.setScalar(this.currentScale);

    // Head orientation + subtle inertial roll (zero-allocation)
    this.scratchDummyObj.position.copy(this.currentPos);
    this.scratchDummyObj.lookAt(lookTargetWorld);
    const bankZ = THREE.MathUtils.clamp(-this.velocity.x * 0.06, -0.32, 0.32);
    this.scratchEuler.setFromQuaternion(this.scratchDummyObj.quaternion, 'YXZ');
    this.scratchEuler.y = THREE.MathUtils.clamp(this.scratchEuler.y, -0.8, 0.8);
    this.scratchEuler.x = THREE.MathUtils.clamp(this.scratchEuler.x, -0.55, 0.55);
    this.scratchEuler.z += bankZ;
    this.scratchQuat.setFromEuler(this.scratchEuler);
    this.currentHeadQuat.slerp(this.scratchQuat, 1 - Math.exp(-6.2 * dt));
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
    for (let i = 0; i < this.bioVialMats.length; i++) {
      this.bioVialMats[i].emissiveIntensity = 1.9 + Math.sin(elapsed * 4.5 + i * 2.1) * 0.75;
    }
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

    // Fluttering ragged parchment purity-seal litanies (articulated hinges — zero buffer churn)
    for (let sIdx = 0; sIdx < this.parchmentStrips.length; sIdx++) {
      const strip = this.parchmentStrips[sIdx];
      const pivots = strip.pivots;
      for (let p = 0; p < pivots.length; p++) {
        const weight = (p + 1) / pivots.length;
        const waveX = Math.sin(elapsed * 4.6 - p * 1.05 + strip.phase) * 0.09 * weight;
        const waveZ =
          Math.cos(elapsed * 3.1 - p * 0.85 + strip.phase) * 0.045 * weight -
          THREE.MathUtils.clamp(this.velocity.x * 0.035, -0.18, 0.18) * weight;
        pivots[p].rotation.x = waveX;
        pivots[p].rotation.z = (p === 0 ? strip.baseRotZ : 0) + waveZ;
      }
    }

    // Undulating ribbed mechadendrites, servo-claw & spinning Chirurgeon bone-saw (zero-allocation)
    for (let cIdx = 0; cIdx < this.cables.length; cIdx++) {
      const cable = this.cables[cIdx];
      const basePts = cable.basePoints;
      const livePts = cable.livePoints;

      for (let idx = 0; idx < basePts.length; idx++) {
        const bp = basePts[idx];
        this.scratchVecA.copy(bp).applyQuaternion(this.currentHeadQuat);
        if (idx === 0) {
          livePts[idx].copy(this.scratchVecA);
        } else {
          const tWeight = idx / (basePts.length - 1);
          livePts[idx].copy(bp).lerp(this.scratchVecA, Math.max(0, 1 - tWeight * 0.78));
          livePts[idx].x +=
            Math.sin(elapsed * 2.2 + cable.phaseOffset - idx * 0.9) * cable.amp * tWeight -
            this.velocity.x * 0.09 * tWeight;
          livePts[idx].y += -this.velocity.y * 0.05 * tWeight;
          livePts[idx].z +=
            Math.cos(elapsed * 1.85 + cable.phaseOffset - idx * 0.8) * cable.amp * 0.8 * tWeight;
        }
      }

      for (let s = 0; s <= CABLE_SEGMENT_COUNT; s++) {
        evalFourPointCatmullRom(livePts, s / CABLE_SEGMENT_COUNT, this.scratchSplineSamples[s]);
      }

      for (let s = 0; s < CABLE_SEGMENT_COUNT; s++) {
        const pA = this.scratchSplineSamples[s];
        const pB = this.scratchSplineSamples[s + 1];
        const segMesh = cable.segmentMeshes[s];

        segMesh.position.set(
          (pA.x + pB.x) * 0.5,
          (pA.y + pB.y) * 0.5,
          (pA.z + pB.z) * 0.5
        );
        this.scratchVecB.copy(pB).sub(pA);
        const segLen = Math.max(0.001, this.scratchVecB.length());
        this.scratchVecB.multiplyScalar(1 / segLen);
        this.scratchQuat.setFromUnitVectors(UP_AXIS, this.scratchVecB);
        segMesh.quaternion.copy(this.scratchQuat);
        segMesh.scale.set(cable.radius, segLen * 1.08, cable.radius);

        if (s < cable.jointMeshes.length) {
          cable.jointMeshes[s].position.copy(pB);
        }
      }

      const ringCount = cable.ribRings.length;
      for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const u = (rIdx + 1) / (ringCount + 1);
        const ring = cable.ribRings[rIdx];
        evalFourPointCatmullRom(livePts, u, this.scratchVecA);
        evalFourPointCatmullRom(livePts, Math.min(1, u + 0.03), this.scratchVecB);
        ring.position.copy(this.scratchVecA);
        this.scratchVecC.copy(this.scratchVecB).sub(this.scratchVecA);
        if (this.scratchVecC.lengthSq() > 1e-6) {
          this.scratchVecC.normalize();
          this.scratchQuat.setFromUnitVectors(UP_AXIS, this.scratchVecC);
          ring.quaternion.copy(this.scratchQuat);
        }
      }

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
    }

    // Rising incense embers & forge sparks (dual-phase drift — zero buffer uploads)
    for (let i = 0; i < this.emberClouds.length; i++) {
      const layer = this.emberClouds[i];
      const phase = (elapsed * 0.16 + layer.phaseOffset) % 1;
      layer.points.position.y = -1.0 + phase * 2.15;
      layer.points.position.x = Math.sin(elapsed * 1.25 + layer.swaySeed) * 0.14;
      layer.material.opacity = Math.sin(phase * Math.PI) * 0.68;
    }

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

      this.eyeTipMarker.getWorldPosition(this.scratchEyeWorld);
      this.screenToWorld(sweepX, sweepY, -0.2, this.scratchTargetWorld);

      const dist = Math.max(0.05, this.scratchEyeWorld.distanceTo(this.scratchTargetWorld));
      this.scanBeamGroup.visible = true;
      this.scanBeamGroup.position.copy(this.scratchEyeWorld);
      this.scanBeamGroup.lookAt(this.scratchTargetWorld);
      this.scanConeMesh.scale.set(1, 1, dist);
      this.scanCoreLine.scale.set(1, 1, dist);

      this.scanReticleGroup.visible = true;
      this.scanReticleGroup.position.copy(this.scratchTargetWorld);
      this.scanReticleGroup.rotation.z = elapsed * 2.8;
      const retPulse = 0.85 + Math.sin(elapsed * 10) * 0.14;
      this.scanReticleGroup.scale.setScalar(retPulse);
    } else {
      this.scanBeamGroup.visible = false;
      this.scanReticleGroup.visible = false;
    }

    if (this.onTelemetry) {
      const screenCenter = this.worldToScreen(this.currentPos, this.scratchScreenA);
      this.scratchVecA.set(
        this.currentPos.x + this.currentScale * 1.2,
        this.currentPos.y,
        this.currentPos.z
      );
      const edgeSample = this.worldToScreen(this.scratchVecA, this.scratchScreenB);
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
    this.canvasEl.removeEventListener('webglcontextlost', this.handleContextLostBound, false);
    this.canvasEl.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestoredBound,
      false
    );
    document.removeEventListener('visibilitychange', this.handleVisibilityChangeBound);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (obj.geometry) geometries.add(obj.geometry);
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => materials.add(m));
        } else if (obj.material) {
          materials.add(obj.material);
        }
      } else if (obj instanceof THREE.Sprite && obj.material) {
        materials.add(obj.material);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.disposableTextures.forEach((t) => t.dispose());
    this.renderer.dispose();
  }
}
