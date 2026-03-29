import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchUserProfile, type UserProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Star, Users, Calendar, BookOpen, Play, GraduationCap } from 'lucide-react';
import { SimulationCard } from '@/components/marketplace/SimulationCard';

const CATEGORY_GRADIENTS: Record<string, string> = {
  physics: 'linear-gradient(135deg, #2d1b69, #11998e)',
  circuits: 'linear-gradient(135deg, #1f1c2c, #928dab)',
  chemistry: 'linear-gradient(135deg, #134e5e, #71b280)',
  engineering: 'linear-gradient(135deg, #4a1942, #c74b50)',
  biology: 'linear-gradient(135deg, #56ab2f, #a8e063)',
  math: 'linear-gradient(135deg, #667eea, #764ba2)',
  cs: 'linear-gradient(135deg, #fc5c7d, #6a82fb)',
  general: 'linear-gradient(135deg, #1a1a2e, #16213e)',
};

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    fetchUserProfile(username)
      .then(setProfile)
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">Loading profile...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <span className="text-lg">User not found</span>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>Back</Button>
      </div>
    );
  }

  const { user, simulations, stats } = profile;
  const initials = user.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const joinDate = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">P</div>
            <span className="font-bold text-sm">Problocks</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">@{user.username}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Profile header */}
        <div className="flex items-start gap-6 mb-8">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{user.display_name}</h1>
              {user.is_educator && (
                <Badge className="gap-1 bg-blue-600">
                  <GraduationCap className="h-3 w-3" /> Educator
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">@{user.username}</p>
            {user.bio && <p className="mt-2 text-sm">{user.bio}</p>}

            <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> Joined {joinDate}
              </span>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{stats.totalSimulations}</div>
              <div className="text-xs text-muted-foreground">Simulations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{stats.totalPlays.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Plays</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Star className="h-4 w-4" />
              </div>
              <div className="text-2xl font-bold">{stats.avgRating?.toFixed(1) ?? '—'}</div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </CardContent>
          </Card>
        </div>

        <Separator className="mb-6" />

        {/* Published simulations */}
        <h2 className="text-xl font-bold mb-4">
          Published Simulations ({simulations.length})
        </h2>

        {simulations.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            No simulations published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {simulations.map(sim => (
              <SimulationCard
                key={sim.id}
                sim={{ ...sim, author_name: user.display_name, username: user.username }}
                thumbnail={CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
