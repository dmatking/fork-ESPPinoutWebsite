// Post-build SEO pass: per-chip OG card images + prerendered per-chip HTML.
// Vercel serves dist/<id>/index.html for /<id> before the SPA rewrite, so
// crawlers and link unfurlers get chip-specific meta while the app is unchanged.
// Run via: tsx scripts/postbuild-seo.ts (wired into `npm run build`).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { CHIPS } from '../src/data/chips'
import type { Chip } from '../src/types/chip'

const DIST = join(import.meta.dirname, '..', 'dist')
const SITE = 'https://esp32pin.com'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function trapPinCount(chip: Chip): number {
  return chip.pins.filter(p => p.constraints && p.constraints.length > 0).length
}

function ogSvg(chip: Chip): string {
  const accent = chip.module?.accent ?? '#3b82f6'
  const name = chip.module?.name ?? chip.name
  // keep the name inside the left column (module glyph starts at x=810)
  const nameSize = Math.min(88, Math.floor(690 / (0.58 * name.length)))
  const radios = chip.module?.radios ?? ''
  const traps = trapPinCount(chip)
  // right-hand module glyph: PCB with castellated pads + antenna region
  const pads = []
  for (let i = 0; i < 9; i++) {
    pads.push(`<circle cx="828" cy="${205 + i * 30}" r="7" fill="#d4d4d8"/>`)
    pads.push(`<circle cx="1132" cy="${205 + i * 30}" r="7" fill="#d4d4d8"/>`)
  }
  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#030712"/>
  <rect x="0" y="0" width="1200" height="6" fill="${accent}"/>
  <text x="72" y="110" font-family="sans-serif" font-size="26" letter-spacing="4" fill="#6b7280">ESP32 PINOUT STUDIO</text>
  <text x="72" y="${110 + nameSize + 60}" font-family="sans-serif" font-size="${nameSize}" font-weight="bold" fill="#f9fafb">${esc(name)}</text>
  <text x="72" y="340" font-family="sans-serif" font-size="30" fill="${accent}">${esc(chip.family)}${radios ? '  ·  ' + esc(radios) : ''}</text>
  <text x="72" y="420" font-family="sans-serif" font-size="28" fill="#9ca3af">${chip.totalGpio} GPIOs  ·  ${traps} trap pins flagged  ·  live conflict check</text>
  <text x="72" y="560" font-family="monospace" font-size="30" fill="#e5e7eb">${SITE.replace('https://', '')}/${chip.id}</text>
  <g>
    <rect x="810" y="160" rx="14" width="340" height="330" fill="#0f172a" stroke="#1f2937" stroke-width="3"/>
    <rect x="810" y="160" rx="14" width="340" height="70" fill="${accent}" opacity="0.25"/>
    <path d="M 840 180 h 40 v 30 h -40 v -12 h 28 v -8 h -28 z" fill="${accent}" opacity="0.8"/>
    <rect x="880" y="270" width="200" height="140" rx="6" fill="#111827" stroke="#374151" stroke-width="2"/>
    <text x="980" y="348" font-family="monospace" font-size="22" fill="#6b7280" text-anchor="middle">${esc(chip.family)}</text>
    ${pads.join('\n    ')}
  </g>
</svg>`
}

function chipTitle(chip: Chip): string {
  const name = chip.module?.name ?? chip.name
  return `${name} Pinout - GPIOs, strapping pins, ADC | ESP32 Pinout Studio`
}

function chipDescription(chip: Chip): string {
  const name = chip.module?.name ?? chip.name
  const traps = trapPinCount(chip)
  return `Interactive ${name} pinout: all ${chip.totalGpio} GPIOs with ADC, touch, PWM and bus functions, ${traps} trap pins flagged (strapping, flash, input-only), live conflict checking and Arduino export. Data from Espressif's official KiCad symbols.`
}

function prerenderHtml(base: string, chip: Chip): string {
  const url = `${SITE}/${chip.id}`
  const og = `${SITE}/og/${chip.id}.png`
  const title = esc(chipTitle(chip))
  const desc = esc(chipDescription(chip))
  let html = base
  const subs: Array<[RegExp, string]> = [
    [/<title>[^<]*<\/title>/, `<title>${title}</title>`],
    [/(<meta name="description" content=")[^"]*/, `$1${desc}`],
    [/(<link rel="canonical" href=")[^"]*/, `$1${url}`],
    [/(<meta property="og:title" content=")[^"]*/, `$1${title}`],
    [/(<meta property="og:description" content=")[^"]*/, `$1${desc}`],
    [/(<meta property="og:url" content=")[^"]*/, `$1${url}`],
    [/(<meta property="og:image" content=")[^"]*/, `$1${og}`],
    [/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`],
    [/(<meta name="twitter:description" content=")[^"]*/, `$1${desc}`],
    [/(<meta name="twitter:image" content=")[^"]*/, `$1${og}`],
  ]
  for (const [re, replacement] of subs) {
    if (!re.test(html)) throw new Error(`postbuild-seo: pattern not found in index.html: ${re}`)
    html = html.replace(re, replacement)
  }
  return html
}

async function main() {
  const base = readFileSync(join(DIST, 'index.html'), 'utf8')
  mkdirSync(join(DIST, 'og'), { recursive: true })
  for (const chip of CHIPS) {
    await sharp(Buffer.from(ogSvg(chip))).png().toFile(join(DIST, 'og', `${chip.id}.png`))
    mkdirSync(join(DIST, chip.id), { recursive: true })
    writeFileSync(join(DIST, chip.id, 'index.html'), prerenderHtml(base, chip))
  }
  console.log(`postbuild-seo: ${CHIPS.length} chip pages + OG images generated`)
}

main()
