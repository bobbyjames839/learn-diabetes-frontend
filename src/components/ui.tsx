import type { ReactNode } from 'react'

export const CATEGORY_STYLES: Record<string, { label: string; chip: string; dot: string }> = {
  basics: { label: 'Basics', chip: 'bg-sage-wash text-sage', dot: 'bg-sage' },
  food: { label: 'Food', chip: 'bg-amber-wash text-amber-deep', dot: 'bg-amber' },
  insulin: { label: 'Insulin', chip: 'bg-berry-wash text-berry', dot: 'bg-berry' },
  exercise: { label: 'Exercise', chip: 'bg-sage-wash text-sage', dot: 'bg-sage' },
  troubleshooting: { label: 'Troubleshooting', chip: 'bg-berry-wash text-berry', dot: 'bg-berry' },
  'daily-life': { label: 'Daily life', chip: 'bg-amber-wash text-amber-deep', dot: 'bg-amber' },
}

export function categoryStyle(category: string) {
  return (
    CATEGORY_STYLES[category] ?? {
      label: category,
      chip: 'bg-cream-deep text-ink-soft',
      dot: 'bg-ink-soft',
    }
  )
}

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`mx-auto w-full max-w-6xl px-6 lg:px-10 ${className}`}>{children}</div>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-line bg-card shadow-[0_1px_3px_rgba(43,33,24,0.04)] ${className}`}
    >
      {children}
    </div>
  )
}

export function StatCard({
  value,
  label,
  hint,
  accent = 'amber',
}: {
  value: ReactNode
  label: string
  hint?: string
  accent?: 'amber' | 'sage' | 'berry'
}) {
  const tones = {
    amber: 'text-amber-deep',
    sage: 'text-sage',
    berry: 'text-berry',
  }
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={`mt-1.5 text-3xl font-bold tabular-nums leading-none ${tones[accent]}`}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
    </Card>
  )
}

export function ProgressRing({ percent, size = 132 }: { percent: number; size?: number }) {
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100)

  return (
    <svg
      width={size}
      height={size}
      className="shrink-0"
      role="img"
      aria-label={`${percent}% complete`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-cream-deep)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-amber)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text
        x="50%"
        y="46%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-ink text-2xl font-bold tabular-nums"
      >
        {percent}%
      </text>
      <text
        x="50%"
        y="64%"
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-ink-soft text-[10px] font-semibold uppercase tracking-wider"
      >
        complete
      </text>
    </svg>
  )
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-cream-deep ${className}`}>
      <div
        className="h-full rounded-full bg-amber transition-all duration-700"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'quiet'
  size?: 'sm' | 'md'
}) {
  const variants = {
    primary:
      'bg-amber text-white hover:bg-amber-deep disabled:bg-line disabled:text-ink-soft shadow-[0_1px_2px_rgba(43,33,24,0.1)]',
    ghost: 'border border-line bg-card text-ink hover:border-ink-soft/40 hover:bg-cream-deep',
    quiet: 'text-ink-soft hover:text-ink hover:bg-cream-deep',
  }
  const sizes = { sm: 'px-3.5 py-1.5 text-xs', md: 'px-5 py-2.5 text-sm' }
  return (
    <button
      {...props}
      className={`rounded-lg font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-amber-wash font-bold text-amber-deep"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-4 rounded-card border border-berry/25 bg-berry-wash px-5 py-4 text-sm text-berry"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">
          Retry
        </button>
      )}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-ink-soft">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-amber" />
      {label}
    </div>
  )
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <Card className="px-8 py-16 text-center">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{children}</div>
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function SafetyNotice() {
  return (
    <p className="text-xs leading-relaxed text-ink-soft">
      <strong className="font-semibold text-ink">Educational only.</strong> This app explains why
      glucose behaves the way it does. It never suggests insulin doses or treatment actions, and is
      not a substitute for your diabetes team.
    </p>
  )
}
