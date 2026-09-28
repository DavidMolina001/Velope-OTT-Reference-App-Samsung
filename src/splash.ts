// The DMP splash: a DOM overlay above the canvas (CSS animations and Web Audio, neither of
// which the WebGL scene can do) shown from boot until Home's first rows are ready. The chime is
// synthesised, so there is no audio file to ship: a tick as the ring pulses, one rising note as
// each letter lands, a soft shimmer under the tagline.
//
// Timeline (ms): ring 50, D 350, M 500, P 650, bar 1100, tagline 1450, dots 2000. The overlay
// stays at least MIN_VISIBLE so the animation always completes, and fades once the app is ready.

const MIN_VISIBLE = 2800
const FADE = 450

const CSS = `
@font-face{font-family:SplashRaleway;src:url(fonts/Raleway-ExtraBold.ttf)}
@font-face{font-family:SplashLato;src:url(fonts/Lato-Regular.ttf)}
#splash{position:fixed;inset:0;z-index:40;background:#0b0e17;overflow:hidden;transition:opacity ${FADE}ms ease}
#splash .ring{position:absolute;left:50%;top:44%;width:30vw;height:30vw;border-radius:50%;border:4px solid #8b6cff;transform:translate(-50%,-50%) scale(.2);opacity:0;animation:sp-ring 1s .05s ease-out forwards}
#splash .word{position:absolute;left:0;right:0;top:30%;text-align:center;font-family:SplashRaleway,sans-serif;font-weight:800;font-size:13vw;letter-spacing:.06em;color:#f2f5ff;line-height:1}
#splash .word span{display:inline-block;opacity:0;transform:translateY(40px);animation:sp-drop .55s cubic-bezier(.3,1.4,.5,1) forwards}
#splash .word span:nth-child(1){animation-delay:.35s}#splash .word span:nth-child(2){animation-delay:.5s}#splash .word span:nth-child(3){animation-delay:.65s;color:#8b6cff}
#splash .bar{position:absolute;left:50%;top:57%;height:6px;width:0;background:#8b6cff;border-radius:3px;transform:translateX(-50%);animation:sp-bar .45s 1.1s ease-out forwards}
#splash .tag{position:absolute;left:0;right:0;top:63%;text-align:center;font-family:SplashLato,sans-serif;font-size:2.4vw;letter-spacing:.3em;color:#c7cee0;opacity:0;transform:translateY(12px);animation:sp-tag .5s 1.45s ease-out forwards}
#splash .dots{position:absolute;left:0;right:0;bottom:12%;display:flex;justify-content:center;gap:14px;opacity:0;animation:sp-fade .3s 2s forwards}
#splash .dots i{width:12px;height:12px;border-radius:50%;background:#8a93ad;display:block;animation:sp-pulse 1.2s 2s infinite}
#splash .dots i:nth-child(2){animation-delay:2.2s}#splash .dots i:nth-child(3){animation-delay:2.4s}
@keyframes sp-ring{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}30%{opacity:.9}100%{opacity:0;transform:translate(-50%,-50%) scale(1.6)}}
@keyframes sp-drop{to{opacity:1;transform:translateY(0)}}
@keyframes sp-bar{to{width:34vw}}
@keyframes sp-tag{to{opacity:1;transform:translateY(0)}}
@keyframes sp-fade{to{opacity:1}}
@keyframes sp-pulse{0%,100%{background:#8a93ad}40%{background:#8b6cff}}
`

const HTML = `
<div class="ring"></div>
<div class="word"><span>D</span><span>M</span><span>P</span></div>
<div class="bar"></div>
<div class="tag">A DAVID MOLINA PRODUCTION</div>
<div class="dots"><i></i><i></i><i></i></div>`

type Ctx = AudioContext

function tone(ctx: Ctx, freq: number, at: number, duration: number, volume: number): void {
  const osc = ctx.createOscillator()
  const overtone = ctx.createOscillator()
  const gain = ctx.createGain()
  const overtoneGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  overtone.type = 'sine'
  overtone.frequency.value = freq * 2
  overtoneGain.gain.value = 0.18
  osc.connect(gain)
  overtone.connect(overtoneGain)
  overtoneGain.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(volume, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0008, at + duration)
  osc.start(at)
  overtone.start(at)
  osc.stop(at + duration + 0.05)
  overtone.stop(at + duration + 0.05)
}

function tick(ctx: Ctx, at: number): void {
  const length = Math.floor(ctx.sampleRate * 0.04)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  source.buffer = buffer
  filter.type = 'bandpass'
  filter.frequency.value = 2400
  filter.Q.value = 1.2
  gain.gain.value = 0.22
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ctx.destination)
  source.start(at)
}

function chime(): void {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) {
    console.warn('SPLASH no Web Audio')
    return
  }
  const ctx = new Ctor()
  const play = () => {
    const t = ctx.currentTime + 0.05
    tick(ctx, t + 0.05)
    tone(ctx, 523.25, t + 0.75, 0.5, 0.5) // C5, D lands
    tone(ctx, 659.25, t + 0.9, 0.5, 0.5) // E5, M lands
    tone(ctx, 783.99, t + 1.05, 0.7, 0.55) // G5, P lands
    tone(ctx, 1046.5, t + 1.5, 1.4, 0.22) // C6 + G6 shimmer under the tagline
    tone(ctx, 1567.98, t + 1.56, 1.6, 0.12)
    console.log(`SPLASH chime state=${ctx.state}`)
    setTimeout(() => void ctx.close(), 4000)
  }
  // A TV app may start with the context suspended; resume() needs no gesture there.
  if (ctx.state === 'suspended') void ctx.resume().then(play, () => console.warn('SPLASH audio blocked'))
  else play()
}

export interface Splash {
  /** The app has content to show: the splash fades once its animation has completed. */
  ready(): void
}

export function showSplash(): Splash {
  const shownAt = performance.now()
  const style = document.createElement('style')
  style.textContent = CSS
  const root = document.createElement('div')
  root.id = 'splash'
  root.innerHTML = HTML
  document.head.appendChild(style)
  document.body.appendChild(root)
  console.log('SPLASH shown')
  // Samsung's video splash screen (tizen/config.xml, ready_when="custom") stays up until the app
  // says so: hand over on the first painted frame, which is this overlay's opening state.
  requestAnimationFrame(() => {
    const screen = window.screen as Screen & { show?: () => void }
    if (typeof screen.show === 'function') {
      screen.show()
      console.log('SPLASH system splash dismissed')
    }
  })
  chime()
  let done = false
  return {
    ready() {
      if (done) return
      done = true
      const wait = Math.max(0, MIN_VISIBLE - (performance.now() - shownAt))
      setTimeout(() => {
        root.style.opacity = '0'
        setTimeout(() => {
          root.remove()
          style.remove()
          console.log('SPLASH hidden')
        }, FADE)
      }, wait)
    },
  }
}
