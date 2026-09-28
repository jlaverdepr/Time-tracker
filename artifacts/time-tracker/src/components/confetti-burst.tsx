import * as React from "react"

const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#6366f1", "#ec4899", "#0ea5e9"]

// Brief celebratory burst, positioned absolutely over a `relative` parent.
// Self-removes after playing — pass onDone to unmount it from the caller.
export function ConfettiBurst({ onDone, pieceCount = 20 }: { onDone?: () => void; pieceCount?: number }) {
  const pieces = React.useMemo(() =>
    Array.from({ length: pieceCount }, (_, i) => {
      const angle = Math.random() * Math.PI * 2
      const distance = 40 + Math.random() * 50
      return {
        id: i,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.1,
        duration: 0.6 + Math.random() * 0.5,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance - 20,
        rot: Math.random() * 480 - 240,
      }
    }), [pieceCount])

  React.useEffect(() => {
    const t = setTimeout(() => onDone?.(), 1200)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {pieces.map(p => (
        <span
          key={p.id}
          className="absolute top-1/2 left-1/2 w-1.5 h-2.5 rounded-[1px]"
          style={{
            backgroundColor: p.color,
            animation: `confetti-burst ${p.duration}s ease-out ${p.delay}s forwards`,
            "--confetti-tx": `${p.tx}px`,
            "--confetti-ty": `${p.ty}px`,
            "--confetti-rot": `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
