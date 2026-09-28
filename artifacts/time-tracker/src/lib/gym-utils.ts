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

const CATEGORY_HINTS: { keywords: string[]; category: GymExerciseCategory }[] = [
  { keywords: ["leg", "glute", "quad", "hamstring", "calf"], category: "Lower Body" },
  { keywords: ["chest", "back", "shoulder", "arm", "bicep", "tricep", "push", "pull"], category: "Upper Body" },
  { keywords: ["core", "abs"], category: "Core" },
  { keywords: ["full"], category: "Full Body" },
]

// Puts the category matching a workout's title (e.g. "Legs" -> Lower Body)
// first in the list, so the exercise picker surfaces the most relevant
// section without the user having to scroll past unrelated ones.
export function orderCategoriesForTitle(title?: string | null): typeof CATEGORIES {
  if (!title) return CATEGORIES
  const norm = title.toLowerCase()
  const hint = CATEGORY_HINTS.find(h => h.keywords.some(k => norm.includes(k)))
  if (!hint) return CATEGORIES
  const idx = CATEGORIES.findIndex(c => c.value === hint.category)
  if (idx <= 0) return CATEGORIES
  const reordered = [...CATEGORIES]
  const [match] = reordered.splice(idx, 1)
  return [match, ...reordered]
}

export function formatPace(distanceKm: number, durationMinutes: number): string | null {
  if (distanceKm <= 0 || durationMinutes <= 0) return null
  const paceMinPerKm = durationMinutes / distanceKm
  let min = Math.floor(paceMinPerKm)
  let sec = Math.round((paceMinPerKm - min) * 60)
  if (sec === 60) { min += 1; sec = 0 }
  return `${min}:${String(sec).padStart(2, "0")} /km`
}

export function formatSpeed(distanceKm: number, durationMinutes: number): string | null {
  if (distanceKm <= 0 || durationMinutes <= 0) return null
  const speedKmh = distanceKm / (durationMinutes / 60)
  return `${speedKmh.toFixed(1)} km/h`
}

// Native <input type="number"> silently reports an empty value when the
// typed text doesn't match the OS locale's decimal separator (e.g. typing
// "5.2" on a system whose locale expects "5,2"), which was making distance/
// weight fields save as null with no visible error. Using a plain text input
// with this sanitizer sidesteps locale-dependent native parsing entirely.
export function sanitizeNumericInput(raw: string, allowDecimal: boolean): string {
  let value = raw.replace(",", ".")
  value = allowDecimal
    ? value.replace(/[^0-9.]/g, "")
    : value.replace(/[^0-9]/g, "")
  if (allowDecimal) {
    const firstDot = value.indexOf(".")
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, "")
    }
  }
  return value
}
