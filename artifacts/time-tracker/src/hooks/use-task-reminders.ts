import * as React from "react"
import { useListTodoEntries } from "@workspace/api-client-react"

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Fires a native notification for tasks with an opt-in reminderTime, while
// the app is open. No background/tray process — matches the confirmed scope.
export function useTaskReminders() {
  // Today's entries (the server resolves "today" on each fetch)
  const { data: tasks = [] } = useListTodoEntries()
  const firedRef = React.useRef<{ date: string; ids: Set<number> }>({ date: formatYMD(new Date()), ids: new Set() })

  React.useEffect(() => {
    if (typeof Notification === "undefined") return
    if (Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return

      const now = new Date()
      const todayStr = formatYMD(now)
      if (firedRef.current.date !== todayStr) {
        firedRef.current = { date: todayStr, ids: new Set() }
      }
      const currentTime = formatHHMM(now)

      for (const task of tasks) {
        if (!task.reminderTime || task.reminderTime !== currentTime) continue
        if (task.status === "done") continue
        if (firedRef.current.ids.has(task.id)) continue
        firedRef.current.ids.add(task.id)
        new Notification("Task reminder", { body: task.text })
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [tasks])
}
