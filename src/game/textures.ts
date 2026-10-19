import * as THREE from 'three';
import { PlatformSurfaceTheme } from './levels';
import { markShared } from './dispose';

const sharedTextureCache = new Map<PlatformSurfaceTheme, THREE.CanvasTexture>();

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

  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  if (theme === 'meadow') {
    // Rich stylized grass pattern with clover tufts and daisies
    cCtx.fillStyle = '#22c55e';
    cCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < 64; i++) {
      const gx = ((i * 73) % 230) + 8;
      const gy = ((i * 137) % 230) + 8;
      cCtx.fillStyle = i % 2 === 0 ? '#16a34a' : '#4ade80';
      drawRoundRect(cCtx, gx, gy, 20, 20, 6);
      cCtx.fill();
    }

    for (let i = 0; i < 80; i++) {
      const bx = ((i * 97) % 240) + 8;
      const by = ((i * 53) % 240) + 8;
      cCtx.strokeStyle = i % 3 === 0 ? '#86efac' : '#15803d';
      cCtx.lineWidth = 2.5;
      cCtx.beginPath();
      cCtx.moveTo(bx, by + 8);
      cCtx.quadraticCurveTo(
        bx - 3,
        by + 2,
        bx + (i % 2 === 0 ? 4 : -4),
        by - 4
      );
      cCtx.stroke();

      if (i % 14 === 0) {
        cCtx.fillStyle = '#fef08a';
        cCtx.beginPath();
        cCtx.arc(bx, by, 3.8, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
  } else if (theme === 'stone') {
    // Interlocking beveled stone tiles with baked mortar & highlight lines
    cCtx.fillStyle = '#64748b';
    cCtx.fillRect(0, 0, size, size);

    const rows = 4;
    const cols = 4;
    const tileW = size / cols;
    const tileH = size / rows;
    const pad = 4;

    for (let r = 0; r < rows; r++) {
      const offsetX = r % 2 === 1 ? tileW * 0.5 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = c * tileW + offsetX + pad;
        const y = r * tileH + pad;
        const w = tileW - pad * 2;
        const h = tileH - pad * 2;

        // Baked bottom-right shadow edge
        cCtx.fillStyle = '#94a3b8';
        drawRoundRect(cCtx, x, y + 2, w, h, 9);
        cCtx.fill();

        const shade = (r * 3 + c * 5) % 3;
        cCtx.fillStyle =
          shade === 0 ? '#f8fafc' : shade === 1 ? '#f1f5f9' : '#e2e8f0';
        drawRoundRect(cCtx, x, y, w, h - 2, 9);
        cCtx.fill();

        cCtx.strokeStyle = '#ffffff';
        cCtx.lineWidth = 2;
        drawRoundRect(cCtx, x + 2, y + 2, w - 4, h - 6, 7);
        cCtx.stroke();
      }
    }
  } else if (theme === 'emerald') {
    // Moving platform tech-stone tile
    cCtx.fillStyle = '#0f766e';
    cCtx.fillRect(0, 0, size, size);

    const grid = 2;
    const cell = size / grid;
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const x = c * cell + 8;
        const y = r * cell + 8;
        const w = cell - 16;
        const h = cell - 16;

        cCtx.fillStyle = '#2dd4bf';
        drawRoundRect(cCtx, x, y, w, h, 14);
        cCtx.fill();

        cCtx.strokeStyle = '#99f6e4';
        cCtx.lineWidth = 3;
        drawRoundRect(cCtx, x + 4, y + 4, w - 8, h - 8, 10);
        cCtx.stroke();

        cCtx.fillStyle = '#115e59';
        cCtx.beginPath();
        cCtx.arc(x + w / 2, y + h / 2, 12, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
  } else if (theme === 'gold') {
    // Ornate golden key island tiles
    cCtx.fillStyle = '#d97706';
    cCtx.fillRect(0, 0, size, size);

    const cell = size / 2;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const x = c * cell + 6;
        const y = r * cell + 6;
        const w = cell - 12;
        const h = cell - 12;

        cCtx.fillStyle = '#fef08a';
        drawRoundRect(cCtx, x, y, w, h, 12);
        cCtx.fill();

        cCtx.strokeStyle = '#f59e0b';
        cCtx.lineWidth = 4;
        drawRoundRect(cCtx, x + 8, y + 8, w - 16, h - 16, 8);
        cCtx.stroke();
      }
    }
  } else {
    // 'royal' portal island tiles
    cCtx.fillStyle = '#0284c7';
    cCtx.fillRect(0, 0, size, size);

    const cell = size / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = c * cell + 4;
        const y = r * cell + 4;
        const w = cell - 8;
        const h = cell - 8;

        const isEven = (r + c) % 2 === 0;
        cCtx.fillStyle = isEven ? '#f0f9ff' : '#bae6fd';
        drawRoundRect(cCtx, x, y, w, h, 8);
        cCtx.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  markShared(map);

  sharedTextureCache.set(theme, map);
  return map;
}
