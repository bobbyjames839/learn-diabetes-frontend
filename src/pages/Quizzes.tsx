import { EmptyState } from '../components/ui'

export default function Quizzes() {
  return (
    <div className="rise">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
        <p className="mt-1 text-sm text-ink-soft">Practise the mechanisms you've read about.</p>
      </div>

      <EmptyState title="Coming soon">
        Quizzes will test the reasoning behind each lesson — scenarios rather than recall — and
        keep track of which ideas you find hard.
      </EmptyState>
    </div>
  )
}
