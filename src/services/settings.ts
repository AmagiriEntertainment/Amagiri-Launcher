import type { Instance, Settings } from '../types'

export const JAVA_RUNTIMES = [
  { id: 'auto', label: 'Auto' },
  { id: 'legacy', label: 'Java 8 (Legacy)' },
  { id: 'alpha', label: 'Java 16 (Alpha)' },
  { id: 'beta', label: 'Java 17 (Beta)' },
  { id: 'gamma', label: 'Java 17 (Gamma)' },
  { id: 'delta', label: 'Java 21 (Delta)' },
  { id: 'epsilon', label: 'Java 25 (Epsilon)' }
] as const

export const DEFAULT_SETTINGS: Settings = {
  minRam: 1024, maxRam: 4096, java: '', javaRuntime: 'auto', jvm: '-XX:+UseG1GC',
  w: 1280, h: 720, fullscreen: false, dir: '', closeOnLaunch: false, lang: 'English', autoUpdate: false
}

export type SettingMode = 'global' | 'custom'

export interface InstanceSettingsDraft {
  name: string
  icon: string
  notes: string
  memoryMode: SettingMode
  minRam: number
  maxRam: number
  windowMode: SettingMode
  w: number
  h: number
  fullscreen: boolean
  javaRuntime: string
  javaPath: string
  jvmMode: SettingMode
  jvm: string
  server: string
}

const HOST = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*|(?:\d{1,3}\.){3}\d{1,3})(?::(\d{1,5}))?$/

export function serverLaunchArgs(server?: string): string[] {
  const raw = (server ?? '').trim()
  if (!raw) return []
  const match = HOST.exec(raw)
  if (!match) return []
  const port = match[1] ? Number(match[1]) : 0
  if (match[1] && (port < 1 || port > 65535)) return []
  const host = match[1] ? raw.slice(0, -(match[1].length + 1)) : raw
  return match[1] ? ['--server', host, '--port', String(port)] : ['--server', host]
}

export const isValidServer = (server: string) => !server.trim() || serverLaunchArgs(server).length > 0

export function runtimeLabel(id?: string) {
  return JAVA_RUNTIMES.find((runtime) => runtime.id === (id || 'auto'))?.label ?? (id || 'Auto')
}

export function ramCeiling(totalMemMb: number, current: number) {
  const systemCap = totalMemMb > 0 ? Math.floor(totalMemMb / 256) * 256 : 16384
  return Math.min(65536, Math.max(2048, systemCap, current))
}

export function instanceDraft(inst: Instance, settings: Settings): InstanceSettingsDraft {
  return {
    name: inst.name,
    icon: inst.icon || '⛏️',
    notes: inst.notes ?? '',
    memoryMode: inst.memoryMode === 'custom' ? 'custom' : 'global',
    minRam: inst.minRam ?? settings.minRam,
    maxRam: inst.maxRam ?? settings.maxRam,
    windowMode: inst.windowMode === 'custom' ? 'custom' : 'global',
    w: inst.w ?? settings.w,
    h: inst.h ?? settings.h,
    fullscreen: Boolean(inst.fullscreen),
    javaRuntime: inst.javaRuntime || 'global',
    javaPath: inst.javaPath ?? '',
    jvmMode: inst.jvmMode === 'custom' ? 'custom' : 'global',
    jvm: inst.jvm ?? settings.jvm,
    server: inst.server ?? ''
  }
}

export function applyInstanceDraft(inst: Instance, draft: InstanceSettingsDraft): Instance {
  const javaPath = draft.javaPath.trim()
  const notes = draft.notes.trim()
  const server = draft.server.trim()
  return {
    ...inst,
    name: draft.name.trim(),
    icon: draft.icon,
    notes: notes || undefined,
    memoryMode: draft.memoryMode,
    minRam: draft.minRam,
    maxRam: draft.maxRam,
    windowMode: draft.windowMode,
    w: draft.w,
    h: draft.h,
    fullscreen: draft.fullscreen,
    javaRuntime: draft.javaRuntime === 'global' ? undefined : draft.javaRuntime,
    javaPath: javaPath || undefined,
    jvmMode: draft.jvmMode,
    jvm: draft.jvm,
    server: server || undefined
  }
}

export function usesCustomLaunch(inst: Instance) {
  return inst.memoryMode === 'custom' || inst.windowMode === 'custom' || inst.jvmMode === 'custom' || Boolean(inst.javaRuntime) || Boolean(inst.javaPath) || Boolean(inst.server?.trim())
}

export type LaunchCheck = 'ok' | 'ram' | 'resolution' | 'server' | 'java'

export function checkLaunch(input: { minRam: number; maxRam: number; w: number; h: number; fullscreen: boolean; server: string; javaPath: string }): LaunchCheck {
  if (input.minRam > input.maxRam || input.minRam < 512 || input.maxRam < 512) return 'ram'
  if (!input.fullscreen && (input.w < 640 || input.h < 480)) return 'resolution'
  if (!isValidServer(input.server)) return 'server'
  if (input.javaPath.trim() && !/java(w)?\.exe$/i.test(input.javaPath.trim())) return 'java'
  return 'ok'
}

export function resolveLaunch(inst: Instance, settings: Settings) {
  const memoryCustom = inst.memoryMode === 'custom'
  const windowCustom = inst.windowMode === 'custom'
  const minRam = memoryCustom ? (inst.minRam ?? settings.minRam) : settings.minRam
  const maxRam = memoryCustom ? (inst.maxRam ?? settings.maxRam) : settings.maxRam
  const fullscreen = windowCustom ? Boolean(inst.fullscreen) : Boolean(settings.fullscreen)
  const w = windowCustom ? (inst.w ?? settings.w) : settings.w
  const h = windowCustom ? (inst.h ?? settings.h) : settings.h
  const server = (inst.server ?? '').trim()
  const javaPath = inst.javaPath ?? ''
  return {
    check: checkLaunch({ minRam, maxRam, w, h, fullscreen, server, javaPath }),
    java: javaPath || settings.java,
    javaRuntime: inst.javaRuntime || settings.javaRuntime || 'auto',
    minRam, maxRam,
    jvm: inst.jvmMode === 'custom' ? (inst.jvm ?? '') : settings.jvm,
    w, h, fullscreen, server
  }
}
