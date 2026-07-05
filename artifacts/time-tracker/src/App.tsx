import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Dashboard from '@/pages/dashboard';
import Calendar from '@/pages/calendar';
import Sessions from '@/pages/sessions';
import Projects from '@/pages/projects';
import Todos from '@/pages/todos';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;