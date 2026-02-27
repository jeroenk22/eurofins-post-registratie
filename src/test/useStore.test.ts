import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore, newEntry } from '../useStore'

describe('newEntry', () => {
  it('creates an entry with default values', () => {
    const entry = newEntry()
    expect(entry.shelf).toBeNull()
    expect(entry.name).toBe('')
    expect(entry.colli).toBe(1)
    expect(entry.spoed).toBe(false)
    expect(entry.photos).toEqual([])
  })

  it('generates unique ids', () => {
    const ids = Array.from({ length: 20 }, () => newEntry().id)
    expect(new Set(ids).size).toBe(20)
  })
})

describe('useStore', () => {
  it('starts with one empty entry', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.entries).toHaveLength(1)
  })

  it('addEntry adds a new entry', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.addEntry())
    expect(result.current.entries).toHaveLength(2)
  })

  it('removeEntry removes the correct entry', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.addEntry())
    const idToRemove = result.current.entries[0].id
    act(() => result.current.removeEntry(idToRemove))
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.entries[0].id).not.toBe(idToRemove)
  })

  it('updateEntry patches only the specified entry', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.addEntry())
    const [first, second] = result.current.entries
    act(() => result.current.updateEntry(first.id, { name: 'Acme', colli: 3 }))
    expect(result.current.entries[0].name).toBe('Acme')
    expect(result.current.entries[0].colli).toBe(3)
    expect(result.current.entries[1].id).toBe(second.id) // second untouched
  })

  it('updateEntry updates shelf per entry', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.addEntry())
    const [first, second] = result.current.entries
    act(() => result.current.updateEntry(first.id, { shelf: 3 }))
    act(() => result.current.updateEntry(second.id, { shelf: 7 }))
    expect(result.current.entries[0].shelf).toBe(3)
    expect(result.current.entries[1].shelf).toBe(7)
  })

  it('reset clears all state', () => {
    const { result } = renderHook(() => useStore())
    act(() => {
      result.current.addEntry()
      result.current.setSenderName('Sophie')
      result.current.setSenderPhone('0612345678')
      result.current.setSenderEmail('sophie@example.com')
      result.current.reset()
    })
    expect(result.current.entries).toHaveLength(1)
    expect(result.current.senderName).toBe('')
    expect(result.current.senderPhone).toBe('')
    expect(result.current.senderEmail).toBe('')
  })
})
