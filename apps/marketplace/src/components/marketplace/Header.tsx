import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, Plus, Bell, LogIn } from 'lucide-react';

interface HeaderProps {
  search: string;
  onSearch: (value: string) => void;
}

interface User {
  id: string;
  username: string;
  display_name: string;
}

export function Header({ search, onSearch }: HeaderProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pb_user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('pb_token');
    localStorage.removeItem('pb_user');
    setUser(null);
  };

  const initials = user?.display_name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <span className="text-lg font-bold">Problocks</span>
        </Link>

        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search simulations..."
            className="h-9 pl-9 bg-secondary/50"
            value={search}
            onChange={e => onSearch(e.target.value)}
          />
        </div>

        <div className="flex-1" />

        {user ? (
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Create
            </Button>

            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-8 w-8 cursor-pointer">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-2 py-1.5 text-sm font-medium">{user.display_name}</div>
                <div className="px-2 pb-1.5 text-xs text-muted-foreground">@{user.username}</div>
                <DropdownMenuSeparator />
                <DropdownMenuItem>My Simulations</DropdownMenuItem>
                <DropdownMenuItem>Earnings</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Sign Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              <LogIn className="mr-1.5 h-4 w-4" /> Sign In
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Create Account
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
