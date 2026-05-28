import { useApp } from '../context/AppContext'
import { filterPins } from '../utils/filterPins'
import type { Pin } from '../types/chip'

// Color of the pad rectangle that touches the chip body — primary capability wins
function padBg(pin: Pin): string {
  if (!pin.isUsable) return 'bg-red-950'
  const c = pin.constraints
  const caps = pin.capabilities
  if (c.some(x => x.severity === 'danger'))   return 'bg-red-800'
  if (c.some(x => x.id === 'adc2_no_wifi'))   return 'bg-orange-700'
  if (caps.includes('adc1'))                   return 'bg-emerald-800'
  if (caps.includes('dac'))                    return 'bg-teal-700'
  if (caps.includes('touch'))                  return 'bg-cyan-800'
  if (caps.includes('i2c'))                    return 'bg-blue-800'
  if (caps.includes('spi'))                    return 'bg-violet-800'
  if (caps.includes('uart'))                   return 'bg-amber-800'
  if (caps.includes('usb'))                    return 'bg-pink-800'
  if (c.some(x => x.id === 'strapping_pin'))   return 'bg-yellow-800'
  return 'bg-gray-700'
}

function padBorderColor(pin: Pin, selected: boolean): string {
  if (selected) return '#4ade80'
  if (!pin.isUsable || pin.constraints.some(c => c.severity === 'danger')) return '#ef4444'
  if (pin.constraints.some(c => c.id === 'adc2_no_wifi'))  return '#f97316'
  if (pin.capabilities.includes('adc1'))   return '#10b981'
  if (pin.capabilities.includes('dac'))    return '#14b8a6'
  if (pin.capabilities.includes('touch'))  return '#06b6d4'
  if (pin.capabilities.includes('i2c'))    return '#3b82f6'
  if (pin.capabilities.includes('spi'))    return '#8b5cf6'
  if (pin.capabilities.includes('uart'))   return '#f59e0b'
  if (pin.capabilities.includes('usb'))    return '#ec4899'
  if (pin.constraints.some(c => c.id === 'strapping_pin')) return '#ca8a04'
  return '#4b5563'
}

function gpioTextColor(pin: Pin, selected: boolean): string {
  if (selected) return '#86efac'
  if (!pin.isUsable) return '#f87171'
  if (pin.constraints.some(c => c.severity === 'danger')) return '#fca5a5'
  return '#4ade80'
}

// First non-GPIO name is the most useful alt function (e.g. ADC2_CH1, U0TXD)
function getAlt(pin: Pin): string {
  return pin.names.find(n => !n.startsWith('GPIO')) ?? ''
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
  const alt = getAlt(pin)
  const borderColor = padBorderColor(pin, isSelected)
  const textColor = gpioTextColor(pin, isSelected)
  const isLeft = side === 'left'

  const PinPad = (
    <div
      className={`w-3 self-stretch flex-shrink-0 border-y transition-colors duration-100 ${padBg(pin)}`}
      style={{ borderColor }}
    />
  )

  const GpioNum = (
    <span
      className="font-mono font-bold text-xs w-6 text-center flex-shrink-0 tabular-nums leading-none"
      style={{
        color: textColor,
        textDecoration: !pin.isUsable ? 'line-through' : 'none',
      }}
    >
      {pin.gpio}
    </span>
  )

  const AltLabel = alt ? (
    <span className="font-mono text-[11px] text-gray-400 truncate leading-none">{alt}</span>
  ) : null

  const MappingLabel = mappingLabel ? (
    <span
      className="text-[10px] font-medium truncate flex-shrink-0 max-w-[60px] px-1 rounded"
      style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.15)' }}
    >
      {mappingLabel}
    </span>
  ) : null

  return (
    <div
      onClick={onClick}
      className={`flex items-stretch h-[26px] cursor-pointer transition-colors select-none
        ${isFiltered ? '' : 'opacity-[0.15]'}
        ${isSelected ? 'bg-green-950/50' : 'hover:bg-white/[0.03]'}
      `}
    >
      {isLeft ? (
        <>
          <div className="flex items-center justify-end gap-1.5 w-48 px-2 min-w-0 overflow-hidden">
            {MappingLabel}
            {AltLabel}
            {GpioNum}
          </div>
          {PinPad}
        </>
      ) : (
        <>
          {PinPad}
          <div className="flex items-center gap-1.5 w-48 px-2 min-w-0 overflow-hidden">
            {GpioNum}
            {AltLabel}
            {MappingLabel}
          </div>
        </>
      )}
    </div>
  )
}

const LEGEND = [
  ['#10b981', 'ADC1 (WiFi-safe)'],
  ['#f97316', 'ADC2 (WiFi conflict)'],
  ['#06b6d4', 'Touch'],
  ['#3b82f6', 'I2C'],
  ['#8b5cf6', 'SPI'],
  ['#f59e0b', 'UART'],
  ['#ec4899', 'USB/JTAG'],
  ['#ca8a04', 'Strapping'],
  ['#ef4444', 'Danger / Reserved'],
  ['#4b5563', 'GPIO / PWM'],
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
      style={{ background: '#080d10', borderColor: '#1f2937' }}
    >
      {/* Diagram */}
      <div className="p-4 pb-3 overflow-x-auto">
        <div className="flex items-stretch justify-center min-w-fit mx-auto">

          {/* Left pin bank */}
          <div className="flex flex-col gap-px">
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

          {/* IC chip body */}
          <div
            className="flex-shrink-0 w-[60px] flex flex-col items-center justify-center relative"
            style={{
              background: '#0c1015',
              borderLeft: '2px solid #374151',
              borderRight: '2px solid #374151',
            }}
          >
            {/* IC package notch at top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-3 rounded-b-full"
              style={{
                background: '#080d10',
                borderBottom: '2px solid #374151',
                borderLeft: '2px solid #374151',
                borderRight: '2px solid #374151',
              }}
            />
            {/* Chip family label, rotated */}
            <span
              className="font-mono rotate-90 whitespace-nowrap select-none"
              style={{
                fontSize: '9px',
                letterSpacing: '0.2em',
                color: '#374151',
                textTransform: 'uppercase',
              }}
            >
              {chip.family}
            </span>
            {/* Pin-1 indicator */}
            <div
              className="absolute rounded-full"
              style={{
                bottom: 8,
                right: 8,
                width: 5,
                height: 5,
                border: '1px solid #374151',
              }}
            />
          </div>

          {/* Right pin bank */}
          <div className="flex flex-col gap-px">
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
        className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1"
        style={{ borderTop: '1px solid #1f2937' }}
      >
        {LEGEND.map(([color, label]) => (
          <span key={label} className="flex items-center gap-1.5 text-gray-500" style={{ fontSize: 11 }}>
            <span
              className="flex-shrink-0 rounded-sm"
              style={{ width: 10, height: 10, background: color, opacity: 0.8 }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
