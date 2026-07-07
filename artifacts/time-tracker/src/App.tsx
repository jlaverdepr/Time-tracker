import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from '@/pages/dashboard';
import Calendar from '@/pages/calendar';
import Sessions from '@/pages/sessions';
import Projects from '@/pages/projects';
import Todos from '@/pages/todos';
import GymTrack from '@/pages/gym-track';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { useTaskReminders } from '@/hooks/use-task-reminders';
import { TimerProvider } from '@/hooks/use-timer';

const queryClient = new QueryClient();

function TaskReminders() {
  useTaskReminders();
  return null;
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-muted-foreground mb-6">We couldn't find the page you're looking for.</p>
        <a href="/" className="text-primary hover:underline">Return Home</a>
      </div>
    </div>
  )
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/sessions" component={Sessions} />
      <Route path="/projects" component={Projects} />
      <Route path="/todos" component={Todos} />
      <Route path="/gym-track" component={GymTrack} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TimerProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <TaskReminders />
          <Toaster />
        </TimerProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;