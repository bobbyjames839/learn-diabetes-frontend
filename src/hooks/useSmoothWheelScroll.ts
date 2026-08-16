import { useCallback, useRef } from 'react'

/**
 * Native wheel scrolling jumps by whatever delta the trackpad/mouse reports —
 * `scroll-behavior: smooth` doesn't touch it, only programmatic scrolls. This
 * intercepts wheel input on the element and eases toward the target instead,
 * so the sidebar-style panels settle rather than snap.
 *
 * A callback ref rather than a `useRef` + mount effect: the panels this is used
 * on aren't in the tree on first render (the page shows a spinner until its
 * data lands, and the lessons grid unmounts entirely while the flashcard deck
 * is showing). A mount effect reads `ref.current` once, finds null, and never
 * attaches. React calls this back every time the element appears or goes away,
 * so the listener follows it.
 */
export function useSmoothWheelScroll<T extends HTMLElement>() {
  const detach = useRef<(() => void) | null>(null)

  return useCallback((el: T | null) => {
    detach.current?.()
    detach.current = null
    if (!el) return

    let target = el.scrollTop
    let raf: number | null = null

    function step() {
      const current = el!.scrollTop
      const diff = target - current
      if (Math.abs(diff) < 0.5) {
        el!.scrollTop = target
        raf = null
        return
      }
      el!.scrollTop = current + diff * 0.18
      raf = requestAnimationFrame(step)
    }

    function onWheel(event: WheelEvent) {
      const maxScroll = el!.scrollHeight - el!.clientHeight
      if (maxScroll <= 0) return
      // Let the page scroll once this panel has nowhere left to go, rather
      // than eating the gesture at the edge.
      if ((target <= 0 && event.deltaY < 0) || (target >= maxScroll && event.deltaY > 0)) return

      event.preventDefault()
      target = Math.min(maxScroll, Math.max(0, target + event.deltaY))
      if (raf === null) raf = requestAnimationFrame(step)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    detach.current = () => {
      el.removeEventListener('wheel', onWheel)
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])
}
