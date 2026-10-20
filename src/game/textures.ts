import * as THREE from 'three';
import { PlatformSurfaceTheme } from './levels';
import { markShared } from './dispose';

const sharedTextureCache = new Map<PlatformSurfaceTheme, THREE.CanvasTexture>();

/** 렌더러가 지원하는 최대 비등방성 필터링 값 (기본 1 = 꺼짐, 렌더러 생성 시 설정됨) */
let platformAnisotropy = 1;

/**
 * 렌더러 생성 직후 호출: GPU 최대 지원치(최대 16x)로 비등방성 필터링을 설정합니다.
 * 이미 생성된 캐시 텍스처에도 즉시 반영합니다.
 */
export function setPlatformTextureAnisotropy(maxAnisotropy: number): void {
  platformAnisotropy = Math.max(1, Math.min(16, Math.floor(maxAnisotropy)));
  for (const tex of sharedTextureCache.values()) {
    if (tex.anisotropy !== platformAnisotropy) {
      tex.anisotropy = platformAnisotropy;
      tex.needsUpdate = true;
    }
  }
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 갤럭시 탭 S6 Lite (Exynos 9611) 최적화:
 * - GPU 픽셀 부하를 유발하던 bumpMap을 제거하고, 컬러 캔버스 텍스처 자체에 입체 하이라이트와 음영 줄눈을 베이크(Bake)합니다.
 * - 발판마다 텍스처를 복제(.clone)하지 않고 테마별 단일 공유 텍스처(총 5장)만 메모리에 상주시킵니다.
 */
export function getSharedPlatformTexture(
  theme: PlatformSurfaceTheme
): THREE.CanvasTexture {
  const cached = sharedTextureCache.get(theme);
  if (cached) return cached;

  const size = 1024;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  if (theme === 'meadow') {
    // Rich high-res stylized meadow grass with multi-layered blades, clover patches, pebbles & daisies
    const baseGrad = cCtx.createRadialGradient(
      size * 0.5,
      size * 0.5,
      size * 0.1,
      size * 0.5,
      size * 0.5,
      size * 0.75
    );
    baseGrad.addColorStop(0, '#22c55e');
    baseGrad.addColorStop(1, '#16a34a');
    cCtx.fillStyle = baseGrad;
    cCtx.fillRect(0, 0, size, size);

    // Subtle organic turf patches
    for (let i = 0; i < 140; i++) {
      const gx = (i * 173) % (size - 80);
      const gy = (i * 293) % (size - 80);
      const patchW = 48 + (i % 5) * 14;
      const patchH = 48 + ((i * 3) % 5) * 14;
      cCtx.fillStyle =
        i % 3 === 0
          ? 'rgba(21, 128, 61, 0.42)'
          : i % 3 === 1
          ? 'rgba(74, 222, 128, 0.35)'
          : 'rgba(34, 197, 94, 0.4)';
      drawRoundRect(cCtx, gx, gy, patchW, patchH, 22);
      cCtx.fill();
    }

    // Small moss & pebble accents
    for (let i = 0; i < 60; i++) {
      const px = ((i * 227) % (size - 32)) + 16;
      const py = ((i * 389) % (size - 32)) + 16;
      cCtx.fillStyle = i % 2 === 0 ? 'rgba(134, 239, 172, 0.35)' : 'rgba(20, 83, 45, 0.25)';
      cCtx.beginPath();
      cCtx.arc(px, py, 6 + (i % 4) * 2, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Fine grass blade clusters (crisp high-res strokes)
    cCtx.lineCap = 'round';
    for (let i = 0; i < 420; i++) {
      const bx = ((i * 197) % (size - 36)) + 18;
      const by = ((i * 109) % (size - 36)) + 18;

      for (let b = -1; b <= 1; b++) {
        const offsetX = b * 6;
        const lean = (b + ((i % 3) - 1) * 0.5) * 9;
        const bladeH = 18 + ((i + b) % 4) * 5;

        // Blade shadow
        cCtx.strokeStyle = 'rgba(20, 83, 45, 0.45)';
        cCtx.lineWidth = 5.5;
        cCtx.beginPath();
        cCtx.moveTo(bx + offsetX, by + 12);
        cCtx.quadraticCurveTo(
          bx + offsetX + lean * 0.35,
          by + 2,
          bx + offsetX + lean,
          by - bladeH + 12
        );
        cCtx.stroke();

        // Blade highlight
        cCtx.strokeStyle =
          (i + b) % 3 === 0 ? '#bbf7d0' : (i + b) % 3 === 1 ? '#86efac' : '#15803d';
        cCtx.lineWidth = 4;
        cCtx.beginPath();
        cCtx.moveTo(bx + offsetX, by + 10);
        cCtx.quadraticCurveTo(
          bx + offsetX + lean * 0.35,
          by,
          bx + offsetX + lean,
          by - bladeH + 10
        );
        cCtx.stroke();
      }

      // Detailed daisies & wildflowers
      if (i % 18 === 0) {
        const fx = bx;
        const fy = by;
        const petalCount = 6;
        const petalDist = 8.5;
        cCtx.fillStyle = i % 36 === 0 ? '#ffffff' : '#fef9c3';
        for (let p = 0; p < petalCount; p++) {
          const angle = (p * Math.PI * 2) / petalCount;
          cCtx.beginPath();
          cCtx.arc(
            fx + Math.cos(angle) * petalDist,
            fy + Math.sin(angle) * petalDist,
            5.2,
            0,
            Math.PI * 2
          );
          cCtx.fill();
        }
        cCtx.fillStyle = '#facc15';
        cCtx.beginPath();
        cCtx.arc(fx, fy, 5.5, 0, Math.PI * 2);
        cCtx.fill();
        cCtx.strokeStyle = '#ca8a04';
        cCtx.lineWidth = 1.5;
        cCtx.stroke();
      }
    }
  } else if (theme === 'stone') {
    // High-res interlocking beveled stone blocks with multi-step mortar depth, grain & specular highlights
    cCtx.fillStyle = '#475569';
    cCtx.fillRect(0, 0, size, size);

    const rows = 4;
    const cols = 4;
    const tileW = size / cols;
    const tileH = size / rows;
    const pad = 12;

    for (let r = 0; r < rows; r++) {
      const offsetX = r % 2 === 1 ? tileW * 0.5 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = c * tileW + offsetX + pad;
        const y = r * tileH + pad;
        const w = tileW - pad * 2;
        const h = tileH - pad * 2;

        // Deep mortar drop shadow
        cCtx.fillStyle = '#334155';
        drawRoundRect(cCtx, x + 2, y + 8, w, h, 28);
        cCtx.fill();

        // Lower stone bevel edge
        cCtx.fillStyle = '#94a3b8';
        drawRoundRect(cCtx, x, y + 5, w, h - 2, 28);
        cCtx.fill();

        // Main stone top face with subtle directional gradient
        const shade = Math.abs(r * 3 + c * 5) % 3;
        const topColor =
          shade === 0 ? '#f8fafc' : shade === 1 ? '#f1f5f9' : '#e2e8f0';
        const botColor =
          shade === 0 ? '#e2e8f0' : shade === 1 ? '#cbd5e1' : '#cbd5e1';
        const tileGrad = cCtx.createLinearGradient(x, y, x, y + h);
        tileGrad.addColorStop(0, topColor);
        tileGrad.addColorStop(1, botColor);

        cCtx.fillStyle = tileGrad;
        drawRoundRect(cCtx, x, y, w, h - 6, 26);
        cCtx.fill();

        // Inner crisp specular bevel highlight
        cCtx.strokeStyle = '#ffffff';
        cCtx.lineWidth = 5;
        drawRoundRect(cCtx, x + 6, y + 6, w - 12, h - 18, 20);
        cCtx.stroke();

        // Subtle carved inner border groove
        cCtx.strokeStyle = 'rgba(100, 116, 139, 0.22)';
        cCtx.lineWidth = 3;
        drawRoundRect(cCtx, x + 18, y + 18, w - 36, h - 42, 14);
        cCtx.stroke();

        // Subtle stone pores / speckles
        for (let s = 0; s < 10; s++) {
          const sx = x + 26 + ((s * 67 + r * 31) % Math.max(10, w - 52));
          const sy = y + 26 + ((s * 97 + c * 43) % Math.max(10, h - 56));
          cCtx.fillStyle =
            s % 2 === 0
              ? 'rgba(148, 163, 184, 0.35)'
              : 'rgba(255, 255, 255, 0.55)';
          cCtx.beginPath();
          cCtx.arc(sx, sy, 3 + (s % 3), 0, Math.PI * 2);
          cCtx.fill();
        }
      }
    }
  } else if (theme === 'emerald') {
    // High-res moving platform tech-stone tile with glowing circuit lines & center emblem
    cCtx.fillStyle = '#0f766e';
    cCtx.fillRect(0, 0, size, size);

    const grid = 2;
    const cell = size / grid;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const x = c * cell + 24;
        const y = r * cell + 24;
        const w = cell - 48;
        const h = cell - 48;

        // Outer recessed shadow
        cCtx.fillStyle = '#115e59';
        drawRoundRect(cCtx, x, y + 8, w, h, 44);
        cCtx.fill();

        // Main emerald plate gradient
        const plateGrad = cCtx.createLinearGradient(x, y, x + w, y + h);
        plateGrad.addColorStop(0, '#5eead4');
        plateGrad.addColorStop(0.5, '#2dd4bf');
        plateGrad.addColorStop(1, '#14b8a6');
        cCtx.fillStyle = plateGrad;
        drawRoundRect(cCtx, x, y, w, h - 6, 42);
        cCtx.fill();

        // Bright neon rim frame
        cCtx.strokeStyle = '#ccfbf1';
        cCtx.lineWidth = 8;
        drawRoundRect(cCtx, x + 14, y + 14, w - 28, h - 34, 30);
        cCtx.stroke();

        // Inner tech frame
        cCtx.strokeStyle = '#0d9488';
        cCtx.lineWidth = 5;
        drawRoundRect(cCtx, x + 36, y + 36, w - 72, h - 78, 20);
        cCtx.stroke();

        // Center power core ring
        const cx = x + w / 2;
        const cy = y + (h - 6) / 2;
        cCtx.fillStyle = '#115e59';
        cCtx.beginPath();
        cCtx.arc(cx, cy, 48, 0, Math.PI * 2);
        cCtx.fill();

        cCtx.fillStyle = '#99f6e4';
        cCtx.beginPath();
        cCtx.arc(cx, cy, 28, 0, Math.PI * 2);
        cCtx.fill();

        cCtx.strokeStyle = '#ffffff';
        cCtx.lineWidth = 4;
        cCtx.beginPath();
        cCtx.arc(cx, cy, 20, 0, Math.PI * 2);
        cCtx.stroke();
      }
    }
  } else if (theme === 'gold') {
    // High-res ornate golden key island tiles with royal filigree & bevels
    cCtx.fillStyle = '#b45309';
    cCtx.fillRect(0, 0, size, size);

    const cell = size / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = c * cell + 20;
        const y = r * cell + 20;
        const w = cell - 40;
        const h = cell - 40;

        // Bevel shadow
        cCtx.fillStyle = '#92400e';
        drawRoundRect(cCtx, x, y + 8, w, h, 38);
        cCtx.fill();

        // Metallic gold gradient
        const goldGrad = cCtx.createLinearGradient(x, y, x + w, y + h);
        goldGrad.addColorStop(0, '#fef9c3');
        goldGrad.addColorStop(0.5, '#fef08a');
        goldGrad.addColorStop(1, '#facc15');
        cCtx.fillStyle = goldGrad;
        drawRoundRect(cCtx, x, y, w, h - 6, 36);
        cCtx.fill();

        // Outer specular trim
        cCtx.strokeStyle = '#ffffff';
        cCtx.lineWidth = 6;
        drawRoundRect(cCtx, x + 10, y + 10, w - 20, h - 26, 28);
        cCtx.stroke();

        // Ornate inner gold border
        cCtx.strokeStyle = '#f59e0b';
        cCtx.lineWidth = 10;
        drawRoundRect(cCtx, x + 28, y + 28, w - 56, h - 62, 20);
        cCtx.stroke();

        // Center diamond emblem
        const cx = x + w / 2;
        const cy = y + (h - 6) / 2;
        cCtx.fillStyle = '#f59e0b';
        cCtx.beginPath();
        cCtx.moveTo(cx, cy - 36);
        cCtx.lineTo(cx + 36, cy);
        cCtx.lineTo(cx, cy + 36);
        cCtx.lineTo(cx - 36, cy);
        cCtx.closePath();
        cCtx.fill();

        cCtx.fillStyle = '#fef9c3';
        cCtx.beginPath();
        cCtx.arc(cx, cy, 12, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
  } else {
    // High-res 'royal' portal island tiles
    cCtx.fillStyle = '#0369a1';
    cCtx.fillRect(0, 0, size, size);

    const cell = size / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * cell + 14;
        const y = r * cell + 14;
        const w = cell - 28;
        const h = cell - 28;

        const isEven = (r + c) % 2 === 0;
        cCtx.fillStyle = '#0284c7';
        drawRoundRect(cCtx, x, y + 6, w, h, 26);
        cCtx.fill();

        const royalGrad = cCtx.createLinearGradient(x, y, x, y + h);
        royalGrad.addColorStop(0, isEven ? '#ffffff' : '#e0f2fe');
        royalGrad.addColorStop(1, isEven ? '#e0f2fe' : '#bae6fd');
        cCtx.fillStyle = royalGrad;
        drawRoundRect(cCtx, x, y, w, h - 5, 24);
        cCtx.fill();

        cCtx.strokeStyle = '#ffffff';
        cCtx.lineWidth = 5;
        drawRoundRect(cCtx, x + 6, y + 6, w - 12, h - 17, 18);
        cCtx.stroke();

        cCtx.strokeStyle = isEven ? '#bae6fd' : '#7dd3fc';
        cCtx.lineWidth = 3;
        drawRoundRect(cCtx, x + 16, y + 16, w - 32, h - 37, 12);
        cCtx.stroke();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = platformAnisotropy;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  markShared(map);

  sharedTextureCache.set(theme, map);
  return map;
}
