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
