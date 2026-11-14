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
  /** Automaton helm center in viewport pixels */
  screenX: number;
  screenY: number;
  /** Approximate pixel radius of unit on screen for hit-box sizing */
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

interface ArticulatedCipherStrip {
  pivots: THREE.Group[];
  baseRotZ: number;
  phase: number;
}

interface CipherMoteLayer {
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

interface AutomatonArmorTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

function createVaultEnvironmentEquirect(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Moody sanctum vault reflection dome: balanced metallic specular without overexposure
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 128);
  skyGrad.addColorStop(0, '#94a3b8');
  skyGrad.addColorStop(0.3, '#64748b');
  skyGrad.addColorStop(0.58, '#334155');
  skyGrad.addColorStop(0.82, '#1e293b');
  skyGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 256, 128);

  // Controlled warm brass key reflection on upper-right hemisphere
  const keyGlow = ctx.createRadialGradient(176, 38, 6, 176, 38, 60);
  keyGlow.addColorStop(0, 'rgba(253, 230, 188, 0.58)');
  keyGlow.addColorStop(0.5, 'rgba(217, 119, 6, 0.22)');
  keyGlow.addColorStop(1, 'rgba(217, 119, 6, 0)');
  ctx.fillStyle = keyGlow;
  ctx.fillRect(0, 0, 256, 128);

  // Subtle emerald-teal rim reflection accent on left hemisphere
  const rimGlow = ctx.createRadialGradient(64, 52, 6, 64, 52, 50);
  rimGlow.addColorStop(0, 'rgba(94, 234, 212, 0.45)');
  rimGlow.addColorStop(0.55, 'rgba(20, 184, 166, 0.18)');
  rimGlow.addColorStop(1, 'rgba(20, 184, 166, 0)');
  ctx.fillStyle = rimGlow;
  ctx.fillRect(0, 0, 256, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createAutomatonHelmTextures(): AutomatonArmorTextures {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Balanced mid-tone weathered pewter & tempered satin-titanium armor gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#9aa8bc');
  grad.addColorStop(0.38, '#7e8da3');
  grad.addColorStop(0.72, '#5f6e84');
  grad.addColorStop(1, '#414d60');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Fine vertical brushed-titanium machining grain
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 8 + Math.random() * 34;
    ctx.strokeStyle =
      Math.random() > 0.48 ? 'rgba(226, 232, 240, 0.09)' : 'rgba(15, 23, 42, 0.095)';
    ctx.lineWidth = 0.8 + Math.random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }

  // Subtle tempered-pewter sheen & metallic patina
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 0.8 + Math.random() * 3.6;
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(15, 23, 42, 0.065)' : 'rgba(226, 232, 240, 0.065)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Precision CNC-machined armor panel bevel seams + subtle edge highlight lips
  for (const seamY of [146, 248, 342]) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(36, seamY);
    ctx.lineTo(208, seamY + 12);
    ctx.lineTo(304, seamY + 12);
    ctx.lineTo(476, seamY);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(226, 232, 240, 0.24)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(36, seamY + 2);
    ctx.lineTo(208, seamY + 14);
    ctx.lineTo(304, seamY + 14);
    ctx.lineTo(476, seamY + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(212, 166, 79, 0.42)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(256, 64);
  ctx.lineTo(256, 360);
  ctx.stroke();

  // Cryptographic X.509 OID & SHA-256 hex serial laser-etched on pewter cheek armor plane
  ctx.fillStyle = 'rgba(226, 179, 88, 0.76)';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('UNIT-IX // X.509-AUTOMATON', 266, 184);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.64)';
  ctx.font = 'bold 9px monospace';
  ctx.fillText('OID 2.5.29.19 // SHA-256', 266, 198);
  ctx.fillText('0x9F86:D081:884C:7D65', 266, 211);

  // Bump map canvas for brushed steel micro-relief & machined panel grooves
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = Math.random() > 0.5 ? 156 : 100;
    bCtx.fillStyle = `rgba(${v},${v},${v},0.16)`;
    bCtx.fillRect(x, y, 1.2, 5 + Math.random() * 14);
  }

  // Recessed armor panel seam lines in bump map
  bCtx.strokeStyle = '#303030';
  bCtx.lineWidth = 2.0;
  for (const seamY of [146, 248, 342]) {
    bCtx.beginPath();
    bCtx.moveTo(36, seamY);
    bCtx.lineTo(208, seamY + 12);
    bCtx.lineTo(304, seamY + 12);
    bCtx.lineTo(476, seamY);
    bCtx.stroke();
  }

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

  // Forged foundry steel micro-grain & scratch marks
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

function createCipherShroudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian & midnight slate-indigo heavy ballistic cybernetic shroud
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1f2b3e');
  grad.addColorStop(0.52, '#141d2c');
  grad.addColorStop(0.86, '#0b101a');
  grad.addColorStop(1, '#06090f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Coarse heavy ballistic/woven carbon-indigo fabric texture
  ctx.strokeStyle = 'rgba(5, 8, 15, 0.28)';
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

  // Subtle slate-indigo sheen patina
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle =
      Math.random() > 0.32 ? 'rgba(6, 10, 18, 0.09)' : 'rgba(56, 98, 148, 0.05)';
    ctx.beginPath();
    ctx.arc(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Precision burnished-brass PCB circuit-bus filigree & emerald via-nodes along hood edges
  ctx.fillStyle = '#b68938';
  // Top crown circuit bus band
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 19, 512, 3);
  // Left & Right front shroud opening continuous bus rails
  ctx.fillRect(0, 0, 16, 512);
  ctx.fillRect(496, 0, 16, 512);
  ctx.fillRect(24, 0, 3, 512);
  ctx.fillRect(485, 0, 3, 512);
  ctx.fillRect(35, 0, 2, 512);
  ctx.fillRect(475, 0, 2, 512);

  // Angled 45-degree circuit trace bridges & circular micro-via pads
  ctx.strokeStyle = '#c89b46';
  ctx.lineWidth = 2;
  for (let y = 18; y < 500; y += 34) {
    // Left circuit trace + circular via pad
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(25, y + 9);
    ctx.lineTo(36, y + 9);
    ctx.lineTo(44, y + 17);
    ctx.stroke();

    ctx.fillStyle = '#d4a64f';
    ctx.beginPath();
    ctx.arc(44, y + 17, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(44, y + 17, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Right mirrored circuit trace + circular via pad
    ctx.beginPath();
    ctx.moveTo(496, y);
    ctx.lineTo(487, y + 9);
    ctx.lineTo(476, y + 9);
    ctx.lineTo(468, y + 17);
    ctx.stroke();

    ctx.fillStyle = '#d4a64f';
    ctx.beginPath();
    ctx.arc(468, y + 17, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(468, y + 17, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLouvreCoolantTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  // Anodized dark slate-titanium heat-sink casing
  ctx.fillStyle = '#18212f';
  ctx.fillRect(0, 0, 256, 64);

  // Burnished brass collar trim bands
  ctx.fillStyle = '#b68938';
  ctx.fillRect(0, 0, 256, 7);
  ctx.fillRect(0, 57, 256, 7);

  // Machined vertical heat-sink cooling louvers with subtle teal-emerald glow slots
  for (let x = 6; x < 256; x += 16) {
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(x, 11, 8, 42);
    ctx.fillStyle = 'rgba(20, 184, 166, 0.42)';
    ctx.fillRect(x + 3, 16, 2, 32);
    ctx.fillStyle = 'rgba(212, 166, 79, 0.35)';
    ctx.fillRect(x + 9, 11, 2, 42);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCipherPlateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Anodized dark obsidian-titanium metallic key-plate surface
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#222938');
  grad.addColorStop(0.55, '#161c27');
  grad.addColorStop(1, '#0c1017');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 512);

  // Outer burnished-brass frame
  ctx.strokeStyle = '#b68938';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 122, 506);

  // Inner copper-gold circuit bus border
  ctx.strokeStyle = 'rgba(212, 166, 79, 0.72)';
  ctx.lineWidth = 2;
  ctx.strokeRect(11, 13, 106, 486);

  // Hexagonal X.509 cryptographic key-sigil header
  ctx.strokeStyle = '#d4a64f';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const hx = 64 + Math.cos(a) * 15;
    const hy = 44 + Math.sin(a) * 15;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.beginPath();
  ctx.arc(64, 44, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Etched SHA-256 / PEM cipher bit-lanes & hash blocks
  for (let y = 76; y < 478; y += 14) {
    const isHeaderRow = y % 84 === 76;
    ctx.fillStyle = isHeaderRow ? 'rgba(212, 166, 79, 0.88)' : 'rgba(148, 163, 184, 0.58)';
    if (isHeaderRow) {
      ctx.fillRect(18, y, 92, 4);
    } else {
      let cx = 18;
      let seed = y * 17;
      while (cx < 104) {
        seed = (seed * 31 + 13) % 97;
        const segW = 6 + (seed % 14);
        if (cx + segW <= 108) {
          ctx.fillRect(cx, y, segW, 3);
        }
        cx += segW + 4;
      }
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
 * Sculpts a forged metallic automaton sentinel mask & faceted cybernetic helm:
 * angular V-sloped visor brow, raised central armored barbute crest prow,
 * chiseled planar cheek armor bevels, and recessed gunmetal optic wells.
 */
function sculptAutomatonMaskGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1.0, 64, 52);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const brightAlloy = new THREE.Color('#ffffff');
  const recessVoid = new THREE.Color('#111824');
  const bevelShadow = new THREE.Color('#526075');

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x;
    const ny = v.y;
    const nz = v.z;

    let x = nx * 0.86;
    let y = ny * 1.06;
    let z = nz * 1.04;
    const col = brightAlloy.clone();

    // 1. Machined lateral temple recesses behind visor brow
    if (ny > -0.04 && ny < 0.56 && Math.abs(nx) > 0.54) {
      const indent =
        Math.exp(-Math.pow((ny - 0.24) / 0.24, 2)) *
        Math.exp(-Math.pow((nz - 0.2) / 0.45, 2)) *
        Math.max(0, Math.abs(nx) - 0.54);
      x -= Math.sign(nx) * indent * 0.34;
      col.lerp(bevelShadow, Math.min(1, indent * 1.4));
    }

    // 2. Streamlined rear automaton helm vault
    if (nz < -0.3) {
      z -= 0.1 * Math.exp(-Math.pow((ny - 0.08) / 0.45, 2));
    }

    // 3. Angular armored faceplate taper toward the lower vox/telemetry grille
    if (ny < -0.08) {
      const t = Math.min(1, (-ny - 0.08) / 0.92);
      x *= 1.0 - t * 0.38;
      if (nz < 0.18) {
        y += t * 0.3;
        z *= 1.0 - t * 0.24;
      }
    }

    // 4. Faceted front automaton visor, central barbute prow crest, & optic housings
    if (nz > 0.3) {
      // Angular V-sloped armored visor brow overhang
      const browTargetY = 0.23 + Math.abs(nx) * 0.14;
      const browRidge =
        Math.exp(-Math.pow((ny - browTargetY) / 0.07, 2)) *
        Math.exp(-Math.pow(nx / 0.64, 2));
      z += browRidge * 0.18;
      y -= browRidge * 0.025;

      // Chiseled upper cheek-guard armor flares
      const cheekGuard =
        Math.exp(-Math.pow((Math.abs(nx) - 0.47) / 0.13, 2)) *
        Math.exp(-Math.pow((ny + 0.04) / 0.095, 2));
      x += Math.sign(nx) * cheekGuard * 0.12;
      z += cheekGuard * 0.11;

      // Planar lower cheek bevels (machined facet shading)
      const lowerFacet =
        Math.exp(-Math.pow((Math.abs(nx) - 0.36) / 0.15, 2)) *
        Math.exp(-Math.pow((ny + 0.27) / 0.15, 2));
      x -= Math.sign(nx) * lowerFacet * 0.09;
      z -= lowerFacet * 0.09;
      col.lerp(bevelShadow, Math.min(1, lowerFacet * 0.85));

      // Recessed gunmetal optic housings
      const leftOrbit = Math.hypot((nx + 0.33) / 0.205, (ny - 0.06) / 0.155);
      const rightOrbit = Math.hypot((nx - 0.33) / 0.215, (ny - 0.06) / 0.165);
      const minOrbit = Math.min(leftOrbit, rightOrbit);
      if (minOrbit < 1.0) {
        const depth = Math.pow(1.0 - minOrbit * minOrbit, 1.15);
        z -= depth * 0.38;
        col.lerp(recessVoid, Math.min(1, depth * 1.4));
      } else if (minOrbit < 1.2) {
        const rim = Math.sin(((minOrbit - 1.0) / 0.2) * Math.PI);
        z += rim * 0.04;
      }

      // Raised V-beveled central barbute visor armor prow
      if (ny > -0.34 && ny < 0.28) {
        const crestProfile =
          Math.max(0, 1.0 - Math.abs(nx) / 0.115) *
          Math.exp(-Math.pow((ny + 0.03) / 0.22, 2));
        z += crestProfile * 0.095;
      }
    }

    // Precision lower mounting flange for the articulated telemetry grille
    if (y < -0.48) {
      y = -0.48 + (y + 0.48) * 0.2;
      col.lerp(bevelShadow, 0.5);
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
  private envRenderTarget: THREE.WebGLRenderTarget;
  private rootAnchor: THREE.Group;
  private headTiltGroup: THREE.Group;
  private jawPivot: THREE.Group;
  private relayCoreMat: THREE.MeshStandardMaterial;
  private turretRevolverGroup: THREE.Group;
  private eyeOuterRing: THREE.Group;
  private eyeBarrel: THREE.Group;
  private eyeLensMat: THREE.MeshStandardMaterial;
  private eyeGlowSprite: THREE.Sprite;
  private eyeTipMarker: THREE.Object3D;
  private bioVialMats: THREE.MeshStandardMaterial[] = [];
  private antennaLampMat: THREE.MeshStandardMaterial;
  private gyroCoreGroup: THREE.Group;
  private gyroOuterGimbal: THREE.Group;
  private gyroInnerGimbal: THREE.Group;
  private gyroPrismMat: THREE.MeshStandardMaterial;
  private holoOrbitRings: THREE.Group;
  private holoProjectorCone: THREE.Mesh;
  private scanBeamGroup: THREE.Group;
  private scanConeMesh: THREE.Mesh;
  private scanCoreLine: THREE.Mesh;
  private scanReticleGroup: THREE.Group;
  private ambientLight: THREE.AmbientLight;
  private coldFillLight: THREE.DirectionalLight;
  private orbitRing1Mat: THREE.MeshBasicMaterial;
  private orbitRing2Mat: THREE.MeshBasicMaterial;
  private holoConeMat: THREE.MeshBasicMaterial;
  private scanConeMat: THREE.MeshBasicMaterial;
  private scanCoreMat: THREE.MeshBasicMaterial;
  private retOuterMat: THREE.MeshBasicMaterial;
  private retInnerMat: THREE.MeshBasicMaterial;
  private cipherStrips: ArticulatedCipherStrip[] = [];
  private cables: ArticulatedCable[] = [];
  private cipherMoteLayers: CipherMoteLayer[] = [];

  private mode: ServitorMode = 'menu';
  private roamingState: RoamingSubState = 'patrol';
  private pointerNorm = new THREE.Vector2(0, 0);
  private pointerPx = -9999;
  private pointerPy = -9999;
  private hoveredMenuPoint: { x: number; y: number } | null = null;
  private isUnitHovered = false;
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
      initialTheme?: 'dark' | 'light';
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

    // Moody sanctum vault PMREM reflection map: true metallic sheen without overexposure
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envEquirect = createVaultEnvironmentEquirect();
    this.envRenderTarget = pmremGenerator.fromEquirectangular(envEquirect);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.52;
    envEquirect.dispose();
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      38,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      100
    );
    this.camera.position.set(0, 0, 12.2);

    // ─── Regal Cybernetic Chiaroscuro Lighting (Warm Brass Key + Teal Rim + Slate Fill)
    this.ambientLight = new THREE.AmbientLight('#4b5565', 0.68);
    this.scene.add(this.ambientLight);

    const warmBrassKey = new THREE.DirectionalLight('#ffe8bf', 2.9);
    warmBrassKey.position.set(4.2, 5.2, 7.2);
    this.scene.add(warmBrassKey);

    const tealIndigoRim = new THREE.DirectionalLight('#14b8a6', 2.08);
    tealIndigoRim.position.set(-6.5, 2.2, -3.5);
    this.scene.add(tealIndigoRim);

    this.coldFillLight = new THREE.DirectionalLight('#728399', 1.02);
    this.coldFillLight.position.set(2.5, -5.5, 3.2);
    this.scene.add(this.coldFillLight);

    this.rootAnchor = new THREE.Group();
    this.scene.add(this.rootAnchor);

    this.headTiltGroup = new THREE.Group();
    this.rootAnchor.add(this.headTiltGroup);

    // ─── Procedural Gothic-Cybernetic PBR Textures & Materials ─────────────────
    const { map: helmMap, bumpMap: helmBump } = createAutomatonHelmTextures();
    const metalBump = createPittedMetalBump();
    const cowlTex = createCipherShroudTexture();
    const coolantLouvreTex = createLouvreCoolantTexture();
    const cipherPlateTex = createCipherPlateTexture();
    const opticFlareTex = createGlowSpriteTexture(
      'rgba(236, 254, 255, 1)',
      'rgba(20, 184, 166, 0.78)'
    );
    this.disposableTextures.push(
      helmMap,
      helmBump,
      metalBump,
      cowlTex,
      coolantLouvreTex,
      cipherPlateTex,
      opticFlareTex
    );

    const automatonHelmMat = new THREE.MeshStandardMaterial({
      map: helmMap,
      bumpMap: helmBump,
      bumpScale: 0.023,
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.62,
    });

    const pewterArmorMat = new THREE.MeshStandardMaterial({
      color: '#5b697d',
      bumpMap: metalBump,
      bumpScale: 0.022,
      roughness: 0.38,
      metalness: 0.68,
    });

    const forgedIronMat = new THREE.MeshStandardMaterial({
      color: '#333d4d',
      bumpMap: metalBump,
      bumpScale: 0.026,
      roughness: 0.4,
      metalness: 0.76,
    });

    const blackenedIronMat = new THREE.MeshStandardMaterial({
      color: '#12161d',
      bumpMap: metalBump,
      bumpScale: 0.022,
      roughness: 0.5,
      metalness: 0.85,
    });

    const burnishedBrassMat = new THREE.MeshStandardMaterial({
      color: '#b48337',
      bumpMap: metalBump,
      bumpScale: 0.018,
      roughness: 0.33,
      metalness: 0.91,
    });

    const tarnishedCopperMat = new THREE.MeshStandardMaterial({
      color: '#8f522e',
      bumpMap: metalBump,
      bumpScale: 0.02,
      roughness: 0.39,
      metalness: 0.86,
    });

    const cipherShroudMat = new THREE.MeshStandardMaterial({
      map: cowlTex,
      bumpMap: metalBump,
      bumpScale: 0.02,
      side: THREE.DoubleSide,
      roughness: 0.84,
      metalness: 0.12,
    });

    const coolantLouvreMat = new THREE.MeshStandardMaterial({
      map: coolantLouvreTex,
      bumpMap: metalBump,
      bumpScale: 0.018,
      roughness: 0.42,
      metalness: 0.72,
    });

    // ─── 1. Forged Metallic Automaton Sentinel Mask & Central Visor Spine ──────
    const helmMesh = new THREE.Mesh(sculptAutomatonMaskGeometry(), automatonHelmMat);
    this.headTiltGroup.add(helmMesh);

    // Burnished-brass central barbute visor crest spine & hex micro-rivets
    const visorSpine = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.38, 0.068),
      burnishedBrassMat
    );
    visorSpine.position.set(0, 0.05, 1.08);
    visorSpine.rotation.x = -0.05;
    this.headTiltGroup.add(visorSpine);

    for (const ry of [-0.09, 0.05, 0.19]) {
      const rivet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.024, 6),
        forgedIronMat
      );
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(0, ry, 1.115);
      this.headTiltGroup.add(rivet);
    }

    // ─── 2. Obsidian / Slate-Indigo Cipher Shroud & Heavy Brass Gorget ─────────
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
    // Flare lower shroud skirt outward around the gorget collar
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
    const cowlMesh = new THREE.Mesh(cowlGeom, cipherShroudMat);
    this.headTiltGroup.add(cowlMesh);

    // Heavy Riveted Gunmetal & Burnished Brass Gorget Collar around neck base
    const gorgetGroup = new THREE.Group();
    gorgetGroup.position.set(0, -0.78, 0.04);
    gorgetGroup.rotation.x = 0.16;
    this.headTiltGroup.add(gorgetGroup);

    const gorgetOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.86, 0.32, 24, 1, true),
      forgedIronMat
    );
    gorgetGroup.add(gorgetOuter);

    const gorgetTopBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.038, 10, 28),
      burnishedBrassMat
    );
    gorgetTopBrassRim.rotation.x = Math.PI / 2;
    gorgetTopBrassRim.position.y = 0.15;
    gorgetGroup.add(gorgetTopBrassRim);

    const gorgetBottomBrassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.042, 10, 28),
      burnishedBrassMat
    );
    gorgetBottomBrassRim.rotation.x = Math.PI / 2;
    gorgetBottomBrassRim.position.y = -0.15;
    gorgetGroup.add(gorgetBottomBrassRim);

    // Hexagonal brass studs around the front of the gorget
    for (let i = -4; i <= 4; i++) {
      const a = i * 0.26;
      const stud = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.032, 0.05, 6),
        burnishedBrassMat
      );
      stud.position.set(Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78);
      stud.rotation.x = Math.PI / 2;
      stud.rotation.z = -a;
      gorgetGroup.add(stud);
    }

    // ─── 3. Symmetrical Forged Crown Armor Plates & Hexagonal Brass Bolts ──────
    for (const side of [-1, 1]) {
      const crownPlateGeom = new THREE.SphereGeometry(
        1.022,
        24,
        18,
        side < 0 ? Math.PI * 0.08 : Math.PI * 0.58,
        Math.PI * 0.34,
        0.13,
        Math.PI * 0.34
      );
      crownPlateGeom.scale(0.87, 1.07, 1.05);
      const crownPlate = new THREE.Mesh(crownPlateGeom, pewterArmorMat);
      this.headTiltGroup.add(crownPlate);

      // Precision hexagonal brass bolts along each crown plate bevel
      for (let b = 0; b < 4; b++) {
        const t = b / 3;
        const by = 0.34 + t * 0.42;
        const bx = side * (0.2 + t * 0.12);
        const bz = Math.sqrt(Math.max(0.12, 1.03 - bx * bx - (by / 1.07) * (by / 1.07)));
        const hexBolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.028, 6),
          burnishedBrassMat
        );
        hexBolt.rotation.x = Math.PI / 2 - by * 0.45;
        hexBolt.rotation.z = -side * 0.22;
        hexBolt.position.set(bx, by, bz);
        this.headTiltGroup.add(hexBolt);
      }
    }

    // ─── 4. Forehead Octagonal X.509 Cipher Keystone Medallion ─────────────────
    const keystoneGroup = new THREE.Group();
    keystoneGroup.position.set(0, 0.52, 0.96);
    keystoneGroup.rotation.x = -0.36;
    this.headTiltGroup.add(keystoneGroup);

    // Beveled octagonal burnished-brass escutcheon bezel
    const keystoneBezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.205, 0.036, 8),
      burnishedBrassMat
    );
    keystoneBezel.rotation.x = Math.PI / 2;
    keystoneBezel.rotation.z = Math.PI / 8;
    keystoneGroup.add(keystoneBezel);

    // Recessed blackened-iron octagonal cipher dial
    const keystoneDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.146, 0.146, 0.044, 8),
      blackenedIronMat
    );
    keystoneDial.rotation.x = Math.PI / 2;
    keystoneDial.rotation.z = Math.PI / 8;
    keystoneGroup.add(keystoneDial);

    // Inner precision brass bus ring
    const keystoneInnerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.108, 0.013, 8, 24),
      burnishedBrassMat
    );
    keystoneInnerRing.position.z = 0.022;
    keystoneGroup.add(keystoneInnerRing);

    // 4 cardinal diamond circuit-bus pins (N, E, S, W compass points)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pin = new THREE.Mesh(
        new THREE.BoxGeometry(0.038, 0.038, 0.032),
        burnishedBrassMat
      );
      pin.position.set(Math.cos(a) * 0.168, Math.sin(a) * 0.168, 0.012);
      pin.rotation.z = a + Math.PI / 4;
      keystoneGroup.add(pin);
    }

    // Faceted glowing amber-gold cryptographic octahedron keystone at center
    const keystoneGem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.068, 0),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 1.9,
        roughness: 0.18,
        metalness: 0.35,
      })
    );
    keystoneGem.scale.set(0.95, 1.15, 0.55);
    keystoneGem.position.set(0, 0, 0.032);
    keystoneGroup.add(keystoneGem);

    // ─── 5. Right Optic Housing: Tri-Lens Revolver Optical Turret ──────────────
    const turretMount = new THREE.Group();
    turretMount.position.set(0.33, 0.06, 0.76);
    turretMount.rotation.y = 0.12;
    this.headTiltGroup.add(turretMount);

    // Octagonal forged gunmetal optic mount bolted into right housing
    const socketArmor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.34, 0.18, 8),
      forgedIronMat
    );
    socketArmor.rotation.x = Math.PI / 2;
    turretMount.add(socketArmor);

    for (let b = 0; b < 8; b++) {
      const ba = (b / 8) * Math.PI * 2 + Math.PI / 8;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6),
        burnishedBrassMat
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
      burnishedBrassMat
    );
    revolverPlate.rotation.x = Math.PI / 2;
    this.turretRevolverGroup.add(revolverPlate);

    // PRIMARY LENS: Teal-Cyan Telescoping Optical Barrel with Brass Crosshairs
    const primaryHousing = new THREE.Group();
    primaryHousing.position.set(-0.03, -0.02, 0.03);
    this.turretRevolverGroup.add(primaryHousing);

    this.eyeOuterRing = new THREE.Group();
    primaryHousing.add(this.eyeOuterRing);

    const knurledRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.185, 0.028, 10, 24),
      burnishedBrassMat
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
      burnishedBrassMat
    );
    barrelBrassLip.position.z = 0.105;
    this.eyeBarrel.add(barrelBrassLip);

    // Brass targeting crosshair etched across front of primary lens
    for (let c = 0; c < 2; c++) {
      const hair = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, 0.009, 0.012),
        burnishedBrassMat
      );
      hair.position.z = 0.142;
      hair.rotation.z = (c * Math.PI) / 2;
      this.eyeBarrel.add(hair);
    }

    this.eyeLensMat = new THREE.MeshStandardMaterial({
      color: '#2dd4bf',
      emissive: '#0d9488',
      emissiveIntensity: 3.3,
      roughness: 0.1,
      metalness: 0.15,
    });
    const primaryLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.132, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      this.eyeLensMat
    );
    primaryLens.rotation.x = Math.PI / 2;
    primaryLens.position.z = 0.085;
    this.eyeBarrel.add(primaryLens);

    const hotCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#ecfeff' })
    );
    hotCore.position.z = 0.19;
    this.eyeBarrel.add(hotCore);

    const flareMat = new THREE.SpriteMaterial({
      map: opticFlareTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.88,
    });
    this.eyeGlowSprite = new THREE.Sprite(flareMat);
    this.eyeGlowSprite.scale.set(0.86, 0.86, 1);
    this.eyeGlowSprite.position.z = 0.24;
    this.eyeBarrel.add(this.eyeGlowSprite);

    const eyeBounceLight = new THREE.PointLight('#14b8a6', 2.0, 3.6);
    eyeBounceLight.position.set(0, 0, 0.35);
    this.eyeBarrel.add(eyeBounceLight);

    this.eyeTipMarker = new THREE.Object3D();
    this.eyeTipMarker.position.set(0, 0, 0.23);
    this.eyeBarrel.add(this.eyeTipMarker);

    // SECONDARY TURRET LENS: Amber-Gold Interferometer Targeter at upper-right
    const secBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.078, 0.24, 14),
      burnishedBrassMat
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

    // TERTIARY TURRET LENS: Sapphire Precision Optical Scope at lower-right
    const tertBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 0.32, 12),
      forgedIronMat
    );
    tertBarrel.rotation.x = Math.PI / 2;
    tertBarrel.position.set(0.17, -0.14, 0.14);
    this.turretRevolverGroup.add(tertBarrel);

    const tertLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.033, 10, 10),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 2.8,
      })
    );
    tertLens.position.set(0.17, -0.14, 0.3);
    this.turretRevolverGroup.add(tertLens);

    // ─── 6. Left Optic: Armored Amber-Gold Slit-Visor Sensor Module ────────────
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
      forgedIronMat
    );
    visorSlitBarTop.position.set(0, 0.042, 0.055);
    leftEyeGroup.add(visorSlitBarTop);

    const visorSlitBarBot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.065, 0.05),
      forgedIronMat
    );
    visorSlitBarBot.position.set(0, -0.042, 0.055);
    leftEyeGroup.add(visorSlitBarBot);

    const visorAmberSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.022, 0.04),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 2.8,
      })
    );
    visorAmberSlit.position.set(0, 0, 0.052);
    leftEyeGroup.add(visorAmberSlit);

    // ─── 7. Articulated Vox-Telemetry Grille & Louvered Coolant Canisters ──────
    this.jawPivot = new THREE.Group();
    this.jawPivot.position.set(0, -0.32, 0.16);
    this.headTiltGroup.add(this.jawPivot);

    // Hydraulic cheek-actuators coupling lower faceplate grille to upper helm
    for (const side of [-1, 1]) {
      const pistonOuter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.36, 10),
        burnishedBrassMat
      );
      pistonOuter.position.set(side * 0.46, -0.08, 0.28);
      pistonOuter.rotation.x = 0.48;
      pistonOuter.rotation.z = side * 0.22;
      this.jawPivot.add(pistonOuter);
    }

    // Faceted gunmetal lower faceplate grille housing
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
    const muzzleShell = new THREE.Mesh(muzzleGeom, forgedIronMat);
    muzzleShell.position.set(0, -0.28, 0.44);
    this.jawPivot.add(muzzleShell);

    const muzzleBrassTrimTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.055, 0.32),
      burnishedBrassMat
    );
    muzzleBrassTrimTop.position.set(0, -0.07, 0.56);
    this.jawPivot.add(muzzleBrassTrimTop);

    const muzzleChinProw = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.11, 0.38),
      burnishedBrassMat
    );
    muzzleChinProw.position.set(0, -0.49, 0.56);
    this.jawPivot.add(muzzleChinProw);

    // Glowing Amber-Teal Relay-Core behind steel grille bars
    this.relayCoreMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 2.0,
      roughness: 0.3,
    });
    const relayCore = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.16), this.relayCoreMat);
    relayCore.position.set(0, -0.28, 0.62);
    this.jawPivot.add(relayCore);

    // 9 vertical steel grille bars across lower faceplate
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

    // Twin Lateral Louvered Heat-Sink Canisters + Armored Conduit Hoses
    for (const side of [-1, 1]) {
      const canisterGroup = new THREE.Group();
      canisterGroup.position.set(side * 0.46, -0.32, 0.48);
      canisterGroup.rotation.z = side * 0.48;
      canisterGroup.rotation.y = side * 0.42;
      this.jawPivot.add(canisterGroup);

      const canBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.115, 0.125, 0.24, 16),
        coolantLouvreMat
      );
      canisterGroup.add(canBody);

      const canCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.045, 16),
        burnishedBrassMat
      );
      canCap.position.y = -0.12;
      canisterGroup.add(canCap);

      // Corrugated conduit curving from canister into gorget
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

    // ─── 8. Dielectric Coolant Vials & Telemetry Dipole Transceiver Mast ───────
    const vialConfigs = [
      { pos: [0.86, 0.84, 0.06] as const, rotZ: -0.56, rotX: -0.12, color: '#34d399', em: '#059669' },
      { pos: [1.02, 0.54, -0.14] as const, rotZ: -0.86, rotX: -0.22, color: '#38bdf8', em: '#0284c7' },
    ];

    vialConfigs.forEach((vc) => {
      const vGroup = new THREE.Group();
      vGroup.position.set(vc.pos[0], vc.pos[1], vc.pos[2]);
      vGroup.rotation.z = vc.rotZ;
      vGroup.rotation.x = vc.rotX;
      this.headTiltGroup.add(vGroup);

      const socketCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.11, 0.12, 12),
        burnishedBrassMat
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
        burnishedBrassMat
      );
      topCap.position.y = 0.34;
      vGroup.add(topCap);

      // 4 protective brass cage bars around vial
      for (let b = 0; b < 4; b++) {
        const ba = (b / 4) * Math.PI * 2;
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.28, 6),
          burnishedBrassMat
        );
        strut.position.set(Math.cos(ba) * 0.078, 0.18, Math.sin(ba) * 0.078);
        vGroup.add(strut);
      }
    });

    // Telemetry Dipole Transceiver Mast mounted on Left Shroud
    const mastGroup = new THREE.Group();
    mastGroup.position.set(-0.84, 0.88, -0.06);
    mastGroup.rotation.z = 0.32;
    this.headTiltGroup.add(mastGroup);

    const mastSocket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.1, 0.16, 10),
      burnishedBrassMat
    );
    mastGroup.add(mastSocket);

    const mastSpire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.032, 0.96, 8),
      forgedIronMat
    );
    mastSpire.position.y = 0.52;
    mastGroup.add(mastSpire);

    // Toroidal RF inductor coil & telemetry dipole ring on mast
    for (const coilY of [0.38, 0.68]) {
      const coilR = coilY > 0.55 ? 0.085 : 0.125;
      const coilRing = new THREE.Mesh(
        new THREE.TorusGeometry(coilR, 0.014, 8, 20),
        burnishedBrassMat
      );
      coilRing.rotation.x = Math.PI / 2;
      coilRing.position.y = coilY;
      mastGroup.add(coilRing);
    }

    this.antennaLampMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 3.0,
    });
    const mastLamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 10, 10),
      this.antennaLampMat
    );
    mastLamp.position.y = 1.02;
    mastGroup.add(mastLamp);

    // ─── 9. Hexagonal Brass Lock-Hasps & Articulated X.509 Cipher Key-Plates ───
    const cipherPlateMat = new THREE.MeshStandardMaterial({
      map: cipherPlateTex,
      bumpMap: metalBump,
      bumpScale: 0.014,
      side: THREE.DoubleSide,
      roughness: 0.36,
      metalness: 0.8,
    });

    const claspPlacements = [
      {
        pos: [-0.66, -0.58, 0.56] as const,
        rotY: -0.45,
        rotZ: -0.08,
        ledColor: '#34d399',
        ledEmissive: '#059669',
        lengths: [0.92, 0.74],
      },
      {
        pos: [0.68, -0.62, 0.48] as const,
        rotY: 0.52,
        rotZ: 0.1,
        ledColor: '#fbbf24',
        ledEmissive: '#d97706',
        lengths: [0.8],
      },
    ];

    claspPlacements.forEach((cp, cpIdx) => {
      const claspAnchor = new THREE.Group();
      claspAnchor.position.set(cp.pos[0], cp.pos[1], cp.pos[2]);
      claspAnchor.rotation.y = cp.rotY;
      claspAnchor.rotation.z = cp.rotZ;
      this.headTiltGroup.add(claspAnchor);

      // Hexagonal blackened-iron cryptographic lock-clasp housing
      const hexHousing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.135, 0.148, 0.048, 6),
        blackenedIronMat
      );
      hexHousing.rotation.x = Math.PI / 2;
      hexHousing.position.z = 0.034;
      claspAnchor.add(hexHousing);

      // Hexagonal burnished-brass collar bezel
      const hexBezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.112, 0.022, 6, 6),
        burnishedBrassMat
      );
      hexBezel.position.z = 0.056;
      claspAnchor.add(hexBezel);

      // Glowing X.509 verification status jewel at center of lock-clasp
      const statusJewel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.044, 0),
        new THREE.MeshStandardMaterial({
          color: cp.ledColor,
          emissive: cp.ledEmissive,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        })
      );
      statusJewel.scale.set(1, 1, 0.55);
      statusJewel.position.z = 0.068;
      claspAnchor.add(statusJewel);

      cp.lengths.forEach((len, lIdx) => {
        const segCount = 4;
        const segLen = len / segCount;
        const pivots: THREE.Group[] = [];
        const baseRotZ = (lIdx === 0 ? -0.08 : 0.11) + cpIdx * 0.04;

        let parentNode: THREE.Object3D = claspAnchor;
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

          const sliceGeom = new THREE.PlaneGeometry(0.168, segLen * 0.94, 1, 1);
          const uvAttr = sliceGeom.attributes.uv;
          const vTop = 1 - s / segCount;
          const vBot = 1 - (s + 1) / segCount;
          for (let k = 0; k < uvAttr.count; k++) {
            uvAttr.setY(k, uvAttr.getY(k) > 0.5 ? vTop : vBot);
          }
          sliceGeom.translate(0, -segLen * 0.5, 0);

          const sliceMesh = new THREE.Mesh(sliceGeom, cipherPlateMat);
          pivot.add(sliceMesh);
          parentNode = pivot;
        }

        this.cipherStrips.push({
          pivots,
          baseRotZ,
          phase: cpIdx * 2.1 + lIdx * 1.4,
        });
      });
    });

    // ─── 10. Underside Dual-Axis Gyroscopic Cipher Core ────────────────────────
    this.gyroCoreGroup = new THREE.Group();
    this.gyroCoreGroup.position.set(0, -0.92, 0.02);
    this.headTiltGroup.add(this.gyroCoreGroup);

    // 3 Precision struts connecting gorget underside to upper gimbal yoke
    for (let ch = 0; ch < 3; ch++) {
      const ca = (ch / 3) * Math.PI * 2;
      const strutRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.28, 6),
        blackenedIronMat
      );
      strutRod.position.set(Math.cos(ca) * 0.2, -0.12, Math.sin(ca) * 0.2);
      strutRod.rotation.z = Math.cos(ca) * 0.24;
      strutRod.rotation.x = -Math.sin(ca) * 0.24;
      this.gyroCoreGroup.add(strutRod);
    }

    const gimbalYokeCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.022, 8, 20),
      burnishedBrassMat
    );
    gimbalYokeCollar.rotation.x = Math.PI / 2;
    gimbalYokeCollar.position.y = -0.23;
    this.gyroCoreGroup.add(gimbalYokeCollar);

    // Counter-rotating outer burnished-brass gimbal ring
    this.gyroOuterGimbal = new THREE.Group();
    this.gyroOuterGimbal.position.y = -0.46;
    this.gyroCoreGroup.add(this.gyroOuterGimbal);

    const outerGimbalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.022, 10, 32),
      burnishedBrassMat
    );
    this.gyroOuterGimbal.add(outerGimbalRing);

    for (let g = 0; g < 4; g++) {
      const ga = (g / 4) * Math.PI * 2;
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.036, 0.036, 0.048),
        forgedIronMat
      );
      lug.position.set(Math.cos(ga) * 0.24, Math.sin(ga) * 0.24, 0);
      lug.rotation.z = ga;
      this.gyroOuterGimbal.add(lug);
    }

    // Orthogonal inner steel-and-copper gimbal ring
    this.gyroInnerGimbal = new THREE.Group();
    this.gyroOuterGimbal.add(this.gyroInnerGimbal);

    const innerGimbalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.172, 0.017, 10, 28),
      tarnishedCopperMat
    );
    innerGimbalRing.rotation.y = Math.PI / 2;
    this.gyroInnerGimbal.add(innerGimbalRing);

    // Faceted emerald-teal octahedral cryptographic prism core
    this.gyroPrismMat = new THREE.MeshStandardMaterial({
      color: '#34d399',
      emissive: '#059669',
      emissiveIntensity: 2.9,
      roughness: 0.16,
      metalness: 0.3,
    });
    const gyroPrismCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.105, 0),
      this.gyroPrismMat
    );
    gyroPrismCore.scale.set(0.92, 1.22, 0.92);
    this.gyroInnerGimbal.add(gyroPrismCore);

    const gyroCoreLight = new THREE.PointLight('#10b981', 1.25, 3.0);
    gyroCoreLight.position.set(0, -0.46, 0.18);
    this.gyroCoreGroup.add(gyroCoreLight);

    // ─── 11. Segmented Conduit Arms (Caliper, Optical Collimator & Probe) ──────
    const sharedCableCylGeom = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false);
    const sharedCableJointGeom = new THREE.SphereGeometry(1.06, 8, 6);
    const sharedCableRibGeom = new THREE.TorusGeometry(1.24, 0.24, 6, 12);
    sharedCableRibGeom.rotateX(Math.PI / 2);

    const cableDefs: Array<{
      pts: [number, number, number][];
      radius: number;
      mat: THREE.Material;
      tipType?: 'caliper' | 'optic' | 'probe';
    }> = [
      {
        pts: [
          [0.54, -0.82, -0.12],
          [0.88, -1.24, -0.18],
          [0.82, -1.78, 0.06],
          [0.95, -2.22, 0.34],
        ],
        radius: 0.062,
        mat: forgedIronMat,
        tipType: 'caliper',
      },
      {
        pts: [
          [-0.54, -0.82, -0.12],
          [-0.86, -1.28, -0.22],
          [-0.78, -1.82, 0.04],
          [-0.88, -2.26, 0.3],
        ],
        radius: 0.058,
        mat: forgedIronMat,
        tipType: 'optic',
      },
      {
        pts: [
          [0.24, -0.88, -0.34],
          [0.36, -1.46, -0.52],
          [0.22, -2.04, -0.38],
          [0.3, -2.52, -0.2],
        ],
        radius: 0.046,
        mat: coolantLouvreMat,
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

      // Segmented brass/steel rings along the conduit arm
      const ribRings: THREE.Mesh[] = [];
      const ringCount = 6;
      for (let r = 1; r <= ringCount; r++) {
        const ringMesh = new THREE.Mesh(
          sharedCableRibGeom,
          r % 2 === 0 ? burnishedBrassMat : forgedIronMat
        );
        ringMesh.scale.setScalar(cfg.radius);
        this.rootAnchor.add(ringMesh);
        ribRings.push(ringMesh);
      }

      let tipGroup: THREE.Group | undefined;
      let tipSpinMesh: THREE.Mesh | undefined;

      if (cfg.tipType === 'caliper') {
        tipGroup = new THREE.Group();
        const wrist = new THREE.Mesh(
          new THREE.CylinderGeometry(0.088, 0.072, 0.13, 8),
          burnishedBrassMat
        );
        tipGroup.add(wrist);

        const contactDiode = new THREE.Mesh(
          new THREE.SphereGeometry(0.028, 8, 8),
          new THREE.MeshStandardMaterial({
            color: '#34d399',
            emissive: '#059669',
            emissiveIntensity: 2.4,
          })
        );
        contactDiode.position.y = -0.08;
        tipGroup.add(contactDiode);

        // 3 Precision beveled micro-caliper contact fingers (non-claw)
        for (let p = 0; p < 3; p++) {
          const a = (p / 3) * Math.PI * 2;
          const finger = new THREE.Mesh(
            new THREE.BoxGeometry(0.022, 0.17, 0.03),
            forgedIronMat
          );
          finger.position.set(Math.cos(a) * 0.072, -0.14, Math.sin(a) * 0.072);
          finger.rotation.x = Math.sin(a) * 0.24;
          finger.rotation.z = -Math.cos(a) * 0.24;
          tipGroup.add(finger);
        }
        this.rootAnchor.add(tipGroup);
      } else if (cfg.tipType === 'optic') {
        tipGroup = new THREE.Group();
        const yokeHousing = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.14, 0.085),
          burnishedBrassMat
        );
        tipGroup.add(yokeHousing);

        // Smooth rotary optical collimator & multi-prism aperture wheel (no saw teeth)
        const collimatorWheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.135, 0.135, 0.026, 24),
          blackenedIronMat
        );
        collimatorWheel.rotation.z = Math.PI / 2;
        collimatorWheel.position.y = -0.15;

        const brassWheelRim = new THREE.Mesh(
          new THREE.TorusGeometry(0.135, 0.016, 8, 24),
          burnishedBrassMat
        );
        brassWheelRim.rotation.x = Math.PI / 2;
        collimatorWheel.add(brassWheelRim);

        const apertureLensMat = new THREE.MeshStandardMaterial({
          color: '#2dd4bf',
          emissive: '#0d9488',
          emissiveIntensity: 2.4,
        });
        for (let st = 0; st < 6; st++) {
          const sa = (st / 6) * Math.PI * 2;
          const microPrism = new THREE.Mesh(
            new THREE.CylinderGeometry(0.022, 0.022, 0.032, 8),
            apertureLensMat
          );
          microPrism.position.set(Math.cos(sa) * 0.082, 0, Math.sin(sa) * 0.082);
          collimatorWheel.add(microPrism);
        }
        tipGroup.add(collimatorWheel);
        tipSpinMesh = collimatorWheel;
        this.rootAnchor.add(tipGroup);
      } else if (cfg.tipType === 'probe') {
        tipGroup = new THREE.Group();
        const collar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.042, 0.1, 8),
          burnishedBrassMat
        );
        tipGroup.add(collar);

        const stylusShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.01, 0.2, 8),
          forgedIronMat
        );
        stylusShaft.position.y = -0.14;
        tipGroup.add(stylusShaft);

        const tipBead = new THREE.Mesh(
          new THREE.SphereGeometry(0.022, 8, 8),
          new THREE.MeshStandardMaterial({
            color: '#fbbf24',
            emissive: '#d97706',
            emissiveIntensity: 2.5,
          })
        );
        tipBead.position.y = -0.24;
        tipGroup.add(tipBead);
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

    // ─── 12. Teal-Emerald & Brass Holographic Cipher Orbit Rings & Cone ────────
    this.holoOrbitRings = new THREE.Group();
    this.rootAnchor.add(this.holoOrbitRings);

    this.orbitRing1Mat = new THREE.MeshBasicMaterial({
      color: '#14b8a6',
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orbitRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.78, 0.011, 8, 64),
      this.orbitRing1Mat
    );
    orbitRing1.rotation.x = 1.18;
    orbitRing1.rotation.y = 0.28;
    this.holoOrbitRings.add(orbitRing1);

    this.orbitRing2Mat = new THREE.MeshBasicMaterial({
      color: '#d97706',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const orbitRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.05, 0.009, 8, 64),
      this.orbitRing2Mat
    );
    orbitRing2.rotation.x = -0.95;
    orbitRing2.rotation.z = 0.42;
    this.holoOrbitRings.add(orbitRing2);

    const holoConeGeom = new THREE.ConeGeometry(1.3, 4.2, 28, 1, true);
    holoConeGeom.translate(0, -2.1, 0);
    holoConeGeom.rotateX(-Math.PI / 2);
    this.holoConeMat = new THREE.MeshBasicMaterial({
      color: '#14b8a6',
      transparent: true,
      opacity: 0.075,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.holoProjectorCone = new THREE.Mesh(holoConeGeom, this.holoConeMat);
    this.eyeBarrel.add(this.holoProjectorCone);

    // ─── 13. World-Space Volumetric Teal-Cyan Optical Telemetry Scan Beam ──────
    this.scanBeamGroup = new THREE.Group();
    this.scanBeamGroup.visible = false;
    this.scene.add(this.scanBeamGroup);

    const scanConeGeom = new THREE.ConeGeometry(0.35, 1.0, 28, 1, true);
    scanConeGeom.rotateX(-Math.PI / 2);
    scanConeGeom.translate(0, 0, 0.5);
    this.scanConeMat = new THREE.MeshBasicMaterial({
      color: '#14b8a6',
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scanConeMesh = new THREE.Mesh(scanConeGeom, this.scanConeMat);
    this.scanBeamGroup.add(this.scanConeMesh);

    const coreCylGeom = new THREE.CylinderGeometry(0.018, 0.009, 1.0, 8);
    coreCylGeom.rotateX(Math.PI / 2);
    coreCylGeom.translate(0, 0, 0.5);
    this.scanCoreMat = new THREE.MeshBasicMaterial({
      color: '#99f6e4',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.scanCoreLine = new THREE.Mesh(coreCylGeom, this.scanCoreMat);
    this.scanBeamGroup.add(this.scanCoreLine);

    this.scanReticleGroup = new THREE.Group();
    this.scanReticleGroup.visible = false;
    this.scene.add(this.scanReticleGroup);

    this.retOuterMat = new THREE.MeshBasicMaterial({
      color: '#2dd4bf',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const retOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.365, 32),
      this.retOuterMat
    );
    this.scanReticleGroup.add(retOuter);

    this.retInnerMat = new THREE.MeshBasicMaterial({
      color: '#f59e0b',
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const retInner = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.165, 8),
      this.retInnerMat
    );
    this.scanReticleGroup.add(retInner);

    // ─── 14. Ambient Cryptographic Telemetry Motes (Static Buffer Drift) ───────
    for (let layer = 0; layer < 2; layer++) {
      const moteCount = 22;
      const motePos = new Float32Array(moteCount * 3);
      for (let i = 0; i < moteCount; i++) {
        motePos[i * 3] = (Math.random() - 0.5) * 2.1;
        motePos[i * 3 + 1] = -1.6 + Math.random() * 2.4;
        motePos[i * 3 + 2] = (Math.random() - 0.5) * 1.7;
      }
      const moteGeom = new THREE.BufferGeometry();
      moteGeom.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
      const moteMat = new THREE.PointsMaterial({
        color: layer === 0 ? '#34d399' : '#fbbf24',
        size: 0.044,
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const points = new THREE.Points(moteGeom, moteMat);
      this.rootAnchor.add(points);
      this.cipherMoteLayers.push({
        points,
        material: moteMat,
        phaseOffset: layer * 0.5,
        swaySeed: layer * 2.4,
      });
    }

    if (options?.initialTheme) {
      this.setTheme(options.initialTheme);
    }

    this.snapToModeInitialPose();
    this.startLoop();
  }

  public setTheme(theme: 'dark' | 'light') {
    const isLight = theme === 'light';
    const blend = isLight ? THREE.NormalBlending : THREE.AdditiveBlending;

    this.scene.environmentIntensity = isLight ? 0.68 : 0.52;
    this.ambientLight.intensity = isLight ? 0.98 : 0.68;
    this.coldFillLight.intensity = isLight ? 1.38 : 1.02;

    this.orbitRing1Mat.blending = blend;
    this.orbitRing1Mat.opacity = isLight ? 0.38 : 0.34;
    this.orbitRing1Mat.color.set(isLight ? '#0d9488' : '#14b8a6');
    this.orbitRing1Mat.needsUpdate = true;

    this.orbitRing2Mat.blending = blend;
    this.orbitRing2Mat.opacity = isLight ? 0.34 : 0.28;
    this.orbitRing2Mat.color.set(isLight ? '#b45309' : '#d97706');
    this.orbitRing2Mat.needsUpdate = true;

    this.holoConeMat.blending = blend;
    this.holoConeMat.opacity = isLight ? 0.09 : 0.075;
    this.holoConeMat.color.set(isLight ? '#0d9488' : '#14b8a6');
    this.holoConeMat.needsUpdate = true;

    this.scanConeMat.blending = blend;
    this.scanConeMat.opacity = isLight ? 0.16 : 0.18;
    this.scanConeMat.color.set(isLight ? '#0d9488' : '#14b8a6');
    this.scanConeMat.needsUpdate = true;

    this.scanCoreMat.blending = blend;
    this.scanCoreMat.opacity = isLight ? 0.68 : 0.8;
    this.scanCoreMat.color.set(isLight ? '#0f766e' : '#99f6e4');
    this.scanCoreMat.needsUpdate = true;

    this.retOuterMat.blending = blend;
    this.retOuterMat.opacity = isLight ? 0.78 : 0.72;
    this.retOuterMat.color.set(isLight ? '#0d9488' : '#2dd4bf');
    this.retOuterMat.needsUpdate = true;

    this.retInnerMat.blending = blend;
    this.retInnerMat.opacity = isLight ? 0.78 : 0.68;
    this.retInnerMat.color.set(isLight ? '#b45309' : '#f59e0b');
    this.retInnerMat.needsUpdate = true;

    this.cipherMoteLayers.forEach((layer, idx) => {
      layer.material.blending = blend;
      layer.material.color.set(
        isLight ? (idx === 0 ? '#059669' : '#b45309') : idx === 0 ? '#34d399' : '#fbbf24'
      );
      layer.material.needsUpdate = true;
    });
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

  public setUnitHovered(hovered: boolean) {
    this.isUnitHovered = hovered;
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
        label: '__VIEWPORT_SANCTITY__',
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
        desiredScale = this.isUnitHovered ? 0.28 : 0.25;
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

    // Respirator jaw heave & binary relay-core flicker
    const heavyRespiratorBreath = (Math.sin(elapsed * 1.6) * 0.5 + 0.5) * 0.045;
    const binaryBurst =
      Math.abs(Math.sin(elapsed * 22.0) * Math.cos(elapsed * 8.5)) * 0.13 * jawChatterAmount;
    this.jawPivot.rotation.x = heavyRespiratorBreath + binaryBurst;
    this.relayCoreMat.emissiveIntensity =
      1.5 + jawChatterAmount * 3.0 + Math.sin(elapsed * 17.0) * 0.4;

    // Revolver turret snap & optical lens rotation
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
      2.9 + Math.sin(elapsed * 6.5) * 0.45 + (this.roamingState === 'scanning' ? 1.5 : 0);
    const flareSize = 0.8 + Math.sin(elapsed * 8.0) * 0.08 + (this.isUnitHovered ? 0.18 : 0);
    this.eyeGlowSprite.scale.set(flareSize, flareSize, 1);

    // Coolant vial luminescence & blinking transceiver beacon
    for (let i = 0; i < this.bioVialMats.length; i++) {
      this.bioVialMats[i].emissiveIntensity = 1.9 + Math.sin(elapsed * 4.5 + i * 2.1) * 0.75;
    }
    this.antennaLampMat.emissiveIntensity = Math.sin(elapsed * 4.4) > 0.3 ? 3.4 : 0.45;

    // Dual-axis counter-rotating gyroscopic cipher core with subtle inertial lag
    this.gyroCoreGroup.rotation.z = THREE.MathUtils.clamp(
      -this.velocity.x * 0.1 + Math.sin(elapsed * 1.9) * 0.06,
      -0.38,
      0.38
    );
    this.gyroCoreGroup.rotation.x = THREE.MathUtils.clamp(
      this.velocity.y * 0.07 + Math.cos(elapsed * 1.5) * 0.05,
      -0.3,
      0.3
    );
    const gimbalRate = this.roamingState === 'scanning' ? 2.4 : 1.0;
    this.gyroOuterGimbal.rotation.y += dt * 1.35 * gimbalRate;
    this.gyroOuterGimbal.rotation.z = Math.sin(elapsed * 1.2) * 0.22;
    this.gyroInnerGimbal.rotation.x += dt * 2.05 * gimbalRate;
    this.gyroInnerGimbal.rotation.z = Math.cos(elapsed * 1.65) * 0.35;
    this.gyroPrismMat.emissiveIntensity = 2.5 + Math.sin(elapsed * 7.5) * 0.65;

    // Articulated X.509 cipher key-plates sway (zero buffer churn)
    for (let sIdx = 0; sIdx < this.cipherStrips.length; sIdx++) {
      const strip = this.cipherStrips[sIdx];
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

    // Undulating ribbed conduit tendrils, actuator claw & rotary optical disc (zero-allocation)
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
        // Rotary optical collimator aperture wheel
        cable.tipSpinMesh.rotation.x += dt * (this.roamingState === 'scanning' ? 10.5 : 3.2);
      }
    }

    // Drifting ambient cryptographic telemetry motes (zero buffer uploads)
    for (let i = 0; i < this.cipherMoteLayers.length; i++) {
      const layer = this.cipherMoteLayers[i];
      const phase = (elapsed * 0.14 + layer.phaseOffset) % 1;
      layer.points.position.y = -1.0 + phase * 2.15;
      layer.points.position.x = Math.sin(elapsed * 1.25 + layer.swaySeed) * 0.14;
      layer.material.opacity = Math.sin(phase * Math.PI) * 0.58;
    }

    // Holographic projection rings in menu mode
    const showHolo = this.mode === 'menu' || this.mode === 'transition-to-menu';
    this.holoOrbitRings.visible = showHolo;
    this.holoProjectorCone.visible = showHolo;
    if (showHolo) {
      this.holoOrbitRings.rotation.y += dt * 0.28;
      this.holoOrbitRings.rotation.z -= dt * 0.16;
    }

    // Volumetric Teal-Cyan Optical Telemetry Scan Beam
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
    this.envRenderTarget.dispose();
    this.renderer.dispose();
  }
}
