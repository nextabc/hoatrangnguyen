import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
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
import { correctIndexesFor, isExactSelection } from './selection'

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
            <Trophy size={20} /> Thi thử đủ 23 câu
          </button>
          <button className="secondary-button review-mode-button" onClick={() => onStart('review')}>
            <BookOpen size={20} /> Ôn toàn bộ {bank.questions.length} câu
          </button>
        </div>
        <p className="audit-note">Câu hỏi sai trong PowerPoint gốc đã được sửa theo tài liệu audit mới nhất.</p>
      </section>
    </main>
  )
}

function ResultScreen({ score, answered, setNumber, totalSets, wrong, onNextSet }) {
  const percent = Math.round((score / Math.max(1, answered)) * 100)
  const title = score >= 21 ? 'Sẵn sàng tranh giải!' : score >= 17 ? 'Nền tảng rất khá' : 'Tiếp tục khóa lỗi'
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
  const [selected, setSelected] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [responses, setResponses] = useState({})
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [wrong, setWrong] = useState([])
  const [best, setBest] = useState(Number(localStorage.getItem(STORAGE.best) || 0))
  const beep = useBeep(sound)
  const activeSet = sets[setIndex]
  const activeQuestions = mode === 'review' ? bank.questions : activeSet.questions
  const totalQuestions = activeQuestions.length
  const question = activeQuestions[questionIndex]
  const correctIndexes = correctIndexesFor(question)
  const round = mode === 'review'
    ? ROUND_CONFIG.find((item) => item.key === question.difficulty) || ROUND_CONFIG[0]
    : currentRound(questionIndex)
  const seen = JSON.parse(localStorage.getItem(STORAGE.seen) || '[]')
  const coverage = Math.min(100, Math.round((new Set(seen).size / bank.questions.length) * 100))

  const finish = (nextWrong = wrong, nextScore = score) => {
    setScreen('result')
    if (nextScore > best) {
      setBest(nextScore)
      localStorage.setItem(STORAGE.best, String(nextScore))
    }
    setPaused(false)
  }

  const markAnswer = (correct, userAnswer = '', selectedIndexes = []) => {
    if (feedback || responses[question.id]) return
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
    setResponses((current) => ({
      ...current,
      [question.id]: { correct, userAnswer, selected: selectedIndexes },
    }))
    const updatedSeen = [...new Set([...seen, question.id])]
    localStorage.setItem(STORAGE.seen, JSON.stringify(updatedSeen))
  }

  useEffect(() => {
    if (screen !== 'game' || mode === 'review' || paused || feedback) return undefined
    if (seconds <= 0) {
      markAnswer(false, 'Hết giờ', selected)
      return undefined
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [screen, mode, paused, feedback, seconds])

  const start = (selectedMode) => {
    setMode(selectedMode)
    setQuestionIndex(0)
    setSeconds(15)
    setScore(0)
    setStreak(0)
    setWrong([])
    setResponses({})
    setFeedback(null)
    setSelected([])
    setScreen('game')
  }

  const choose = (index) => {
    if (feedback || paused) return
    if (question.selectionMode === 'multiple') {
      setSelected((current) => current.includes(index)
        ? current.filter((value) => value !== index)
        : [...current, index])
      return
    }
    const selectedIndexes = [index]
    setSelected(selectedIndexes)
    if (mode === 'review') {
      setFeedback({ correct: index === question.correct, userAnswer: question.options[index], review: true })
      return
    }
    markAnswer(index === question.correct, question.options[index], selectedIndexes)
  }

  const submitMultiple = () => {
    if (feedback || paused || selected.length === 0) return
    const selectedSorted = [...selected].sort((a, b) => a - b)
    const correct = isExactSelection(selectedSorted, correctIndexes)
    const userAnswer = selectedSorted.map((index) => question.options[index]).join('; ')
    if (mode === 'review') {
      setFeedback({ correct, userAnswer, review: true })
      return
    }
    markAnswer(correct, userAnswer, selectedSorted)
  }

  const goToQuestion = (nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(totalQuestions - 1, nextIndex))
    if (boundedIndex === questionIndex) return
    const nextQuestion = activeQuestions[boundedIndex]
    const saved = mode === 'review' ? null : responses[nextQuestion.id]
    setQuestionIndex(boundedIndex)
    setSeconds(15)
    setSelected(saved?.selected ?? [])
    setFeedback(saved ? { correct: saved.correct, userAnswer: saved.userAnswer } : null)
  }

  const revealAnswer = () => {
    if (mode !== 'review' || feedback) return
    setFeedback({ correct: null, userAnswer: '', review: true, revealed: true })
    const updatedSeen = [...new Set([...seen, question.id])]
    localStorage.setItem(STORAGE.seen, JSON.stringify(updatedSeen))
  }

  const next = () => {
    if (mode === 'review') {
      goToQuestion(questionIndex + 1)
      return
    }
    if (questionIndex >= totalQuestions - 1) {
      finish(wrong, score)
      return
    }
    goToQuestion(questionIndex + 1)
  }

  useEffect(() => {
    if (screen !== 'game') return undefined
    const handleKeyDown = (event) => {
      const tagName = event.target?.tagName
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToQuestion(questionIndex - 1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (questionIndex < totalQuestions - 1) goToQuestion(questionIndex + 1)
        else if (mode !== 'review' && feedback) finish(wrong, score)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [screen, mode, questionIndex, totalQuestions, feedback, responses, wrong, score])

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
        answered={23}
        setNumber={setIndex + 1}
        totalSets={sets.length}
        wrong={wrong}
        onNextSet={nextSet}
      />
    )
  }

  return (
    <main className="screen game-screen">
      <header className="game-header">
        <div className="brand"><Sparkles size={20} /><div><strong>HOA TRẠNG NGUYÊN</strong><span>Văn Miếu – Quốc Tử Giám</span></div></div>
        {mode === 'review' ? (
          <div className="review-progress"><BookOpen size={18} /> Dùng phím ← → để duyệt toàn bộ ngân hàng</div>
        ) : (
          <RoundRail questionIndex={questionIndex} />
        )}
        <div className="set-label">{mode === 'review' ? `Ngân hàng ${totalQuestions} câu` : `Bộ đề ${String(setIndex + 1).padStart(2, '0')}/${sets.length}`}</div>
      </header>

      <section className="quiz-shell">
        <div className="status-row">
          <div className="category"><span style={{ background: round.color }} />{round.name} · {question.category}</div>
          {mode !== 'review' && <div className="hud">
            <span><Trophy size={16} /> {score}</span>
            <span><Flame size={16} /> {streak}</span>
          </div>}
        </div>

        <div className="question-panel">
          <span className="question-number">Câu {questionIndex + 1}/{totalQuestions}</span>
          <h2>{question.prompt}</h2>
        </div>

        {mode !== 'review' && <div className="timer-row">
          <div className={`timer-dial ${seconds <= 5 ? 'urgent' : ''}`}><Clock3 size={21} /><strong>{seconds}</strong><small>giây</small></div>
          <div className="timer-track"><span style={{ width: `${(seconds / 15) * 100}%` }} /></div>
        </div>}

        {mode === 'review' && (
          <div className="review-toolbar" aria-label="Điều hướng ôn toàn bộ câu hỏi">
            <button onClick={() => goToQuestion(questionIndex - 1)} disabled={questionIndex === 0}>
              <ChevronLeft size={18} /> Câu trước
            </button>
            <button className="reveal-button" onClick={revealAnswer} disabled={Boolean(feedback)}>
              <Eye size={18} /> Mở đáp án đúng
            </button>
            <button onClick={() => goToQuestion(questionIndex + 1)} disabled={questionIndex === totalQuestions - 1}>
              Câu sau <ChevronRight size={18} />
            </button>
          </div>
        )}

        <div className="answers-grid">
          {question.options.map((option, index) => {
            const isSelected = selected.includes(index)
            const isCorrect = feedback && correctIndexes.includes(index)
            const isWrong = feedback && isSelected && !correctIndexes.includes(index)
            return (
              <button
                key={`${question.id}-${index}`}
                className={`answer-button ${isSelected && !feedback ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}`}
                aria-pressed={isSelected}
                onClick={() => choose(index)}
                disabled={Boolean(feedback) || paused}
              >
                <span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong>
              </button>
            )
          })}
        </div>

        {question.selectionMode === 'multiple' && !feedback && (
          <div className="multiple-answer-actions">
            <span>Chọn tất cả đáp án đúng rồi bấm chốt.</span>
            <button onClick={submitMultiple} disabled={selected.length === 0 || paused}>
              Chốt {selected.length > 0 ? `${selected.length} đáp án` : 'đáp án'}
            </button>
          </div>
        )}

        {feedback && (
          <div className={`feedback ${feedback.revealed ? 'is-revealed' : feedback.correct ? 'is-correct' : 'is-wrong'}`} role="status">
            {feedback.revealed ? <Eye size={24} /> : feedback.correct ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            <div>
              <strong>{feedback.revealed ? 'Đáp án đúng' : feedback.correct ? 'Chính xác!' : seconds === 0 && mode !== 'review' ? 'Hết 15 giây' : 'Chưa chính xác'}</strong>
              <span>Đáp án chuẩn: {question.answer}</span>
              {question.explanation && <small>{question.explanation}</small>}
            </div>
            {!(mode === 'review' && questionIndex === totalQuestions - 1) && (
              <button onClick={next}>{mode === 'review' ? 'Câu tiếp' : questionIndex === totalQuestions - 1 ? 'Hoàn thành' : 'Câu tiếp'} <ChevronRight size={18} /></button>
            )}
          </div>
        )}
      </section>

      <footer className="game-footer">
        <span>{mode === 'review' ? 'Ôn toàn bộ: ← câu trước · → câu sau · mở đáp án bất kỳ lúc nào' : '← câu trước · → câu sau · trả lời sai vẫn tiếp tục đến hết 23 câu'}</span>
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
