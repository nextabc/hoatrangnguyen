import fs from 'node:fs'
import { correctIndexesFor, isExactSelection } from '../src/selection.js'

const data = JSON.parse(fs.readFileSync(new URL('../src/data/questionBank.json', import.meta.url), 'utf8'))
const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const rounds = [
  { key: 'easy', count: 10 },
  { key: 'medium', count: 8 },
  { key: 'hard', count: 5 },
]

function shuffle(items, seed) {
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

const pools = Object.fromEntries(rounds.map((round, i) => [
  round.key,
  shuffle(data.questions.filter((q) => q.difficulty === round.key), 1070 + i * 1484),
]))
const setCount = Math.max(...rounds.map((round) => Math.ceil(pools[round.key].length / round.count)))
const sets = Array.from({ length: setCount }, (_, setIndex) => rounds.flatMap((round) =>
  Array.from({ length: round.count }, (_, i) => pools[round.key][(setIndex * round.count + i) % pools[round.key].length]),
))

const allIds = new Set(sets.flat().map((q) => q.id))
const duplicatePrompts = data.questions.length - new Set(data.questions.map((q) => q.prompt.toLowerCase())).size
const failures = []
const allowedDifficulties = new Set(rounds.map((round) => round.key))
const allowedTypes = new Set(['choice'])
const questionIds = new Set()
const semanticOption = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/\b(vua|king|phia|huong)\b/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

for (const [index, question] of data.questions.entries()) {
  const label = question.id || `question at index ${index}`
  if (!question.id || questionIds.has(question.id)) failures.push(`Missing or duplicate ID: ${label}`)
  questionIds.add(question.id)
  if (!question.prompt?.trim()) failures.push(`${label}: missing prompt`)
  if (!question.answer?.trim()) failures.push(`${label}: missing answer`)
  if (!question.category?.trim()) failures.push(`${label}: missing category`)
  if (!question.source?.trim()) failures.push(`${label}: missing source`)
  if (!allowedDifficulties.has(question.difficulty)) failures.push(`${label}: invalid difficulty ${question.difficulty}`)
  if (!allowedTypes.has(question.type)) failures.push(`${label}: invalid type ${question.type}`)
  if (question.type === 'choice') {
    if (!Array.isArray(question.options) || question.options.length !== 4) failures.push(`${label}: choice question must have exactly four options`)
    if (!['single', 'multiple'].includes(question.selectionMode)) failures.push(`${label}: invalid selection mode`)
    const correctIndexes = question.selectionMode === 'multiple' ? question.correct : [question.correct]
    if (!Array.isArray(correctIndexes) || correctIndexes.length < 1 || correctIndexes.some((value) => !Number.isInteger(value) || value < 0 || value >= question.options?.length)) failures.push(`${label}: invalid correct option indexes`)
    if (new Set(correctIndexes).size !== correctIndexes.length) failures.push(`${label}: duplicate correct option indexes`)
    if (question.selectionMode === 'single' && !Number.isInteger(question.correct)) failures.push(`${label}: single-choice correct value must be one index`)
    if (question.selectionMode === 'multiple' && (!Array.isArray(question.correct) || question.correct.length < 2)) failures.push(`${label}: multiple-choice question needs at least two correct options`)
    const expectedAnswer = correctIndexes.map((value) => question.options?.[value]).join('; ')
    if (expectedAnswer !== question.answer) failures.push(`${label}: answer does not match the indexed correct options`)
    if (new Set(question.options || []).size !== question.options?.length) failures.push(`${label}: duplicate answer options`)
    if (new Set((question.options || []).map(semanticOption)).size !== question.options?.length) failures.push(`${label}: semantically duplicate answer options`)
    if (question.selectionMode === 'single' && (question.options || []).filter((option) => option === question.answer).length !== 1) failures.push(`${label}: correct answer must appear exactly once`)
  }
}

if (data.questions.length !== 234) failures.push(`Expected 234 questions, got ${data.questions.length}`)
if (data.questions.some((question) => question.type !== 'choice')) failures.push('Every question must use the one-of-four choice format')
if (sets.length !== 13) failures.push(`Expected 13 sets, got ${sets.length}`)
if (sets.some((set) => set.length !== 23)) failures.push('A set does not contain 23 questions')
if (sets.some((set) => new Set(set.map((q) => q.id)).size !== 23)) failures.push('A set contains duplicate IDs')
if (allIds.size !== data.questions.length) failures.push(`Coverage ${allIds.size}/${data.questions.length}`)
if (duplicatePrompts) failures.push(`${duplicatePrompts} duplicate prompts`)
if (data.meta?.auditedAt !== '2026-09-16') failures.push('Missing current audit date')
if (!Array.isArray(data.meta?.officialSources) || data.meta.officialSources.length < 8) failures.push('Official audit sources are incomplete')
if (!appSource.includes("event.key === 'ArrowLeft'") || !appSource.includes("event.key === 'ArrowRight'")) failures.push('Keyboard arrow navigation is missing')
if (!appSource.includes('responses[question.id]')) failures.push('Answered-question deduplication is missing')
if (appSource.includes("mode === 'exam' && feedback && !feedback.correct")) failures.push('Exam mode still stops after a wrong answer')
if (!appSource.includes("question.selectionMode === 'multiple'")) failures.push('Multiple-answer interaction is missing')

const selectionTestQuestion = { selectionMode: 'multiple', correct: [0, 2, 3] }
const selectionTestCorrect = correctIndexesFor(selectionTestQuestion)
if (!isExactSelection([3, 0, 2], selectionTestCorrect)) failures.push('Multiple-answer exact-match check rejects a correct unordered selection')
if (isExactSelection([0, 2], selectionTestCorrect)) failures.push('Multiple-answer exact-match check accepts a missing answer')
if (isExactSelection([0, 1, 2, 3], selectionTestCorrect)) failures.push('Multiple-answer exact-match check accepts an extra answer')

for (const set of sets) {
  const counts = Object.fromEntries(rounds.map((r) => [r.key, set.filter((q) => q.difficulty === r.key).length]))
  for (const round of rounds) if (counts[round.key] !== round.count) failures.push(`Wrong round split: ${JSON.stringify(counts)}`)
}

const joined = JSON.stringify(data)
if (!joined.includes('Nhâm Tuất')) failures.push('Missing corrected Nhâm Tuất knowledge')
if (joined.includes('Nhâm Thảo')) failures.push('Incorrect Nhâm Thảo remains in game data')
if (!joined.includes('1919, tại Huế')) failures.push('Missing corrected 1919 Huế knowledge')
if (joined.includes('8 mái')) failures.push('Ambiguous 8-roof description remains in game data')
if (joined.includes('cấp khu vực Châu Á - Thái Bình Dương')) failures.push('Unverified UNESCO 2010 wording remains in game data')

const expectedFacts = {
  q001: ['1070'],
  q004: ['1076'],
  q012: ['1484'],
  q014: ['1442-1779'],
  q015: ['1484-1780'],
  q091: ['1805'],
  q105: ['9 gian'],
  q106: ['40 cột'],
  q111: ['2 tầng mái'],
  q119: ['Nhâm Tuất'],
  q122: ['33 người'],
  q133: ['Vua Mạc Đăng Doanh cho trùng tu Quốc Tử Giám'],
  q134: ['2010 là năm Việt Nam nộp hồ sơ', '2011 là năm được đăng ký'],
  q146: ['Phường Văn Miếu - Quốc Tử Giám'],
  q186: ['quốc học'],
  q231: ['2 tầng mái'],
  q232: ['Vua Trần Thái Tông'],
}
const byId = new Map(data.questions.map((question) => [question.id, question]))
for (const [id, fragments] of Object.entries(expectedFacts)) {
  const question = byId.get(id)
  if (!question) {
    failures.push(`Missing audited fact ${id}`)
    continue
  }
  for (const fragment of fragments) {
    if (!question.answer.includes(fragment)) failures.push(`${id}: expected answer fragment "${fragment}"`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'PASS',
  uniqueQuestions: data.questions.length,
  preparedSets: sets.length,
  questionsPerSet: 23,
  roundSplit: '10-8-5',
  fullCoverage: `${allIds.size}/${data.questions.length}`,
  questionTypes: {
    choice: data.questions.filter((q) => q.type === 'choice').length,
    text: data.questions.filter((q) => q.type === 'text').length,
  },
  selectionModes: {
    single: data.questions.filter((q) => q.selectionMode === 'single').length,
    multiple: data.questions.filter((q) => q.selectionMode === 'multiple').length,
  },
  schemaChecks: 'PASS',
  answerOptionChecks: 'PASS',
  interactionChecks: 'PASS',
  highRiskFactChecks: Object.keys(expectedFacts).length,
  officialSources: data.meta.officialSources.length,
}, null, 2))
