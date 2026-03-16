import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RecipientAutocomplete from '../components/RecipientAutocomplete'
import type { RecipientOption } from '../services/googleSheetsService'

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
  },
  {
    id: 'Mestklanten-0',
    type: 'Mestklanten',
    label: 'Acme B.V. (9999ZZ Groningen)',
    value: 'Acme B.V. (9999ZZ Groningen)',
    searchTerms: ['Acme B.V.', '9999ZZ', 'Groningen'],
    adres: 'Industrieweg 10',
    postcode: '9999ZZ',
    plaats: 'Groningen',
    land: 'Nederland',
  },
]

function setup(value = '', onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <RecipientAutocomplete
        id="test-recipient"
        value={value}
        onChange={onChange}
        recipients={recipients}
      />
    ),
  }
}

describe('RecipientAutocomplete', () => {
  it('toont het label en input', () => {
    setup()
    expect(screen.getByLabelText('Naam / Bedrijf ontvanger *')).toBeInTheDocument()
  })

  it('toont geen dropdown bij minder dan 2 tekens', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'J')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('toont suggesties bij 2+ tekens', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('M001 - Jan de Vries')).toBeInTheDocument()
  })

  it('filtert op Achternaam', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Jansen')
    expect(screen.getByText('A100 - Sophie Jansen')).toBeInTheDocument()
    expect(screen.queryByText('M001 - Jan de Vries')).not.toBeInTheDocument()
  })

  it('filtert op Postcode', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), '9999')
    expect(screen.getByText('Acme B.V. (9999ZZ Groningen)')).toBeInTheDocument()
  })

  it('filtert op Plaats', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Utrecht')
    expect(screen.getByText('A100 - Sophie Jansen')).toBeInTheDocument()
  })

  it('vult waarde in en sluit dropdown bij klikken op suggestie', async () => {
    const onChange = vi.fn()
    render(
      <RecipientAutocomplete
        id="test-recipient"
        value=""
        onChange={onChange}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    const option = screen.getByText('M001 - Jan de Vries')
    fireEvent.mouseDown(option)
    expect(onChange).toHaveBeenCalledWith('M001 - Jan de Vries')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('navigeert met pijltjestoetsen', async () => {
    setup()
    const input = screen.getByRole('combobox')
    await userEvent.type(input, 'Jan')
    const listbox = screen.getByRole('listbox')
    expect(listbox).toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}')
    const firstOption = screen.getAllByRole('option')[0]
    expect(firstOption).toHaveAttribute('aria-selected', 'true')
  })

  it('sluit dropdown bij Escape', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selecteert actief item bij Enter', async () => {
    const onChange = vi.fn()
    render(
      <RecipientAutocomplete
        id="test-recipient"
        value=""
        onChange={onChange}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('M001 - Jan de Vries')
  })

  it('toont categoriebadge', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    expect(screen.getByText('Monsternemer')).toBeInTheDocument()
  })

  it('toont adresregel in suggestie', async () => {
    setup()
    await userEvent.type(screen.getByRole('combobox'), 'Jan')
    expect(screen.getByText(/Kerkstraat 1/)).toBeInTheDocument()
  })

  it('roept onChange aan bij vrij typen', async () => {
    const onChange = vi.fn()
    render(
      <RecipientAutocomplete
        id="test-recipient"
        value=""
        onChange={onChange}
        recipients={recipients}
      />
    )
    await userEvent.type(screen.getByRole('combobox'), 'Ma')
    expect(onChange).toHaveBeenCalledWith('M')
    expect(onChange).toHaveBeenCalledWith('Ma')
  })
})
