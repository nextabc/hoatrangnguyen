export function correctIndexesFor(question) {
  return question.selectionMode === 'multiple' ? question.correct : [question.correct]
}

export function isExactSelection(selectedIndexes, correctIndexes) {
  if (selectedIndexes.length !== correctIndexes.length) return false
  const selected = [...selectedIndexes].sort((a, b) => a - b)
  const correct = [...correctIndexes].sort((a, b) => a - b)
  return selected.every((value, index) => value === correct[index])
}
