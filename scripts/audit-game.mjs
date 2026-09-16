import fs from 'node:fs'

const data = JSON.parse(fs.readFileSync(new URL('../src/data/questionBank.json', import.meta.url), 'utf8'))
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
if (data.questions.length !== 234) failures.push(`Expected 234 questions, got ${data.questions.length}`)
if (sets.length !== 13) failures.push(`Expected 13 sets, got ${sets.length}`)
if (sets.some((set) => set.length !== 23)) failures.push('A set does not contain 23 questions')
if (sets.some((set) => new Set(set.map((q) => q.id)).size !== 23)) failures.push('A set contains duplicate IDs')
if (allIds.size !== data.questions.length) failures.push(`Coverage ${allIds.size}/${data.questions.length}`)
if (duplicatePrompts) failures.push(`${duplicatePrompts} duplicate prompts`)

for (const set of sets) {
  const counts = Object.fromEntries(rounds.map((r) => [r.key, set.filter((q) => q.difficulty === r.key).length]))
  for (const round of rounds) if (counts[round.key] !== round.count) failures.push(`Wrong round split: ${JSON.stringify(counts)}`)
}

const joined = JSON.stringify(data)
if (!joined.includes('Nhâm Tuất')) failures.push('Missing corrected Nhâm Tuất knowledge')
if (joined.includes('Nhâm Thảo')) failures.push('Incorrect Nhâm Thảo remains in game data')
if (!joined.includes('1919, tại Huế')) failures.push('Missing corrected 1919 Huế knowledge')

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
}, null, 2))
