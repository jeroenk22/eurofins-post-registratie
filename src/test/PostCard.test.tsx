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
  {
    id: 'MK-0',
    type: 'Mestklanten',
    label: 'Bakker (Nijmegen)',
    value: 'Bakker (Nijmegen)',
    searchTerms: ['Bakker', '6789EF', 'Nijmegen'],
    adres: 'Langestraat 10',
    postcode: '6789EF',
    plaats: 'Nijmegen',
    land: 'Nederland',
    route: '5',
  },
]

// Geen naam ingesteld zodat de RecipientAutocomplete geen eigen ✕-knop toont
const mestklantEntry: PostEntry = {
  ...baseEntry,
  recipientType: 'Mestklanten',
  colliOmschrijvingen: [''],
}

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

  it('roept onUpdate aan met verhoogd colli bij klikken +', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={baseEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    fireEvent.click(screen.getByText('+'))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colli: 2 })
  })

  it('roept onUpdate aan met verlaagd colli bij klikken − en behoudt omschrijvingen', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...baseEntry, colli: 2, colliOmschrijvingen: ['doos', 'buis'] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={[]} />
    )
    fireEvent.click(screen.getByText('−'))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colli: 1 })
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

describe('PostCard — mestklant colli dropdown', () => {
  it('toont een select in plaats van een tekstveld bij recipientType Mestklanten', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.getByRole('combobox', { name: /omschrijving collo/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/omschrijving collo \(optioneel\)/i)).not.toBeInTheDocument()
  })

  it('toont een tekstveld (geen select) voor niet-mestklanten', () => {
    render(
      <PostCard entry={baseEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.getByPlaceholderText(/omschrijving collo/i)).toBeInTheDocument()
    // de select voor mestklanten mag er niet zijn
    expect(screen.queryByRole('combobox', { name: /omschrijving collo/i })).not.toBeInTheDocument()
  })

  it('toont alle 5 vaste opties in de dropdown', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.getByRole('option', { name: 'Eijkelkamp deksels' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'D-Tech (KLEINE DOOS)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'D-Tech (GROTE DOOS)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Vaste mestzakken (50st)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Vaste mestzakken (500st)' })).toBeInTheDocument()
  })

  it('vaste mestzakken (50st) staat vóór vaste mestzakken (500st)', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    const options = screen.getAllByRole('option').map(o => o.textContent)
    const idx50 = options.indexOf('Vaste mestzakken (50st)')
    const idx500 = options.indexOf('Vaste mestzakken (500st)')
    expect(idx50).toBeLessThan(idx500)
  })

  it('toont de optie "Anders..." in de dropdown', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.getByRole('option', { name: 'Anders...' })).toBeInTheDocument()
  })

  it('placeholder-optie is disabled', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    const placeholder = screen.getByRole('option', { name: /omschrijving collo/i, hidden: true })
    expect(placeholder).toBeDisabled()
  })

  it('placeholder toont geen "(optioneel)" bij mestklanten', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.queryByText(/optioneel/i)).not.toBeInTheDocument()
  })

  it('selecteren vaste optie slaat het label op via onUpdate', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    const select = screen.getByRole('combobox', { name: /omschrijving collo/i })
    fireEvent.change(select, { target: { value: 'Eijkelkamp deksels' } })
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: ['Eijkelkamp deksels'] })
  })

  it('elke vaste optie slaat het label op (label = option value)', () => {
    const labels = [
      'Eijkelkamp deksels',
      'D-Tech (KLEINE DOOS)',
      'D-Tech (GROTE DOOS)',
      'Vaste mestzakken (50st)',
      'Vaste mestzakken (500st)',
    ]
    for (const label of labels) {
      const onUpdate = vi.fn()
      render(
        <PostCard entry={mestklantEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
      )
      const selects = screen.getAllByRole('combobox', { name: /omschrijving collo/i })
      const select = selects[selects.length - 1]
      fireEvent.change(select, { target: { value: label } })
      expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: [label] })
      const options = screen.getAllByRole('option', { name: label })
      expect(options[options.length - 1]).toHaveValue(label)
    }
  })

  it('selecteren "Anders..." toont vrij tekstveld', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    const select = screen.getByRole('combobox', { name: /omschrijving collo/i })
    fireEvent.change(select, { target: { value: '__anders__' } })
    expect(screen.getByPlaceholderText(/vrije omschrijving/i)).toBeInTheDocument()
  })

  it('typen in het vrije tekstveld stuurt waarde door via onUpdate', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    fireEvent.change(screen.getByRole('combobox', { name: /omschrijving collo/i }), { target: { value: '__anders__' } })
    fireEvent.change(screen.getByPlaceholderText(/vrije omschrijving/i), { target: { value: 'Speciaal pakket' } })
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: ['Speciaal pakket'] })
  })

  it('na "Anders..." terugkiezen naar vaste optie: tekstveld verdwijnt en label wordt opgeslagen', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    const select = screen.getByRole('combobox', { name: /omschrijving collo/i })
    fireEvent.change(select, { target: { value: '__anders__' } })
    fireEvent.change(select, { target: { value: 'D-Tech (KLEINE DOOS)' } })
    expect(screen.queryByPlaceholderText(/vrije omschrijving/i)).not.toBeInTheDocument()
    expect(onUpdate).toHaveBeenLastCalledWith('test-1', { colliOmschrijvingen: ['D-Tech (KLEINE DOOS)'] })
  })

  it('✕-knopje op select is niet zichtbaar als veld leeg is', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.queryByRole('button', { name: /veld leegmaken/i })).not.toBeInTheDocument()
  })

  it('✕-knopje op select verschijnt wanneer een optie gekozen is', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...mestklantEntry, colliOmschrijvingen: ['Eijkelkamp deksels'] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    expect(screen.getByRole('button', { name: /veld leegmaken/i })).toBeInTheDocument()
  })

  it('✕-knopje op select reset omschrijving naar leeg', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard entry={{ ...mestklantEntry, colliOmschrijvingen: ['Eijkelkamp deksels'] }} index={0} onUpdate={onUpdate} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    fireEvent.mouseDown(screen.getByRole('button', { name: /veld leegmaken/i }))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: [''] })
  })

  it('✕-knopje verschijnt ook in "Anders..."-modus en sluit het tekstveld', () => {
    render(
      <PostCard entry={mestklantEntry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} />
    )
    fireEvent.change(screen.getByRole('combobox', { name: /omschrijving collo/i }), { target: { value: '__anders__' } })
    expect(screen.getByPlaceholderText(/vrije omschrijving/i)).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('button', { name: /veld leegmaken/i }))
    expect(screen.queryByPlaceholderText(/vrije omschrijving/i)).not.toBeInTheDocument()
  })

  it('bij colli=2 heeft elk collo zijn eigen dropdown', () => {
    render(
      <PostCard
        entry={{ ...mestklantEntry, colli: 2, colliOmschrijvingen: ['', ''] }}
        index={0}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    expect(screen.getAllByRole('combobox', { name: /omschrijving collo/i })).toHaveLength(2)
  })

  it('bij colli=2 wijzigt selectie in tweede collo alleen de tweede omschrijving', () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={{ ...mestklantEntry, colli: 2, colliOmschrijvingen: ['Eijkelkamp deksels', ''] }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    const selects = screen.getAllByRole('combobox', { name: /omschrijving collo/i })
    fireEvent.change(selects[1], { target: { value: 'D-Tech (KLEINE DOOS)' } })
    expect(onUpdate).toHaveBeenCalledWith('test-1', { colliOmschrijvingen: ['Eijkelkamp deksels', 'D-Tech (KLEINE DOOS)'] })
  })

  it('bij colli=2 opent "Anders..." in tweede collo het tekstveld alleen voor dat collo', () => {
    render(
      <PostCard
        entry={{ ...mestklantEntry, colli: 2, colliOmschrijvingen: ['', ''] }}
        index={0}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    const selects = screen.getAllByRole('combobox', { name: /omschrijving collo/i })
    fireEvent.change(selects[1], { target: { value: '__anders__' } })
    expect(screen.getAllByPlaceholderText(/vrije omschrijving/i)).toHaveLength(1)
  })

  it('onSelect met mestklant stelt recipientType in op Mestklanten en reset omschrijvingen', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={baseEntry}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Bakker')
    fireEvent.mouseDown(screen.getByText('Bakker (Nijmegen)'))
    expect(onUpdate).toHaveBeenCalledWith(
      'test-1',
      expect.objectContaining({ recipientType: 'Mestklanten', colliOmschrijvingen: [] })
    )
  })

  it('onSelect met niet-mestklant stelt recipientType in op het juiste type', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={baseEntry}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    fireEvent.mouseDown(screen.getByText('M001 - Jan de Vries'))
    expect(onUpdate).toHaveBeenCalledWith(
      'test-1',
      expect.objectContaining({ recipientType: 'Monsternemers' })
    )
  })

  it('naam wissen reset ook recipientType', async () => {
    const onUpdate = vi.fn()
    render(
      <PostCard
        entry={{ ...mestklantEntry, name: 'Bakker (Nijmegen)' }}
        index={0}
        onUpdate={onUpdate}
        onRemove={vi.fn()}
        showRemove={false}
        recipients={recipients}
      />
    )
    // Gebruik de placeholder om specifiek de RecipientAutocomplete te targeten
    // (de mestklant-select is ook een combobox en zou getByRole('combobox') laten falen)
    await userEvent.clear(screen.getByPlaceholderText(/bijv\./i))
    expect(onUpdate).toHaveBeenCalledWith('test-1', { recipientType: undefined })
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

describe('PostCard — showErrors fout-styling', () => {
  const render$ = (entry: PostEntry, showErrors = true) =>
    render(<PostCard entry={entry} index={0} onUpdate={vi.fn()} onRemove={vi.fn()} showRemove={false} recipients={recipients} showErrors={showErrors} />)

  it('geen rode klassen als showErrors=false, ook al zijn velden leeg', () => {
    render$({ ...baseEntry }, false)
    const nameInput = screen.getByPlaceholderText(/bijv\. jan de vries/i)
    expect(nameInput.className).not.toContain('border-red-400')
    expect(screen.getByRole('button', { name: /foto's toevoegen/i }).className).not.toContain('border-red-400')
  })

  it('naam-input krijgt rode rand als name leeg is en showErrors=true', () => {
    render$({ ...baseEntry, name: '' })
    expect(screen.getByPlaceholderText(/bijv\. jan de vries/i).className).toContain('border-red-400')
  })

  it('naam-input heeft geen rode rand als name ingevuld is', () => {
    render$({ ...baseEntry, name: 'Jan' })
    expect(screen.getByPlaceholderText(/bijv\. jan de vries/i).className).not.toContain('border-red-400')
  })

  it('schap-grid krijgt rode ring als shelf null is', () => {
    render$({ ...baseEntry, shelf: null })
    const schapKnoppen = screen.getByRole('button', { name: '1' }).closest('.grid')!
    expect(schapKnoppen.className).toContain('ring-red-400')
  })

  it('schap-grid heeft geen rode ring als shelf geselecteerd is', () => {
    render$({ ...baseEntry, shelf: 3 })
    const schapKnoppen = screen.getByRole('button', { name: '1' }).closest('.grid')!
    expect(schapKnoppen.className).not.toContain('ring-red-400')
  })

  it('locatiebeschrijving krijgt rode rand als shelf=overig en beschrijving leeg is', () => {
    render$({ ...baseEntry, shelf: 'overig', shelfDescription: '' })
    expect(screen.getByLabelText(/locatiebeschrijving/i).className).toContain('border-red-400')
  })

  it('locatiebeschrijving heeft geen rode rand als beschrijving ingevuld is', () => {
    render$({ ...baseEntry, shelf: 'overig', shelfDescription: 'Op kar' })
    expect(screen.getByLabelText(/locatiebeschrijving/i).className).not.toContain('border-red-400')
  })

  it("foto-uploadknop krijgt rode rand als photos leeg is", () => {
    render$({ ...baseEntry, photos: [] })
    expect(screen.getByRole('button', { name: /foto's toevoegen/i }).className).toContain('border-red-400')
  })

  it("foto-uploadknop heeft geen rode rand als er foto's zijn", () => {
    const photo = { id: 'p1', name: 'foto.jpg', data: 'data:image/jpeg;base64,abc' }
    render$({ ...baseEntry, photos: [photo] })
    expect(screen.getByRole('button', { name: /foto's toevoegen/i }).className).not.toContain('border-red-400')
  })

  it('mestklant select krijgt rode rand als omschrijving leeg is', () => {
    render$({ ...mestklantEntry, colliOmschrijvingen: [''] })
    const select = screen.getByRole('combobox', { name: /omschrijving collo/i })
    expect(select.className).toContain('border-red-400')
  })

  it('mestklant select heeft geen rode rand als omschrijving ingevuld is', () => {
    render$({ ...mestklantEntry, colliOmschrijvingen: ['Eijkelkamp deksels'] })
    const select = screen.getByRole('combobox', { name: /omschrijving collo/i })
    expect(select.className).not.toContain('border-red-400')
  })

  it('bij colli=2 krijgt alleen het lege collo een rode rand', () => {
    render$({ ...mestklantEntry, colli: 2, colliOmschrijvingen: ['Eijkelkamp deksels', ''] })
    const selects = screen.getAllByRole('combobox', { name: /omschrijving collo/i })
    expect(selects[0].className).not.toContain('border-red-400')
    expect(selects[1].className).toContain('border-red-400')
  })

  it('vrij tekstveld in Anders-modus krijgt rode rand als leeg', () => {
    render$({ ...mestklantEntry, colliOmschrijvingen: [''] })
    fireEvent.change(screen.getByRole('combobox', { name: /omschrijving collo/i }), { target: { value: '__anders__' } })
    expect(screen.getByPlaceholderText(/vrije omschrijving/i).className).toContain('border-red-400')
  })
})
