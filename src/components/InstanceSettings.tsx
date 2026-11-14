import { useEffect, useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { JAVA_RUNTIMES, applyInstanceDraft, checkLaunch, instanceDraft, ramCeiling, runtimeLabel, type InstanceSettingsDraft } from '../services/settings'
import { LAUNCH_ERROR, tr } from '../i18n'
import { Field, Group, SaveBar, Segment, SettingsGrid } from './ui'
import InstanceIcon from './InstanceIcon'
import IconPicker from './IconPicker'
import type { Ctx, Instance } from '../types'

export default function InstanceSettings({ c, inst }: { c: Ctx; inst: Instance }) {
  const g = c.settings
  const lang = g.lang
  const [draft, setDraft] = useState<InstanceSettingsDraft>(() => instanceDraft(inst, g))
  const [totalMem, setTotalMem] = useState(0)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  useEffect(() => { setDraft(instanceDraft(inst, g)) }, [inst.id])
  useEffect(() => { window.api.systemInfo().then((info) => setTotalMem(info.totalMemMb)).catch(() => undefined) }, [])
  const set = <K extends keyof InstanceSettingsDraft>(key: K, value: InstanceSettingsDraft[K]) => setDraft((prev) => ({ ...prev, [key]: value }))
  const memoryOn = draft.memoryMode === 'custom'
  const windowOn = draft.windowMode === 'custom'
  const jvmOn = draft.jvmMode === 'custom'
  const check = checkLaunch({
    minRam: memoryOn ? draft.minRam : g.minRam,
    maxRam: memoryOn ? draft.maxRam : g.maxRam,
    w: windowOn ? draft.w : g.w,
    h: windowOn ? draft.h : g.h,
    fullscreen: windowOn ? draft.fullscreen : g.fullscreen,
    server: draft.server,
    javaPath: draft.javaPath
  })
  const nameOk = Boolean(draft.name.trim())
  const bad = !nameOk || check !== 'ok'
  const shownMin = memoryOn ? draft.minRam : g.minRam
  const shownMax = memoryOn ? draft.maxRam : g.maxRam
  const shownW = windowOn ? draft.w : g.w
  const shownH = windowOn ? draft.h : g.h
  const shownFull = windowOn ? draft.fullscreen : g.fullscreen
  const javaName = draft.javaPath.trim() ? tr(lang, 'customJava') : draft.javaRuntime === 'global' ? tr(lang, 'autoJava') : runtimeLabel(draft.javaRuntime)
  const windowName = shownFull ? tr(lang, 'fullscreen') : `${shownW}×${shownH}`
  const customCount = [draft.memoryMode, draft.windowMode, draft.jvmMode].filter((mode) => mode === 'custom').length + (draft.javaRuntime !== 'global' || draft.javaPath.trim() ? 1 : 0) + (draft.server.trim() ? 1 : 0)
  const ceiling = ramCeiling(totalMem, Math.max(draft.minRam, draft.maxRam, g.maxRam))
  const dirty = JSON.stringify(applyInstanceDraft(inst, draft)) !== JSON.stringify(inst)
  const save = () => {
    if (bad) return
    c.setInstances(c.instances.map((item) => item.id === inst.id ? applyInstanceDraft(item, draft) : item))
    c.notify(tr(lang, 'savedInstance'), 'success')
  }
  const clearOverrides = () => setDraft((prev) => ({
    ...instanceDraft({ ...inst, memoryMode: 'global', windowMode: 'global', jvmMode: 'global', javaRuntime: undefined, javaPath: undefined, server: undefined, fullscreen: false }, g),
    name: prev.name, icon: prev.icon, notes: prev.notes
  }))
  const pickJava = async () => {
    const path = await window.api.pickFile(['exe'])
    if (!path) return
    if (!/java(w)?\.exe$/i.test(path)) { c.notify(tr(lang, 'javaWarn'), 'danger'); return }
    setDraft((prev) => ({ ...prev, javaPath: path }))
  }
  const modes = [{ id: 'global', label: tr(lang, 'optDefault') }, { id: 'custom', label: tr(lang, 'optCustom') }]
  return <>
    <div className="sum-strip">
      <div><strong>{tr(lang, 'willLaunch')}</strong><span>{shownMin}–{shownMax} MB · {windowName} · {javaName}{draft.server.trim() ? ` · ${tr(lang, 'join')} ${draft.server.trim()}` : ''}</span></div>
      <span className={`sum-chip ${customCount ? 'on' : ''}`}>{customCount ? tr(lang, 'overrides', { n: customCount }) : tr(lang, 'following')}</span>
    </div>
    <SettingsGrid>
      <Group title={tr(lang, 'general')}>
        <Field label={tr(lang, 'name')} error={!nameOk ? tr(lang, 'nameRequired') : undefined}><Form.Control value={draft.name} isInvalid={!nameOk} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={tr(lang, 'icon')}>
          <button type="button" className="ni-selected-icon instance-selected-icon" onClick={() => setIconPickerOpen(true)}><InstanceIcon icon={draft.icon} size={34}/><span>Choose icon</span><small>77 icons · Upload custom</small></button>
        </Field>
        <Field label={tr(lang, 'notes')}><Form.Control as="textarea" rows={2} value={draft.notes} placeholder={tr(lang, 'notesPh')} onChange={(e) => set('notes', e.target.value)} /></Field>
      </Group>
      <Group title={tr(lang, 'memory')} aside={<Segment options={modes} value={memoryOn ? 'custom' : 'global'} onChange={(v) => set('memoryMode', v as 'global' | 'custom')} />}>
        <div className="sg-fields" data-locked={memoryOn ? 'false' : 'true'}>
          <Field label={tr(lang, 'minimum')} value={`${shownMin} MB`}><Form.Range min={512} max={ceiling} step={256} value={shownMin} disabled={!memoryOn} onChange={(e) => set('minRam', +e.target.value)} /></Field>
          <Field label={tr(lang, 'maximum')} value={`${shownMax} MB`}><Form.Range min={512} max={ceiling} step={256} value={shownMax} disabled={!memoryOn} onChange={(e) => set('maxRam', +e.target.value)} /></Field>
        </div>
        {memoryOn && shownMin > shownMax && <div className="sf-error">{tr(lang, 'ramWarn')}</div>}
        {totalMem > 0 && shownMax > totalMem * 0.85 && <div className="sf-hint text-warning">{tr(lang, 'ramHigh')}</div>}
      </Group>
      <Group title={tr(lang, 'window')} aside={<Segment options={modes} value={windowOn ? 'custom' : 'global'} onChange={(v) => set('windowMode', v as 'global' | 'custom')} />}>
        <div className="sg-fields" data-locked={windowOn ? 'false' : 'true'}>
          <Form.Check type="switch" label={tr(lang, 'fullscreen')} checked={shownFull} disabled={!windowOn} onChange={(e) => set('fullscreen', e.target.checked)} />
          <Field label={tr(lang, 'resolution')} error={windowOn && !shownFull && (shownW < 640 || shownH < 480) ? tr(lang, 'resWarn') : undefined}>
            <div className="sf-pair"><Form.Control type="number" value={shownW} disabled={!windowOn || shownFull} isInvalid={windowOn && !shownFull && shownW < 640} onChange={(e) => set('w', +e.target.value)} /><span>×</span><Form.Control type="number" value={shownH} disabled={!windowOn || shownFull} isInvalid={windowOn && !shownFull && shownH < 480} onChange={(e) => set('h', +e.target.value)} /></div>
          </Field>
        </div>
        <Field label={tr(lang, 'server')} error={check === 'server' ? tr(lang, 'serverWarn') : undefined} hint={tr(lang, 'serverHelp')}>
          <Form.Control value={draft.server} placeholder={tr(lang, 'serverPh')} isInvalid={!draft.server.trim() ? false : check === 'server'} onChange={(e) => set('server', e.target.value)} />
        </Field>
      </Group>
      <Group title={tr(lang, 'java')} desc={tr(lang, 'javaHelp')}>
        <Field label={tr(lang, 'javaRuntime')}>
          <Form.Select value={draft.javaRuntime} onChange={(e) => set('javaRuntime', e.target.value)}>
            <option value="global">{tr(lang, 'javaGlobal', { runtime: runtimeLabel(g.javaRuntime) })}</option>
            {JAVA_RUNTIMES.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.label}</option>)}
          </Form.Select>
        </Field>
        <Field label={tr(lang, 'javaPath')} error={check === 'java' ? tr(lang, 'javaWarn') : undefined}>
          <div className="sf-row"><Form.Control value={draft.javaPath} placeholder={tr(lang, 'javaPlaceholder')} isInvalid={check === 'java'} onChange={(e) => set('javaPath', e.target.value)} /><Button variant="outline-light" onClick={() => void pickJava()}>{tr(lang, 'browse')}</Button></div>
        </Field>
        <div className="sf">
          <div className="sf-top"><label className="sf-label">{tr(lang, 'jvm')}</label><Segment options={modes} value={jvmOn ? 'custom' : 'global'} onChange={(v) => set('jvmMode', v as 'global' | 'custom')} /></div>
          <Form.Control value={jvmOn ? draft.jvm : g.jvm} disabled={!jvmOn} onChange={(e) => set('jvm', e.target.value)} />
        </div>
      </Group>
    </SettingsGrid>
    <IconPicker show={iconPickerOpen} value={draft.icon} onSelect={(icon) => set('icon', icon)} onHide={() => setIconPickerOpen(false)}/>
    <SaveBar dirty={dirty} disabled={bad} onSave={save} onDiscard={() => setDraft(instanceDraft(inst, g))} saveLabel={tr(lang, 'saveInstance')} savedLabel={tr(lang, 'allSaved')} unsavedLabel={tr(lang, 'unsaved')} discardLabel={tr(lang, 'discard')}
      extra={<Button variant="outline-light" size="sm" onClick={clearOverrides}>{tr(lang, 'resetOverrides')}</Button>} />
  </>
}
