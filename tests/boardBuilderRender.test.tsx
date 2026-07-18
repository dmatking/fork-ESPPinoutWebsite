// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { CHIPS } from '../src/data/chips/index'
import { resolveBoard } from '../src/data/boards/resolveBoard'
import type { BoardSpec } from '../src/data/boards/types'
import { AppContext, type AppState, type DiagramView } from '../src/context/AppContext'
import type { Chip } from '../src/types/chip'
import { PinoutDiagram } from '../src/components/PinoutDiagram'

const here = dirname(fileURLToPath(import.meta.url))
const spec = JSON.parse(
  readFileSync(resolve(here, '../contrib/boards/example.board.json'), 'utf8'),
) as BoardSpec
const { chip } = resolveBoard(spec, CHIPS.find(c => c.id === spec.baseChip))

const ctx = (c: Chip, view: DiagramView): AppState => ({
  chip: c, setChip: () => {}, page: 'build', navigate: () => {},
  view, setView: () => {}, selectedPin: null, setSelectedPin: () => {},
  filter: 'all', setFilter: () => {}, mapping: [], assignPin: () => {},
  unassignPin: () => {}, clearMapping: () => {}, shareUrl: '',
})

afterEach(cleanup)

describe('board builder preview renders the resolved board', () => {
  it('has a chip to render', () => { expect(chip).not.toBeNull() })

  it.each(['module', 'schematic'] as DiagramView[])('renders %s view without throwing', view => {
    const { container } = render(
      <AppContext.Provider value={ctx(chip!, view)}><PinoutDiagram /></AppContext.Provider>,
    )
    expect(container.querySelector('svg')).toBeTruthy()
  })
})
