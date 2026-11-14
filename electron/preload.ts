import { contextBridge, ipcRenderer } from 'electron'

const on = (ch: string, cb: (d: unknown) => void) => {
  const f = (_e: unknown, d: unknown) => cb(d)
  ipcRenderer.on(ch, f)
  return () => { ipcRenderer.removeListener(ch, f) }
}
const call = (ch: string) => (...a: unknown[]) => ipcRenderer.invoke(ch, ...a)

contextBridge.exposeInMainWorld('api', {
  appVersion: call('app:version'), systemInfo: call('app:system'), openDir: call('shell:openDir'), curseForgeKeyStatus: call('curseforge:key-status'), setCurseForgeKey: call('curseforge:set-key'), versions: call('mc:versions'), detectJava: call('java:detect'), javaRuntimes: call('java:runtimes'),
  loaderSupport: call('loaders:support'), modpackInstall: call('modpack:install'),
  pickFile: call('dialog:file'), pickDir: call('dialog:dir'), openExternal: call('shell:open'),
  offlineUuid: call('account:uuid'), launch: call('game:launch'), cancelLaunch: call('game:cancel'),
  hubSearch: call('hub:search'), hubBrowse: call('hub:browse'), hubVersions: call('hub:versions'), hubInstall: call('hub:install'), instList: call('inst:list'), instBrowse: call('inst:browse'), instToggle: call('inst:toggle'), instRemove: call('inst:remove'),
  instAdd: call('inst:add'), instOpen: call('inst:open'), instExists: call('inst:exists'), instDelete: call('inst:delete'),
  onProgress: (cb: (d: unknown) => void) => on('game:progress', cb),
  onLog: (cb: (d: unknown) => void) => on('game:log', cb),
  onExit: (cb: (d: unknown) => void) => on('game:exit', cb)
})
