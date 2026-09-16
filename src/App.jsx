import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Fullscreen,
  Medal,
  Pause,
  Play,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react'
import bank from './data/questionBank.json'

const ROUND_CONFIG = [
  { key: 'easy', name: 'Khởi động', count: 10, color: '#f3c75f' },
  { key: 'medium', name: 'Tăng tốc', count: 8, color: '#17c8f4' },
  { key: 'hard', name: 'Về đích', count: 5, color: '#fb806f' },
]

const STORAGE = {
  nextSet: 'hoaTrangNguyen.nextSet.v1',
  seen: 'hoaTrangNguyen.seen.v1',
  best: 'hoaTrangNguyen.best.v1',
}

function seededShuffle(items, seed) {
  const result = [...items]
  let state = seed >>> 0
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function buildSets() {
  const pools = Object.fromEntries(
    ROUND_CONFIG.map((round, idx) => [
      round.key,
      seededShuffle(bank.questions.filter((q) => q.difficulty === round.key), 1070 + idx * 1484),
    ]),
  )
  const setCount = Math.max(
    ...ROUND_CONFIG.map((r) => Math.ceil(pools[r.key].length / r.count)),
  )

  return Array.from({ length: setCount }, (_, setIndex) => {
    const questions = []
    ROUND_CONFIG.forEach((round) => {
      const pool = pools[round.key]
      for (let i = 0; i < round.count; i += 1) {
        questions.push(pool[(setIndex * round.count + i) % pool.length])
      }
    })
    return { id: setIndex + 1, questions }
  })
}

function normalize(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function autoGrade(input, answer) {
  const user = normalize(input)
  const target = normalize(answer)
  if (!user) return false
  if (user === target) return true
  if (target.length <= 14) return target.includes(user) || user.includes(target)
  const targetTokens = [...new Set(target.split(' ').filter((w) => w.length > 2))]
  const userTokens = new Set(user.split(' '))
  const hits = targetTokens.filter((word) => userTokens.has(word)).length
  return hits >= Math.max(2, Math.ceil(targetTokens.length * 0.72))
}

function currentRound(questionIndex) {
  if (questionIndex < 10) return ROUND_CONFIG[0]
  if (questionIndex < 18) return ROUND_CONFIG[1]
  return ROUND_CONFIG[2]
}

function useBeep(enabled) {
  const contextRef = useRef(null)
  return (kind) => {
    if (!enabled) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = contextRef.current || new AudioContext()
    contextRef.current = ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = kind === 'correct' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(kind === 'correct' ? 620 : 190, ctx.currentTime)
    if (kind === 'correct') osc.frequency.exponentialRampToValueAtTime(920, ctx.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.27)
  }
}

function RoundRail({ questionIndex }) {
  return (
    <div className="round-rail" aria-label="Tiến độ ba vòng">
      {ROUND_CONFIG.map((round, idx) => {
        const start = idx === 0 ? 0 : idx === 1 ? 10 : 18
        const end = start + round.count
        const active = questionIndex >= start && questionIndex < end
        const complete = questionIndex >= end
        return (
          <div className={`round-step ${active ? 'active' : ''} ${complete ? 'complete' : ''}`} key={round.key}>
            <span>{round.name}</span>
            <strong>{round.count}</strong>
          </div>
        )
      })}
    </div>
  )
}

function StartScreen({ setIndex, setCount, coverage, best, onStart }) {
  return (
    <main className="screen start-screen">
      <section className="start-card">
        <div className="crest"><Medal size={34} /></div>
        <h1>HOA TRẠNG NGUYÊN</h1>
        <p className="subtitle">Văn Miếu – Quốc Tử Giám</p>
        <div className="gold-rule" />
        <p className="intro">
          Bộ đề {String(setIndex + 1).padStart(2, '0')}/{setCount} gồm 23 câu, chia đúng ba vòng và 15 giây mỗi câu.
        </p>
        <div className="start-stats">
          <div><strong>{bank.questions.length}</strong><span>câu đã audit</span></div>
          <div><strong>{coverage}%</strong><span>đã luyện</span></div>
          <div><strong>{best}/23</strong><span>kỷ lục</span></div>
        </div>
        <div className="mode-actions">
          <button className="primary-button" onClick={() => onStart('practice')}>
            <Play size={20} fill="currentColor" /> Luyện đủ 23 câu
          </button>
          <button className="secondary-button" onClick={() => onStart('exam')}>
            <Trophy size={20} /> Thi thật: sai là dừng
          </button>
        </div>
        <p className="audit-note">Câu hỏi sai trong PowerPoint gốc đã được sửa theo tài liệu audit mới nhất.</p>
      </section>
    </main>
  )
}

function ResultScreen({ score, answered, setNumber, totalSets, wrong, mode, onNextSet }) {
  const percent = Math.round((score / Math.max(1, answered)) * 100)
  const title = mode === 'exam' && wrong ? 'Tạm dừng tại đây' : score >= 21 ? 'Sẵn sàng tranh giải!' : score >= 17 ? 'Nền tảng rất khá' : 'Tiếp tục khóa lỗi'
  return (
    <main className="screen result-screen">
      <section className="result-card">
        <div className="result-icon"><Trophy size={44} /></div>
        <p className="result-kicker">BỘ ĐỀ {String(setNumber).padStart(2, '0')}/{totalSets}</p>
        <h2>{title}</h2>
        <div className="score-ring"><strong>{score}</strong><span>/{answered}</span></div>
        <p>Độ chính xác {percent}% · {wrong.length} câu cần xem lại</p>
        {wrong.length > 0 && (
          <div className="review-list">
            {wrong.slice(0, 4).map((q) => <span key={q.id}>{q.prompt}</span>)}
            {wrong.length > 4 && <span>Và {wrong.length - 4} câu khác</span>}
          </div>
        )}
        <div className="result-actions">
          <button className="primary-button" onClick={onNextSet}>Chơi bộ đề mới <ChevronRight size={20} /></button>
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const sets = useMemo(buildSets, [])
  const storedSet = Number(localStorage.getItem(STORAGE.nextSet) || 0)
  const [setIndex, setSetIndex] = useState(Number.isFinite(storedSet) ? storedSet % sets.length : 0)
  const [screen, setScreen] = useState('start')
  const [mode, setMode] = useState('practice')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [seconds, setSeconds] = useState(15)
  const [paused, setPaused] = useState(false)
  const [sound, setSound] = useState(true)
  const [selected, setSelected] = useState(null)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wrong, setWrong] = useState([])
  const [best, setBest] = useState(Number(localStorage.getItem(STORAGE.best) || 0))
  const beep = useBeep(sound)
  const activeSet = sets[setIndex]
  const question = activeSet.questions[questionIndex]
  const round = currentRound(questionIndex)
  const seen = JSON.parse(localStorage.getItem(STORAGE.seen) || '[]')
  const coverage = Math.min(100, Math.round((new Set(seen).size / bank.questions.length) * 100))

  const finish = (nextWrong = wrong, nextScore = score) => {
    const answered = mode === 'exam' && nextWrong.length ? questionIndex + 1 : 23
    setScreen('result')
    if (nextScore > best) {
      setBest(nextScore)
      localStorage.setItem(STORAGE.best, String(nextScore))
    }
    setPaused(false)
    return answered
  }

  const markAnswer = (correct, userAnswer = '') => {
    if (feedback) return
    const nextWrong = correct ? wrong : [...wrong, question]
    if (correct) {
      setScore((value) => value + 1)
      setStreak((value) => value + 1)
      beep('correct')
    } else {
      setStreak(0)
      setWrong(nextWrong)
      beep('wrong')
    }
    setFeedback({ correct, userAnswer })
    const updatedSeen = [...new Set([...seen, question.id])]
    localStorage.setItem(STORAGE.seen, JSON.stringify(updatedSeen))
  }

  useEffect(() => {
    if (screen !== 'game' || paused || feedback) return undefined
    if (seconds <= 0) {
      markAnswer(false, 'Hết giờ')
      return undefined
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [screen, paused, feedback, seconds])

  const start = (selectedMode) => {
    setMode(selectedMode)
    setQuestionIndex(0)
    setSeconds(15)
    setScore(0)
    setStreak(0)
    setWrong([])
    setFeedback(null)
    setInput('')
    setSelected(null)
    setScreen('game')
  }

  const choose = (index) => {
    if (feedback || paused) return
    setSelected(index)
    markAnswer(index === question.correct, question.options[index])
  }

  const submitText = (event) => {
    event.preventDefault()
    if (!input.trim()) return
    markAnswer(autoGrade(input, question.answer), input.trim())
  }

  const next = () => {
    if (mode === 'exam' && feedback && !feedback.correct) {
      finish(wrong, score)
      return
    }
    if (questionIndex >= 22) {
      finish(wrong, score)
      return
    }
    setQuestionIndex((value) => value + 1)
    setSeconds(15)
    setSelected(null)
    setInput('')
    setFeedback(null)
  }

  const nextSet = () => {
    const newIndex = (setIndex + 1) % sets.length
    setSetIndex(newIndex)
    localStorage.setItem(STORAGE.nextSet, String(newIndex))
    setScreen('start')
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  if (screen === 'start') {
    return <StartScreen setIndex={setIndex} setCount={sets.length} coverage={coverage} best={best} onStart={start} />
  }
  if (screen === 'result') {
    return (
      <ResultScreen
        score={score}
        answered={mode === 'exam' && wrong.length ? questionIndex + 1 : 23}
        setNumber={setIndex + 1}
        totalSets={sets.length}
        wrong={wrong}
        mode={mode}
        onNextSet={nextSet}
      />
    )
  }

  return (
    <main className="screen game-screen">
      <header className="game-header">
        <div className="brand"><Sparkles size={20} /><div><strong>HOA TRẠNG NGUYÊN</strong><span>Văn Miếu – Quốc Tử Giám</span></div></div>
        <RoundRail questionIndex={questionIndex} />
        <div className="set-label">Bộ đề {String(setIndex + 1).padStart(2, '0')}/{sets.length}</div>
      </header>

      <section className="quiz-shell">
        <div className="status-row">
          <div className="category"><span style={{ background: round.color }} />{round.name} · {question.category}</div>
          <div className="hud">
            <span><Trophy size={16} /> {score}</span>
            <span><Flame size={16} /> {streak}</span>
          </div>
        </div>

        <div className="question-panel">
          <span className="question-number">Câu {questionIndex + 1}/23</span>
          <h2>{question.prompt}</h2>
        </div>

        <div className="timer-row">
          <div className={`timer-dial ${seconds <= 5 ? 'urgent' : ''}`}><Clock3 size={21} /><strong>{seconds}</strong><small>giây</small></div>
          <div className="timer-track"><span style={{ width: `${(seconds / 15) * 100}%` }} /></div>
        </div>

        {question.type === 'choice' ? (
          <div className="answers-grid">
            {question.options.map((option, index) => {
              const isCorrect = feedback && index === question.correct
              const isWrong = feedback && selected === index && index !== question.correct
              return (
                <button
                  key={`${question.id}-${index}`}
                  className={`answer-button ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                  onClick={() => choose(index)}
                  disabled={Boolean(feedback) || paused}
                >
                  <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>
                </button>
              )
            })}
          </div>
        ) : (
          <form className="text-answer" onSubmit={submitText}>
            <label htmlFor="answer">Viết đáp án ngắn gọn</label>
            <div>
              <input id="answer" value={input} onChange={(e) => setInput(e.target.value)} disabled={Boolean(feedback) || paused} autoFocus autoComplete="off" />
              <button type="submit" disabled={!input.trim() || Boolean(feedback) || paused}>Chốt đáp án</button>
            </div>
          </form>
        )}

        {feedback && (
          <div className={`feedback ${feedback.correct ? 'is-correct' : 'is-wrong'}`} role="status">
            {feedback.correct ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            <div>
              <strong>{feedback.correct ? 'Chính xác!' : seconds === 0 ? 'Hết 15 giây' : 'Chưa chính xác'}</strong>
              <span>Đáp án chuẩn: {question.answer}</span>
              {question.explanation && <small>{question.explanation}</small>}
            </div>
            <button onClick={next}>{mode === 'exam' && !feedback.correct ? 'Xem kết quả' : questionIndex === 22 ? 'Hoàn thành' : 'Câu tiếp'} <ChevronRight size={18} /></button>
          </div>
        )}
      </section>

      <footer className="game-footer">
        <span>{mode === 'practice' ? 'Luyện tập: chơi đủ 23 câu' : 'Thi thật: trả lời sai sẽ dừng'}</span>
        <div>
          <button aria-label={sound ? 'Tắt âm thanh' : 'Bật âm thanh'} onClick={() => setSound((value) => !value)}>{sound ? <Volume2 /> : <VolumeX />}</button>
          <button aria-label={paused ? 'Tiếp tục' : 'Tạm dừng'} onClick={() => setPaused((value) => !value)}>{paused ? <Play /> : <Pause />}</button>
          <button aria-label="Toàn màn hình" onClick={toggleFullscreen}><Fullscreen /></button>
        </div>
      </footer>

      {paused && <div className="pause-overlay"><button onClick={() => setPaused(false)}><Play size={28} fill="currentColor" /> Tiếp tục</button></div>}
    </main>
  )
}
