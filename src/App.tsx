import { useState, useEffect, useRef, useCallback } from "react";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const isBlack = (midi) => [1,3,6,8,10].includes(midi%12);
const noteName = (midi) => NOTE_NAMES[midi%12] + Math.floor(midi/12-1);
const noteNameShort = (midi) => NOTE_NAMES[midi%12];
const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ── Audio engine ──────────────────────────────────────────────────────────────
function createAudioEngine() {
  let ctx = null;
  const activeNodes = {};
  const sustainTimeouts = {};
  const MAX_SUSTAIN_MS = 1500;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function playNote(midi, velocity = 100) {
    stopNote(midi);
    const c = getCtx();
    const freq = midiToFreq(midi);
    const gain = c.createGain();
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const osc3 = c.createOscillator();
    osc1.type = "triangle"; osc1.frequency.value = freq;
    osc2.type = "sine";     osc2.frequency.value = freq * 2;
    osc3.type = "sine";     osc3.frequency.value = freq * 4;
    const g1 = c.createGain(); g1.gain.value = 0.6;
    const g2 = c.createGain(); g2.gain.value = 0.25;
    const g3 = c.createGain(); g3.gain.value = 0.08;
    osc1.connect(g1); g1.connect(gain);
    osc2.connect(g2); g2.connect(gain);
    osc3.connect(g3); g3.connect(gain);
    const vol = (velocity / 127) * 0.4;
    const now = c.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(vol * 0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(vol * 0.25, now + 0.3);
    gain.connect(c.destination);
    osc1.start(now); osc2.start(now); osc3.start(now);
    activeNodes[midi] = { gain, oscs: [osc1, osc2, osc3], ctx: c };
    sustainTimeouts[midi] = setTimeout(() => stopNote(midi), MAX_SUSTAIN_MS);
  }

  function stopNote(midi) {
    if (sustainTimeouts[midi]) { clearTimeout(sustainTimeouts[midi]); delete sustainTimeouts[midi]; }
    const node = activeNodes[midi];
    if (!node) return;
    const { gain, oscs, ctx: c } = node;
    const now = c.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch(e){} }); }, 500);
    delete activeNodes[midi];
  }

  return { playNote, stopNote };
}

// ── Lessons ───────────────────────────────────────────────────────────────────
const LESSONS = [
  {
    id: "freeplay", title: "Free Play", icon: "🎸", freePlay: true,
    description: "Explore the keyboard freely! Press any key to hear its sound. Get comfortable with the layout before starting lessons.",
    exercise: null,
  },
  {
    id: 0, title: "Meet Middle C", icon: "🎯",
    description: "Middle C (C4) is the anchor of the piano. It sits right in the middle at MIDI note 60. Find it and press it!",
    exercise: { type: "single", prompt: "Find and press Middle C", targets: [60], hint: "The C closest to the center of your keyboard" },
  },
  {
    id: 1, title: "C to G — Five Fingers", icon: "👆",
    description: "The white keys from C to G spell C–D–E–F–G. Play them one by one using fingers 1–2–3–4–5.",
    exercise: { type: "sequence", prompt: "Play C – D – E – F – G in order", targets: [60,62,64,65,67], fingerLabels: ["1","2","3","4","5"], hint: "Use your right hand, thumb on C" },
  },
  {
    id: 2, title: "Come Back Down", icon: "🔄",
    description: "Play those same five notes in reverse — G back to C.",
    exercise: { type: "sequence", prompt: "Play G – F – E – D – C", targets: [67,65,64,62,60], fingerLabels: ["5","4","3","2","1"], hint: "Start on G with finger 5" },
  },
  {
    id: 3, title: "C Major Scale", icon: "🎼",
    description: "The C major scale: C–D–E–F–G–A–B–C. The thumb tucks under after E to reach F!",
    exercise: { type: "sequence", prompt: "Play C D E F G A B C", targets: [60,62,64,65,67,69,71,72], fingerLabels: ["1","2","3","1","2","3","4","5"], hint: "Thumb crosses under after finger 3 on E" },
  },
  {
    id: 4, title: "C Major Chord", icon: "🎵",
    description: "A chord is multiple notes played together. C major uses C–E–G. Place fingers 1, 3, and 5 on those keys.",
    exercise: { type: "chord", prompt: "Play C + E + G together", targets: [60,64,67], hint: "Fingers 1 (C), 3 (E), 5 (G) — all at once" },
  },
  {
    id: 5, title: "G Major Chord", icon: "🎵",
    description: "G major uses G–B–D. Shift your hand up to G and use the same 1–3–5 fingering.",
    exercise: { type: "chord", prompt: "Play G + B + D together", targets: [67,71,74], hint: "Fingers 1 (G), 3 (B), 5 (D)" },
  },
  {
    id: 6, title: "Mary Had a Little Lamb", icon: "🐑",
    description: "Your first melody! Uses only E–D–C–D–E–E–E. Take it one note at a time.",
    exercise: { type: "sequence", prompt: "E – D – C – D – E – E – E", targets: [64,62,60,62,64,64,64], hint: "All in the C4 octave — no stretches needed!" },
  },
  {
    id: 7, title: "D Minor Chord", icon: "🎵",
    description: "D minor (Dm) has a sadder, moodier feel than major chords. It uses D–F–A.",
    exercise: { type: "chord", prompt: "Play D + F + A together", targets: [62,65,69], hint: "Fingers 1 (D), 2 (F), 3 (A) — a compact shape" },
  },
  {
    id: 8, title: "Dm → C Progression", icon: "🔗",
    description: "Now let's connect two chords! Play Dm, then move your hand to play C major.",
    exercise: {
      type: "chordsequence",
      prompt: "Play Dm, then C major",
      chords: [
        { label: "Dm", targets: [62,65,69] },
        { label: "C",  targets: [60,64,67] },
      ],
      hint: "Take your time between chords — smooth transitions come with practice",
    },
  },
  {
    id: 9, title: "Dm → C → G Progression", icon: "🎶",
    description: "The full progression from the MIDI file — Dm, C, G. It's the backbone of countless songs.",
    exercise: {
      type: "chordsequence",
      prompt: "Play Dm → C → G in sequence",
      chords: [
        { label: "Dm", targets: [62,65,69] },
        { label: "C",  targets: [60,64,67] },
        { label: "G",  targets: [67,71,74] },
      ],
      hint: "You already know all three chords — now chain them together!",
    },
  },
  {
    id: 10, title: "A Minor Chord", icon: "🎵",
    description: "A minor (Am) is one of the most expressive chords in music. It uses A–C–E. Place fingers 1 (A), 2 (C), and 3 (E).",
    exercise: { type: "chord", prompt: "Play A + C + E together", targets: [57,60,64], hint: "Fingers 1 (A), 2 (C), 3 (E) — shift your hand down to A" },
  },
  {
    id: 11, title: "F Major Chord", icon: "🎵",
    description: "F major uses F–A–C. It rounds out one of the most popular chord families in pop music alongside C, G, and Am.",
    exercise: { type: "chord", prompt: "Play F + A + C together", targets: [53,57,60], hint: "Fingers 1 (F), 2 (A), 3 (C) — shift your hand down to F" },
  },
  {
    id: 12, title: "Play Along: The Scientist", icon: "🎤",
    description: "Based on the chord progression from 'The Scientist' by Coldplay — slow, beautiful, and perfect for beginners. Four chords repeating: C, G, Am, F. Hit Start and play each chord when it lights up!",
    exercise: {
      type: "playalong",
      bpm: 36,
      beatsPerChord: 4,
      chords: [
        { label:"C",  targets:[60,64,67] }, { label:"G",  targets:[67,71,74] },
        { label:"Am", targets:[57,60,64] }, { label:"F",  targets:[53,57,60] },
        { label:"C",  targets:[60,64,67] }, { label:"G",  targets:[67,71,74] },
        { label:"Am", targets:[57,60,64] }, { label:"F",  targets:[53,57,60] },
        { label:"C",  targets:[60,64,67] }, { label:"G",  targets:[67,71,74] },
        { label:"Am", targets:[57,60,64] }, { label:"F",  targets:[53,57,60] },
        { label:"C",  targets:[60,64,67] }, { label:"G",  targets:[67,71,74] },
        { label:"Am", targets:[57,60,64] }, { label:"F",  targets:[53,57,60] },
      ],
      hint: "Each chord lasts 4 beats. Don't worry about mistakes — just keep playing!",
    },
  },
  ,{
    id: 13, title: "Play Along: Sinnerman", icon: "🔥",
    description: "'Sinnerman' by Nina Simone — dark, driving, and irresistible. It's mostly Am and Dm rocking back and forth with the occasional Em. Start slow and feel that relentless pulse.",
    exercise: {
      type: "playalong",
      bpm: 40,
      beatsPerChord: 4,
      chords: [
        { label:"Am", targets:[57,60,64] }, { label:"Am", targets:[57,60,64] },
        { label:"Dm", targets:[62,65,69] }, { label:"Am", targets:[57,60,64] },
        { label:"Am", targets:[57,60,64] }, { label:"Am", targets:[57,60,64] },
        { label:"Dm", targets:[62,65,69] }, { label:"Am", targets:[57,60,64] },
        { label:"Am", targets:[57,60,64] }, { label:"Dm", targets:[62,65,69] },
        { label:"Dm", targets:[62,65,69] }, { label:"Am", targets:[57,60,64] },
        { label:"Em", targets:[64,67,71] }, { label:"Dm", targets:[62,65,69] },
        { label:"Am", targets:[57,60,64] }, { label:"Am", targets:[57,60,64] },
        { label:"Am", targets:[57,60,64] }, { label:"Am", targets:[57,60,64] },
        { label:"Dm", targets:[62,65,69] }, { label:"Am", targets:[57,60,64] },
        { label:"Am", targets:[57,60,64] }, { label:"Am", targets:[57,60,64] },
        { label:"Dm", targets:[62,65,69] }, { label:"Am", targets:[57,60,64] },
      ],
      hint: "Feel the pulse! Am and Dm alternate — let the dark mood carry you.",
    },
  },
];

// ── Piano key layout ──────────────────────────────────────────────────────────
const START = 48, END = 84;
function buildKeys() {
  const W = [], B = []; let wi = 0;
  for (let m = START; m <= END; m++) {
    if (!isBlack(m)) { W.push({ midi: m, idx: wi }); wi++; }
    else B.push({ midi: m, wl: wi - 1 });
  }
  return { W, B, tw: wi };
}
const { W: whites, B: blacks, tw: totalW } = buildKeys();

function kColor(midi, pressed, targets, next, done, isFP, isPA) {
  if (isFP) return pressed.has(midi) ? "correct" : "none";
  if (isPA) {
    if (pressed.has(midi) && targets.has(midi)) return "correct";
    if (pressed.has(midi)) return "played";
    if (targets.has(midi)) return "target";
    return "none";
  }
  if (done.has(midi)) return "done";
  if (next === midi) return "next";
  if (pressed.has(midi) && targets.has(midi)) return "correct";
  if (pressed.has(midi)) return "wrong";
  if (targets.has(midi)) return "target";
  return "none";
}
const WC = { none:"#ffffff", target:"#bfdbfe", next:"#60a5fa", correct:"#86efac", wrong:"#fca5a5", done:"#bbf7d0", played:"#e9d5ff" };
const BC = { none:"#1f2937", target:"#1d4ed8", next:"#3b82f6", correct:"#16a34a", wrong:"#dc2626", done:"#15803d", played:"#7e22ce" };

// ── Play Along UI component ───────────────────────────────────────────────────
function PlayAlongUI({ ex, paPlaying, paFinished, paChordIdx, paBeat, paHit, paScore, onStart, onStop }) {
  // Derive unique chords from the exercise so any song works
  const seen = new Set();
  const uniqueChords = ex.chords.filter(ch => {
    if (seen.has(ch.label)) return false;
    seen.add(ch.label); return true;
  });
  const currentChord = ex.chords[paChordIdx];
  const pct = paPlaying ? (paBeat / ex.beatsPerChord) * 100 : 0;

  return (
    <div>
      {/* Chord reference cards */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
        {uniqueChords.map(ch => (
          <div key={ch.label} style={{ padding:"6px 12px", borderRadius:8, textAlign:"center", background:"#374151", border:"1px solid #4b5563" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#e5e7eb" }}>{ch.label}</div>
            <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{ch.targets.map(t => noteNameShort(t)).join("–")}</div>
          </div>
        ))}
      </div>

      {/* Active chord + beat display */}
      {paPlaying && currentChord && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"#6b7280" }}>Now playing:</span>
            <span style={{ fontSize:11, color:"#6b7280" }}>Chord {paChordIdx + 1} of {ex.chords.length}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{
              padding:"10px 20px", borderRadius:10, fontWeight:800, fontSize:22,
              textAlign:"center", minWidth:80,
              background: paHit === "hit" ? "#15803d" : paHit === "miss" ? "#7f1d1d" : "#4338ca",
              color:"#fff",
              border: `2px solid ${paHit === "hit" ? "#16a34a" : paHit === "miss" ? "#dc2626" : "#6366f1"}`,
              transition:"background 0.2s",
            }}>
              {currentChord.label}
              <div style={{ fontSize:11, fontWeight:400, color:"#c7d2fe", marginTop:2 }}>
                {currentChord.targets.map(t => noteNameShort(t)).join("–")}
              </div>
            </div>
            {/* Beat dots */}
            <div style={{ display:"flex", gap:6 }}>
              {Array.from({ length: ex.beatsPerChord }).map((_, i) => (
                <div key={i} style={{
                  width:12, height:12, borderRadius:"50%", transition:"background 0.1s",
                  background: i < paBeat ? "#6366f1" : i === paBeat ? "#a5b4fc" : "#374151",
                }} />
              ))}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop:8, height:4, background:"#374151", borderRadius:2 }}>
            <div style={{ height:"100%", width:`${pct}%`, background:"#6366f1", borderRadius:2, transition:"width 0.1s linear" }} />
          </div>
        </div>
      )}

      {/* Score */}
      {(paPlaying || paFinished) && (
        <div style={{ display:"flex", gap:12, marginBottom:10 }}>
          <div style={{ padding:"4px 12px", borderRadius:7, background:"#14532d", color:"#86efac", fontSize:12, fontWeight:700 }}>✅ {paScore.hit} hit</div>
          <div style={{ padding:"4px 12px", borderRadius:7, background:"#7f1d1d", color:"#fca5a5", fontSize:12, fontWeight:700 }}>❌ {paScore.miss} missed</div>
        </div>
      )}

      {/* Finished banner */}
      {paFinished && (
        <div style={{ padding:"12px", borderRadius:10, background:"#1e1b4b", border:"1px solid #4338ca", textAlign:"center", marginBottom:10 }}>
          <div style={{ fontSize:20, marginBottom:4 }}>🎉</div>
          <div style={{ fontWeight:700, fontSize:15, color:"#a5b4fc" }}>Song complete!</div>
          <div style={{ fontSize:13, color:"#6b7280", marginTop:4 }}>
            {paScore.hit} / {ex.chords.length} chords — {Math.round((paScore.hit / ex.chords.length) * 100)}%
          </div>
        </div>
      )}

      {/* Start / Stop */}
      <div style={{ display:"flex", gap:8 }}>
        {!paPlaying ? (
          <button onClick={onStart} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", cursor:"pointer", background:"#16a34a", color:"#fff", fontSize:14, fontWeight:700 }}>
            {paFinished ? "▶ Play Again" : "▶ Start"}
          </button>
        ) : (
          <button onClick={onStop} style={{ flex:1, padding:"10px", borderRadius:9, border:"none", cursor:"pointer", background:"#7f1d1d", color:"#fca5a5", fontSize:14, fontWeight:700 }}>
            ■ Stop
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function PianoTutor() {
  const [midiDev, setMidiDev] = useState(null);
  const [err, setErr] = useState(null);
  const [pressed, setPressed] = useState(new Set());
  const [li, setLi] = useState(0);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(new Set());
  const [fb, setFb] = useState(null);
  const [ld, setLd] = useState(false);
  const [comp, setComp] = useState(new Set());
  const [lastNote, setLastNote] = useState(null);
  // Play-along state
  const [paPlaying, setPaPlaying]   = useState(false);
  const [paBeat, setPaBeat]         = useState(0);
  const [paChordIdx, setPaChordIdx] = useState(0);
  const [paHit, setPaHit]           = useState(null);
  const [paScore, setPaScore]       = useState({ hit: 0, miss: 0 });
  const [paFinished, setPaFinished] = useState(false);
  const paTimerRef = useRef(null);
  const paHitRef   = useRef(false);
  const sr         = useRef({});
  const audioRef   = useRef(null);

  function getAudio() {
    if (!audioRef.current) audioRef.current = createAudioEngine();
    return audioRef.current;
  }

  const lesson = LESSONS[li];
  const isFP   = !!lesson.freePlay;
  const ex     = lesson.exercise;

  let targets = new Set();
  let nextKey = null;
  if (ex) {
    if (ex.type === "sequence")           { targets = new Set([ex.targets[step]]); nextKey = ex.targets[step]; }
    else if (ex.type === "chord")          targets = new Set(ex.targets);
    else if (ex.type === "chordsequence")  targets = new Set(ex.chords[step]?.targets || []);
    else if (ex.type === "single")         targets = new Set(ex.targets);
    else if (ex.type === "playalong")      targets = paPlaying ? new Set(ex.chords[paChordIdx]?.targets || []) : new Set();
  }

  sr.current = { li, step, ld, done, ex, isFP, paPlaying, paChordIdx, paHitRef };

  // MIDI setup
  useEffect(() => {
    if (!navigator.requestMIDIAccess) { setErr("Web MIDI not supported — use Chrome or Edge."); return; }
    navigator.requestMIDIAccess().then(acc => {
      const connect = () => {
        const ins = [...acc.inputs.values()];
        setMidiDev(ins[0]?.name || null);
        ins.forEach(i => { i.onmidimessage = handleMidi; });
      };
      connect(); acc.onstatechange = connect;
    }).catch(() => setErr("MIDI access denied."));
  }, []);

  // Play-along timer
  useEffect(() => {
    if (!paPlaying) return;
    const curEx = LESSONS[li].exercise;
    if (!curEx || curEx.type !== "playalong") return;
    const msPerBeat = (60 / curEx.bpm) * 1000;
    let beat = 0;
    let chordIdx = 0;
    paHitRef.current = false;

    paTimerRef.current = setInterval(() => {
      beat++;
      if (beat >= curEx.beatsPerChord) {
        beat = 0;
        const wasHit = paHitRef.current;
        setPaScore(s => wasHit ? { ...s, hit: s.hit + 1 } : { ...s, miss: s.miss + 1 });
        setPaHit(wasHit ? "hit" : "miss");
        setTimeout(() => setPaHit(null), 400);
        paHitRef.current = false;
        chordIdx++;
        if (chordIdx >= curEx.chords.length) {
          clearInterval(paTimerRef.current);
          setPaPlaying(false);
          setPaFinished(true);
          setPaChordIdx(0);
          return;
        }
        setPaChordIdx(chordIdx);
      }
      setPaBeat(beat);
    }, msPerBeat);

    return () => clearInterval(paTimerRef.current);
  }, [paPlaying, li]);

  function startPlayAlong() {
    setPaPlaying(true); setPaBeat(0); setPaChordIdx(0);
    setPaScore({ hit: 0, miss: 0 }); setPaFinished(false); setPaHit(null);
    paHitRef.current = false;
  }
  function stopPlayAlong() {
    clearInterval(paTimerRef.current);
    setPaPlaying(false); setPaBeat(0); setPaChordIdx(0);
  }

  const handleMidi = useCallback((e) => {
    const [st, note, vel] = e.data;
    const on  = (st & 0xf0) === 0x90 && vel > 0;
    const off = (st & 0xf0) === 0x80 || ((st & 0xf0) === 0x90 && vel === 0);
    if (on)  { getAudio().playNote(note, vel); setPressed(p => new Set([...p, note])); setLastNote(note); doNote(note); }
    if (off) { getAudio().stopNote(note); setPressed(p => { const s = new Set(p); s.delete(note); return s; }); }
  }, []);

  function doNote(note) {
    const { ld, ex, step, done, isFP, paPlaying, paChordIdx, paHitRef } = sr.current;
    if (isFP || ld || !ex) return;

    if (ex.type === "single") {
      if (note === ex.targets[0]) { setDone(new Set(ex.targets)); flash("✅ Perfect!", "success"); setTimeout(win, 700); }
      else flash(`❌ That's ${noteName(note)} — try again!`, "error");

    } else if (ex.type === "sequence") {
      if (note === ex.targets[step]) {
        const nd = new Set(done); nd.add(note); setDone(nd);
        const ns = step + 1;
        if (ns >= ex.targets.length) { flash("🎉 Sequence complete!", "success"); setTimeout(win, 700); }
        else { setStep(ns); flash(`✅ ${noteNameShort(note)}`, "success"); setTimeout(() => setFb(null), 600); }
      } else {
        flash(`❌ Expected ${noteNameShort(ex.targets[step])}, got ${noteNameShort(note)}`, "error");
        setTimeout(() => setFb(null), 1200);
      }

    } else if (ex.type === "chord") {
      setTimeout(() => {
        setPressed(cur => {
          if (ex.targets.every(t => cur.has(t))) { setDone(new Set(ex.targets)); flash("🎉 Perfect chord!", "success"); setTimeout(win, 700); }
          return cur;
        });
      }, 80);

    } else if (ex.type === "chordsequence") {
      setTimeout(() => {
        setPressed(cur => {
          const currentChord = ex.chords[step];
          if (currentChord.targets.every(t => cur.has(t))) {
            const nd = new Set(done);
            currentChord.targets.forEach(t => nd.add(t));
            setDone(nd);
            const ns = step + 1;
            if (ns >= ex.chords.length) { flash("🎉 Progression complete!", "success"); setTimeout(win, 700); }
            else { setStep(ns); flash(`✅ ${currentChord.label}! Now play ${ex.chords[ns].label}`, "success"); setTimeout(() => setFb(null), 1000); }
          }
          return cur;
        });
      }, 80);

    } else if (ex.type === "playalong") {
      if (!paPlaying) return;
      setTimeout(() => {
        setPressed(cur => {
          const currentChord = ex.chords[paChordIdx];
          if (currentChord && currentChord.targets.every(t => cur.has(t))) {
            paHitRef.current = true;
          }
          return cur;
        });
      }, 60);
    }
  }

  function flash(msg, type) { setFb({ msg, type }); }
  function win() { setLd(true); setComp(p => new Set([...p, sr.current.li])); setFb({ msg: "🏆 Lesson Complete!", type: "complete" }); }
  function goL(i) {
    setLi(i); setStep(0); setDone(new Set()); setFb(null); setLd(false); setPressed(new Set());
    stopPlayAlong(); setPaFinished(false); setPaScore({ hit: 0, miss: 0 });
  }
  function clickKey(m) {
    getAudio().playNote(m, 90);
    setPressed(p => new Set([...p, m]));
    setLastNote(m);
    doNote(m);
    setTimeout(() => {
      getAudio().stopNote(m);
      setPressed(p => { const s = new Set(p); s.delete(m); return s; });
    }, 300);
  }

  const KW = 30, KH = 130, BW = 19, BH = 82;

  return (
    <div style={{ height:"100vh", background:"#030712", color:"#f9fafb", display:"flex", flexDirection:"column", fontFamily:"'Inter',sans-serif", overflow:"hidden" }}>

      {/* Header */}
      <div style={{ background:"#111827", borderBottom:"1px solid #1f2937", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:24 }}>🎹</span>
          <span style={{ fontSize:18, fontWeight:700 }}>Piano Tutor</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, padding:"5px 12px", borderRadius:20, background:midiDev?"#14532d":"#1f2937", color:midiDev?"#86efac":"#9ca3af" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:midiDev?"#4ade80":"#6b7280" }} />
          {midiDev || (err ? "No MIDI support" : "Click keys to play!")}
        </div>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

        {/* Sidebar */}
        <div style={{ width:200, background:"#111827", borderRight:"1px solid #1f2937", overflowY:"auto", padding:"10px 0", flexShrink:0 }}>
          <p style={{ fontSize:10, color:"#6b7280", padding:"0 14px 6px", letterSpacing:2, textTransform:"uppercase", margin:0 }}>Lessons</p>
          {LESSONS.map((l, i) => (
            <button key={i} onClick={() => goL(i)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"9px 14px", border:"none", cursor:"pointer", fontSize:12, textAlign:"left", background:li===i?"#4338ca":"transparent", color:li===i?"#fff":comp.has(l.id)?"#4ade80":"#d1d5db", transition:"background 0.15s" }}>
              <span>{comp.has(l.id) ? "✅" : l.icon}</span>
              <span style={{ lineHeight:1.3 }}>{l.title}</span>
            </button>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", padding:"16px", gap:12, overflowY:"auto" }}>

          {isFP ? (
            /* ── Free Play ── */
            <div style={{ width:"100%", maxWidth:640, background:"#111827", borderRadius:14, padding:20, border:"1px solid #1f2937" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:28 }}>{lesson.icon}</span>
                <div>
                  <p style={{ fontSize:10, color:"#818cf8", textTransform:"uppercase", letterSpacing:2, margin:0 }}>Mode</p>
                  <h2 style={{ fontSize:17, fontWeight:700, margin:"2px 0 0" }}>{lesson.title}</h2>
                </div>
              </div>
              <p style={{ color:"#9ca3af", fontSize:13, lineHeight:1.6, marginBottom:12 }}>{lesson.description}</p>
              <div style={{ background:"#1f2937", borderRadius:10, padding:16, display:"flex", alignItems:"center", justifyContent:"center", minHeight:72, flexDirection:"column", gap:4 }}>
                {lastNote ? (
                  <>
                    <span style={{ fontSize:38, fontWeight:800, color:"#a5b4fc" }}>{noteNameShort(lastNote)}</span>
                    <span style={{ fontSize:12, color:"#6b7280" }}>{noteName(lastNote)} · MIDI {lastNote} · {midiToFreq(lastNote).toFixed(1)} Hz</span>
                  </>
                ) : (
                  <span style={{ color:"#4b5563", fontSize:14 }}>Press any key to hear it 🎵</span>
                )}
              </div>
              {pressed.size > 0 && (
                <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:6 }}>
                  {[...pressed].sort((a,b)=>a-b).map(m => (
                    <div key={m} style={{ padding:"4px 10px", borderRadius:7, fontSize:12, fontWeight:700, background:"#16a34a", color:"#fff" }}>{noteNameShort(m)}</div>
                  ))}
                </div>
              )}
              <button onClick={() => goL(1)} style={{ marginTop:14, width:"100%", padding:"10px", borderRadius:10, border:"none", cursor:"pointer", background:"#4338ca", color:"#fff", fontSize:14, fontWeight:700 }}>
                Start Lessons →
              </button>
            </div>

          ) : (
            /* ── Lesson card ── */
            <div style={{ width:"100%", maxWidth:640, background:"#111827", borderRadius:14, padding:20, border:"1px solid #1f2937" }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:28 }}>{lesson.icon}</span>
                <div>
                  <p style={{ fontSize:10, color:"#818cf8", textTransform:"uppercase", letterSpacing:2, margin:0 }}>Lesson {li} of {LESSONS.length - 1}</p>
                  <h2 style={{ fontSize:17, fontWeight:700, margin:"2px 0 0" }}>{lesson.title}</h2>
                </div>
              </div>
              <p style={{ color:"#9ca3af", fontSize:13, lineHeight:1.6, marginBottom:12 }}>{lesson.description}</p>

              <div style={{ background:"#1f2937", borderRadius:10, padding:14 }}>
                <p style={{ color:"#a5b4fc", fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:1, margin:"0 0 4px" }}>🎯 Exercise</p>
                <p style={{ fontSize:14, fontWeight:600, margin:"0 0 8px" }}>{ex.prompt}</p>

                {/* Sequence */}
                {ex.type === "sequence" && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:8 }}>
                    {ex.targets.map((t, i) => (
                      <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"3px 8px", borderRadius:7, fontSize:11, fontWeight:700, background:done.has(t)?"#15803d":i===step?"#4338ca":"#374151", color:done.has(t)||i===step?"#fff":"#9ca3af", transform:i===step?"scale(1.1)":"scale(1)", border:`2px solid ${done.has(t)?"#16a34a":i===step?"#6366f1":"#4b5563"}` }}>
                        <span>{noteNameShort(t)}</span>
                        {ex.fingerLabels && <span style={{ fontSize:9, fontWeight:400, color:"#d1d5db" }}>{ex.fingerLabels[i]}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Chord */}
                {ex.type === "chord" && (
                  <div style={{ display:"flex", gap:7, marginBottom:8 }}>
                    {ex.targets.map(t => (
                      <div key={t} style={{ padding:"3px 12px", borderRadius:7, fontSize:13, fontWeight:700, background:pressed.has(t)||done.has(t)?"#15803d":"#374151", color:pressed.has(t)||done.has(t)?"#fff":"#9ca3af", border:`2px solid ${pressed.has(t)||done.has(t)?"#16a34a":"#4b5563"}` }}>
                        {noteNameShort(t)}
                      </div>
                    ))}
                  </div>
                )}

                {/* Chord sequence */}
                {ex.type === "chordsequence" && (
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8, flexWrap:"wrap" }}>
                    {ex.chords.map((chord, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ padding:"8px 16px", borderRadius:9, fontWeight:700, transition:"all 0.15s", background:i<step?"#15803d":i===step?"#4338ca":"#374151", color:"#fff", transform:i===step?"scale(1.08)":"scale(1)", border:`2px solid ${i<step?"#16a34a":i===step?"#6366f1":"#4b5563"}`, textAlign:"center", minWidth:56 }}>
                          <div style={{ fontSize:15 }}>{chord.label}</div>
                          <div style={{ display:"flex", gap:3, marginTop:3, justifyContent:"center" }}>
                            {chord.targets.map(t => (
                              <span key={t} style={{ fontSize:10, color:i===step?"#c7d2fe":"#9ca3af", fontWeight:400 }}>{noteNameShort(t)}</span>
                            ))}
                          </div>
                        </div>
                        {i < ex.chords.length - 1 && <span style={{ color:"#4b5563", fontSize:18 }}>→</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Play Along */}
                {ex.type === "playalong" && (
                  <PlayAlongUI
                    ex={ex}
                    paPlaying={paPlaying}
                    paFinished={paFinished}
                    paChordIdx={paChordIdx}
                    paBeat={paBeat}
                    paHit={paHit}
                    paScore={paScore}
                    onStart={startPlayAlong}
                    onStop={stopPlayAlong}
                  />
                )}

                <p style={{ color:"#6b7280", fontSize:11, margin:"8px 0 0" }}>💡 {ex.hint}</p>
              </div>

              {fb && (
                <div style={{ marginTop:10, padding:"10px 14px", borderRadius:10, textAlign:"center", fontWeight:600, fontSize:fb.type==="complete"?16:13, background:fb.type==="complete"||fb.type==="success"?"#14532d":fb.type==="error"?"#7f1d1d":"#1f2937", color:fb.type==="complete"||fb.type==="success"?"#86efac":fb.type==="error"?"#fca5a5":"#d1d5db" }}>
                  {fb.msg}
                </div>
              )}

              {(ld || (ex.type === "playalong" && paFinished)) && li < LESSONS.length - 1 && (
                <button onClick={() => goL(li + 1)} style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:10, border:"none", cursor:"pointer", background:"#4338ca", color:"#fff", fontSize:14, fontWeight:700 }}>
                  Next Lesson →
                </button>
              )}
              {(ld || (ex.type === "playalong" && paFinished)) && li === LESSONS.length - 1 && (
                <p style={{ marginTop:10, textAlign:"center", color:"#fbbf24", fontWeight:700, fontSize:16 }}>🏆 All lessons complete! Amazing work!</p>
              )}
            </div>
          )}

          {err && (
            <div style={{ width:"100%", maxWidth:640, padding:"9px 14px", borderRadius:10, fontSize:12, background:"#78350f20", color:"#fcd34d", border:"1px solid #92400e" }}>
              ⚠️ {err} You can still click the keys below!
            </div>
          )}

          {/* Piano keyboard */}
          <div style={{ width:"100%", overflowX:"auto", display:"flex", justifyContent:"center" }}>
            <svg width={totalW*KW} height={KH+2} style={{ display:"block", cursor:"pointer", userSelect:"none" }}>
              {whites.map(({ midi: m, idx }) => {
                const c = kColor(m, pressed, targets, nextKey, done, isFP, ex && ex.type === "playalong" && paPlaying);
                const isC = NOTE_NAMES[m%12] === "C";
                const labelColor = c === "none" ? (isC ? "#6366f1" : "#94a3b8") : "#1f2937";
                return (
                  <g key={m} onClick={() => clickKey(m)}>
                    <rect x={idx*KW+1} y={0} width={KW-2} height={KH} rx={4} fill={WC[c]} stroke="#cbd5e1" strokeWidth={1} />
                    {/* Note name */}
                    <text x={idx*KW+KW/2} y={KH-10} textAnchor="middle" fontSize={9} fontWeight={isC ? "700" : "400"} fill={labelColor} style={{ pointerEvents:"none" }}>
                      {NOTE_NAMES[m%12]}
                    </text>
                    {/* Octave number under C notes only */}
                    {isC && (
                      <text x={idx*KW+KW/2} y={KH-1} textAnchor="middle" fontSize={7} fill={labelColor} style={{ pointerEvents:"none" }}>
                        {Math.floor(m/12-1)}
                      </text>
                    )}
                  </g>
                );
              })}
              {blacks.map(({ midi: m, wl }) => {
                const c = kColor(m, pressed, targets, nextKey, done, isFP, ex && ex.type === "playalong" && paPlaying);
                const bx = wl*KW+KW-BW/2;
                const labelColor = c === "none" ? "#9ca3af" : "#fff";
                return (
                  <g key={m} onClick={() => clickKey(m)}>
                    <rect x={bx} y={0} width={BW} height={BH} rx={3} fill={BC[c]} />
                    <text
                      x={bx + BW/2} y={BH - 6}
                      textAnchor="middle" fontSize={7} fill={labelColor}
                      style={{ pointerEvents:"none" }}
                    >
                      {NOTE_NAMES[m%12]}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <p style={{ color:"#4b5563", fontSize:11, margin:"0 0 8px" }}>Click keys with your mouse, or plug in a MIDI device (Chrome/Edge)</p>
        </div>
      </div>
    </div>
  );
}
