import { useEffect, useRef, useState } from 'react'
import { LAUNCH_ERROR, tr } from '../i18n'
import { resolveLaunch } from '../services/settings'
import { DEFAULT_ICON } from '../components/InstanceIcon'
import type { Account, GameState, HubItem, Instance, Notify, PageId, Settings } from '../types'

const IDLE: GameState = { status: 'idle', phase: '', done: 0, total: 0, files: 0, totalFiles: 0, speed: 0, log: [], error: '' }
const SUPPORTED = ['Vanilla', 'Fabric', 'Forge', 'NeoForge', 'Quilt']
const clean = (m: string) => m.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export function useGame(instances: Instance[], setInstances: (i: Instance[]) => void, selectedId: string, acc: Account | undefined, s: Settings, notify: Notify, go: (p: PageId) => void, onModpackReady?: (id: string) => void) {
  const [game, setGame] = useState<GameState>(IDLE)
  const R = useRef({ instances, setInstances, selectedId, acc, s })
  R.current = { instances, setInstances, selectedId, acc, s }
  const cur = useRef<{ id: string; t: number } | null>(null)
  const patch = (id: string, p: Partial<Instance>) => { const next = R.current.instances.map((i) => (i.id === id ? { ...i, ...p } : i)); R.current.instances = next; R.current.setInstances(next) }

  const start = (inst: Instance | undefined, installOnly: boolean) => {
    const { acc, s } = R.current
    if (!inst) return notify('Create an instance first.', 'warning')
    if (!SUPPORTED.includes(inst.loader)) return notify(`${inst.loader} install is not supported yet. Use Vanilla, Fabric or Quilt.`, 'warning')
    if (!installOnly) {
      if (!acc) { notify('Add an offline profile first.', 'warning'); return go('accounts') }
      if (acc.type !== 'offline') return notify('Only offline profiles can launch for now.', 'warning')
    }
    const launch = resolveLaunch(inst, s)
    if (launch.check !== 'ok') return notify(tr(s.lang, LAUNCH_ERROR[launch.check]), 'warning')
    cur.current = { id: inst.id, t: Date.now() }
    setGame({ ...IDLE, status: 'preparing', phase: 'Starting' })
    window.api.launch({ mc: inst.mc, loader: inst.loader, instId: inst.id, dir: s.dir, java: launch.java, javaRuntime: launch.javaRuntime, minRam: launch.minRam, maxRam: launch.maxRam, jvm: launch.jvm, w: launch.w, h: launch.h, fullscreen: launch.fullscreen, server: launch.server, name: acc?.name ?? '', closeOnLaunch: s.closeOnLaunch, installOnly, loaderVersion: inst.loaderVersion })
      .catch((e: Error) => {
        const cancelled = /Cancelled/.test(e.message)
        setGame((g) => ({ ...g, status: cancelled ? 'idle' : 'error', error: cancelled ? '' : clean(e.message) }))
        notify(cancelled ? 'Download cancelled' : clean(e.message), cancelled ? 'info' : 'danger')
      })
  }
  const startRef = useRef(start); startRef.current = start

  // Installs a modpack as its own NEW instance (version + loader come from the pack), then installs Minecraft + the loader.
  const installModpack = async (item: HubItem) => {
    if (game.status === 'preparing') return notify('Another download is already running.', 'warning')
    const id = crypto.randomUUID()
    setGame({ ...IDLE, status: 'preparing', phase: 'Fetching modpack info' })
    try {
      const meta = await window.api.modpackInstall({ dir: R.current.s.dir, instanceId: id, source: item.source, projectId: item.id })
      const inst: Instance = { id, name: meta.name || item.title, mc: meta.mc, loader: meta.loader, icon: item.icon || meta.icon || DEFAULT_ICON, loaderVersion: meta.loaderVersion, source: 'modpack' }
      R.current.instances = [...R.current.instances, inst]; R.current.setInstances(R.current.instances)
      onModpackReady?.(id)
      notify(`${inst.name} added to your library.${meta.skipped ? ` ${meta.skipped} file(s) could not be downloaded.` : ''} Installing Minecraft ${inst.mc} (${inst.loader})…`, meta.skipped ? 'warning' : 'info')
      startRef.current(inst, true)
    } catch (e) {
      const cancelled = /Cancelled/.test((e as Error).message)
      setGame((g) => ({ ...g, status: cancelled ? 'idle' : 'error', phase: '', error: cancelled ? '' : clean((e as Error).message) }))
      notify(cancelled ? 'Modpack download cancelled' : clean((e as Error).message), cancelled ? 'info' : 'danger')
    }
  }

  useEffect(() => {
    const a = window.api.onProgress((p) => {
      const id = cur.current?.id
      if (p.phase === 'installed' && id) { patch(id, { installed: true }); notify('Installed. You can press Play now.', 'success') }
      if (p.phase === 'running' && id) { cur.current = { id, t: Date.now() }; patch(id, { installed: true, lastPlayed: Date.now() }) }
      setGame((g) => ({ ...g, ...p, status: p.phase === 'running' ? 'running' : p.phase === 'installed' ? 'idle' : 'preparing' }))
    })
    const b = window.api.onLog((l) => setGame((g) => ({ ...g, log: [...g.log.slice(-199), l] })))
    const c = window.api.onExit((code) => {
      const x = cur.current
      if (x) { const i = R.current.instances.find((v) => v.id === x.id); patch(x.id, { playtime: (i?.playtime ?? 0) + (Date.now() - x.t) }) }
      setGame((g) => ({ ...g, status: 'idle', phase: '' }))
      if (code !== 0) notify(`Game exited with code ${code}. See the log on Downloads.`, 'danger')
    })
    return () => { a(); b(); c() }
  }, [])
  const find = (id: string) => R.current.instances.find((i) => i.id === id)
  return { game, installModpack, play: () => startRef.current(find(R.current.selectedId), false), install: (i: Instance, andPlay = false) => startRef.current(i, !andPlay), cancel: () => { void window.api.cancelLaunch() } }
}
