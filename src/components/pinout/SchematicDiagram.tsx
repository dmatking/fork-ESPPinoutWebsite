import type { ReactNode } from 'react'
import { useApp } from '../../context/AppContext'
import { filterPins } from '../../utils/filterPins'
import type { Pin, Chip, LayoutPin } from '../../types/chip'
import { AFFECTED_WORD, resolveModule } from './shared'

// ─── EDA sheet palette (KiCad Eeschema classic) ───────────────────────────────

const SHEET_BG    = '#fdfcf6'
const GRID_DOT    = '#dcd8ca'
const FRAME       = '#6b6455'
const BODY_FILL   = '#fff9c9'
const BODY_STROKE = '#8a1c00'
const PIN_COLOR   = '#8a1c00'
const PINNUM      = '#a83200'
const NAME_TEAL   = '#0e7476'
const TEXT_DARK   = '#3a362e'
const DIM         = '#a09a8a'

const PITCH = 26          // pin pitch on the symbol
const PL    = 46          // pin (stub) length
const BW    = 216         // symbol body width
const FONT  = "'Segoe UI','Helvetica Neue',Arial,sans-serif"

// Function-name → annotation text color on the light sheet.
function fnColor(name: string): string {
  const u = name.toUpperCase()
  if (/^ADC1/.test(u))                             return '#c2410c'
  if (/^ADC2/.test(u))                             return '#b45309'
  if (/^DAC/.test(u))                              return '#a16207'
  if (/^TOUCH/.test(u))                            return '#15803d'
  if (/^RTC|^32K|XTAL/.test(u))                    return '#0f766e'
  if (/MOSI|MISO|^SCK$|VSPI|HSPI/.test(u))       return '#1d4ed8'
  if (/SDA$|SCL$/.test(u))                         return '#6d28d9'
  if (/^U[0-9]?(TXD?|RXD?|CTS|RTS)|^TX|^RX/.test(u)) return '#0e7490'
  if (/USB|JTAG/.test(u))                          return '#be185d'
  if (/^MT(DI|CK|MS|DO)$/.test(u))                return '#57534e'
  if (/^SD_|^CMD$|^CLK$|^SD[0-9]$/.test(u))       return '#4338ca'
  if (/CLK/.test(u))                               return '#0369a1'
  return '#57534e'
}

// Pin-name color inside the body.
function pinNameColor(label: string): string {
  const u = label.toUpperCase()
  if (/^3V3$|^VCC|^5V$|^VIN|^VBUS/.test(u)) return '#b91c1c'
  if (u === 'GND')                            return '#44403c'
  if (u === 'NC')                             return DIM
  return NAME_TEAL
}

// ─── Bank building (logical ordering, all four physical edges folded in) ──────

interface SchemRow {
  key: string
  pinNumber?: number
  pin?: Pin
  label?: string
  pads?: number[]      // collapsed group: every physical pad number in it
}

function buildBanks(chip: Chip): { left: SchemRow[]; right: SchemRow[] } {
  const pinByGpio = new Map(chip.pins.map(p => [p.gpio, p]))

  let pads: LayoutPin[]
  if (chip.packageLayout) {
    const L = chip.packageLayout
    pads = [...L.left, ...L.bottom, ...L.right, ...(L.top ?? [])]
  } else {
    pads = [...chip.pins].sort((a, b) => a.gpio - b.gpio).map((p, i) => ({ pinNumber: i + 1, gpio: p.gpio }))
  }

  const gpioRows: SchemRow[] = []
  const powerRows: SchemRow[] = []
  const ctrlRows: SchemRow[] = []
  const otherRows: SchemRow[] = []
  const gndPads: number[] = []
  const ncPads: number[] = []
  const seen = new Set<number>()

  for (const lp of pads) {
    if (lp.gpio !== undefined) {
      if (seen.has(lp.gpio)) continue
      seen.add(lp.gpio)
      gpioRows.push({ key: `g${lp.gpio}`, pinNumber: lp.pinNumber, pin: pinByGpio.get(lp.gpio) })
      continue
    }
    const l = (lp.label ?? 'NC').toUpperCase()
    if (l === 'GND')                                     gndPads.push(lp.pinNumber)
    else if (l === 'NC')                                 ncPads.push(lp.pinNumber)
    else if (/^3V3$|^VCC|^5V$|^VIN|^VBUS|^3\.3V$/.test(l)) powerRows.push({ key: `s${lp.pinNumber}`, pinNumber: lp.pinNumber, label: lp.label })
    else if (/^EN$|^RST|^RESET|^CHIP_PU/.test(l))        ctrlRows.push({ key: `s${lp.pinNumber}`, pinNumber: lp.pinNumber, label: lp.label })
    else                                                 otherRows.push({ key: `s${lp.pinNumber}`, pinNumber: lp.pinNumber, label: lp.label })
  }

  gpioRows.sort((a, b) => (a.pin?.gpio ?? 999) - (b.pin?.gpio ?? 999))

  const leftExtras = [...powerRows, ...ctrlRows]
  const rightExtras: SchemRow[] = [...otherRows]
  if (gndPads.length) rightExtras.push({ key: 'gnd', label: 'GND', pads: gndPads.sort((a, b) => a - b) })
  if (ncPads.length)  rightExtras.push({ key: 'nc',  label: 'NC',  pads: ncPads.sort((a, b) => a - b) })

  const G = gpioRows.length
  let leftG = Math.ceil((G + rightExtras.length - leftExtras.length) / 2)
  leftG = Math.max(0, Math.min(G, leftG))

  return {
    left:  [...leftExtras, ...gpioRows.slice(0, leftG)],
    right: [...gpioRows.slice(leftG), ...rightExtras],
  }
}

// ─── Annotation segments (net-label style text outside the pin) ───────────────

interface Seg { text: string; color: string; bold?: boolean }

function rowSegments(row: SchemRow, mappingLabel?: string): Seg[] {
  const segs: Seg[] = []
  if (mappingLabel) segs.push({ text: mappingLabel, color: '#15803d', bold: true })
  const { pin } = row
  if (pin) {
    // Constraint markers first (closest to the outside), deduped by word.
    const seenWords = new Set<string>()
    for (const c of pin.constraints) {
      const word = AFFECTED_WORD[c.id] ?? 'Note'
      if (seenWords.has(word)) continue
      seenWords.add(word)
      segs.push({
        text: `${c.severity === 'danger' ? '✕' : '⚠'}${word}`,
        color: c.severity === 'danger' ? '#b91c1c' : '#b45309',
        bold: true,
      })
    }
    // Alternate functions (the GPIO name itself lives inside the body).
    const primary = pin.names.find(n => /^GPIO\d/.test(n)) ?? pin.names[0]
    for (const n of pin.names) {
      if (n === primary) continue
      segs.push({ text: n, color: fnColor(n) })
    }
  } else if (row.pads) {
    const shown = row.pads.slice(0, 6)
    const rest = row.pads.length - shown.length
    segs.push({ text: `×${row.pads.length} · pads ${shown.join(',')}${rest > 0 ? ` +${rest}` : ''}`, color: DIM })
  }
  return segs
}

const segW = (s: Seg) => s.text.length * 6.1 + 9
const segsW = (segs: Seg[]) => segs.reduce((a, s) => a + segW(s), 0)

// ─── Diagram ──────────────────────────────────────────────────────────────────

export function SchematicDiagram() {
  const { chip, selectedPin, setSelectedPin, filter, mapping } = useApp()
  const filteredSet = new Set(filterPins(chip.pins, filter).map(p => p.gpio))
  const m = resolveModule(chip)
  const { left, right } = buildBanks(chip)

  const mapLabel = (row: SchemRow) => (row.pin ? mapping.find(a => a.gpio === row.pin!.gpio)?.label : undefined)

  const leftAW  = Math.min(320, Math.max(150, ...left.map(r => segsW(rowSegments(r, mapLabel(r))))))
  const rightAW = Math.min(320, Math.max(150, ...right.map(r => segsW(rowSegments(r, mapLabel(r))))))

  const FRAME_I = 22
  const CX0  = FRAME_I + 24
  const TOPY = FRAME_I + 46

  const maxRows = Math.max(left.length, right.length)
  const bodyH = maxRows * PITCH + 26
  const bodyX = CX0 + leftAW + PL
  const rowCY = (i: number) => TOPY + 20 + i * PITCH

  const TB_W = 292, TB_H = 66
  const svgW = bodyX + BW + PL + rightAW + 24 + FRAME_I
  const svgH = TOPY + bodyH + 44 + TB_H + 18 + FRAME_I

  const toggle = (pin: Pin | undefined) => {
    if (!pin) return
    setSelectedPin(selectedPin?.gpio === pin.gpio ? null : pin)
  }

  // ── One symbol pin + its annotations ──
  const renderRow = (row: SchemRow, i: number, side: 'left' | 'right'): ReactNode => {
    const cy = rowCY(i)
    const isLeft = side === 'left'
    const edgeX = isLeft ? bodyX : bodyX + BW
    const tipX  = isLeft ? edgeX - PL : edgeX + PL
    const segs = rowSegments(row, mapLabel(row))

    const name = row.pin
      ? (row.pin.names.find(n => /^GPIO\d/.test(n)) ?? row.pin.names[0] ?? `IO${row.pin.gpio}`)
      : (row.label ?? 'NC')

    const isSelected = !!row.pin && selectedPin?.gpio === row.pin.gpio
    const isActive = !row.pin || filteredSet.has(row.pin.gpio)

    // annotations run outward from the pin tip
    let ax = isLeft ? tipX - 8 : tipX + 8
    const annots = segs.map((s, k) => {
      const el = (
        <text key={k} x={ax} y={cy + 3.5} fontSize="10" fontFamily={FONT}
          fontWeight={s.bold ? 700 : 400} fill={s.color}
          textAnchor={isLeft ? 'end' : 'start'}>{s.text}</text>
      )
      ax += (isLeft ? -1 : 1) * segW(s)
      return el
    })

    const hitX = isLeft ? CX0 - 6 : edgeX
    const hitW = isLeft ? edgeX - hitX : svgW - FRAME_I - 10 - edgeX

    return (
      <g key={row.key} className={row.pin ? 'sch-row' : undefined}
        opacity={isActive ? 1 : 0.13}
        onClick={() => toggle(row.pin)}>
        {row.pin ? (
          <title>
            {row.pin.names.join(' / ')}
            {row.pin.constraints.length ? ' — ' + row.pin.constraints.map(c => c.title).join(' · ') : ''}
          </title>
        ) : row.pads ? (
          <title>{`${row.label} pads: ${row.pads.join(', ')}`}</title>
        ) : null}
        {/* hover / selection background */}
        <rect className="sch-hit" x={hitX} y={cy - PITCH / 2} width={hitW} height={PITCH}
          fill={isSelected ? 'rgba(37,99,235,0.14)' : 'transparent'}
          stroke={isSelected ? '#2563eb' : 'none'} strokeWidth="1" strokeDasharray={isSelected ? '3 2' : undefined} />
        {/* pin stub */}
        <line x1={edgeX} y1={cy} x2={tipX} y2={cy} stroke={PIN_COLOR} strokeWidth="1.5" />
        <circle cx={tipX} cy={cy} r="1.8" fill="none" stroke={PIN_COLOR} strokeWidth="1" />
        {/* pin number above the stub */}
        <text x={(edgeX + tipX) / 2} y={cy - 4} fontSize="8.5" fontFamily={FONT} fill={PINNUM}
          textAnchor="middle">{row.pads ? `×${row.pads.length}` : row.pinNumber}</text>
        {/* pin name inside the body */}
        <text x={isLeft ? edgeX + 7 : edgeX - 7} y={cy + 3.5} fontSize="10.5" fontFamily={FONT}
          fontWeight={600} fill={pinNameColor(name)}
          textAnchor={isLeft ? 'start' : 'end'}>{name}</text>
        {annots}
      </g>
    )
  }

  // ── Sheet frame coordinate bands ──
  const frameRefs: ReactNode[] = []
  {
    const innerW = svgW - 2 * FRAME_I
    const innerH = svgH - 2 * FRAME_I
    const nx = Math.max(2, Math.round(innerW / 220))
    const ny = Math.max(2, Math.round(innerH / 220))
    for (let i = 0; i < nx; i++) {
      const x0 = FRAME_I + (innerW * i) / nx
      const x1 = FRAME_I + (innerW * (i + 1)) / nx
      if (i > 0) {
        frameRefs.push(<line key={`vt${i}`} x1={x0} y1={6} x2={x0} y2={FRAME_I} stroke={FRAME} strokeWidth="0.8" />)
        frameRefs.push(<line key={`vb${i}`} x1={x0} y1={svgH - FRAME_I} x2={x0} y2={svgH - 6} stroke={FRAME} strokeWidth="0.8" />)
      }
      frameRefs.push(<text key={`nt${i}`} x={(x0 + x1) / 2} y={17} fontSize="9" fontFamily={FONT} fill={FRAME} textAnchor="middle">{i + 1}</text>)
      frameRefs.push(<text key={`nb${i}`} x={(x0 + x1) / 2} y={svgH - 9} fontSize="9" fontFamily={FONT} fill={FRAME} textAnchor="middle">{i + 1}</text>)
    }
    for (let j = 0; j < ny; j++) {
      const y0 = FRAME_I + (innerH * j) / ny
      const y1 = FRAME_I + (innerH * (j + 1)) / ny
      const letter = String.fromCharCode(65 + j)
      if (j > 0) {
        frameRefs.push(<line key={`hl${j}`} x1={6} y1={y0} x2={FRAME_I} y2={y0} stroke={FRAME} strokeWidth="0.8" />)
        frameRefs.push(<line key={`hr${j}`} x1={svgW - FRAME_I} y1={y0} x2={svgW - 6} y2={y0} stroke={FRAME} strokeWidth="0.8" />)
      }
      frameRefs.push(<text key={`lt${j}`} x={13} y={(y0 + y1) / 2 + 3} fontSize="9" fontFamily={FONT} fill={FRAME} textAnchor="middle">{letter}</text>)
      frameRefs.push(<text key={`lr${j}`} x={svgW - 13} y={(y0 + y1) / 2 + 3} fontSize="9" fontFamily={FONT} fill={FRAME} textAnchor="middle">{letter}</text>)
    }
  }

  const tbX = svgW - FRAME_I - TB_W
  const tbY = svgH - FRAME_I - TB_H
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4 pb-3 overflow-x-auto">
      <svg width={svgW} height={svgH} className="mx-auto block rounded-sm" style={{ minWidth: svgW }}
        xmlns="http://www.w3.org/2000/svg">
        <style>{`.sch-row{cursor:pointer}.sch-row:hover .sch-hit{fill:rgba(37,99,235,0.07)}`}</style>
        <defs>
          <pattern id={`schgrid-${chip.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="0.6" cy="0.6" r="0.7" fill={GRID_DOT} />
          </pattern>
        </defs>

        {/* paper + grid */}
        <rect width={svgW} height={svgH} fill={SHEET_BG} />
        <rect width={svgW} height={svgH} fill={`url(#schgrid-${chip.id})`} />

        {/* sheet frame */}
        <rect x="6" y="6" width={svgW - 12} height={svgH - 12} fill="none" stroke={FRAME} strokeWidth="1.4" />
        <rect x={FRAME_I} y={FRAME_I} width={svgW - 2 * FRAME_I} height={svgH - 2 * FRAME_I} fill="none" stroke={FRAME} strokeWidth="0.8" />
        {frameRefs}

        {/* reference designator + symbol body */}
        <text x={bodyX} y={TOPY - 10} fontSize="12" fontFamily={FONT} fontWeight={600} fill={NAME_TEAL}>U1</text>
        <rect x={bodyX} y={TOPY} width={BW} height={bodyH} fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="2" />

        {/* value (module name) under the body */}
        <text x={bodyX + BW / 2} y={TOPY + bodyH + 18} fontSize="12" fontFamily={FONT} fontWeight={600}
          fill={NAME_TEAL} textAnchor="middle">{m.name}</text>
        <text x={bodyX + BW / 2} y={TOPY + bodyH + 33} fontSize="9" fontFamily={FONT}
          fill={FRAME} textAnchor="middle">{m.arch} · {m.radios}</text>

        {/* pins */}
        {left.map((row, i) => renderRow(row, i, 'left'))}
        {right.map((row, i) => renderRow(row, i, 'right'))}

        {/* title block */}
        <g>
          <rect x={tbX} y={tbY} width={TB_W} height={TB_H} fill={SHEET_BG} stroke={FRAME} strokeWidth="1.2" />
          <line x1={tbX} y1={tbY + 22} x2={tbX + TB_W} y2={tbY + 22} stroke={FRAME} strokeWidth="0.8" />
          <line x1={tbX} y1={tbY + 44} x2={tbX + TB_W} y2={tbY + 44} stroke={FRAME} strokeWidth="0.8" />
          <line x1={tbX + TB_W - 92} y1={tbY + 44} x2={tbX + TB_W - 92} y2={tbY + TB_H} stroke={FRAME} strokeWidth="0.8" />
          <text x={tbX + 8} y={tbY + 15} fontSize="10.5" fontFamily={FONT} fontWeight={700} fill={TEXT_DARK}>
            {m.name} — pinout
          </text>
          <text x={tbX + 8} y={tbY + 37} fontSize="9.5" fontFamily={FONT} fill={TEXT_DARK}>
            ESP32 Pinout Studio · esp32pin.com
          </text>
          <text x={tbX + 8} y={tbY + 59} fontSize="9" fontFamily={FONT} fill={TEXT_DARK}>
            Date: {today}
          </text>
          <text x={tbX + TB_W - 84} y={tbY + 59} fontSize="9" fontFamily={FONT} fill={TEXT_DARK}>
            Sheet 1 / 1
          </text>
        </g>
      </svg>
      <p className="text-center font-mono" style={{ fontSize: 9, color: '#3d5068', marginTop: 8 }}>
        Logical symbol — GPIOs in ascending order, GND/NC pads collapsed. Pin numbers are the physical pads on the module.
      </p>
    </div>
  )
}
