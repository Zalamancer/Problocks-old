import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Search } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center">
        <div className="text-8xl font-extrabold text-muted-foreground/20 mb-4">404</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8 max-w-md">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button className="gap-2" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" /> Go Home
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/explore')}>
            <Search className="h-4 w-4" /> Explore Simulations
          </Button>
        </div>
      </div>
    </div>
  );
}
