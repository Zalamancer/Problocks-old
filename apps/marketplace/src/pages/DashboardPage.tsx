import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Wallet, TrendingUp, Play, Star, Eye, DollarSign,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<any>(null);
  const [sims, setSims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const stored = localStorage.getItem('pb_user');
  const user = stored ? JSON.parse(stored) : null;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    Promise.all([
      fetch(`${API_BASE}/economy/wallet/${user.id}`).then(r => r.json()),
      fetch(`${API_BASE}/simulations?limit=50`).then(r => r.json()),
    ]).then(([walletData, simsData]) => {
      setWallet(walletData);
      // Filter to only user's simulations
      setSims((simsData.simulations ?? []).filter((s: any) => s.username === user.username));
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const totalPlays = sims.reduce((sum: number, s: any) => sum + s.plays, 0);
  const avgRating = sims.length > 0
    ? sims.reduce((sum: number, s: any) => sum + (s.rating ? parseFloat(s.rating) : 0), 0) / sims.filter((s: any) => s.rating).length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/explore')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">P</div>
            <span className="font-bold text-sm">Problocks</span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm">Creator Dashboard</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Creator Dashboard</h1>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span className="text-xs">Balance</span>
                  </div>
                  <div className="text-2xl font-bold">{wallet?.balance ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Probux (${wallet?.balanceUsd ?? '0.00'})</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-xs">Total Earned</span>
                  </div>
                  <div className="text-2xl font-bold">{wallet?.totalEarned ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Probux lifetime</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Eye className="h-4 w-4" />
                    <span className="text-xs">Total Plays</span>
                  </div>
                  <div className="text-2xl font-bold">{totalPlays.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Across all sims</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Star className="h-4 w-4" />
                    <span className="text-xs">Avg Rating</span>
                  </div>
                  <div className="text-2xl font-bold">{avgRating ? avgRating.toFixed(1) : '—'}</div>
                  <div className="text-xs text-muted-foreground">Out of 5.0</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent transactions */}
            {wallet?.recentTransactions?.length > 0 && (
              <section className="mb-8">
                <h2 className="text-lg font-semibold mb-3">Recent Earnings</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {wallet.recentTransactions.slice(0, 10).map((tx: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <DollarSign className={`h-4 w-4 ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`} />
                            <span className="text-sm">{tx.description || tx.type}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount} PBX
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            <Separator className="mb-6" />

            {/* My simulations performance */}
            <h2 className="text-lg font-semibold mb-3">My Simulations</h2>
            {sims.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted-foreground mb-3">No simulations published yet.</p>
                <Button onClick={() => navigate('/explore')}>Browse Marketplace</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sims.map((s: any) => (
                  <Card key={s.id} className="cursor-pointer hover:ring-1 hover:ring-primary/30" onClick={() => navigate(`/sim/${s.slug}`)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{s.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px]">{s.category}</Badge>
                          <span>v{s.version}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold">{s.plays.toLocaleString()}</div>
                          <div className="text-[10px] text-muted-foreground">plays</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold flex items-center gap-0.5">
                            {s.rating ? <><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />{s.rating}</> : '—'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">rating</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-500">+{s.plays}</div>
                          <div className="text-[10px] text-muted-foreground">PBX earned</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
