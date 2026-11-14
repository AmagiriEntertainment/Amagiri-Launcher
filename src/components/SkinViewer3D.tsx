import { useEffect, useRef } from 'react'
import * as skinview3d from 'skinview3d'

export type SkinAnimation = 'idle' | 'walk' | 'run' | 'wave' | 'crouch' | 'fly' | 'none'

type Props = {
  skin: string
  cape?: string
  model: 'Classic' | 'Slim'
  animation: SkinAnimation
  autoRotate?: boolean
}

/** A real Three.js Minecraft player renderer (UV mapping, layers, pivots and animation are handled by skinview3d). */
export default function SkinViewer3D({ skin, cape, model, animation, autoRotate = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewerRef = useRef<skinview3d.SkinViewer | null>(null)

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return

    const viewer = new skinview3d.SkinViewer({
      canvas,
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      background: 0x17151d,
      fov: 38,
      zoom: 0.82,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      enableControls: true,
      model: model === 'Slim' ? 'slim' : 'default'
    })
    viewer.controls.enableRotate = true
    viewer.controls.enableZoom = true
    viewer.controls.enablePan = false
    viewer.autoRotate = autoRotate
    viewer.autoRotateSpeed = 0.65
    viewer.cameraLight.intensity = 0.75
    viewer.globalLight.intensity = 2.2
    viewerRef.current = viewer

    const resize = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) {
        viewer.width = Math.round(rect.width)
        viewer.height = Math.round(rect.height)
      }
    })
    resize.observe(host)

    return () => {
      resize.disconnect()
      viewer.dispose()
      if (viewerRef.current === viewer) viewerRef.current = null
    }
    // Create one WebGL renderer per mounted canvas. Other properties are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    viewer.loadSkin(skin, { model: model === 'Slim' ? 'slim' : 'default' }).catch(error => {
      console.error('Unable to render Minecraft skin:', error)
    })
  }, [skin, model])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    if (cape) viewer.loadCape(cape).catch(error => console.error('Unable to render Minecraft cape:', error))
    else viewer.loadCape(null)
  }, [cape])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const animations = {
      idle: () => new skinview3d.IdleAnimation(),
      walk: () => new skinview3d.WalkingAnimation(),
      run: () => new skinview3d.RunningAnimation(),
      wave: () => new skinview3d.WaveAnimation(),
      crouch: () => new skinview3d.CrouchAnimation(),
      fly: () => new skinview3d.FlyingAnimation()
    }
    viewer.animation = animation === 'none' ? null : animations[animation]()
    if (viewer.animation) viewer.animation.speed = animation === 'walk' ? 1.25 : 1
  }, [animation])

  useEffect(() => {
    if (viewerRef.current) viewerRef.current.autoRotate = autoRotate
  }, [autoRotate])

  return <div ref={hostRef} className="skin-stage skin-stage-real" aria-label="Interactive 3D Minecraft skin preview">
    <canvas ref={canvasRef} className="skin-viewer-canvas" />
    <div className="skin-stage-hint">DRAG TO ROTATE · SCROLL TO ZOOM</div>
    <style>{`
      .skin-stage-real{height:460px;min-height:360px;position:relative;overflow:hidden;border-radius:14px;background:radial-gradient(ellipse at 50% 42%,#302a3a 0%,#1b1822 52%,#111016 100%);}
      .skin-viewer-canvas{display:block;width:100%;height:100%;outline:none;}
      .skin-stage-real .skin-stage-hint{position:absolute;bottom:14px;left:0;right:0;text-align:center;color:#aaa3b2;font-size:10px;letter-spacing:1.7px;font-weight:700;pointer-events:none;text-shadow:0 1px 5px #000;}
    `}</style>
  </div>
}
