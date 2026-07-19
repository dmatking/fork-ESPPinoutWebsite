import { ChipSelector }    from './components/ChipSelector'
import { RoutingCard }     from './components/RoutingCard'
import { FilterBar }       from './components/FilterBar'
import { PinoutDiagram }   from './components/PinoutDiagram'
import { PinTable }        from './components/PinTable'
import { PinDetailPanel }  from './components/PinDetailPanel'
import { MappingBuilder }  from './components/MappingBuilder'
import { ExportPanel }     from './components/ExportPanel'
import { CommunitySubmit } from './components/CommunitySubmit'
import { ContributePage } from './components/ContributePage'
import { BoardBuilderPage } from './components/BoardBuilderPage'
import { useApp }          from './context/AppContext'

export default function App() {
  const { chip, page, navigate, mapping } = useApp()

  if (page === 'contribute') return <ContributePage />
  if (page === 'build') return <BoardBuilderPage />

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
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('contribute')}
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                Contribute
              </button>
              <a
                href="https://github.com/FelixKunzJr/ESPPinoutWebsite"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-300"
              >
                GitHub ↗
              </a>
            </div>
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
                <p className="text-xs font-semibold text-yellow-400 mb-1">⚠️ {chip.name} - Known Gotchas</p>
                <ul className="text-xs text-yellow-300/80 space-y-0.5 list-disc pl-4">
                  {chip.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}

            <div id="pinout-diagram-export">
              {/* Print-only header/footer: window.print() shows only this
                  container (see @media print in index.css). */}
              <div className="hidden print:block mb-3" style={{ color: '#111' }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{chip.module?.name ?? chip.name} pinout</h1>
                <p style={{ fontSize: 11, color: '#555', margin: '2px 0 0' }}>
                  ESP32 Pinout Studio - esp32pin.com/{chip.id} - {new Date().toISOString().slice(0, 10)}
                </p>
              </div>
              <PinoutDiagram />
              <div className="hidden print:block mt-3" style={{ color: '#111' }}>
                {chip.notes.length > 0 && (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 3px' }}>Known gotchas</p>
                    <ul style={{ fontSize: 11, margin: 0, paddingLeft: 16, listStyle: 'disc' }}>
                      {chip.notes.map((n, i) => <li key={i}>{n}</li>)}
                    </ul>
                  </>
                )}
                {mapping.length > 0 && (
                  <>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: '10px 0 3px' }}>Pin mapping</p>
                    <table style={{ fontSize: 11, borderCollapse: 'collapse' }}>
                      <tbody>
                        {mapping.map(a => (
                          <tr key={a.gpio}>
                            <td style={{ border: '1px solid #bbb', padding: '2px 8px' }}>GPIO{a.gpio}</td>
                            <td style={{ border: '1px solid #bbb', padding: '2px 8px' }}>{a.role}</td>
                            <td style={{ border: '1px solid #bbb', padding: '2px 8px' }}>{a.label}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </div>

            <RoutingCard />

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

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-4">
        <div className="max-w-screen-2xl mx-auto w-full px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href="https://kunzengineering.ch/en"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3"
            title="A free tool by Kunz Engineering"
          >
            <span className="flex items-center justify-center rounded-md bg-white px-2.5 py-1.5 shadow-sm">
              <img
                src="/kunz-engineering-mark.png"
                alt="Kunz Engineering"
                width={34}
                height={18}
                style={{ height: 18, width: 'auto', display: 'block' }}
              />
            </span>
            <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors leading-tight">
              A free tool by<br />
              <span className="font-semibold text-gray-300 group-hover:text-white">Kunz Engineering</span>
              <span className="text-gray-600"> · kunzengineering.ch ↗</span>
            </span>
          </a>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <a
              href="https://github.com/FelixKunzJr/ESPPinoutWebsite"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              Open source on GitHub ↗
            </a>
            <span className="text-gray-700">MIT licensed</span>
          </div>
        </div>
      </footer>

      {/* Pin detail slide-in panel */}
      <PinDetailPanel />
    </div>
  )
}
