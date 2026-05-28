import { useApp } from '../context/AppContext'
import { filterPins } from '../utils/filterPins'
import type { Pin, Chip } from '../types/chip'

const ROW_H = 26
const CHIP_W = 176

function getBadge(name: string): { bg: string; text: string } {
  const u = name.toUpperCase()
  if (u === 'GND')                                                          return { bg: '#111827', text: '#9ca3af' }
  if (/^3V3$|^VCC$|^3\.3V$/.test(u))                                      return { bg: '#dc2626', text: '#fff' }
  if (/^VIN$|^VBUS$|^5V$|^POWER$/.test(u))                                return { bg: '#b91c1c', text: '#fff' }
  if (/^EN$|^RST$|^RESET$|^ENABLE$/.test(u))                              return { bg: '#374151', text: '#e5e7eb' }
  if (/^ADC1/.test(u))                                                      return { bg: '#ea580c', text: '#fff' }
  if (/^ADC2/.test(u))                                                      return { bg: '#d97706', text: '#fff' }
  if (/^DAC\d?$/.test(u))                                                   return { bg: '#ca8a04', text: '#fff' }
  if (/^TOUCH/.test(u))                                                     return { bg: '#16a34a', text: '#fff' }
  if (/^RTC/.test(u))                                                       return { bg: '#0f766e', text: '#fff' }
  if (/MOSI$|MISO$|^SCK$|VSPI|HSPI/.test(u))                              return { bg: '#2563eb', text: '#fff' }
  if (/SDA$|SCL$/.test(u))                                                  return { bg: '#7c3aed', text: '#fff' }
  if (/^U[0-9]?(TXD?|RXD?|CTS|RTS)$|^TX\d?$|^RX\d?$/.test(u))          return { bg: '#0891b2', text: '#fff' }
  if (/^GPIO\d/.test(u))                                                    return { bg: '#6d28d9', text: '#fff' }
  if (/^SD_/.test(u))                                                       return { bg: '#4338ca', text: '#fff' }
  if (/USB|JTAG/.test(u))                                                   return { bg: '#be185d', text: '#fff' }
  if (/CLK|XTAL/.test(u))                                                   return { bg: '#0369a1', text: '#fff' }
  if (/^MT(DI|CK|MS|DO)$/.test(u))                                         return { bg: '#292524', text: '#a8a29e' }
  if (/^VP$|^VN$/.test(u))                                                  return { bg: '#374151', text: '#d1d5db' }
  return                                                                            { bg: '#374151', text: '#9ca3af' }
}

function connectorColor(pin: Pin): string {
  if (!pin.isUsable || pin.constraints.some(c => c.severity === 'danger')) return '#374151'
  if (pin.capabilities.includes('adc1'))   return '#ea580c'
  if (pin.capabilities.includes('adc2'))   return '#d97706'
  if (pin.capabilities.includes('dac'))    return '#ca8a04'
  if (pin.capabilities.includes('touch'))  return '#16a34a'
  if (pin.capabilities.includes('i2c'))    return '#7c3aed'
  if (pin.capabilities.includes('spi'))    return '#2563eb'
  if (pin.capabilities.includes('uart'))   return '#0891b2'
  if (pin.constraints.some(c => c.id === 'strapping_pin')) return '#eab308'
  return '#6b7280'
}

function sortedNames(names: string[], side: 'left' | 'right'): string[] {
  const gpio = names.filter(n => /^GPIO\d/.test(n))
  const other = names.filter(n => !/^GPIO\d/.test(n))
  return side === 'left' ? [...other, ...gpio] : [...gpio, ...other]
}

interface PinRowProps {
  pin: Pin
  side: 'left' | 'right'
  pinIndex: number
  isSelected: boolean
  isFiltered: boolean
  mappingLabel?: string
  onClick: () => void
}

function PinRow({ pin, side, pinIndex, isSelected, isFiltered, mappingLabel, onClick }: PinRowProps) {
  const color = connectorColor(pin)
  const names = sortedNames(pin.names, side)

  const hasDanger  = pin.constraints.some(c => c.severity === 'danger')
  const hasWarning = !hasDanger && pin.constraints.length > 0

  const constraintBadge = hasDanger ? (
    <span
      className="font-mono font-bold rounded-sm flex-shrink-0"
      style={{ background: '#3f0808', color: '#f87171', fontSize: 9, lineHeight: '15px', height: 15, padding: '0 4px' }}
    >
      ✕
    </span>
  ) : hasWarning ? (
    <span
      className="font-mono font-bold rounded-sm flex-shrink-0"
      style={{ background: '#3a1a00', color: '#fbbf24', fontSize: 9, lineHeight: '15px', height: 15, padding: '0 4px' }}
    >
      ⚠
    </span>
  ) : null

  const functionBadges = (
    <>
      {mappingLabel && (
        <span
          className="font-mono font-bold rounded-sm flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.4)', color: '#a5b4fc', fontSize: 9, lineHeight: '15px', height: 15, padding: '0 5px' }}
        >
          {mappingLabel}
        </span>
      )}
      {names.map(name => {
        const { bg, text } = getBadge(name)
        return (
          <span
            key={name}
            className="font-mono font-bold rounded-sm flex-shrink-0"
            style={{ background: bg, color: text, fontSize: 9, lineHeight: '15px', height: 15, padding: '0 5px' }}
          >
            {name}
          </span>
        )
      })}
    </>
  )

  const pinNumBox = (
    <div
      className="flex-shrink-0 flex items-center justify-center font-mono"
      style={{ width: 16, height: 16, background: '#0d1520', border: '1px solid #1e2d40', borderRadius: 2, fontSize: 7, fontWeight: 700, color: '#3d5068' }}
    >
      {pinIndex}
    </div>
  )

  const solderDot = (
    <div
      className="flex-shrink-0 rounded-full"
      style={{ width: 8, height: 8, background: color, boxShadow: `0 0 4px ${color}80` }}
    />
  )

  const connLine = (
    <div className="flex-shrink-0" style={{ width: 12, height: 1.5, background: color + '80' }} />
  )

  return (
    <div
      onClick={onClick}
      className={`flex items-center cursor-pointer select-none transition-colors
        ${isFiltered ? '' : 'opacity-[0.07]'}
        ${isSelected ? 'bg-violet-950/40' : 'hover:bg-white/[0.03]'}
      `}
      style={{ height: ROW_H, borderBottom: '1px solid #050a10' }}
    >
      {side === 'left' ? (
        <>
          {/* outermost = farthest from chip = first rendered in justify-end row */}
          <div className="flex-1 flex items-center justify-end gap-[3px] min-w-0 overflow-hidden pr-1.5">
            {constraintBadge}
            {functionBadges}
          </div>
          {connLine}
          {pinNumBox}
          <div style={{ width: 4, flexShrink: 0 }} />
          {solderDot}
        </>
      ) : (
        <>
          {solderDot}
          <div style={{ width: 4, flexShrink: 0 }} />
          {pinNumBox}
          {connLine}
          <div className="flex-1 flex items-center justify-start gap-[3px] min-w-0 overflow-hidden pl-1.5">
            {functionBadges}
            {constraintBadge}
          </div>
        </>
      )}
    </div>
  )
}

// Copper-traced antenna comb tine positions: [dx from center, height]
const ANTENNA_TINES: [number, number][] = [
  [-46, 10], [-40,  7], [-34, 18], [-28,  7], [-22, 13],
  [-16,  7], [-10, 22], [ -4,  7], [  2, 16], [  8,  7],
  [ 14, 18], [ 20,  7], [ 26, 12], [ 32,  7], [ 38,  9],
]

function ChipBody({ chip, height }: { chip: Chip; height: number }) {
  const W = CHIP_W
  const H = height
  const cx = W / 2

  const antennaH   = 50
  const shieldM    = 11
  const shieldTop  = antennaH + 7
  const shieldBot  = H - 16
  const shieldH    = shieldBot - shieldTop
  const shieldW    = W - shieldM * 2
  const uid        = chip.id

  // WiFi arcs base (roughly 38% down the shield)
  const wcy = shieldTop + Math.round(shieldH * 0.38)
  // Text block center
  const textY = wcy + 18

  const radioLabel = [
    chip.hasWifi && 'Wi-Fi',
    chip.hasBle  && 'BLE',
    chip.hasBluetooth && 'BT',
  ].filter(Boolean).join(' · ')

  return (
    <svg
      width={W}
      height={H}
      style={{ flexShrink: 0, display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`shield-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1e2d40" />
          <stop offset="45%"  stopColor="#192638" />
          <stop offset="100%" stopColor="#141f2e" />
        </linearGradient>
        <linearGradient id={`pcb-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0b1420" />
          <stop offset="100%" stopColor="#091018" />
        </linearGradient>
      </defs>

      {/* ── PCB base ── */}
      <rect width={W} height={H} fill={`url(#pcb-${uid})`} rx="3" />
      <rect x="0.75" y="0.75" width={W-1.5} height={H-1.5} fill="none" stroke="#1e3255" strokeWidth="1.5" rx="2.5" />

      {/* ── Antenna section ── */}
      <rect width={W} height={antennaH} fill="#0d1928" rx="3" />
      {/* square out the bottom edge of the rx above */}
      <rect y={antennaH - 6} width={W} height={6} fill="#0d1928" />
      <line x1="0" y1={antennaH} x2={W} y2={antennaH} stroke="#1a2e45" strokeWidth="0.75" />

      {/* Copper horizontal base trace */}
      <rect x={cx - 48} y={antennaH - 12} width={96} height={2.5} fill="#c2782a" />
      {/* Copper vertical tines */}
      {ANTENNA_TINES.map(([dx, th], i) => (
        <rect
          key={i}
          x={cx + dx}
          y={antennaH - 12 - th}
          width={3.5}
          height={th}
          fill={i % 3 === 0 ? '#d08530' : '#c2782a'}
          rx="0.5"
        />
      ))}
      {/* Copper sheen overlay */}
      {ANTENNA_TINES.map(([dx, th], i) => (
        <rect key={`s${i}`} x={cx + dx} y={antennaH - 12 - th} width={1} height={th} fill="#e8a04a" opacity="0.3" />
      ))}

      {/* ── RF Shield shadow ── */}
      <rect x={shieldM + 2} y={shieldTop + 2} width={shieldW} height={shieldH} fill="#000" rx="2.5" opacity="0.4" />

      {/* ── RF Shield body ── */}
      <rect x={shieldM} y={shieldTop} width={shieldW} height={shieldH} fill={`url(#shield-${uid})`} rx="2.5" />

      {/* Shield top-edge highlight (simulates machined edge bevel) */}
      <rect x={shieldM} y={shieldTop} width={shieldW} height={3} fill="#3a566e" rx="1" opacity="0.55" />
      {/* Shield right-edge subtle highlight */}
      <rect x={shieldM + shieldW - 2} y={shieldTop + 3} width={2} height={shieldH - 3} fill="#2a4055" rx="0" opacity="0.3" />

      {/* Shield outer border */}
      <rect x={shieldM} y={shieldTop} width={shieldW} height={shieldH} fill="none" stroke="#2a3e58" strokeWidth="0.75" rx="2.5" />

      {/* Inner inset frame */}
      <rect x={shieldM + 5} y={shieldTop + 5} width={shieldW - 10} height={shieldH - 10} fill="none" stroke="#192a3c" strokeWidth="0.5" rx="1.5" opacity="0.5" />

      {/* Corner mounting screws */}
      {([
        [shieldM + 9,           shieldTop + 9],
        [shieldM + shieldW - 9, shieldTop + 9],
        [shieldM + 9,           shieldTop + shieldH - 9],
        [shieldM + shieldW - 9, shieldTop + shieldH - 9],
      ] as [number, number][]).map(([sx, sy], i) => (
        <g key={i}>
          <circle cx={sx} cy={sy} r={4} fill="#0e1c2c" stroke="#253a52" strokeWidth="0.75" />
          <line x1={sx - 2.2} y1={sy} x2={sx + 2.2} y2={sy} stroke="#1e3050" strokeWidth="0.9" />
          <line x1={sx} y1={sy - 2.2} x2={sx} y2={sy + 2.2} stroke="#1e3050" strokeWidth="0.9" />
        </g>
      ))}

      {/* ── Wi-Fi signal arcs ── */}
      {[10, 18, 26].map((r, i) => (
        <path
          key={i}
          d={`M ${cx - r},${wcy} A ${r} ${r} 0 0 1 ${cx + r},${wcy}`}
          fill="none"
          stroke={['#36587a', '#254466', '#1a3355'][i]}
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <circle cx={cx} cy={wcy} r={2.5} fill="#253a55" />

      {/* ── Branding text ── */}
      <text
        x={cx} y={textY + 14}
        textAnchor="middle"
        fontSize="8.5"
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="700"
        fill="#4a6a8a"
        letterSpacing="2.5"
      >
        ESPRESSIF
      </text>
      <text
        x={cx} y={textY + 30}
        textAnchor="middle"
        fontSize="14"
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="800"
        fill="#5e82a0"
        letterSpacing="1.5"
      >
        {chip.family}
      </text>
      {radioLabel && (
        <text
          x={cx} y={textY + 44}
          textAnchor="middle"
          fontSize="6.5"
          fontFamily="'Courier New', Courier, monospace"
          fill="#1e3456"
          letterSpacing="0.5"
        >
          {radioLabel}
        </text>
      )}

      {/* CE + FCC markings */}
      <text
        x={cx - 18} y={shieldTop + shieldH - 12}
        textAnchor="middle"
        fontSize="9"
        fontFamily="serif"
        fontWeight="700"
        fill="#1e3050"
        letterSpacing="0.5"
      >
        CE
      </text>
      <text
        x={cx + 18} y={shieldTop + shieldH - 12}
        textAnchor="middle"
        fontSize="7"
        fontFamily="'Courier New', Courier, monospace"
        fontWeight="700"
        fill="#1e3050"
      >
        FCC
      </text>
      <text
        x={cx} y={shieldTop + shieldH - 3}
        textAnchor="middle"
        fontSize="5"
        fontFamily="'Courier New', Courier, monospace"
        fill="#14263a"
        letterSpacing="0.5"
      >
        ID: 2AC7Z-ESP32WROOM32
      </text>

      {/* ── GND thermal pad ── */}
      <rect x={cx - 32} y={H - 13} width={64} height={9} fill="#070c14" stroke="#1a3050" strokeWidth="0.75" rx="1" />
      <text x={cx} y={H - 6} textAnchor="middle" fontSize="4.5" fontFamily="monospace" fill="#1e3050">GND</text>
    </svg>
  )
}

const LEGEND = [
  { bg: '#dc2626', text: '#fff', label: 'Power' },
  { bg: '#111827', text: '#9ca3af', label: 'GND' },
  { bg: '#ea580c', text: '#fff', label: 'ADC1 (WiFi-safe)' },
  { bg: '#d97706', text: '#fff', label: 'ADC2 (WiFi conflict)' },
  { bg: '#ca8a04', text: '#fff', label: 'DAC' },
  { bg: '#16a34a', text: '#fff', label: 'Touch' },
  { bg: '#6d28d9', text: '#fff', label: 'GPIO' },
  { bg: '#2563eb', text: '#fff', label: 'SPI' },
  { bg: '#7c3aed', text: '#fff', label: 'I2C' },
  { bg: '#0891b2', text: '#fff', label: 'UART' },
  { bg: '#0369a1', text: '#fff', label: 'Clock' },
  { bg: '#374151', text: '#e5e7eb', label: 'EN/RST' },
] as const

export function PinoutDiagram() {
  const { chip, selectedPin, setSelectedPin, filter, mapping } = useApp()
  const filteredSet = new Set(filterPins(chip.pins, filter).map(p => p.gpio))

  const sorted = [...chip.pins].sort((a, b) => a.gpio - b.gpio)
  const mid = Math.ceil(sorted.length / 2)
  const leftPins  = sorted.slice(0, mid)
  const rightPins = sorted.slice(mid)

  const chipHeight = Math.max(leftPins.length, rightPins.length) * ROW_H

  const toggle = (pin: Pin) =>
    setSelectedPin(selectedPin?.gpio === pin.gpio ? null : pin)

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: '#060b12', borderColor: '#1a2535' }}>
      <div className="p-4 pb-3 overflow-x-auto">
        <div className="flex items-start justify-center min-w-fit mx-auto">

          {/* Left pin bank */}
          <div className="flex flex-col">
            {leftPins.map((pin, i) => (
              <PinRow
                key={pin.gpio}
                pin={pin}
                side="left"
                pinIndex={i + 1}
                isSelected={selectedPin?.gpio === pin.gpio}
                isFiltered={filteredSet.has(pin.gpio)}
                mappingLabel={mapping.find(a => a.gpio === pin.gpio)?.label}
                onClick={() => toggle(pin)}
              />
            ))}
          </div>

          {/* IC module body */}
          <ChipBody chip={chip} height={chipHeight} />

          {/* Right pin bank */}
          <div className="flex flex-col">
            {rightPins.map((pin, i) => (
              <PinRow
                key={pin.gpio}
                pin={pin}
                side="right"
                pinIndex={leftPins.length + i + 1}
                isSelected={selectedPin?.gpio === pin.gpio}
                isFiltered={filteredSet.has(pin.gpio)}
                mappingLabel={mapping.find(a => a.gpio === pin.gpio)?.label}
                onClick={() => toggle(pin)}
              />
            ))}
          </div>

        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5" style={{ borderTop: '1px solid #1a2535' }}>
        {LEGEND.map(({ bg, text, label }) => (
          <span key={label} className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
            <span
              className="font-mono font-bold rounded-sm flex-shrink-0"
              style={{ background: bg, color: text, fontSize: 8, lineHeight: '14px', height: 14, padding: '0 4px' }}
            >
              {label.split(' ')[0]}
            </span>
            <span style={{ color: '#6b7280' }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
