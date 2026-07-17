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
              href="https://github.com/FelixKunzJr/ESPPinoutWebsite"
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
            {/* Chip notes banner - collapsed by default on phones to keep the diagram above the fold */}
            {chip.notes.length > 0 && (
              <details
                key={chip.id}
                open={typeof window === 'undefined' || window.innerWidth >= 768}
                className="rounded-xl bg-yellow-950/30 border border-yellow-700/50 px-4 py-3"
              >
                <summary className="text-xs font-semibold text-yellow-400 cursor-pointer select-none">
                  ⚠️ {chip.name} - Known Gotchas ({chip.notes.length})
                </summary>
                <ul className="text-xs text-yellow-300/80 space-y-0.5 list-disc pl-4 mt-1.5">
                  {chip.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </details>
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
