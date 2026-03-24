/**
 * Soccer Tracker — App Icon & Splash Screen Generator
 *
 * 실행 방법:
 *   node scripts/generate-assets.js
 *
 * 필요 패키지:
 *   npm install --save-dev sharp
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('❌  sharp 패키지가 없습니다. 먼저 실행하세요:');
  console.error('   npm install --save-dev sharp');
  process.exit(1);
}

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ─── SVG 디자인 ───────────────────────────────────────────────────────────────

/** 앱 아이콘 SVG (1024×1024) */
function iconSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const innerR = r * 0.62;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="bg" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#1A1A1A"/>
      <stop offset="100%" stop-color="#0A0A0A"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00FF8540"/>
      <stop offset="100%" stop-color="#00FF8500"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>

  <!-- Glow -->
  <circle cx="${cx}" cy="${cy}" r="${r * 1.1}" fill="url(#glow)"/>

  <!-- Outer ring -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#00FF85" stroke-width="${size * 0.025}" opacity="0.6"/>

  <!-- Inner circle -->
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#00FF8514" stroke="#00FF85" stroke-width="${size * 0.015}" opacity="0.9"/>

  <!-- Soccer ball pentagon pattern (simplified) -->
  <text x="${cx}" y="${cy + size * 0.085}" text-anchor="middle" font-size="${size * 0.32}" dominant-baseline="middle">⚽</text>

  <!-- Speed lines -->
  <line x1="${cx - r * 0.6}" y1="${cy + r * 0.65}" x2="${cx + r * 0.6}" y2="${cy + r * 0.65}"
        stroke="#00FF85" stroke-width="${size * 0.012}" stroke-linecap="round" opacity="0.35"/>
  <line x1="${cx - r * 0.38}" y1="${cy + r * 0.8}" x2="${cx + r * 0.38}" y2="${cy + r * 0.8}"
        stroke="#00FF85" stroke-width="${size * 0.008}" stroke-linecap="round" opacity="0.2"/>
</svg>`;
}

/** 스플래시 SVG (1284×2778 — iPhone 최대 해상도 기준) */
function splashSVG(w, h) {
  const cx = w / 2;
  const cy = h * 0.42;
  const iconR = Math.min(w, h) * 0.16;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="${(cy / h * 100).toFixed(1)}%" r="40%">
      <stop offset="0%" stop-color="#00FF8522"/>
      <stop offset="100%" stop-color="#00FF8500"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${w}" height="${h}" fill="#0A0A0A"/>

  <!-- Glow -->
  <ellipse cx="${cx}" cy="${cy}" rx="${w * 0.55}" ry="${w * 0.55}" fill="url(#glow)"/>

  <!-- Icon ring -->
  <circle cx="${cx}" cy="${cy}" r="${iconR * 1.35}" fill="none"
          stroke="#00FF85" stroke-width="${w * 0.006}" opacity="0.25"/>
  <circle cx="${cx}" cy="${cy}" r="${iconR * 1.08}" fill="#00FF8510"
          stroke="#00FF85" stroke-width="${w * 0.004}" opacity="0.5"/>

  <!-- Ball emoji -->
  <text x="${cx}" y="${cy + iconR * 0.12}" text-anchor="middle"
        font-size="${iconR * 1.1}" dominant-baseline="middle">⚽</text>

  <!-- App name -->
  <text x="${cx}" y="${cy + iconR * 1.75}" text-anchor="middle"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="${w * 0.065}" font-weight="700" fill="#FFFFFF" letter-spacing="-1">
    Soccer Tracker
  </text>

  <!-- Tagline -->
  <text x="${cx}" y="${cy + iconR * 2.3}" text-anchor="middle"
        font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-size="${w * 0.032}" font-weight="400" fill="#8A8A8A" letter-spacing="0.5">
    경기와 훈련의 모든 순간을 기록하세요
  </text>

  <!-- Bottom accent line -->
  <line x1="${cx - w * 0.12}" y1="${h * 0.88}" x2="${cx + w * 0.12}" y2="${h * 0.88}"
        stroke="#00FF85" stroke-width="${w * 0.005}" stroke-linecap="round" opacity="0.4"/>
</svg>`;
}

// ─── 생성 ─────────────────────────────────────────────────────────────────────

async function generate() {
  console.log('🎨  Soccer Tracker 앱 에셋 생성 중...\n');

  const tasks = [
    {
      name: 'icon.png (1024×1024)',
      out: path.join(ASSETS_DIR, 'icon.png'),
      fn: () =>
        sharp(Buffer.from(iconSVG(1024)))
          .png()
          .toFile(path.join(ASSETS_DIR, 'icon.png')),
    },
    {
      name: 'adaptive-icon.png (1024×1024)',
      out: path.join(ASSETS_DIR, 'adaptive-icon.png'),
      fn: () =>
        sharp(Buffer.from(iconSVG(1024)))
          .png()
          .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png')),
    },
    {
      name: 'splash.png (1284×2778)',
      out: path.join(ASSETS_DIR, 'splash.png'),
      fn: () =>
        sharp(Buffer.from(splashSVG(1284, 2778)))
          .png()
          .toFile(path.join(ASSETS_DIR, 'splash.png')),
    },
    {
      name: 'favicon.png (48×48)',
      out: path.join(ASSETS_DIR, 'favicon.png'),
      fn: () =>
        sharp(Buffer.from(iconSVG(256)))
          .resize(48, 48)
          .png()
          .toFile(path.join(ASSETS_DIR, 'favicon.png')),
    },
  ];

  for (const task of tasks) {
    try {
      await task.fn();
      console.log(`  ✅  ${task.name}`);
    } catch (err) {
      console.error(`  ❌  ${task.name}: ${err.message}`);
    }
  }

  console.log('\n✨  완료! assets/ 폴더를 확인하세요.');
  console.log('   npx expo start 로 앱을 실행해 확인할 수 있습니다.');
}

generate();
