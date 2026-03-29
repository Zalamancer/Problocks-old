import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Check } from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saved, setSaved] = useState(false);

  const stored = localStorage.getItem('pb_user');
  const user = stored ? JSON.parse(stored) : null;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setDisplayName(user.display_name ?? '');
    // Fetch full profile for bio
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('pb_token')}` },
    })
      .then(r => r.json())
      .then(data => { if (data.user?.bio) setBio(data.user.bio); })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    // Update localStorage
    const updated = { ...user, display_name: displayName };
    localStorage.setItem('pb_user', JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/explore')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">P</div>
            <span className="font-bold text-sm">Problocks</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">Settings</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Profile</h2>

            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={user.username} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Username cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email ?? ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Bio</Label>
              <textarea
                className="w-full rounded-md border bg-background p-2 text-sm resize-none"
                rows={3}
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
            </div>

            <Button onClick={handleSave} className="gap-1">
              {saved ? <><Check className="h-4 w-4" /> Saved!</> : <><Save className="h-4 w-4" /> Save Changes</>}
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Account Type</p>
                <p className="text-xs text-muted-foreground">{user.is_educator ? 'Educator' : 'Student'}</p>
              </div>
              <Badge variant={user.is_educator ? 'default' : 'secondary'}>
                {user.is_educator ? 'Educator' : 'Student'}
              </Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Member Since</p>
                <p className="text-xs text-muted-foreground">March 2026</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400 mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Once you delete your account, there is no going back.
            </p>
            <Button variant="outline" size="sm" className="text-red-400 border-red-500/30 hover:bg-red-500/10">
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
