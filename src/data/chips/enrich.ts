import type { Capability, Pin } from '../../types/chip'

// Supplemental pin functions for chips whose Espressif KiCad symbol shipped with
// sparse pin names, so the generator could not extract the analog / JTAG / crystal
// alternate functions (e.g. ESP32-C5, whose symbol only named power, UART0 and USB).
//
// Values are transcribed from the official Espressif datasheet IO MUX table, not
// guessed. This overlay is applied on top of the generated pins in catalog.ts, so
// generated.ts stays untouched and fully regenerable - the enrichment is additive
// (names + capabilities only; it never changes the authoritative constraint set).

interface Enrich {
  names?: string[]      // alternate function names to append (after the GPIO name)
  caps?: Capability[]   // capabilities to add
}

// Canonical capability order, matching the generator, so the merged list is stable.
const CAP_ORDER: Capability[] = [
  'gpio', 'adc1', 'adc2', 'dac', 'touch', 'pwm', 'i2c', 'spi', 'uart', 'i2s', 'rtc', 'usb', 'jtag',
]

// ESP32-C5 (ESP32-C5 Series Datasheet, IO MUX and GPIO Matrix):
// ADC1 has 6 channels on GPIO1-6; GPIO0/1 carry the 32 kHz crystal; GPIO2-5 are
// the JTAG pins (MTMS/MTDI/MTCK/MTDO); GPIO0-6 are the LP (RTC-domain) GPIOs.
const C5: Record<number, Enrich> = {
  0: { names: ['XTAL_32K_P'], caps: ['rtc'] },
  1: { names: ['ADC1_CH0', 'XTAL_32K_N'], caps: ['adc1', 'rtc'] },
  2: { names: ['ADC1_CH1', 'MTMS'], caps: ['adc1', 'rtc', 'jtag'] },
  3: { names: ['ADC1_CH2', 'MTDI'], caps: ['adc1', 'rtc', 'jtag'] },
  4: { names: ['ADC1_CH3', 'MTCK'], caps: ['adc1', 'rtc', 'jtag'] },
  5: { names: ['ADC1_CH4', 'MTDO'], caps: ['adc1', 'rtc', 'jtag'] },
  6: { names: ['ADC1_CH5'], caps: ['adc1', 'rtc'] },
}

const TABLE: Record<string, Record<number, Enrich>> = {
  esp32c5wroom1: C5,
  esp32c5mini1: C5,
}

export function enrichPins(chipId: string, pins: Pin[]): Pin[] {
  const table = TABLE[chipId]
  if (!table) return pins
  return pins.map(p => {
    const e = table[p.gpio]
    if (!e) return p
    const names = [...p.names, ...(e.names ?? []).filter(n => !p.names.includes(n))]
    const capSet = new Set<Capability>([...p.capabilities, ...(e.caps ?? [])])
    const capabilities = CAP_ORDER.filter(c => capSet.has(c))
    return { ...p, names, capabilities }
  })
}
