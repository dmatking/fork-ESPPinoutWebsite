# ESP32 Pinout Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free, fully static web app that shows interactive pinout diagrams, constraint warnings, and a pin-mapping builder for all common ESP32 chip variants.

**Architecture:** 100% client-side Vite + React + TypeScript + Tailwind. Chip data lives in strongly-typed JSON files under `src/data/chips/`. All state (chip selection, mapping, filters) is held in React context. Shareable URLs encode state in the hash. No backend, no build-time data fetching — deploys free to Vercel or GitHub Pages.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Tailwind CSS 3, html2canvas (PNG export), Vitest + Testing Library (unit tests)

---

## File Map

```
src/
  types/
    chip.ts              — Chip, Pin, Capability, Constraint types (single source of truth)
  data/
    chips/
      esp32.ts           — Classic ESP32 (WROOM/WROVER/DevKitC)
      esp32s2.ts         — ESP32-S2
      esp32s3.ts         — ESP32-S3
      esp32c3.ts         — ESP32-C3
      esp32c6.ts         — ESP32-C6
      esp32h2.ts         — ESP32-H2
    index.ts             — Re-exports all chips as CHIPS array
  context/
    AppContext.tsx        — selectedChip, mapping, filters — shared state + URL sync
  components/
    ChipSelector.tsx      — Dropdown/card grid to pick a chip variant
    PinoutDiagram.tsx     — Data-driven two-column board diagram (SVG/HTML)
    PinTable.tsx          — Filterable/sortable table, synced selection with diagram
    PinDetailPanel.tsx    — Slide-in panel: all capabilities + constraints for one pin
    FilterBar.tsx         — "Safe for output", "ADC+WiFi safe", "PWM", "Free" filters
    MappingBuilder.tsx    — Assign roles to pins; live conflict + gotcha warnings
    ExportPanel.tsx       — #define export, shareable URL copy, PNG download
    ConstraintBadge.tsx   — Colour-coded pill (danger/warning/info) used everywhere
    CommunitySubmit.tsx   — JSON preview + copy button to submit a custom board
  App.tsx
  main.tsx
  index.css
tests/
  chip-data.test.ts       — Validates every chip's data against the schema
  constraint-logic.test.ts— Validates conflict detection
  url-state.test.ts       — Encodes/decodes mapping state in URL hash
```

---

## Task 1: Scaffold Vite + React + TS + Tailwind

**Files:**
- Create: all Vite scaffold files in project root

- [ ] **Step 1: Scaffold project**

```bash
cd /Users/felixkunz/Downloads/Github/ESPPinoutWebsite
npm create vite@latest . -- --template react-ts --yes
npm install
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Configure Tailwind**

Replace `tailwind.config.js` content:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 3: Add Tailwind directives to `src/index.css`**

Replace entire file:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Install export and test deps**

```bash
npm install html2canvas
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 5: Configure Vitest in `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 6: Create test setup file `tests/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```
Expected: Vite dev server running at `http://localhost:5173` with default React app.

- [ ] **Step 8: Verify tests run**

```bash
npm test -- --run
```
Expected: "No test files found" (0 tests, exit 0).

- [ ] **Step 9: Replace `src/App.tsx` with minimal shell**

```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <h1 className="text-2xl font-bold text-green-400">ESP32 Pinout Studio</h1>
    </div>
  )
}
```

- [ ] **Step 10: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Vite React TS Tailwind with Vitest"
```

---

## Task 2: Define Core Types

**Files:**
- Create: `src/types/chip.ts`

- [ ] **Step 1: Create `src/types/chip.ts`**

```ts
export type Severity = 'danger' | 'warning' | 'info'

export type Capability =
  | 'adc1' | 'adc2' | 'dac' | 'touch'
  | 'pwm' | 'i2c' | 'spi' | 'uart' | 'i2s'
  | 'rtc' | 'input_only' | 'usb' | 'jtag'
  | 'gpio'

export type ConstraintId =
  | 'adc2_no_wifi'
  | 'input_only'
  | 'strapping_pin'
  | 'flash_reserved'
  | 'boot_must_float'
  | 'boot_must_high'
  | 'boot_must_low'
  | 'usb_jtag'
  | 'limited_current'
  | 'no_pullup'

export interface Constraint {
  id: ConstraintId
  severity: Severity
  title: string
  description: string
}

export interface Pin {
  gpio: number
  names: string[]            // e.g. ['GPIO4', 'ADC2_CH0', 'TOUCH0']
  capabilities: Capability[]
  constraints: Constraint[]
  isUsable: boolean          // false = never use (flash-reserved etc)
  notes?: string
}

export interface Chip {
  id: string                 // e.g. 'esp32', 'esp32s3'
  name: string               // e.g. 'ESP32 (WROOM/WROVER)'
  family: string             // e.g. 'ESP32', 'ESP32-S3'
  totalGpio: number
  hasWifi: boolean
  hasBle: boolean
  hasBluetooth: boolean      // classic BT (not just BLE)
  cores: number
  datasheetUrl: string
  notes: string[]            // chip-level gotchas
  pins: Pin[]
}

export type MappingRole =
  | 'LED' | 'Button' | 'I2C_SDA' | 'I2C_SCL'
  | 'SPI_MOSI' | 'SPI_MISO' | 'SPI_SCK' | 'SPI_CS'
  | 'UART_TX' | 'UART_RX' | 'PWM' | 'ADC' | 'DAC'
  | 'Touch' | 'Custom'

export interface PinAssignment {
  gpio: number
  role: MappingRole
  label: string              // e.g. "Status LED"
}

export type FilterKey =
  | 'all'
  | 'safe_output'            // not input_only, not flash_reserved
  | 'adc_wifi_safe'          // adc1 only (no adc2)
  | 'pwm'
  | 'free'                   // no constraints at all
  | 'strapping'              // is a strapping pin
  | 'touch'
```

- [ ] **Step 2: Commit**

```bash
git add src/types/chip.ts
git commit -m "feat: define core Chip/Pin/Constraint types"
```

---

## Task 3: Classic ESP32 Data

**Files:**
- Create: `src/data/chips/esp32.ts`

- [ ] **Step 1: Create `src/data/chips/esp32.ts`**

This encodes the full 40-pin classic ESP32 with all known gotchas:

```ts
import type { Chip } from '../../types/chip'

// Pre-built constraint objects reused across pins
const ADC2_NO_WIFI = {
  id: 'adc2_no_wifi' as const,
  severity: 'warning' as const,
  title: 'ADC2 unusable with WiFi',
  description: 'ADC2 is used by the WiFi driver. Any analogRead() on an ADC2 pin returns errors while WiFi is active. Use ADC1 pins (GPIO32–39) for analog readings when WiFi is on.',
}

const INPUT_ONLY = {
  id: 'input_only' as const,
  severity: 'warning' as const,
  title: 'Input only',
  description: 'GPIO34, 35, 36, 39 have no internal pull-up/pull-down and cannot drive output. Only use as digital or analog inputs.',
}

const FLASH_RESERVED = {
  id: 'flash_reserved' as const,
  severity: 'danger' as const,
  title: 'Reserved for flash / PSRAM',
  description: 'GPIO6–11 are connected to the internal SPI flash. Using them for anything else will crash the ESP32.',
}

const makeStrapping = (detail: string) => ({
  id: 'strapping_pin' as const,
  severity: 'warning' as const,
  title: 'Strapping pin',
  description: `This pin is sampled at boot to configure the chip. ${detail}`,
})

const BOOT_FLOAT = {
  id: 'boot_must_float' as const,
  severity: 'warning' as const,
  title: 'Must float at boot',
  description: 'This pin must not be driven LOW or HIGH by external circuitry at boot or the ESP32 may enter an unexpected boot mode.',
}

export const esp32: Chip = {
  id: 'esp32',
  name: 'ESP32 (WROOM / WROVER / DevKitC)',
  family: 'ESP32',
  totalGpio: 34,
  hasWifi: true,
  hasBle: true,
  hasBluetooth: true,
  cores: 2,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32_datasheet_en.pdf',
  notes: [
    'ADC2 (GPIO0,2,4,12–15,25–27) cannot be used while WiFi is active.',
    'GPIO6–11 are connected to internal SPI flash — never use them.',
    'GPIO34, 35, 36, 39 are input-only (no output, no pull-up/down).',
    'GPIO0 must be HIGH (or floating) at boot to boot from flash; pull LOW to enter bootloader.',
    'GPIO12 (MTDI) must be LOW at boot for 3.3 V flash; if pulled HIGH the ESP32 configures 1.8 V flash and may not start.',
    'GPIO15 (MTDO) must be HIGH at boot to suppress startup log on UART0.',
  ],
  pins: [
    {
      gpio: 0,
      names: ['GPIO0', 'ADC2_CH1', 'TOUCH1', 'CLK_OUT1'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [
        ADC2_NO_WIFI,
        makeStrapping('GPIO0 must be HIGH (floating) at boot to boot from flash. LOW = download mode. Avoid pulling low with resistors or sensors at boot.'),
      ],
      isUsable: true,
    },
    {
      gpio: 1,
      names: ['GPIO1', 'U0TXD', 'CLK_OUT3'],
      capabilities: ['gpio', 'uart', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Default UART0 TX. Busy during programming and outputs boot log at 115200 baud.',
    },
    {
      gpio: 2,
      names: ['GPIO2', 'ADC2_CH2', 'TOUCH2'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [
        ADC2_NO_WIFI,
        makeStrapping('GPIO2 must be LOW or floating during download mode. On many DevKit boards the onboard LED is on GPIO2 — the 10 kΩ pull-down can interfere with boot if an external device drives it HIGH.'),
      ],
      isUsable: true,
    },
    {
      gpio: 3,
      names: ['GPIO3', 'U0RXD'],
      capabilities: ['gpio', 'uart', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Default UART0 RX. HIGH at boot.',
    },
    {
      gpio: 4,
      names: ['GPIO4', 'ADC2_CH0', 'TOUCH0'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [ADC2_NO_WIFI],
      isUsable: true,
    },
    {
      gpio: 5,
      names: ['GPIO5', 'VSPICS0'],
      capabilities: ['gpio', 'spi', 'pwm'],
      constraints: [
        makeStrapping('GPIO5 must be HIGH at boot. If pulled LOW at boot, SDIO slave timing is affected. Generally safe with a pull-up.'),
      ],
      isUsable: true,
    },
    { gpio: 6,  names: ['GPIO6',  'SD_CLK'],  capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    { gpio: 7,  names: ['GPIO7',  'SD_DATA0'],capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    { gpio: 8,  names: ['GPIO8',  'SD_DATA1'],capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    { gpio: 9,  names: ['GPIO9',  'SD_DATA2'],capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    { gpio: 10, names: ['GPIO10', 'SD_DATA3'],capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    { gpio: 11, names: ['GPIO11', 'SD_CMD'],  capabilities: [], constraints: [FLASH_RESERVED], isUsable: false },
    {
      gpio: 12,
      names: ['GPIO12', 'ADC2_CH5', 'TOUCH5', 'MTDI'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [
        ADC2_NO_WIFI,
        makeStrapping('MTDI: if HIGH at boot, the flash voltage is set to 1.8 V. Most modules use 3.3 V flash — driving GPIO12 HIGH at boot will prevent startup. Keep LOW or floating at boot.'),
      ],
      isUsable: true,
    },
    {
      gpio: 13,
      names: ['GPIO13', 'ADC2_CH4', 'TOUCH4', 'MTCK'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [ADC2_NO_WIFI],
      isUsable: true,
    },
    {
      gpio: 14,
      names: ['GPIO14', 'ADC2_CH6', 'TOUCH6', 'MTMS'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [
        ADC2_NO_WIFI,
        BOOT_FLOAT,
      ],
      isUsable: true,
      notes: 'Outputs PWM signal at boot. Can interfere with attached hardware.',
    },
    {
      gpio: 15,
      names: ['GPIO15', 'ADC2_CH3', 'TOUCH3', 'MTDO'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [
        ADC2_NO_WIFI,
        makeStrapping('GPIO15 must be HIGH at boot to suppress U0RXD log output. If pulled LOW, the ESP32 outputs debug messages on UART0 at 75 baud.'),
      ],
      isUsable: true,
    },
    {
      gpio: 16,
      names: ['GPIO16', 'U2RXD'],
      capabilities: ['gpio', 'uart', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Not available on WROVER (used for PSRAM). Safe on WROOM.',
    },
    {
      gpio: 17,
      names: ['GPIO17', 'U2TXD'],
      capabilities: ['gpio', 'uart', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Not available on WROVER (used for PSRAM). Safe on WROOM.',
    },
    {
      gpio: 18,
      names: ['GPIO18', 'VSPICLK'],
      capabilities: ['gpio', 'spi', 'pwm'],
      constraints: [],
      isUsable: true,
    },
    {
      gpio: 19,
      names: ['GPIO19', 'VSPIQ', 'U0CTS'],
      capabilities: ['gpio', 'spi', 'uart', 'pwm'],
      constraints: [],
      isUsable: true,
    },
    {
      gpio: 21,
      names: ['GPIO21', 'VSPIHD', 'SDA'],
      capabilities: ['gpio', 'spi', 'i2c', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Default I2C SDA in Arduino.',
    },
    {
      gpio: 22,
      names: ['GPIO22', 'VSPIWR', 'SCL'],
      capabilities: ['gpio', 'spi', 'i2c', 'pwm'],
      constraints: [],
      isUsable: true,
      notes: 'Default I2C SCL in Arduino.',
    },
    {
      gpio: 23,
      names: ['GPIO23', 'VSPID', 'MOSI'],
      capabilities: ['gpio', 'spi', 'pwm'],
      constraints: [],
      isUsable: true,
    },
    {
      gpio: 25,
      names: ['GPIO25', 'ADC2_CH8', 'DAC1'],
      capabilities: ['gpio', 'adc2', 'dac', 'pwm'],
      constraints: [ADC2_NO_WIFI],
      isUsable: true,
    },
    {
      gpio: 26,
      names: ['GPIO26', 'ADC2_CH9', 'DAC2'],
      capabilities: ['gpio', 'adc2', 'dac', 'pwm'],
      constraints: [ADC2_NO_WIFI],
      isUsable: true,
    },
    {
      gpio: 27,
      names: ['GPIO27', 'ADC2_CH7', 'TOUCH7'],
      capabilities: ['gpio', 'adc2', 'touch', 'pwm'],
      constraints: [ADC2_NO_WIFI],
      isUsable: true,
    },
    {
      gpio: 32,
      names: ['GPIO32', 'ADC1_CH4', 'TOUCH9', 'XTAL_32K_P'],
      capabilities: ['gpio', 'adc1', 'touch', 'rtc', 'pwm'],
      constraints: [],
      isUsable: true,
    },
    {
      gpio: 33,
      names: ['GPIO33', 'ADC1_CH5', 'TOUCH8', 'XTAL_32K_N'],
      capabilities: ['gpio', 'adc1', 'touch', 'rtc', 'pwm'],
      constraints: [],
      isUsable: true,
    },
    {
      gpio: 34,
      names: ['GPIO34', 'ADC1_CH6', 'RTC_GPIO4'],
      capabilities: ['gpio', 'adc1', 'rtc'],
      constraints: [INPUT_ONLY],
      isUsable: true,
    },
    {
      gpio: 35,
      names: ['GPIO35', 'ADC1_CH7', 'RTC_GPIO5'],
      capabilities: ['gpio', 'adc1', 'rtc'],
      constraints: [INPUT_ONLY],
      isUsable: true,
    },
    {
      gpio: 36,
      names: ['GPIO36', 'ADC1_CH0', 'RTC_GPIO0', 'VP'],
      capabilities: ['gpio', 'adc1', 'rtc'],
      constraints: [INPUT_ONLY],
      isUsable: true,
    },
    {
      gpio: 39,
      names: ['GPIO39', 'ADC1_CH3', 'RTC_GPIO3', 'VN'],
      capabilities: ['gpio', 'adc1', 'rtc'],
      constraints: [INPUT_ONLY],
      isUsable: true,
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/data/chips/esp32.ts
git commit -m "feat: add Classic ESP32 pin data with constraints"
```

---

## Task 4: Remaining Chip Data Files

**Files:**
- Create: `src/data/chips/esp32s2.ts`
- Create: `src/data/chips/esp32s3.ts`
- Create: `src/data/chips/esp32c3.ts`
- Create: `src/data/chips/esp32c6.ts`
- Create: `src/data/chips/esp32h2.ts`
- Create: `src/data/chips/index.ts`

- [ ] **Step 1: Create `src/data/chips/esp32s2.ts`**

```ts
import type { Chip } from '../../types/chip'

const INPUT_ONLY_S2 = {
  id: 'input_only' as const,
  severity: 'warning' as const,
  title: 'Input only',
  description: 'GPIO46 is input-only with no internal pull-up/down.',
}

export const esp32s2: Chip = {
  id: 'esp32s2',
  name: 'ESP32-S2',
  family: 'ESP32-S2',
  totalGpio: 43,
  hasWifi: true,
  hasBle: false,
  hasBluetooth: false,
  cores: 1,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-s2_datasheet_en.pdf',
  notes: [
    'No Bluetooth — WiFi only.',
    'Native USB (USB OTG) on GPIO19/20 — do not use for GPIO while USB is connected.',
    'GPIO46 is input-only (no output, no pull-up/down).',
    'ADC2 has same WiFi conflict as classic ESP32.',
    'GPIO0 is strapping pin — must be HIGH for normal boot.',
  ],
  pins: [
    { gpio: 0, names: ['GPIO0'], capabilities: ['gpio', 'pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Must be HIGH at boot for normal operation. LOW = download mode.' }],
      isUsable: true },
    { gpio: 1,  names: ['GPIO1',  'ADC1_CH0', 'TOUCH1'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 2,  names: ['GPIO2',  'ADC1_CH1', 'TOUCH2'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 3,  names: ['GPIO3',  'ADC1_CH2', 'TOUCH3'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 4,  names: ['GPIO4',  'ADC1_CH3', 'TOUCH4'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 5,  names: ['GPIO5',  'ADC1_CH4', 'TOUCH5'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 6,  names: ['GPIO6',  'ADC1_CH5', 'TOUCH6'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 7,  names: ['GPIO7',  'ADC1_CH6', 'TOUCH7'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 8,  names: ['GPIO8',  'ADC1_CH7', 'TOUCH8'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 9,  names: ['GPIO9',  'ADC1_CH8', 'TOUCH9'],  capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 10, names: ['GPIO10', 'ADC1_CH9', 'TOUCH10'], capabilities: ['gpio','adc1','touch','pwm'], constraints: [], isUsable: true },
    { gpio: 11, names: ['GPIO11', 'ADC2_CH0', 'TOUCH11'], capabilities: ['gpio','adc2','touch','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 12, names: ['GPIO12', 'ADC2_CH1', 'TOUCH12'], capabilities: ['gpio','adc2','touch','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 13, names: ['GPIO13', 'ADC2_CH2', 'TOUCH13'], capabilities: ['gpio','adc2','touch','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 14, names: ['GPIO14', 'ADC2_CH3', 'TOUCH14'], capabilities: ['gpio','adc2','touch','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 15, names: ['GPIO15', 'ADC2_CH4', 'TOUCH15'], capabilities: ['gpio','adc2','touch','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 16, names: ['GPIO16', 'ADC2_CH5'],            capabilities: ['gpio','adc2','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 17, names: ['GPIO17', 'ADC2_CH6', 'DAC1'],   capabilities: ['gpio','adc2','dac','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 18, names: ['GPIO18', 'ADC2_CH7', 'DAC2'],   capabilities: ['gpio','adc2','dac','pwm'],
      constraints: [{ id: 'adc2_no_wifi', severity: 'warning', title: 'ADC2 unusable with WiFi', description: 'ADC2 is used by the WiFi driver. analogRead() fails while WiFi is active.' }], isUsable: true },
    { gpio: 19, names: ['GPIO19', 'USB_D-'],             capabilities: ['gpio','usb','pwm'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'Native USB D−', description: 'Used for USB OTG. Avoid using as GPIO while USB CDC/HID is active.' }], isUsable: true },
    { gpio: 20, names: ['GPIO20', 'USB_D+'],             capabilities: ['gpio','usb','pwm'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'Native USB D+', description: 'Used for USB OTG. Avoid using as GPIO while USB CDC/HID is active.' }], isUsable: true },
    { gpio: 21, names: ['GPIO21'],                        capabilities: ['gpio','pwm'], constraints: [], isUsable: true },
    ...[26,33,34,35,36,37,38,39,40,41,42].map(n => ({
      gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true,
    })),
    { gpio: 43, names: ['GPIO43', 'U0TXD'],              capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true, notes: 'Default UART0 TX.' },
    { gpio: 44, names: ['GPIO44', 'U0RXD'],              capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true, notes: 'Default UART0 RX.' },
    { gpio: 45, names: ['GPIO45'],                        capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Sampled at boot. Avoid driving at boot.' }], isUsable: true },
    { gpio: 46, names: ['GPIO46'],                        capabilities: ['gpio'],
      constraints: [INPUT_ONLY_S2], isUsable: true },
  ],
}
```

- [ ] **Step 2: Create `src/data/chips/esp32s3.ts`**

```ts
import type { Chip } from '../../types/chip'

const USB_JTAG = {
  id: 'usb_jtag' as const, severity: 'warning' as const,
  title: 'Native USB / JTAG',
  description: 'GPIO19 (D−) and GPIO20 (D+) are wired to the internal USB Serial/JTAG controller. Using them as GPIO breaks USB debugging.',
}

export const esp32s3: Chip = {
  id: 'esp32s3',
  name: 'ESP32-S3',
  family: 'ESP32-S3',
  totalGpio: 45,
  hasWifi: true,
  hasBle: true,
  hasBluetooth: false,
  cores: 2,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf',
  notes: [
    'No ADC2-WiFi conflict — S3 redesigned the ADC/WiFi arbitration.',
    'GPIO19/20 are USB Serial/JTAG D−/D+. Do not use as GPIO when USB is connected.',
    'GPIO0 is strapping pin (HIGH = normal boot, LOW = download mode).',
    'GPIO45/46 are strapping pins — avoid driving at boot.',
    'GPIO3, 4, 5, 6 are strapping-related on some modules.',
    'No DAC on S3.',
  ],
  pins: [
    { gpio: 0, names: ['GPIO0'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'HIGH = boot from flash, LOW = download mode.' }], isUsable: true },
    ...[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18].map(n => ({
      gpio: n, names: [`GPIO${n}`, `ADC1_CH${n-1}`], capabilities: ['gpio','adc1','pwm'] as const[], constraints: [], isUsable: true,
    })),
    { gpio: 19, names: ['GPIO19','USB_D-'],  capabilities: ['gpio','usb','pwm'], constraints: [USB_JTAG], isUsable: true },
    { gpio: 20, names: ['GPIO20','USB_D+'],  capabilities: ['gpio','usb','pwm'], constraints: [USB_JTAG], isUsable: true },
    ...[21,26,33,34,35,36,37,38,39,40,41,42].map(n => ({
      gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true,
    })),
    { gpio: 43, names: ['GPIO43','U0TXD'],   capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true },
    { gpio: 44, names: ['GPIO44','U0RXD'],   capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true },
    { gpio: 45, names: ['GPIO45'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Sampled at boot. Keep floating or HIGH for normal operation.' }], isUsable: true },
    { gpio: 46, names: ['GPIO46'], capabilities: ['gpio'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin / input priority', description: 'Sampled at boot. Also input-only on some sub-variants.' }], isUsable: true },
    ...[47,48].map(n => ({
      gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true,
    })),
  ],
}
```

- [ ] **Step 3: Create `src/data/chips/esp32c3.ts`**

```ts
import type { Chip } from '../../types/chip'

const USB_JTAG_C3 = {
  id: 'usb_jtag' as const, severity: 'warning' as const,
  title: 'USB Serial/JTAG',
  description: 'GPIO18 (D−) and GPIO19 (D+) are the internal USB Serial/JTAG interface. Avoid using as GPIO when USB is connected.',
}

export const esp32c3: Chip = {
  id: 'esp32c3',
  name: 'ESP32-C3',
  family: 'ESP32-C3',
  totalGpio: 22,
  hasWifi: true,
  hasBle: true,
  hasBluetooth: false,
  cores: 1,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf',
  notes: [
    'RISC-V single-core. No classic Bluetooth.',
    'No ADC2 (all ADC channels are ADC1) — no ADC/WiFi conflict.',
    'GPIO18/19 are USB Serial/JTAG D−/D+.',
    'GPIO2, 8, 9 are strapping pins.',
    'GPIO11 is connected to VDD_SPI on some modules — avoid.',
    'No touch sensor, no DAC.',
  ],
  pins: [
    ...[0,1,2,3,4,5].map(n => ({
      gpio: n, names: [`GPIO${n}`, `ADC1_CH${n}`], capabilities: ['gpio','adc1','pwm'] as const[],
      constraints: n === 2 ? [{ id: 'strapping_pin' as const, severity: 'warning' as const, title: 'Strapping pin', description: 'Sampled at boot.' }] : [],
      isUsable: true,
    })),
    ...[6,7].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    { gpio: 8, names: ['GPIO8'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Must be HIGH at boot for normal operation on some modules.' }], isUsable: true },
    { gpio: 9, names: ['GPIO9'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin / boot button', description: 'Pulled HIGH internally. LOW at boot = download mode. This is the BOOT button on most dev boards.' }], isUsable: true },
    { gpio: 10, names: ['GPIO10'], capabilities: ['gpio','pwm'], constraints: [], isUsable: true },
    { gpio: 11, names: ['GPIO11','VDD_SPI'], capabilities: ['gpio'],
      constraints: [{ id: 'flash_reserved', severity: 'danger', title: 'VDD_SPI / possibly flash', description: 'On modules with external flash, GPIO11 may be connected to the flash VDD rail. Do not use without checking your module schematic.' }], isUsable: false },
    ...[12,13,14,15,16,17].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    { gpio: 18, names: ['GPIO18','USB_D-'], capabilities: ['gpio','usb'], constraints: [USB_JTAG_C3], isUsable: true },
    { gpio: 19, names: ['GPIO19','USB_D+'], capabilities: ['gpio','usb'], constraints: [USB_JTAG_C3], isUsable: true },
    { gpio: 20, names: ['GPIO20','U0RXD'], capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true },
    { gpio: 21, names: ['GPIO21','U0TXD'], capabilities: ['gpio','uart','pwm'], constraints: [], isUsable: true },
  ],
}
```

- [ ] **Step 4: Create `src/data/chips/esp32c6.ts`**

```ts
import type { Chip } from '../../types/chip'

export const esp32c6: Chip = {
  id: 'esp32c6',
  name: 'ESP32-C6',
  family: 'ESP32-C6',
  totalGpio: 31,
  hasWifi: true,
  hasBle: true,
  hasBluetooth: false,
  cores: 1,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-c6_datasheet_en.pdf',
  notes: [
    'RISC-V. Supports WiFi 6 (802.11ax), BLE 5, IEEE 802.15.4 (Zigbee/Thread).',
    'No ADC2 — no ADC/WiFi conflict.',
    'GPIO8, 9 are strapping pins.',
    'GPIO12–17 connected to internal SPI flash — do not use.',
    'GPIO24/25 are USB Serial/JTAG D−/D+.',
    'No DAC, no capacitive touch.',
  ],
  pins: [
    ...[0,1,2,3,4,5,6,7].map(n => ({
      gpio: n, names: [`GPIO${n}`, ...(n < 6 ? [`ADC1_CH${n}`] : [])],
      capabilities: (n < 6 ? ['gpio','adc1','pwm'] : ['gpio','pwm']) as const[],
      constraints: [], isUsable: true,
    })),
    { gpio: 8, names: ['GPIO8'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Sampled at boot.' }], isUsable: true },
    { gpio: 9, names: ['GPIO9'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin / boot button', description: 'LOW at boot = download mode (BOOT button on dev boards).' }], isUsable: true },
    ...[10,11].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    ...[12,13,14,15,16,17].map(n => ({
      gpio: n, names: [`GPIO${n}`], capabilities: [] as const[],
      constraints: [{ id: 'flash_reserved' as const, severity: 'danger' as const, title: 'Reserved for flash', description: 'Connected to internal SPI flash. Do not use.' }],
      isUsable: false,
    })),
    ...[18,19,20,21,22,23].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    { gpio: 24, names: ['GPIO24','USB_D-'], capabilities: ['gpio','usb'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'USB Serial/JTAG D−', description: 'Internal USB debug interface.' }], isUsable: true },
    { gpio: 25, names: ['GPIO25','USB_D+'], capabilities: ['gpio','usb'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'USB Serial/JTAG D+', description: 'Internal USB debug interface.' }], isUsable: true },
    ...[26,27,28,29,30].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
  ],
}
```

- [ ] **Step 5: Create `src/data/chips/esp32h2.ts`**

```ts
import type { Chip } from '../../types/chip'

export const esp32h2: Chip = {
  id: 'esp32h2',
  name: 'ESP32-H2',
  family: 'ESP32-H2',
  totalGpio: 28,
  hasWifi: false,
  hasBle: true,
  hasBluetooth: false,
  cores: 1,
  datasheetUrl: 'https://www.espressif.com/sites/default/files/documentation/esp32-h2_datasheet_en.pdf',
  notes: [
    'No WiFi — BLE 5.3 + IEEE 802.15.4 (Zigbee/Thread/Matter) only.',
    'No ADC/WiFi conflict (no WiFi).',
    'GPIO8, 9 are strapping pins.',
    'GPIO15–20 connected to internal SPI flash — do not use.',
    'GPIO26/27 are USB Serial/JTAG.',
    'No DAC, no capacitive touch.',
  ],
  pins: [
    ...[0,1,2,3,4,5].map(n => ({
      gpio: n, names: [`GPIO${n}`, `ADC1_CH${n}`], capabilities: ['gpio','adc1','pwm'] as const[], constraints: [], isUsable: true,
    })),
    ...[6,7].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    { gpio: 8, names: ['GPIO8'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin', description: 'Sampled at boot.' }], isUsable: true },
    { gpio: 9, names: ['GPIO9'], capabilities: ['gpio','pwm'],
      constraints: [{ id: 'strapping_pin', severity: 'warning', title: 'Strapping pin / boot button', description: 'LOW at boot = download mode.' }], isUsable: true },
    ...[10,11,12,13,14].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    ...[15,16,17,18,19,20].map(n => ({
      gpio: n, names: [`GPIO${n}`], capabilities: [] as const[],
      constraints: [{ id: 'flash_reserved' as const, severity: 'danger' as const, title: 'Reserved for flash', description: 'Connected to internal SPI flash. Do not use.' }],
      isUsable: false,
    })),
    ...[21,22,23,24,25].map(n => ({ gpio: n, names: [`GPIO${n}`], capabilities: ['gpio','pwm'] as const[], constraints: [], isUsable: true })),
    { gpio: 26, names: ['GPIO26','USB_D-'], capabilities: ['gpio','usb'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'USB Serial/JTAG D−', description: 'Internal USB debug interface.' }], isUsable: true },
    { gpio: 27, names: ['GPIO27','USB_D+'], capabilities: ['gpio','usb'],
      constraints: [{ id: 'usb_jtag', severity: 'warning', title: 'USB Serial/JTAG D+', description: 'Internal USB debug interface.' }], isUsable: true },
  ],
}
```

- [ ] **Step 6: Create `src/data/chips/index.ts`**

```ts
import { esp32 }   from './esp32'
import { esp32s2 } from './esp32s2'
import { esp32s3 } from './esp32s3'
import { esp32c3 } from './esp32c3'
import { esp32c6 } from './esp32c6'
import { esp32h2 } from './esp32h2'
import type { Chip } from '../../types/chip'

export const CHIPS: Chip[] = [esp32, esp32s2, esp32s3, esp32c3, esp32c6, esp32h2]

export function getChip(id: string): Chip | undefined {
  return CHIPS.find(c => c.id === id)
}
```

- [ ] **Step 7: Write chip data schema tests in `tests/chip-data.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { CHIPS } from '../src/data/chips/index'

describe('chip data schema validation', () => {
  CHIPS.forEach(chip => {
    describe(`${chip.name}`, () => {
      it('has required top-level fields', () => {
        expect(chip.id).toBeTruthy()
        expect(chip.name).toBeTruthy()
        expect(chip.pins.length).toBeGreaterThan(0)
        expect(chip.datasheetUrl).toMatch(/^https:\/\//)
      })

      it('has no duplicate GPIOs', () => {
        const gpios = chip.pins.map(p => p.gpio)
        const unique = new Set(gpios)
        expect(unique.size).toBe(gpios.length)
      })

      it('every unusable pin has a danger constraint', () => {
        chip.pins.filter(p => !p.isUsable).forEach(pin => {
          const hasDanger = pin.constraints.some(c => c.severity === 'danger')
          expect(hasDanger, `GPIO${pin.gpio} isUsable=false but no danger constraint`).toBe(true)
        })
      })

      it('every constraint has all required fields', () => {
        chip.pins.forEach(pin => {
          pin.constraints.forEach(c => {
            expect(c.id).toBeTruthy()
            expect(c.severity).toMatch(/^(danger|warning|info)$/)
            expect(c.title).toBeTruthy()
            expect(c.description.length).toBeGreaterThan(20)
          })
        })
      })
    })
  })
})
```

- [ ] **Step 8: Run tests**

```bash
npm test -- --run
```
Expected: all chip data tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/data/ tests/chip-data.test.ts
git commit -m "feat: add chip data for S2, S3, C3, C6, H2 with schema tests"
```

---

## Task 5: App Context + URL State

**Files:**
- Create: `src/context/AppContext.tsx`
- Create: `tests/url-state.test.ts`

- [ ] **Step 1: Create `src/context/AppContext.tsx`**

```tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { CHIPS } from '../data/chips/index'
import type { Chip, Pin, PinAssignment, FilterKey } from '../types/chip'

interface AppState {
  chip: Chip
  setChip: (id: string) => void
  selectedPin: Pin | null
  setSelectedPin: (pin: Pin | null) => void
  filter: FilterKey
  setFilter: (f: FilterKey) => void
  mapping: PinAssignment[]
  assignPin: (gpio: number, role: PinAssignment['role'], label: string) => void
  unassignPin: (gpio: number) => void
  clearMapping: () => void
  shareUrl: string
}

const AppContext = createContext<AppState | null>(null)

function encodeState(chipId: string, mapping: PinAssignment[]): string {
  const data = { c: chipId, m: mapping.map(a => ({ g: a.gpio, r: a.role, l: a.label })) }
  return btoa(JSON.stringify(data))
}

function decodeState(hash: string): { chipId: string; mapping: PinAssignment[] } | null {
  try {
    const data = JSON.parse(atob(hash))
    return {
      chipId: data.c,
      mapping: (data.m || []).map((a: { g: number; r: string; l: string }) => ({
        gpio: a.g, role: a.r as PinAssignment['role'], label: a.l,
      })),
    }
  } catch { return null }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [chip, setChipState] = useState<Chip>(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const decoded = decodeState(hash)
      if (decoded) {
        const found = CHIPS.find(c => c.id === decoded.chipId)
        if (found) return found
      }
    }
    return CHIPS[0]
  })

  const [selectedPin, setSelectedPin] = useState<Pin | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [mapping, setMapping] = useState<PinAssignment[]>(() => {
    const hash = window.location.hash.slice(1)
    if (hash) {
      const decoded = decodeState(hash)
      if (decoded) return decoded.mapping
    }
    return []
  })

  const shareUrl = `${window.location.origin}${window.location.pathname}#${encodeState(chip.id, mapping)}`

  // Sync URL hash whenever chip or mapping changes
  useEffect(() => {
    window.location.hash = encodeState(chip.id, mapping)
  }, [chip.id, mapping])

  const setChip = useCallback((id: string) => {
    const found = CHIPS.find(c => c.id === id)
    if (found) { setChipState(found); setSelectedPin(null); setMapping([]) }
  }, [])

  const assignPin = useCallback((gpio: number, role: PinAssignment['role'], label: string) => {
    setMapping(prev => {
      const without = prev.filter(a => a.gpio !== gpio)
      return [...without, { gpio, role, label }]
    })
  }, [])

  const unassignPin = useCallback((gpio: number) => {
    setMapping(prev => prev.filter(a => a.gpio !== gpio))
  }, [])

  const clearMapping = useCallback(() => setMapping([]), [])

  return (
    <AppContext.Provider value={{
      chip, setChip,
      selectedPin, setSelectedPin,
      filter, setFilter,
      mapping, assignPin, unassignPin, clearMapping,
      shareUrl,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

// Exported for tests
export { encodeState, decodeState }
```

- [ ] **Step 2: Write URL state tests in `tests/url-state.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { encodeState, decodeState } from '../src/context/AppContext'
import type { PinAssignment } from '../src/types/chip'

describe('URL state encoding', () => {
  const mapping: PinAssignment[] = [
    { gpio: 21, role: 'I2C_SDA', label: 'Display SDA' },
    { gpio: 22, role: 'I2C_SCL', label: 'Display SCL' },
  ]

  it('round-trips chip id and mapping', () => {
    const encoded = encodeState('esp32', mapping)
    const decoded = decodeState(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.chipId).toBe('esp32')
    expect(decoded!.mapping).toHaveLength(2)
    expect(decoded!.mapping[0].gpio).toBe(21)
    expect(decoded!.mapping[0].role).toBe('I2C_SDA')
    expect(decoded!.mapping[0].label).toBe('Display SDA')
  })

  it('returns null for corrupted input', () => {
    expect(decodeState('not-valid-base64!!!')).toBeNull()
    expect(decodeState('')).toBeNull()
  })

  it('handles empty mapping', () => {
    const encoded = encodeState('esp32s3', [])
    const decoded = decodeState(encoded)
    expect(decoded!.chipId).toBe('esp32s3')
    expect(decoded!.mapping).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run
```
Expected: all URL state tests PASS.

- [ ] **Step 4: Wire AppProvider into `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProvider } from './context/AppContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
```

- [ ] **Step 5: Commit**

```bash
git add src/context/ src/main.tsx tests/url-state.test.ts
git commit -m "feat: add app context with chip/mapping state and URL hash sync"
```

---

## Task 6: Chip Selector Component

**Files:**
- Create: `src/components/ChipSelector.tsx`

- [ ] **Step 1: Create `src/components/ChipSelector.tsx`**

```tsx
import { CHIPS } from '../data/chips/index'
import { useApp } from '../context/AppContext'

const FAMILY_COLORS: Record<string, string> = {
  'ESP32':    'border-blue-500 text-blue-400',
  'ESP32-S2': 'border-purple-500 text-purple-400',
  'ESP32-S3': 'border-green-500 text-green-400',
  'ESP32-C3': 'border-yellow-500 text-yellow-400',
  'ESP32-C6': 'border-orange-500 text-orange-400',
  'ESP32-H2': 'border-pink-500 text-pink-400',
}

export function ChipSelector() {
  const { chip, setChip } = useApp()

  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map(c => {
        const colors = FAMILY_COLORS[c.family] ?? 'border-gray-500 text-gray-400'
        const isActive = chip.id === c.id
        return (
          <button
            key={c.id}
            onClick={() => setChip(c.id)}
            className={`
              px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
              ${colors}
              ${isActive
                ? 'bg-opacity-20 bg-white shadow-lg scale-105'
                : 'bg-gray-900 opacity-70 hover:opacity-100'}
            `}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Add ChipSelector to App.tsx and verify it renders**

```tsx
import { ChipSelector } from './components/ChipSelector'
import { useApp } from './context/AppContext'

export default function App() {
  const { chip } = useApp()
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold text-green-400 mb-3">ESP32 Pinout Studio</h1>
        <ChipSelector />
      </header>
      <main className="p-6">
        <p className="text-gray-400">Selected: {chip.name} — {chip.totalGpio} GPIOs</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Open browser and verify chip buttons appear and switch selection**

```bash
npm run dev
```
Open `http://localhost:5173`. You should see six chip buttons. Clicking one should update the "Selected:" text.

- [ ] **Step 4: Commit**

```bash
git add src/components/ChipSelector.tsx src/App.tsx
git commit -m "feat: add ChipSelector component"
```

---

## Task 7: Constraint Badge + Filter Bar

**Files:**
- Create: `src/components/ConstraintBadge.tsx`
- Create: `src/components/FilterBar.tsx`

- [ ] **Step 1: Create `src/components/ConstraintBadge.tsx`**

```tsx
import type { Constraint } from '../types/chip'

const SEVERITY_STYLES = {
  danger:  'bg-red-900/40 border border-red-500 text-red-300',
  warning: 'bg-yellow-900/40 border border-yellow-500 text-yellow-300',
  info:    'bg-blue-900/40 border border-blue-400 text-blue-300',
}

const SEVERITY_ICON = { danger: '⛔', warning: '⚠️', info: 'ℹ️' }

interface Props {
  constraint: Constraint
  compact?: boolean
}

export function ConstraintBadge({ constraint, compact = false }: Props) {
  const style = SEVERITY_STYLES[constraint.severity]
  const icon  = SEVERITY_ICON[constraint.severity]

  if (compact) {
    return (
      <span title={constraint.description} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${style}`}>
        {icon} {constraint.title}
      </span>
    )
  }

  return (
    <div className={`rounded-lg p-3 ${style}`}>
      <div className="font-semibold text-sm mb-1">{icon} {constraint.title}</div>
      <div className="text-xs leading-relaxed opacity-90">{constraint.description}</div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/FilterBar.tsx`**

```tsx
import { useApp } from '../context/AppContext'
import type { FilterKey } from '../types/chip'

const FILTERS: { key: FilterKey; label: string; title: string }[] = [
  { key: 'all',          label: 'All pins',         title: 'Show all pins' },
  { key: 'safe_output',  label: '✅ Safe output',    title: 'Input-only and flash-reserved pins hidden' },
  { key: 'adc_wifi_safe',label: '📶 ADC + WiFi',     title: 'ADC1 pins only — safe while WiFi is active' },
  { key: 'pwm',          label: '〰️ PWM',             title: 'Pins capable of PWM output' },
  { key: 'touch',        label: '👆 Touch',           title: 'Capacitive touch pins' },
  { key: 'free',         label: '🟢 No constraints',  title: 'Pins with zero restrictions' },
  { key: 'strapping',    label: '🔧 Strapping',       title: 'Boot-strapping pins — handle with care' },
]

export function FilterBar() {
  const { filter, setFilter } = useApp()

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map(f => (
        <button
          key={f.key}
          title={f.title}
          onClick={() => setFilter(f.key)}
          className={`
            px-3 py-1 rounded-full text-xs font-medium transition-all
            ${filter === f.key
              ? 'bg-green-600 text-white shadow'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}
          `}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ConstraintBadge.tsx src/components/FilterBar.tsx
git commit -m "feat: add ConstraintBadge and FilterBar components"
```

---

## Task 8: Pin Table

**Files:**
- Create: `src/components/PinTable.tsx`
- Create: `src/utils/filterPins.ts`

- [ ] **Step 1: Create `src/utils/filterPins.ts`**

```ts
import type { Pin, FilterKey } from '../types/chip'

export function filterPins(pins: Pin[], filter: FilterKey): Pin[] {
  switch (filter) {
    case 'all':          return pins
    case 'safe_output':  return pins.filter(p => p.isUsable && !p.constraints.some(c => c.id === 'input_only'))
    case 'adc_wifi_safe':return pins.filter(p => p.capabilities.includes('adc1'))
    case 'pwm':          return pins.filter(p => p.capabilities.includes('pwm'))
    case 'touch':        return pins.filter(p => p.capabilities.includes('touch'))
    case 'free':         return pins.filter(p => p.constraints.length === 0)
    case 'strapping':    return pins.filter(p => p.constraints.some(c => c.id === 'strapping_pin'))
    default:             return pins
  }
}
```

- [ ] **Step 2: Write filter logic tests**

Add to `tests/chip-data.test.ts`:

```ts
import { filterPins } from '../src/utils/filterPins'
import { esp32 } from '../src/data/chips/esp32'

describe('filterPins', () => {
  it('safe_output excludes input_only and flash_reserved pins', () => {
    const result = filterPins(esp32.pins, 'safe_output')
    result.forEach(p => {
      expect(p.constraints.some(c => c.id === 'input_only')).toBe(false)
      expect(p.isUsable).toBe(true)
    })
  })

  it('adc_wifi_safe returns only adc1 pins', () => {
    const result = filterPins(esp32.pins, 'adc_wifi_safe')
    result.forEach(p => expect(p.capabilities).toContain('adc1'))
  })

  it('free returns pins with zero constraints', () => {
    const result = filterPins(esp32.pins, 'free')
    result.forEach(p => expect(p.constraints).toHaveLength(0))
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run
```
Expected: all PASS.

- [ ] **Step 4: Create `src/components/PinTable.tsx`**

```tsx
import { useApp } from '../context/AppContext'
import { filterPins } from '../utils/filterPins'
import { ConstraintBadge } from './ConstraintBadge'

const CAP_LABELS: Record<string, string> = {
  adc1: 'ADC1', adc2: 'ADC2', dac: 'DAC', touch: 'TOUCH',
  pwm: 'PWM', i2c: 'I2C', spi: 'SPI', uart: 'UART',
  i2s: 'I2S', rtc: 'RTC', usb: 'USB', jtag: 'JTAG', gpio: 'GPIO',
}

export function PinTable() {
  const { chip, selectedPin, setSelectedPin, filter, mapping } = useApp()
  const pins = filterPins(chip.pins, filter)

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 bg-gray-900/60 text-xs uppercase tracking-wider">
            <th className="px-4 py-3">GPIO</th>
            <th className="px-4 py-3">Names</th>
            <th className="px-4 py-3">Capabilities</th>
            <th className="px-4 py-3">Constraints</th>
            <th className="px-4 py-3">Mapped As</th>
          </tr>
        </thead>
        <tbody>
          {pins.map(pin => {
            const isSelected = selectedPin?.gpio === pin.gpio
            const assignment = mapping.find(a => a.gpio === pin.gpio)
            const hasDanger  = pin.constraints.some(c => c.severity === 'danger')
            const hasWarning = pin.constraints.some(c => c.severity === 'warning')
            const rowBg = hasDanger
              ? 'bg-red-950/30'
              : hasWarning
              ? 'bg-yellow-950/20'
              : ''

            return (
              <tr
                key={pin.gpio}
                onClick={() => setSelectedPin(isSelected ? null : pin)}
                className={`
                  border-t border-gray-800/60 cursor-pointer transition-colors
                  ${rowBg}
                  ${isSelected ? 'ring-1 ring-inset ring-green-500 bg-green-950/20' : 'hover:bg-gray-800/40'}
                `}
              >
                <td className="px-4 py-2.5 font-mono font-bold text-green-400">
                  {pin.gpio}
                </td>
                <td className="px-4 py-2.5 font-mono text-gray-300 text-xs">
                  {pin.names.join(' / ')}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {pin.capabilities.filter(c => c !== 'gpio').map(cap => (
                      <span key={cap} className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs">
                        {CAP_LABELS[cap] ?? cap}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {pin.constraints.map(c => (
                      <ConstraintBadge key={c.id} constraint={c} compact />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400">
                  {assignment && (
                    <span className="px-2 py-0.5 rounded bg-blue-900/40 border border-blue-500 text-blue-300">
                      {assignment.role}: {assignment.label}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {pins.length === 0 && (
        <div className="py-12 text-center text-gray-500">No pins match this filter.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/PinTable.tsx src/utils/filterPins.ts
git commit -m "feat: add filterable PinTable with constraint highlighting"
```

---

## Task 9: Pin Detail Panel

**Files:**
- Create: `src/components/PinDetailPanel.tsx`

- [ ] **Step 1: Create `src/components/PinDetailPanel.tsx`**

```tsx
import { useApp } from '../context/AppContext'
import { ConstraintBadge } from './ConstraintBadge'

const CAP_DETAILS: Record<string, { label: string; desc: string }> = {
  adc1:  { label: 'ADC1',  desc: 'Analog-to-digital converter, channel 1. Safe to use while WiFi is active.' },
  adc2:  { label: 'ADC2',  desc: 'Analog-to-digital converter, channel 2. Shared with WiFi driver — readings fail while WiFi is on.' },
  dac:   { label: 'DAC',   desc: 'Digital-to-analog converter. True analog output (not PWM).' },
  touch: { label: 'Touch', desc: 'Capacitive touch sensor input.' },
  pwm:   { label: 'PWM',   desc: 'Pulse-width modulation via LEDC or MCPWM. Can drive LEDs, servos, buzzers.' },
  i2c:   { label: 'I2C',   desc: 'I2C bus. Any GPIO can be I2C via Wire.begin(sda, scl).' },
  spi:   { label: 'SPI',   desc: 'SPI bus. Can be remapped to any GPIO.' },
  uart:  { label: 'UART',  desc: 'Serial/UART. Multiple UARTs available, pins can be remapped.' },
  i2s:   { label: 'I2S',   desc: 'I2S audio bus.' },
  rtc:   { label: 'RTC',   desc: 'RTC GPIO — usable during deep sleep for wakeup.' },
  usb:   { label: 'USB',   desc: 'Native USB data line. Tied to internal USB controller.' },
  jtag:  { label: 'JTAG',  desc: 'JTAG debug interface.' },
}

export function PinDetailPanel() {
  const { selectedPin, setSelectedPin, chip } = useApp()

  if (!selectedPin) return null

  const capEntries = selectedPin.capabilities
    .filter(c => c !== 'gpio')
    .map(c => ({ cap: c, detail: CAP_DETAILS[c] ?? { label: c.toUpperCase(), desc: '' } }))

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col z-50 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <span className="text-2xl font-bold font-mono text-green-400">GPIO{selectedPin.gpio}</span>
          <p className="text-xs text-gray-400 mt-0.5">{chip.name}</p>
        </div>
        <button onClick={() => setSelectedPin(null)} className="text-gray-500 hover:text-gray-200 text-xl">✕</button>
      </div>

      <div className="p-4 flex-1 space-y-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Pin Names</h3>
          <div className="flex flex-wrap gap-1">
            {selectedPin.names.map(n => (
              <span key={n} className="px-2 py-0.5 rounded bg-gray-800 font-mono text-xs text-gray-300">{n}</span>
            ))}
          </div>
        </div>

        {selectedPin.constraints.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              ⚠️ Constraints & Gotchas
            </h3>
            <div className="space-y-2">
              {selectedPin.constraints.map(c => (
                <ConstraintBadge key={c.id} constraint={c} />
              ))}
            </div>
          </div>
        )}

        {capEntries.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Capabilities</h3>
            <div className="space-y-2">
              {capEntries.map(({ cap, detail }) => (
                <div key={cap} className="rounded-lg bg-gray-800/60 px-3 py-2">
                  <div className="text-sm font-semibold text-gray-200">{detail.label}</div>
                  {detail.desc && <div className="text-xs text-gray-400 mt-0.5">{detail.desc}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedPin.notes && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Notes</h3>
            <p className="text-xs text-gray-300 leading-relaxed">{selectedPin.notes}</p>
          </div>
        )}

        {!selectedPin.isUsable && (
          <div className="rounded-lg bg-red-900/30 border border-red-600 p-3 text-center">
            <span className="text-red-300 font-semibold text-sm">⛔ Do not use this pin</span>
            <p className="text-xs text-red-400 mt-1">This GPIO is reserved by the chip and cannot be used for user code.</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PinDetailPanel.tsx
git commit -m "feat: add PinDetailPanel with constraints and capability details"
```

---

## Task 10: Pinout Diagram

**Files:**
- Create: `src/components/PinoutDiagram.tsx`

- [ ] **Step 1: Create `src/components/PinoutDiagram.tsx`**

This renders a data-driven two-column board header layout (left bank / right bank of pins), mimicking how physical dev boards look:

```tsx
import { useApp } from '../context/AppContext'
import { filterPins } from '../utils/filterPins'
import type { Pin } from '../types/chip'

function pinColor(pin: Pin): string {
  if (!pin.isUsable) return '#7f1d1d'
  if (pin.constraints.some(c => c.severity === 'danger'))   return '#991b1b'
  if (pin.constraints.some(c => c.severity === 'warning'))  return '#78350f'
  if (pin.capabilities.includes('adc1'))  return '#14532d'
  if (pin.capabilities.includes('touch')) return '#1e3a5f'
  return '#1f2937'
}

function pinBorder(pin: Pin, isSelected: boolean, isFiltered: boolean): string {
  if (isSelected)  return '#4ade80'
  if (!isFiltered) return '#374151'
  if (pin.constraints.some(c => c.severity === 'danger'))  return '#ef4444'
  if (pin.constraints.some(c => c.severity === 'warning')) return '#f59e0b'
  return '#6b7280'
}

interface PinBoxProps {
  pin: Pin
  side: 'left' | 'right'
  isSelected: boolean
  isFiltered: boolean
  onClick: () => void
  label?: string
}

function PinBox({ pin, side, isSelected, isFiltered, onClick, label }: PinBoxProps) {
  const bg = pinColor(pin)
  const border = pinBorder(pin, isSelected, isFiltered)
  const opacity = isFiltered ? 1 : 0.3

  return (
    <div
      onClick={onClick}
      style={{ opacity, borderColor: border, backgroundColor: bg }}
      className="flex items-center gap-1.5 cursor-pointer border rounded px-2 py-1 transition-all hover:opacity-100 select-none"
      title={pin.names.join(' / ')}
    >
      {side === 'right' && (
        <span className="text-xs font-mono text-gray-400 w-16 text-right truncate">
          {pin.names[1] ?? pin.names[0]}
        </span>
      )}
      <span
        className="text-xs font-bold font-mono px-1.5 py-0.5 rounded"
        style={{ color: border, backgroundColor: '#00000040' }}
      >
        {pin.gpio}
      </span>
      {side === 'left' && (
        <span className="text-xs font-mono text-gray-400 w-16 truncate">
          {pin.names[1] ?? pin.names[0]}
        </span>
      )}
      {label && (
        <span className="text-xs text-blue-300 ml-1 truncate max-w-16">{label}</span>
      )}
    </div>
  )
}

export function PinoutDiagram() {
  const { chip, selectedPin, setSelectedPin, filter, mapping } = useApp()
  const filtered = new Set(filterPins(chip.pins, filter).map(p => p.gpio))

  // Split pins into left/right banks (first half / second half by GPIO number)
  const sorted = [...chip.pins].sort((a, b) => a.gpio - b.gpio)
  const mid = Math.ceil(sorted.length / 2)
  const left  = sorted.slice(0, mid)
  const right = sorted.slice(mid)
  const rows  = Math.max(left.length, right.length)

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/40 p-4">
      <div className="flex justify-center">
        <div className="relative">
          {/* Board outline */}
          <div className="absolute inset-0 rounded-2xl border-2 border-gray-600 pointer-events-none" />

          <div className="grid grid-cols-[1fr_3rem_1fr] gap-x-2 gap-y-0.5 px-2 py-4">
            {Array.from({ length: rows }, (_, i) => {
              const lPin = left[i]
              const rPin = right[i]

              return (
                <>
                  {lPin ? (
                    <PinBox
                      key={`l-${lPin.gpio}`}
                      pin={lPin}
                      side="left"
                      isSelected={selectedPin?.gpio === lPin.gpio}
                      isFiltered={filtered.has(lPin.gpio)}
                      onClick={() => setSelectedPin(selectedPin?.gpio === lPin.gpio ? null : lPin)}
                      label={mapping.find(a => a.gpio === lPin.gpio)?.label}
                    />
                  ) : <div />}

                  {/* Center chip body */}
                  {i === 0 && (
                    <div
                      className="row-span-full flex items-center justify-center bg-gray-800 rounded-lg border border-gray-600"
                      style={{ gridRowEnd: `span ${rows}` }}
                    >
                      <span className="text-gray-500 text-xs font-mono rotate-90 whitespace-nowrap">
                        {chip.family}
                      </span>
                    </div>
                  )}

                  {rPin ? (
                    <PinBox
                      key={`r-${rPin.gpio}`}
                      pin={rPin}
                      side="right"
                      isSelected={selectedPin?.gpio === rPin.gpio}
                      isFiltered={filtered.has(rPin.gpio)}
                      onClick={() => setSelectedPin(selectedPin?.gpio === rPin.gpio ? null : rPin)}
                      label={mapping.find(a => a.gpio === rPin.gpio)?.label}
                    />
                  ) : <div />}
                </>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-900 border border-green-500" /> ADC1</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900 border border-blue-500" /> Touch</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-yellow-500" /> Warning</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-red-500" /> Danger</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-green-400" /> Selected</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/PinoutDiagram.tsx
git commit -m "feat: add data-driven PinoutDiagram component"
```

---

## Task 11: Mapping Builder

**Files:**
- Create: `src/components/MappingBuilder.tsx`
- Create: `tests/constraint-logic.test.ts`

- [ ] **Step 1: Create `src/utils/detectConflicts.ts`**

```ts
import type { Pin, PinAssignment, Chip } from '../types/chip'

export interface Conflict {
  gpio: number
  message: string
  severity: 'danger' | 'warning'
}

export function detectConflicts(chip: Chip, mapping: PinAssignment[]): Conflict[] {
  const conflicts: Conflict[] = []
  const chipHasWifi = chip.hasWifi

  mapping.forEach(assignment => {
    const pin = chip.pins.find(p => p.gpio === assignment.gpio)
    if (!pin) return

    // Unusable pin used
    if (!pin.isUsable) {
      conflicts.push({ gpio: pin.gpio, severity: 'danger', message: `GPIO${pin.gpio} is reserved (flash/system) — remove it.` })
    }

    // Input-only assigned as output role
    const outputRoles: PinAssignment['role'][] = ['LED','PWM','DAC','UART_TX','SPI_MOSI','SPI_SCK','SPI_CS']
    if (pin.constraints.some(c => c.id === 'input_only') && outputRoles.includes(assignment.role)) {
      conflicts.push({ gpio: pin.gpio, severity: 'danger', message: `GPIO${pin.gpio} is input-only but assigned as ${assignment.role}.` })
    }

    // ADC2 while WiFi in use
    if (chipHasWifi && pin.capabilities.includes('adc2') && assignment.role === 'ADC') {
      conflicts.push({ gpio: pin.gpio, severity: 'warning', message: `GPIO${pin.gpio} uses ADC2 — readings will fail while WiFi is active. Use an ADC1 pin instead.` })
    }

    // Strapping pin used as input button (pulled to GND)
    if (pin.constraints.some(c => c.id === 'strapping_pin') && assignment.role === 'Button') {
      conflicts.push({ gpio: pin.gpio, severity: 'warning', message: `GPIO${pin.gpio} is a strapping pin. Pulling it LOW (button) can cause unexpected boot modes.` })
    }
  })

  // Duplicate role conflicts (same I2C bus only one SDA/SCL needed)
  const sdaPins = mapping.filter(a => a.role === 'I2C_SDA')
  if (sdaPins.length > 1) {
    conflicts.push({ gpio: sdaPins[1].gpio, severity: 'warning', message: 'Multiple I2C_SDA pins assigned — only one SDA is needed per bus.' })
  }

  return conflicts
}
```

- [ ] **Step 2: Write conflict detection tests in `tests/constraint-logic.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { detectConflicts } from '../src/utils/detectConflicts'
import { esp32 } from '../src/data/chips/esp32'

describe('detectConflicts', () => {
  it('flags flash-reserved GPIO as danger', () => {
    const conflicts = detectConflicts(esp32, [{ gpio: 6, role: 'LED', label: 'test' }])
    expect(conflicts.some(c => c.gpio === 6 && c.severity === 'danger')).toBe(true)
  })

  it('flags input-only pin used as LED output', () => {
    const conflicts = detectConflicts(esp32, [{ gpio: 34, role: 'LED', label: 'test' }])
    expect(conflicts.some(c => c.gpio === 34 && c.severity === 'danger')).toBe(true)
  })

  it('flags ADC2 pin used as ADC while chip has WiFi', () => {
    const conflicts = detectConflicts(esp32, [{ gpio: 4, role: 'ADC', label: 'soil sensor' }])
    expect(conflicts.some(c => c.gpio === 4 && c.severity === 'warning')).toBe(true)
  })

  it('flags strapping pin used as button', () => {
    const conflicts = detectConflicts(esp32, [{ gpio: 0, role: 'Button', label: 'reset btn' }])
    expect(conflicts.some(c => c.gpio === 0 && c.severity === 'warning')).toBe(true)
  })

  it('returns empty for a safe assignment', () => {
    const conflicts = detectConflicts(esp32, [{ gpio: 21, role: 'I2C_SDA', label: 'SDA' }])
    expect(conflicts).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --run
```
Expected: all PASS.

- [ ] **Step 4: Create `src/components/MappingBuilder.tsx`**

```tsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { detectConflicts } from '../utils/detectConflicts'
import type { PinAssignment } from '../types/chip'

const ROLES: PinAssignment['role'][] = [
  'LED','Button','I2C_SDA','I2C_SCL',
  'SPI_MOSI','SPI_MISO','SPI_SCK','SPI_CS',
  'UART_TX','UART_RX','PWM','ADC','DAC','Touch','Custom',
]

export function MappingBuilder() {
  const { chip, mapping, assignPin, unassignPin, clearMapping, selectedPin } = useApp()
  const [gpio, setGpio] = useState<number>(selectedPin?.gpio ?? 0)
  const [role, setRole] = useState<PinAssignment['role']>('LED')
  const [label, setLabel] = useState('')

  const conflicts = detectConflicts(chip, mapping)
  const usablePins = chip.pins.filter(p => p.isUsable).sort((a, b) => a.gpio - b.gpio)

  const handleAdd = () => {
    if (!label.trim()) return
    assignPin(gpio, role, label.trim())
    setLabel('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">Pin Mapping</h2>
        {mapping.length > 0 && (
          <button onClick={clearMapping} className="text-xs text-red-400 hover:text-red-300">Clear all</button>
        )}
      </div>

      {/* Add assignment form */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">GPIO</label>
          <select
            value={gpio}
            onChange={e => setGpio(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-green-500"
          >
            {usablePins.map(p => (
              <option key={p.gpio} value={p.gpio}>GPIO{p.gpio}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value as PinAssignment['role'])}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-green-500"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-32">
          <label className="text-xs text-gray-500 block mb-1">Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. Status LED"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-500"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!label.trim()}
          className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded text-sm font-medium text-white transition-colors"
        >
          Add
        </button>
      </div>

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="space-y-1">
          {conflicts.map((c, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-2 rounded border ${
                c.severity === 'danger'
                  ? 'bg-red-950/40 border-red-600 text-red-300'
                  : 'bg-yellow-950/40 border-yellow-600 text-yellow-300'
              }`}
            >
              {c.severity === 'danger' ? '⛔' : '⚠️'} {c.message}
            </div>
          ))}
        </div>
      )}

      {/* Current mapping */}
      {mapping.length > 0 && (
        <div className="space-y-1">
          {mapping.map(a => {
            const pin = chip.pins.find(p => p.gpio === a.gpio)
            const hasConflict = conflicts.some(c => c.gpio === a.gpio)
            return (
              <div
                key={a.gpio}
                className={`flex items-center justify-between px-3 py-2 rounded border text-xs ${
                  hasConflict ? 'border-yellow-700 bg-yellow-950/20' : 'border-gray-700 bg-gray-800/40'
                }`}
              >
                <span className="font-mono text-green-400 w-16">GPIO{a.gpio}</span>
                <span className="text-blue-300 w-24">{a.role}</span>
                <span className="text-gray-300 flex-1">{a.label}</span>
                {pin?.names[1] && <span className="text-gray-500 mr-2 font-mono">{pin.names[1]}</span>}
                <button onClick={() => unassignPin(a.gpio)} className="text-red-500 hover:text-red-300 ml-2">✕</button>
              </div>
            )
          })}
        </div>
      )}

      {mapping.length === 0 && (
        <p className="text-xs text-gray-600">No pins mapped yet. Add one above or click a pin in the table.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MappingBuilder.tsx src/utils/detectConflicts.ts tests/constraint-logic.test.ts
git commit -m "feat: add MappingBuilder with live conflict detection"
```

---

## Task 12: Export Panel

**Files:**
- Create: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Create `src/components/ExportPanel.tsx`**

```tsx
import { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { useApp } from '../context/AppContext'
import type { PinAssignment } from '../types/chip'

function generateArduinoDefines(chip: { name: string }, mapping: PinAssignment[]): string {
  if (mapping.length === 0) return '// No pins mapped yet'
  const lines = [
    `// Pin mapping for ${chip.name}`,
    `// Generated by ESP32 Pinout Studio — https://esp32pinout.studio`,
    '',
    ...mapping.map(a => `#define PIN_${a.label.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')} ${a.gpio}  // ${a.role}`),
  ]
  return lines.join('\n')
}

export function ExportPanel() {
  const { chip, mapping, shareUrl } = useApp()
  const [copied, setCopied] = useState<'url' | 'code' | null>(null)
  const diagramRef = useRef<HTMLDivElement>(null)

  const code = generateArduinoDefines(chip, mapping)

  const copyText = async (text: string, type: 'url' | 'code') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadPng = async () => {
    const target = document.getElementById('pinout-diagram-export')
    if (!target) return
    const canvas = await html2canvas(target, { backgroundColor: '#030712', scale: 2 })
    const a = document.createElement('a')
    a.download = `${chip.id}-pinout-mapping.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-300">Export</h2>

      {/* Shareable URL */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Shareable URL</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 font-mono overflow-hidden"
          />
          <button
            onClick={() => copyText(shareUrl, 'url')}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 whitespace-nowrap transition-colors"
          >
            {copied === 'url' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Arduino #defines */}
      <div>
        <label className="text-xs text-gray-500 block mb-1">Arduino / PlatformIO</label>
        <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre max-h-48">
          {code}
        </pre>
        <button
          onClick={() => copyText(code, 'code')}
          className="mt-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition-colors"
        >
          {copied === 'code' ? '✓ Copied' : 'Copy code'}
        </button>
      </div>

      {/* PNG Download */}
      <div>
        <button
          onClick={downloadPng}
          className="w-full px-3 py-2 bg-blue-800 hover:bg-blue-700 rounded text-sm text-white font-medium transition-colors"
        >
          ⬇ Download Pinout PNG
        </button>
        <p className="text-xs text-gray-600 mt-1">Captures the diagram including your mapping labels.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportPanel.tsx
git commit -m "feat: add ExportPanel with Arduino defines, shareable URL, PNG download"
```

---

## Task 13: Community Submit Panel

**Files:**
- Create: `src/components/CommunitySubmit.tsx`

- [ ] **Step 1: Create `src/components/CommunitySubmit.tsx`**

```tsx
import { useState } from 'react'
import { useApp } from '../context/AppContext'

const SUBMIT_ISSUE_URL = 'https://github.com/your-username/esp32-pinout-studio/issues/new?template=chip_data.md&title=New+chip+data'

export function CommunitySubmit() {
  const { chip } = useApp()
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(chip, null, 2)

  const copyJson = async () => {
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-300">Contribute / Report an Error</h2>
      <p className="text-xs text-gray-400 leading-relaxed">
        Found a mistake? Know a chip we're missing? The data is open source. Copy the JSON below, edit it with the correct pin data, and submit a GitHub issue.
      </p>
      <div className="flex gap-2">
        <button
          onClick={copyJson}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-200 transition-colors"
        >
          {copied ? '✓ Copied JSON' : 'Copy current chip JSON'}
        </button>
        <a
          href={SUBMIT_ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-green-800 hover:bg-green-700 rounded text-xs text-white transition-colors"
        >
          Submit on GitHub →
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CommunitySubmit.tsx
git commit -m "feat: add CommunitySubmit panel for chip data contributions"
```

---

## Task 14: Wire Up Full App Layout

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace `src/App.tsx` with full layout**

```tsx
import { ChipSelector }    from './components/ChipSelector'
import { FilterBar }       from './components/FilterBar'
import { PinoutDiagram }   from './components/PinoutDiagram'
import { PinTable }        from './components/PinTable'
import { PinDetailPanel }  from './components/PinDetailPanel'
import { MappingBuilder }  from './components/MappingBuilder'
import { ExportPanel }     from './components/ExportPanel'
import { CommunitySubmit } from './components/CommunitySubmit'
import { useApp }          from './context/AppContext'

export default function App() {
  const { chip } = useApp()

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 sticky top-0 bg-gray-950/95 backdrop-blur z-40">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-bold text-green-400">ESP32 Pinout Studio</h1>
              <p className="text-xs text-gray-500">Free interactive pinout reference for the maker community</p>
            </div>
            <a
              href="https://github.com/your-username/esp32-pinout-studio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              GitHub ↗
            </a>
          </div>
          <ChipSelector />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* Left: diagram + filter + table */}
          <div className="space-y-4">
            {/* Chip notes banner */}
            {chip.notes.length > 0 && (
              <div className="rounded-xl bg-yellow-950/30 border border-yellow-700/50 px-4 py-3">
                <p className="text-xs font-semibold text-yellow-400 mb-1">⚠️ {chip.name} — Known Gotchas</p>
                <ul className="text-xs text-yellow-300/80 space-y-0.5 list-disc list-inside">
                  {chip.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div id="pinout-diagram-export">
              <PinoutDiagram />
            </div>

            <FilterBar />

            <PinTable />
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <MappingBuilder />
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <ExportPanel />
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
              <CommunitySubmit />
            </div>
          </div>
        </div>
      </div>

      {/* Pin detail slide-in panel */}
      <PinDetailPanel />
    </div>
  )
}
```

- [ ] **Step 2: Run full dev build and manually verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- Six chip buttons switch the chip (gotcha banner updates)
- Clicking a table row opens the PinDetailPanel on the right
- Filters reduce the table correctly (e.g. "ADC + WiFi" shows only ADC1 pins)
- Adding a mapping shows it in the table and diagram, generates `#define`s
- Adding GPIO4 as ADC shows a conflict warning (ADC2 + WiFi)
- Adding GPIO6 as anything shows a danger conflict (flash-reserved)
- "Copy" buttons work, PNG download produces an image

- [ ] **Step 3: Run all tests**

```bash
npm test -- --run
```
Expected: all PASS.

- [ ] **Step 4: Build for production and confirm no TS errors**

```bash
npm run build
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire up full app layout with all components"
```

---

## Task 15: Deploy to Vercel

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

- [ ] **Step 2: Init git and push to GitHub** (if not already done)

```bash
git remote add origin https://github.com/your-username/esp32-pinout-studio.git
git push -u origin main
```

- [ ] **Step 3: Deploy via Vercel CLI**

```bash
npx vercel --yes
```
Expected: deployment URL printed. Open it, verify the site loads.

- [ ] **Step 4: Commit vercel.json**

```bash
git add vercel.json
git commit -m "chore: add Vercel deployment config"
```

---

## Self-Review: Spec Coverage Check

| Design requirement | Covered in task |
|--------------------|----------------|
| Chip selector for all 6 variants | Task 6 |
| Board diagram (visual pinout) | Task 10 |
| Filterable table synced with diagram | Tasks 7, 8 |
| Pin detail panel | Task 9 |
| Filter presets (ADC+WiFi, safe output…) | Tasks 7, 8 |
| Pin-mapping builder | Task 11 |
| Live conflict + gotcha warnings | Task 11 |
| Arduino/PlatformIO #define export | Task 12 |
| Shareable URL | Tasks 5, 12 |
| PNG export | Task 12 |
| Community submit / contribute | Task 13 |
| Chip-level gotcha notes | Task 14 (banner) |
| All 6 chips' data with constraints | Tasks 3, 4 |
| Schema tests | Task 4 |
| Deploy to Vercel | Task 15 |

No spec gaps found.
