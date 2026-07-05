import type { GymExerciseCategory } from "@workspace/api-client-react"

export const CATEGORIES: { value: GymExerciseCategory; color: string }[] = [
  { value: "Upper Body", color: "#6366f1" },
  { value: "Lower Body", color: "#f97316" },
  { value: "Full Body", color: "#14b8a6" },
  { value: "Core", color: "#ec4899" },
  { value: "Minor", color: "#64748b" },
]

export function categoryColor(category: string): string {
  return CATEGORIES.find(c => c.value === category)?.color ?? "#64748b"
}

export function formatPace(distanceKm: number, durationMinutes: number): string | null {
  if (distanceKm <= 0 || durationMinutes <= 0) return null
  const paceMinPerKm = durationMinutes / distanceKm
  let min = Math.floor(paceMinPerKm)
  let sec = Math.round((paceMinPerKm - min) * 60)
  if (sec === 60) { min += 1; sec = 0 }
  return `${min}:${String(sec).padStart(2, "0")} /km`
}
