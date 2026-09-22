import './style.css'

type Emotion = 'calm' | 'happy' | 'tense' | 'sad'
type SignalState = { energy: number; pitch: number; brightness: number }
type EmotionResult = { emotion: Emotion; confidence: number; explanation: string }

const meta: Record<Emotion, { label: string; color: string; icon: string }> = {
  calm: { label: 'Calm', color: '#2f927f', icon: '◒' }, happy: { label: 'Happy', color: '#efaa4c', icon: '✦' },
  tense: { label: 'Tense', color: '#dd685e', icon: '⌁' }, sad: { label: 'Sad', color: '#6d7fc5', icon: '◓' },
}
const demoSignals: SignalState[] = [
  { energy: .31, pitch: .42, brightness: .36 }, { energy: .48, pitch: .7, brightness: .66 },
  { energy: .67, pitch: .83, brightness: .77 }, { energy: .38, pitch: .46, brightness: .41 }, { energy: .54, pitch: .61, brightness: .58 },
]
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<header class="topbar"><a class="brand" href="#top" aria-label="VoxSense home"><span class="brand-mark">⌁</span><span>VoxSense</span></a><div class="topbar-meta"><span class="status-dot"></span><span id="connection-status">Ready to listen</span><span class="divider"></span><span class="model-tag">AIML v1.0</span></div></header>
<main id="top"><section class="intro"><div><p class="eyebrow">VOICE INTELLIGENCE / LIVE SESSION</p><h1>Hear the feeling<br><em>between the words.</em></h1><p class="lede">A lightweight emotion lens for your voice. Speak naturally and see how tone, energy, and rhythm come together.</p></div><div class="session-pill"><span class="pulse-ring"></span><span>Private session</span><span class="pill-slash">/</span><span id="session-time">00:00</span></div></section>
<section class="analysis-grid" aria-label="Voice emotion analysis"><article class="panel listening-panel"><div class="panel-topline"><span>01 / INPUT</span><span id="input-state">STANDBY</span></div><div class="orb-wrap"><div class="orb-glow"></div><div class="orb" id="orb"><div class="orb-core"></div><div class="orb-line line-one"></div><div class="orb-line line-two"></div></div></div><div class="listen-copy"><h2 id="listen-title">Ready when you are</h2><p id="listen-helper">Your microphone stays in this browser. Nothing is recorded.</p></div><button class="primary-button" id="listen-button" type="button"><span class="button-icon">◉</span><span>Start listening</span></button><button class="text-button" id="demo-button" type="button">Try a sample voice <span>→</span></button></article>
<article class="panel result-panel"><div class="panel-topline"><span>02 / SIGNAL READING</span><span id="reading-state">AWAITING INPUT</span></div><div class="result-heading"><div><p class="micro-label">DOMINANT EMOTION</p><h2 id="emotion-label">—</h2></div><div class="emotion-symbol" id="emotion-symbol">?</div></div><div class="confidence-row"><span>Confidence</span><strong id="confidence-value">0%</strong></div><div class="confidence-track"><div id="confidence-bar"></div></div><p class="interpretation" id="interpretation">Start a session to see the AIML emotion pattern match.</p><div class="signal-list"><div class="signal-row"><div class="signal-name"><span class="signal-dot energy"></span><span>Energy</span></div><strong id="energy-value">—</strong><div class="signal-track"><div id="energy-bar"></div></div></div><div class="signal-row"><div class="signal-name"><span class="signal-dot pitch"></span><span>Pitch</span></div><strong id="pitch-value">—</strong><div class="signal-track"><div id="pitch-bar"></div></div></div><div class="signal-row"><div class="signal-name"><span class="signal-dot brightness"></span><span>Brightness</span></div><strong id="brightness-value">—</strong><div class="signal-track"><div id="brightness-bar"></div></div></div></div><div class="rule-match"><span class="match-icon">✣</span><span id="rule-match-text">AIML rules will appear here after a reading</span></div></article></section>
<section class="lower-grid"><article class="panel timeline-panel"><div class="panel-topline"><span>03 / EMOTION TIMELINE</span><span>LAST 60 SEC</span></div><div class="timeline-chart" id="timeline-chart"><div class="chart-baseline"></div><div class="chart-empty">Your emotional contour will build as you speak</div></div><div class="timeline-labels"><span>Now</span><span>30s</span><span>60s</span></div></article><article class="panel rules-panel"><div class="panel-topline"><span>04 / HOW IT READS</span><span>RULE-BASED</span></div><h2>Prosody in, <em>patterns out.</em></h2><p>VoxSense maps vocal signals to human-readable emotion patterns. It listens for shape, not words.</p><div class="rule-chips"><span>energy</span><span>pitch</span><span>rhythm</span><span>brightness</span></div></article></section></main><footer><span>VOXSENSE / A SMALL, PRIVATE LISTENING TOOL</span><span>Audio is processed locally in your browser</span></footer>`

let audioContext: AudioContext | undefined
let analyser: AnalyserNode | undefined
let animationFrame = 0
let mediaStream: MediaStream | undefined
let listening = false
let demoIndex = 0
let startedAt = 0
let timer: number | undefined
let history: EmotionResult[] = []
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!

function inferEmotion({ energy, pitch, brightness }: SignalState): EmotionResult {
  const scores: Record<Emotion, number> = {
    calm: (1 - energy) * .45 + (1 - brightness) * .3 + (1 - pitch) * .25,
    happy: energy * .32 + pitch * .38 + brightness * .3,
    tense: energy * .42 + brightness * .32 + pitch * .26,
    sad: (1 - energy) * .42 + pitch * .18 + (1 - brightness) * .4,
  }
  const emotion = (Object.keys(scores) as Emotion[]).sort((a, b) => scores[b] - scores[a])[0]
  const explanations: Record<Emotion, string> = {
    calm: 'Low energy and a softer spectral profile match a steady, grounded delivery.',
    happy: 'Lifted pitch with bright, energetic articulation suggests a positive lift.',
    tense: 'Higher energy and sharp brightness point to a focused, activated tone.',
    sad: 'Lower energy and a muted vocal texture create a more subdued contour.',
  }
  return { emotion, confidence: Math.min(.96, Math.max(.45, .48 + scores[emotion] * .5)), explanation: explanations[emotion] }
}
function renderTimeline() {
  const chart = $('#timeline-chart'); chart.querySelectorAll('.timeline-point').forEach((point) => point.remove())
  history.forEach((item, index) => { const point = document.createElement('span'); point.className = 'timeline-point'; point.style.left = `${8 + (index / Math.max(1, history.length - 1)) * 84}%`; point.style.bottom = `${18 + ['sad', 'calm', 'tense', 'happy'].indexOf(item.emotion) * 17}%`; point.style.backgroundColor = meta[item.emotion].color; point.title = meta[item.emotion].label; chart.appendChild(point) })
  chart.querySelector('.chart-empty')?.classList.toggle('hidden', history.length > 0)
}
function updateReading(signals: SignalState, source = 'LIVE') {
  const result = inferEmotion(signals); const emotion = meta[result.emotion]
  $('#emotion-label').textContent = emotion.label; $('#emotion-label').style.color = emotion.color; $('#emotion-symbol').textContent = emotion.icon; $('#emotion-symbol').style.color = emotion.color
  $('#confidence-value').textContent = `${Math.round(result.confidence * 100)}%`; $('#confidence-bar').style.width = `${result.confidence * 100}%`; $('#confidence-bar').style.backgroundColor = emotion.color; $('#interpretation').textContent = result.explanation; $('#reading-state').textContent = source; $('#rule-match-text').textContent = `AIML pattern matched: ${emotion.label.toUpperCase()}_PROSODY`
  ;(['energy', 'pitch', 'brightness'] as const).forEach((key) => { $(`#${key}-value`).textContent = `${Math.round(signals[key] * 100)}%`; $(`#${key}-bar`).style.width = `${signals[key] * 100}%` })
  history.push(result); if (history.length > 18) history.shift(); renderTimeline()
}
function readMicrophone() {
  if (!analyser || !listening) return
  const waveform = new Uint8Array(analyser.fftSize); const spectrum = new Uint8Array(analyser.frequencyBinCount); analyser.getByteTimeDomainData(waveform); analyser.getByteFrequencyData(spectrum)
  let energy = 0; let crossings = 0
  for (let index = 1; index < waveform.length; index += 1) { const previous = waveform[index - 1] - 128; const current = waveform[index] - 128; energy += current * current; if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) crossings += 1 }
  const totalSpectrum = spectrum.reduce((sum, value) => sum + value, 0) || 1; const weightedSpectrum = spectrum.reduce((sum, value, index) => sum + value * index, 0)
  updateReading({ energy: Math.min(1, Math.sqrt(energy / waveform.length) / 36), pitch: Math.min(1, crossings / 75), brightness: Math.min(1, weightedSpectrum / totalSpectrum / (spectrum.length * .64)) }); animationFrame = requestAnimationFrame(readMicrophone)
}
function setListeningState(value: boolean) {
  listening = value; $('#listen-button').innerHTML = value ? '<span class="button-icon">■</span><span>Stop listening</span>' : '<span class="button-icon">◉</span><span>Start listening</span>'; $('#input-state').textContent = value ? 'LISTENING' : 'STANDBY'; $('#connection-status').textContent = value ? 'Microphone active' : 'Ready to listen'; $('#listen-title').textContent = value ? 'Listening to you' : 'Ready when you are'; $('#listen-helper').textContent = value ? 'Reading vocal texture in real time.' : 'Your microphone stays in this browser. Nothing is recorded.'; $('#orb').classList.toggle('active', value)
}
async function toggleListening() {
  if (listening) { setListeningState(false); cancelAnimationFrame(animationFrame); mediaStream?.getTracks().forEach((track) => track.stop()); return }
  try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); audioContext = new AudioContext(); analyser = audioContext.createAnalyser(); analyser.fftSize = 2048; audioContext.createMediaStreamSource(mediaStream).connect(analyser); setListeningState(true); readMicrophone() } catch { $('#listen-helper').textContent = 'Microphone permission was unavailable. Try the sample voice instead.'; $('#connection-status').textContent = 'Microphone unavailable' }
}
function playDemo() { const signals = demoSignals[demoIndex % demoSignals.length]; demoIndex += 1; setListeningState(false); $('#input-state').textContent = 'SAMPLE'; $('#connection-status').textContent = 'Playing sample reading'; $('#listen-title').textContent = 'Sample voice reading'; $('#listen-helper').textContent = 'Synthetic prosody sample processed through the same AIML rules.'; updateReading(signals, 'SAMPLE') }
function updateTimer() { const elapsed = Math.floor((Date.now() - startedAt) / 1000); $('#session-time').textContent = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` }
$('#listen-button').addEventListener('click', toggleListening); $('#demo-button').addEventListener('click', playDemo); startedAt = Date.now(); timer = window.setInterval(updateTimer, 1000); window.addEventListener('beforeunload', () => { clearInterval(timer); mediaStream?.getTracks().forEach((track) => track.stop()) })
