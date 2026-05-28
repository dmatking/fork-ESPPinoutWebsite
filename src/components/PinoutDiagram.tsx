import { useApp } from '../context/AppContext'
import { filterPins } from '../utils/filterPins'
import type { Pin } from '../types/chip'

const ROW_H = 28

// Badge background + text color per function name
function getBadge(name: string): { bg: string; text: string } {
  const u = name.toUpperCase()
  if (u === 'GND')                                             return { bg: '#374151', text: '#9ca3af' }
  if (/^3V3$|^VCC$|^VIN$|^VBUS$/.test(u))                    return { bg: '#7f1d1d', text: '#fca5a5' }
  if (/^EN$|^RST$|^RESET$/.test(u))                          return { bg: '#134e4a', text: '#5eead4' }
  if (/^ADC1_/.test(u))                                       return { bg: '#7c2d12', text: '#fed7aa' }
  if (/^ADC2_/.test(u))                                       return { bg: '#92400e', text: '#fde68a' }
  if (/^DAC/.test(u))                                         return { bg: '#713f12', text: '#fde047' }
  if (/^TOUCH/.test(u))                                       return { bg: '#164e63', text: '#67e8f9' }
  if (/^MT(DI|CK|MS|DO)$/.test(u))                           return { bg: '#292524', text: '#78716c' }
  if (/^(VSPI|HSPI|V_SPI)|MOSI$|MISO$|^SCK$/.test(u))       return { bg: '#1e3a8a', text: '#93c5fd' }
  if (/SDA$|SCL$/.test(u))                                    return { bg: '#1e40af', text: '#bfdbfe' }
  if (/^U[0-2](TXD|RXD|RTS|CTS)/.test(u))                   return { bg: '#14532d', text: '#86efac' }
  if (/^GPIO/.test(u))                                        return { bg: '#3b0764', text: '#d8b4fe' }
  if (/^SD_/.test(u))                                         return { bg: '#4a1d96', text: '#c4b5fd' }
  if (/USB|JTAG/.test(u))                                     return { bg: '#831843', text: '#f9a8d4' }
  if (/CLK|XTAL/.test(u))                                     return { bg: '#0c4a6e', text: '#7dd3fc' }
  return                                                              { bg: '#1f2937', text: '#9ca3af' }
}

// Dot + line color by primary capability
function connectorColor(pin: Pin): string {
  if (!pin.isUsable || pin.constraints.some(c => c.severity === 'danger')) return '#4b5563'
  if (pin.capabilities.includes('adc1'))   return '#ea580c'
  if (pin.capabilities.includes('adc2'))   return '#f97316'
  if (pin.capabilities.includes('dac'))    return '#ca8a04'
  if (pin.capabilities.includes('touch'))  return '#0891b2'
  if (pin.capabilities.includes('i2c'))    return '#3b82f6'
  if (pin.capabilities.includes('spi'))    return '#6366f1'
  if (pin.capabilities.includes('uart'))   return '#22c55e'
  if (pin.constraints.some(c => c.id === 'strapping_pin')) return '#eab308'
  return '#6b7280'
}

// Put GPIO badge closest to chip (last on left, first on right)
function sortedNames(names: string[], side: 'left' | 'right'): string[] {
  const gpio = names.filter(n => /^GPIO\d/.test(n))
  const other = names.filter(n => !/^GPIO\d/.test(n))
  return side === 'left' ? [...other, ...gpio] : [...gpio, ...other]
}

interface PinRowProps {
  pin: Pin
  side: 'left' | 'right'
  isSelected: boolean
  isFiltered: boolean
  mappingLabel?: string
  onClick: () => void
}

function PinRow({ pin, side, isSelected, isFiltered, mappingLabel, onClick }: PinRowProps) {
  const color = connectorColor(pin)
  const names = sortedNames(pin.names, side)

  const badgeContent = (
    <>
      {mappingLabel && (
        <span
          className="font-mono text-[9px] font-semibold px-1.5 flex-shrink-0 rounded"
          style={{ background: 'rgba(59,130,246,0.25)', color: '#93c5fd', lineHeight: '16px', height: 16 }}
        >
          {mappingLabel}
        </span>
      )}
      {names.map(name => {
        const { bg, text } = getBadge(name)
        return (
          <span
            key={name}
            className="font-mono text-[9px] font-semibold px-1.5 flex-shrink-0 rounded"
            style={{ background: bg, color: text, lineHeight: '16px', height: 16 }}
          >
            {name}
          </span>
        )
      })}
    </>
  )

  const dot = (
    <div
      className="flex-shrink-0 rounded-full"
      style={{ width: 8, height: 8, background: color }}
    />
  )

  const line = (
    <div className="flex-shrink-0" style={{ width: 14, height: 1, background: '#374151' }} />
  )

  return (
    <div
      onClick={onClick}
      className={`flex items-center cursor-pointer transition-colors select-none
        ${isFiltered ? '' : 'opacity-[0.1]'}
        ${isSelected ? 'bg-green-950/40' : 'hover:bg-white/[0.04]'}
      `}
      style={{ height: ROW_H, borderBottom: '1px solid #0f172a' }}
    >
      {side === 'left' ? (
        <>
          <div className="flex-1 flex items-center justify-end gap-1 min-w-0 overflow-hidden pr-1.5">
            {badgeContent}
          </div>
          {line}
          {dot}
        </>
      ) : (
        <>
          {dot}
          {line}
          <div className="flex-1 flex items-center justify-start gap-1 min-w-0 overflow-hidden pl-1.5">
            {badgeContent}
          </div>
        </>
      )}
    </div>
  )
}

function ChipBody({ family }: { family: string }) {
  // Antenna comb: alternating heights for a PCB trace look
  const combHeights = [8, 14, 8, 18, 8, 14, 8, 18, 8, 14, 8]

  return (
    <div
      className="flex-shrink-0 self-stretch flex flex-col"
      style={{ width: 116, background: '#090e14', border: '2px solid #2d3748', borderRadius: 3 }}
    >
      {/* Antenna section */}
      <div
        className="flex justify-center items-end gap-[2px] flex-shrink-0"
        style={{ paddingTop: 8, paddingBottom: 6, borderBottom: '1px solid #1f2937' }}
      >
        {combHeights.map((h, i) => (
          <div key={i} style={{ width: 3, height: h, background: '#2d3748', borderRadius: 1 }} />
        ))}
      </div>

      {/* Main body content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3">
        {/* Wi-Fi arcs */}
        <div className="relative flex items-end justify-center" style={{ width: 36, height: 22 }}>
          <div
            className="absolute rounded-full"
            style={{ width: 5, height: 5, background: '#374151', bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
          />
          {[14, 24, 34].map((w, i) => (
            <div
              key={i}
              className="absolute"
              style={{
                width: w, height: w / 2,
                borderTop: `2px solid ${i === 2 ? '#1f2937' : '#374151'}`,
                borderRadius: '50% 50% 0 0',
                bottom: 3,
              }}
            />
          ))}
        </div>

        {/* Chip text */}
        <div className="text-center leading-tight">
          <div className="font-mono text-[7px] tracking-widest mb-1" style={{ color: '#4b5563' }}>
            Wi-Fi · BT · BLE
          </div>
          <div className="font-mono font-bold tracking-wide" style={{ fontSize: 10, color: '#6b7280' }}>
            {family}
          </div>
          <div className="font-mono text-[6px] mt-1" style={{ color: '#374151', letterSpacing: '0.1em' }}>
            ESPRESSIF
          </div>
        </div>

        <div className="font-mono text-[6px]" style={{ color: '#1f2937' }}>
          FCC ID: 2AC7Z
        </div>
      </div>

      {/* Ground thermal pad */}
      <div className="flex justify-center flex-shrink-0 pb-2">
        <div style={{ width: 56, height: 10, background: '#111827', border: '1px solid #1f2937', borderRadius: 1 }} />
      </div>
    </div>
  )
}

const LEGEND = [
  { bg: '#7f1d1d', text: '#fca5a5', label: 'Power' },
  { bg: '#374151', text: '#9ca3af', label: 'GND' },
  { bg: '#7c2d12', text: '#fed7aa', label: 'ADC1 (WiFi-safe)' },
  { bg: '#92400e', text: '#fde68a', label: 'ADC2 (WiFi conflict)' },
  { bg: '#713f12', text: '#fde047', label: 'DAC' },
  { bg: '#164e63', text: '#67e8f9', label: 'Touch' },
  { bg: '#3b0764', text: '#d8b4fe', label: 'GPIO' },
  { bg: '#1e3a8a', text: '#93c5fd', label: 'SPI' },
  { bg: '#1e40af', text: '#bfdbfe', label: 'I2C' },
  { bg: '#14532d', text: '#86efac', label: 'UART' },
  { bg: '#0c4a6e', text: '#7dd3fc', label: 'Clock' },
] as const

export function PinoutDiagram() {
  const { chip, selectedPin, setSelectedPin, filter, mapping } = useApp()
  const filteredSet = new Set(filterPins(chip.pins, filter).map(p => p.gpio))

  const sorted = [...chip.pins].sort((a, b) => a.gpio - b.gpio)
  const mid = Math.ceil(sorted.length / 2)
  const leftPins = sorted.slice(0, mid)
  const rightPins = sorted.slice(mid)

  const toggle = (pin: Pin) =>
    setSelectedPin(selectedPin?.gpio === pin.gpio ? null : pin)

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: '#060b10', borderColor: '#1f2937' }}
    >
      {/* Diagram */}
      <div className="p-4 pb-3 overflow-x-auto">
        <div className="flex items-stretch justify-center min-w-fit mx-auto">

          {/* Left pin bank */}
          <div className="flex flex-col">
            {leftPins.map(pin => (
              <PinRow
                key={pin.gpio}
                pin={pin}
                side="left"
                isSelected={selectedPin?.gpio === pin.gpio}
                isFiltered={filteredSet.has(pin.gpio)}
                mappingLabel={mapping.find(a => a.gpio === pin.gpio)?.label}
                onClick={() => toggle(pin)}
              />
            ))}
          </div>

          {/* IC body */}
          <ChipBody family={chip.family} />

          {/* Right pin bank */}
          <div className="flex flex-col">
            {rightPins.map(pin => (
              <PinRow
                key={pin.gpio}
                pin={pin}
                side="right"
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
      <div
        className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5"
        style={{ borderTop: '1px solid #1f2937' }}
      >
        {LEGEND.map(({ bg, text, label }) => (
          <span key={label} className="flex items-center gap-1.5" style={{ fontSize: 10 }}>
            <span
              className="font-mono text-[8px] font-semibold px-1.5 rounded flex-shrink-0"
              style={{ background: bg, color: text, lineHeight: '14px', height: 14 }}
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
