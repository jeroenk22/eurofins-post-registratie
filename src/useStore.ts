import { useState, useCallback } from 'react'
import type { PostEntry, Photo } from './types'

let _counter = 0
export const genId = (): string => `e${++_counter}_${Math.random().toString(36).slice(2, 6)}`

export function newEntry(): PostEntry {
  return { id: genId(), shelf: null, name: '', colli: 1, spoed: false, photos: [] }
}

export interface Store {
  entries: PostEntry[]
  addEntry: () => void
  removeEntry: (id: string) => void
  updateEntry: (id: string, patch: Partial<PostEntry>) => void
  senderName: string
  setSenderName: (v: string) => void
  senderPhone: string
  setSenderPhone: (v: string) => void
  senderEmail: string
  setSenderEmail: (v: string) => void
  reset: () => void
}

export function useStore(): Store {
  const [entries, setEntries] = useState<PostEntry[]>([newEntry()])
  const [senderName, setSenderName] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [senderEmail, setSenderEmail] = useState('')

  const addEntry    = useCallback(() => setEntries(prev => [...prev, newEntry()]), [])
  const removeEntry = useCallback((id: string) =>
    setEntries(prev => prev.filter(e => e.id !== id)), [])
  const updateEntry = useCallback((id: string, patch: Partial<PostEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e)), [])

  const reset = useCallback(() => {
    setEntries([newEntry()])
    setSenderName('')
    setSenderPhone('')
    setSenderEmail('')
  }, [])

  return {
    entries, addEntry, removeEntry, updateEntry,
    senderName, setSenderName,
    senderPhone, setSenderPhone,
    senderEmail, setSenderEmail,
    reset,
  }
}
