import { useState } from 'react'

export function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, set] = useState<T>(() => {
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : init } catch { return init }
  })
  return [v, (x: T) => { set(x); try { localStorage.setItem(key, JSON.stringify(x)) } catch { /* storage unavailable */ } }]
}
