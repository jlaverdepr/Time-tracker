import * as React from "react"
import { Link, useLocation } from "wouter"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Calendar as CalendarIcon, List, FolderGit2, Plus, CheckSquare, Dumbbell, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SessionDialog } from "@/components/session-dialog"
import { ActiveTimer } from "@/components/active-timer"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8 shrink-0" />

  const isDark = theme === "dark"
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const [isLogTimeOpen, setIsLogTimeOpen] = React.useState(false)

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Calendar", href: "/calendar", icon: CalendarIcon },
    { name: "Sessions", href: "/sessions", icon: List },
    { name: "Projects", href: "/projects", icon: FolderGit2 },
    { name: "To Do", href: "/todos", icon: CheckSquare },
    { name: "Gym Track", href: "/gym-track", icon: Dumbbell },
  ]

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">
              Focus<span className="text-primary">Time</span>
            </h1>
            <ThemeToggle />
          </div>
          
          <nav className="px-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-primary/10 text-sidebar-primary"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </div>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-sidebar-border pt-3">
          <ActiveTimer />
          <div className="px-4 pb-4">
            <Button
              className="w-full gap-2 font-semibold shadow-sm"
              onClick={() => setIsLogTimeOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Log Time
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        {children}
      </main>

      <SessionDialog open={isLogTimeOpen} onOpenChange={setIsLogTimeOpen} />
    </div>
  )
}
