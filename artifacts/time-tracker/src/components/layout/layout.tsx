import * as React from "react"
import { Link, useLocation } from "wouter"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Calendar as CalendarIcon, List, FolderGit2, Plus, CheckSquare, Dumbbell, Sun, Moon,
  Menu, Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { SessionDialog } from "@/components/session-dialog"
import { ActiveTimer } from "@/components/active-timer"
import { useTimer, formatElapsed } from "@/hooks/use-timer"

const NAV_ITEMS = [
  { name: "Dashboard", short: "Home", href: "/", icon: LayoutDashboard },
  { name: "Calendar", short: "Calendar", href: "/calendar", icon: CalendarIcon },
  { name: "Sessions", short: "Sessions", href: "/sessions", icon: List },
  { name: "Projects", short: "Projects", href: "/projects", icon: FolderGit2 },
  { name: "To Do", short: "To Do", href: "/todos", icon: CheckSquare },
  { name: "Gym Track", short: "Gym", href: "/gym-track", icon: Dumbbell },
]

// Phone bottom bar: the four most-used pages, with the rest under "More".
const TAB_HREFS = ["/", "/calendar", "/todos", "/gym-track"]
const MORE_ITEMS = NAV_ITEMS.filter(i => !TAB_HREFS.includes(i.href))

function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8 shrink-0" />

  const isDark = theme === "dark"
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors",
        className,
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function Logo() {
  return (
    <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">
      Focus<span className="text-primary">Time</span>
    </h1>
  )
}

// ── phone chrome (below md) ───────────────────────────────────────────────────

function MobileHeader({ onLogTime, onOpenMore }: { onLogTime: () => void; onOpenMore: () => void }) {
  const { status, elapsed } = useTimer()
  return (
    <header className="md:hidden shrink-0 border-b border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top)]">
      <div className="h-12 px-4 flex items-center gap-2">
        <Logo />
        <div className="flex-1" />
        {status !== "idle" && (
          <button
            onClick={onOpenMore}
            className={cn(
              "flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs font-mono font-semibold tabular-nums",
              status === "running" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
            title="Timer"
          >
            <Timer className="h-3.5 w-3.5" />
            {formatElapsed(elapsed)}
          </button>
        )}
        <ThemeToggle className="h-9 w-9" />
        <Button size="icon" className="h-9 w-9 rounded-full" onClick={onLogTime} title="Log time">
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

function MobileTabBar({ location, onOpenMore }: { location: string; onOpenMore: () => void }) {
  const moreActive = MORE_ITEMS.some(i => i.href === location)
  const tab = "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors"
  return (
    <nav className="md:hidden shrink-0 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)]">
      <div className="h-14 flex items-stretch">
        {NAV_ITEMS.filter(i => TAB_HREFS.includes(i.href)).map(item => {
          const active = location === item.href
          return (
            <Link key={item.href} href={item.href} className={cn(tab, active ? "text-primary" : "text-sidebar-foreground/60")}>
              <item.icon className="h-5 w-5" />
              {item.short}
            </Link>
          )
        })}
        <button onClick={onOpenMore} className={cn(tab, moreActive ? "text-primary" : "text-sidebar-foreground/60")}>
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  )
}

function MoreSheet({ open, onOpenChange, location }: { open: boolean; onOpenChange: (open: boolean) => void; location: string }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">Other pages and the timer</SheetDescription>
        </SheetHeader>
        <nav className="px-3 space-y-1">
          {MORE_ITEMS.map(item => (
            <Link key={item.href} href={item.href} onClick={() => onOpenChange(false)} className="block">
              <div className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium",
                location === item.href ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}>
                <item.icon className="h-5 w-5" />
                {item.name}
              </div>
            </Link>
          ))}
        </nav>
        <div className="border-t mt-3 pt-3 pb-4">
          <ActiveTimer />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ── layout ────────────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const [isLogTimeOpen, setIsLogTimeOpen] = React.useState(false)
  const [isMoreOpen, setIsMoreOpen] = React.useState(false)

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden bg-background">
      <MobileHeader onLogTime={() => setIsLogTimeOpen(true)} onOpenMore={() => setIsMoreOpen(true)} />

      <aside className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex-col justify-between">
        <div>
          <div className="p-6 flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>

          <nav className="px-4 space-y-1">
            {NAV_ITEMS.map((item) => {
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

      <main className="flex-1 overflow-y-auto overscroll-contain min-w-0 min-h-0 flex flex-col">
        {children}
      </main>

      <MobileTabBar location={location} onOpenMore={() => setIsMoreOpen(true)} />
      <MoreSheet open={isMoreOpen} onOpenChange={setIsMoreOpen} location={location} />
      <SessionDialog open={isLogTimeOpen} onOpenChange={setIsLogTimeOpen} />
    </div>
  )
}
