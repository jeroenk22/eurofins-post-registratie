import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PostCard from '../components/PostCard'
import type { PostEntry } from '../types'
import type { RecipientOption } from '../services/googleSheetsService'

const baseEntry: PostEntry = {
  id: 'test-1',
  name: '',
  shelf: null,
  shelfDescription: '',
  adres: '',
  postcode: '',
  plaats: '',
  land: '',
  colli: 1,
  colliOmschrijvingen: [],
  spoed: false,
  photos: [],
}

const recipients: RecipientOption[] = [
  {
    id: 'M-0',
    type: 'Monsternemers',
    label: 'M001 - Jan de Vries',
    value: 'M001 - Jan de Vries',
    searchTerms: ['M001', 'Jan', 'Vries', '1234AB', 'Amsterdam'],
    adres: 'Kerkstraat 1',
    postcode: '1234AB',
    plaats: 'Amsterdam',
    land: 'Nederland',
    route: '3',
  },
  {
    id: 'AP-0',
    type: 'AP06',
    label: 'A100 - Sophie Jansen',
    value: 'A100 - Sophie Jansen',
    searchTerms: ['A100', 'Sophie', 'Jansen', '5678CD', 'Utrecht'],
    adres: 'Dorpsweg 5',
    postcode: '5678CD',
    plaats: 'Utrecht',
    land: 'Nederland',
    route: '',
  },
]

describe('PostCard — colli omschrijvingen', () => {
  it('toont één omschrijvingsveld bij colli=1', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={baseEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    expect(screen.getAllByPlaceholderText(/omschrijving collo/i)).toHaveLength(1)
  })

  it('toont twee omschrijvingsvelden bij colli=2', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...baseEntry, colli: 2, colliOmschrijvingen: ['', ''] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    expect(screen.getAllByPlaceholderText(/omschrijving collo/i)).toHaveLength(2)
  })

  it('roept onUpdate aan met uitgebreide array bij klikken +', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={baseEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    fireEvent.click(screen.getByText('+'))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colli: 2, colliOmschrijvingen: [''] })
  })

  it('roept onUpdate aan met ingekorte array bij klikken −', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...baseEntry, colli: 2, colliOmschrijvingen: ['doos', 'buis'] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    fireEvent.click(screen.getByText('−'))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colli: 1, colliOmschrijvingen: ['doos'] })
  })

  it('roept onUpdate aan met bijgewerkte omschrijving bij typen', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...baseEntry, colli: 2, colliOmschrijvingen: ['', ''] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    const inputs = screen.getAllByPlaceholderText(/omschrijving collo/i)
    fireEvent.change(inputs[1], { target: { value: 'buis' } })
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: ['', 'buis'] })
  })
})

describe('PostCard — naam/spoed/schap reset-logica', () => {
  it('reset shelf en spoed bij leegmaken naam', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={{ ...baseEntry, name: 'Jan', shelf: 3, spoed: true }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    await userEvent.clear(screen.getByRole('combobox'))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { shelf: null })
    expect(onUpdate).toHaveBeenCalledWith('test-1', { spoed: false })
  })

  it('reset spoed bij selecteren ontvanger zonder schap', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={{ ...baseEntry, spoed: true }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Jansen')
    fireEvent.mouseDown(screen.getByText('A100 - Sophie Jansen'))
    expect(onUpdate).toHaveBeenCalledWith(
      'test-1',
      expect.objectContaining({ shelf: null, spoed: false })
    )
  })

  it('behoudt spoed bij selecteren ontvanger met geldig schap', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={{ ...baseEntry, spoed: true }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    fireEvent.mouseDown(screen.getByText('M001 - Jan de Vries'))
    const callWithShelf = onUpdate.mock.calls.find(([, patch]) => 'shelf' in patch)
    expect(callWithShelf).toBeDefined()
    expect(callWithShelf![1].shelf).toBe(3)
    expect(callWithShelf![1]).not.toHaveProperty('spoed')
  })
})
