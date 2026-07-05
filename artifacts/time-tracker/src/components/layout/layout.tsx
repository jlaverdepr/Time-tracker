import * as React from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Calendar as CalendarIcon, List, FolderGit2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogTimeDialog } from "@/components/log-time-dialog"

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const [isLogTimeOpen, setIsLogTimeOpen] = React.useState(false)

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Calendar", href: "/calendar", icon: CalendarIcon },
    { name: "Sessions", href: "/sessions", icon: List },
    { name: "Projects", href: "/projects", icon: FolderGit2 },
  ]

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 flex flex-col justify-between">
        <div>
          <div className="p-6">
            <h1 className="text-xl font-bold tracking-tight text-sidebar-foreground">
              Focus<span className="text-primary">Time</span>
            </h1>
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

        <div className="p-4 border-t border-sidebar-border">
          <Button 
            className="w-full gap-2 font-semibold shadow-sm" 
            onClick={() => setIsLogTimeOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Log Time
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto min-w-0 flex flex-col">
        {children}
      </main>

      <LogTimeDialog open={isLogTimeOpen} onOpenChange={setIsLogTimeOpen} />
    </div>
  )
}
