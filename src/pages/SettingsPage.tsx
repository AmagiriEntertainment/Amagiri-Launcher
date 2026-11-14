import { useEffect, useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { Field, Group, PageHead, SaveBar, SettingsGrid } from '../components/ui'
import companyLogo from '../assets/amagiri-entertainment.png'
import launcherWordmark from '../assets/amagiri-launcher-wordmark.png'
import { tr } from '../i18n'
import { DEFAULT_SETTINGS, JAVA_RUNTIMES, ramCeiling } from '../services/settings'
import type { Ctx, Settings } from '../types'

export default function SettingsPage({ c }: { c: Ctx }) {
  const [s, setS] = useState<Settings>(c.settings)
  const [curseForgeKey, setCurseForgeKey] = useState('')
  const [curseForgeConfigured, setCurseForgeConfigured] = useState(false)
  const [keyBusy, setKeyBusy] = useState(false)
  const [totalMem, setTotalMem] = useState(0)
  useEffect(() => { window.api.curseForgeKeyStatus().then((v) => setCurseForgeConfigured(v.configured)).catch(() => undefined) }, [])
  useEffect(() => { window.api.systemInfo().then((info) => setTotalMem(info.totalMemMb)).catch(() => undefined) }, [])
  const lang = s.lang
  const dirty = JSON.stringify(s) !== JSON.stringify(c.settings)
  const bad = s.minRam > s.maxRam || (!s.fullscreen && (s.w < 640 || s.h < 480))
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v })
  const ceiling = ramCeiling(totalMem, Math.max(s.minRam, s.maxRam))
  const openDir = async () => { try { await window.api.openDir(s.dir) } catch (e) { c.notify((e as Error).message, 'danger') } }
  const pickJava = async () => {
    const path = await window.api.pickFile(['exe'])
    if (!path) return
    if (!/java(w)?\.exe$/i.test(path)) { c.notify(tr(lang, 'javaWarn'), 'danger'); return }
    set('java', path)
  }
  const save = () => { c.setSettings(s); c.notify(tr(lang, 'savedSettings'), 'success') }
  const clearKey = async () => { setKeyBusy(true); try { await window.api.setCurseForgeKey(''); setCurseForgeConfigured(false); c.notify(tr(lang, 'keyRemoved'), 'success') } catch (e) { c.notify((e as Error).message, 'danger') } finally { setKeyBusy(false) } }
  const saveKey = async () => { setKeyBusy(true); try { const r = await window.api.setCurseForgeKey(curseForgeKey); setCurseForgeConfigured(r.configured); setCurseForgeKey(''); c.notify(tr(lang, 'keySaved'), 'success') } catch (e) { c.notify((e as Error).message, 'danger') } finally { setKeyBusy(false) } }
  const resWarn = !s.fullscreen && (s.w < 640 || s.h < 480)
  return <>
    <PageHead title="Settings" sub={tr(lang, 'settingsSub')} />
    <div className="brand-identity-panel mb-3">
      <img src={companyLogo} alt="Amagiri Entertainment logo" />
      <div><div className="brand-identity-kicker">PUBLISHER & STUDIO</div><h5>Amagiri Entertainment</h5><p>Amagiri Launcher is crafted and published by Amagiri Entertainment.</p></div>
      <img className="brand-identity-launcher" src={launcherWordmark} alt="Amagiri Launcher logo" />
    </div>
    <SettingsGrid>
      <Group title={tr(lang, 'memory')} desc={tr(lang, 'memoryHelp')}>
        <Field label={tr(lang, 'minimum')} value={`${s.minRam} MB`}><Form.Range min={512} max={ceiling} step={256} value={Math.min(s.minRam, ceiling)} onChange={(e) => set('minRam', +e.target.value)} /></Field>
        <Field label={tr(lang, 'maximum')} value={`${s.maxRam} MB`} error={s.minRam > s.maxRam ? tr(lang, 'ramWarn') : undefined} hint={totalMem > 0 ? tr(lang, 'ramSystem', { mb: totalMem }) : undefined}>
          <Form.Range min={512} max={ceiling} step={256} value={Math.min(s.maxRam, ceiling)} onChange={(e) => set('maxRam', +e.target.value)} />
        </Field>
        {totalMem > 0 && s.maxRam > totalMem * 0.85 && <div className="sf-hint text-warning">{tr(lang, 'ramHigh')}</div>}
      </Group>
      <Group title={tr(lang, 'window')} desc={tr(lang, 'windowHelp')}>
        <Form.Check type="switch" label={tr(lang, 'fullscreen')} checked={s.fullscreen} onChange={(e) => set('fullscreen', e.target.checked)} />
        <Field label={tr(lang, 'resolution')} error={resWarn ? tr(lang, 'resWarn') : undefined}>
          <div className="sf-pair"><Form.Control type="number" value={s.w} disabled={s.fullscreen} isInvalid={!s.fullscreen && s.w < 640} onChange={(e) => set('w', +e.target.value)} /><span>×</span><Form.Control type="number" value={s.h} disabled={s.fullscreen} isInvalid={!s.fullscreen && s.h < 480} onChange={(e) => set('h', +e.target.value)} /></div>
        </Field>
      </Group>
      <Group title={tr(lang, 'gameFiles')}>
        <Field label={tr(lang, 'gameDir')}>
          <div className="sf-row"><Form.Control value={s.dir} onChange={(e) => set('dir', e.target.value)} /><Button variant="outline-light" onClick={async () => { const d = await window.api.pickDir(); if (d) set('dir', d) }}>{tr(lang, 'browse')}</Button><Button variant="outline-light" onClick={() => void openDir()}>{tr(lang, 'openFolder')}</Button></div>
        </Field>
      </Group>
      <Group title={tr(lang, 'launcher')}>
        <Form.Check type="switch" label={tr(lang, 'closeOnLaunch')} checked={s.closeOnLaunch} onChange={(e) => set('closeOnLaunch', e.target.checked)} />
        <Field label={tr(lang, 'language')} hint={tr(lang, 'languageHelp')}>
          <Form.Select value={s.lang} onChange={(e) => set('lang', e.target.value)}><option>English</option><option>Bahasa Indonesia</option><option>日本語</option></Form.Select>
        </Field>
      </Group>
      <Group title={tr(lang, 'java')} desc={tr(lang, 'javaHelp')} aside={<Button size="sm" variant="outline-light" onClick={() => c.go('java')}>{tr(lang, 'javaManager')}</Button>}>
        <Field label={tr(lang, 'javaDefault')}>
          <Form.Select value={s.javaRuntime || 'auto'} onChange={(e) => set('javaRuntime', e.target.value)}>{JAVA_RUNTIMES.map((runtime) => <option key={runtime.id} value={runtime.id}>{runtime.id === 'auto' ? 'Auto (recommended)' : runtime.label}</option>)}</Form.Select>
        </Field>
        <Field label={tr(lang, 'javaPath')}>
          <div className="sf-row"><Form.Control value={s.java} onChange={(e) => set('java', e.target.value)} placeholder={tr(lang, 'javaPlaceholder')} /><Button variant="outline-light" onClick={() => void pickJava()}>{tr(lang, 'browse')}</Button></div>
        </Field>
        <Field label={tr(lang, 'jvm')}><Form.Control value={s.jvm} onChange={(e) => set('jvm', e.target.value)} /></Field>
      </Group>
      <Group title={tr(lang, 'curseforge')} desc={tr(lang, 'curseHelp')} aside={<span className={`sum-chip ${curseForgeConfigured ? 'on' : ''}`}>{curseForgeConfigured ? tr(lang, 'configured') : tr(lang, 'notConfigured')}</span>}>
        <Field label={tr(lang, 'apiKey')}>
          <Form.Control type="password" autoComplete="new-password" value={curseForgeKey} onChange={(e) => setCurseForgeKey(e.target.value)} placeholder={curseForgeConfigured ? tr(lang, 'keySet') : tr(lang, 'keyEmpty')} />
        </Field>
        <div className="sf-row"><Button size="sm" disabled={keyBusy || curseForgeKey.length === 0} onClick={() => void saveKey()}>{keyBusy ? tr(lang, 'saving') : tr(lang, 'saveKey')}</Button><Button size="sm" variant="outline-danger" disabled={keyBusy || !curseForgeConfigured} onClick={() => void clearKey()}>{tr(lang, 'remove')}</Button></div>
      </Group>
      <Group wide title={tr(lang, 'about')} aside={<Button variant="outline-light" size="sm" onClick={() => { setS({ ...DEFAULT_SETTINGS, dir: s.dir, lang: s.lang, java: s.java, javaRuntime: s.javaRuntime, autoUpdate: s.autoUpdate }); c.notify(tr(lang, 'restored'), 'info') }}>{tr(lang, 'restore')}</Button>}>
        <div><div className="sf-hint">{tr(lang, 'version')}</div><strong>Amagiri Launcher {c.version || 'dev'}</strong><div className="sf-hint mt-1">{tr(lang, 'updateHelp')}</div></div>
      </Group>
    </SettingsGrid>
    <SaveBar dirty={dirty} disabled={bad} onSave={save} onDiscard={() => setS(c.settings)} saveLabel={tr(lang, 'saveSettings')} savedLabel={tr(lang, 'allSaved')} unsavedLabel={tr(lang, 'unsaved')} discardLabel={tr(lang, 'discard')} />
  </>
}
