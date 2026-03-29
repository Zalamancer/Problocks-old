import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Plus, Users, BookOpen, Copy, Check, GraduationCap, ClipboardList,
} from 'lucide-react';

interface Classroom {
  id: string;
  name: string;
  code: string;
  description: string;
  educator_id: string;
  created_at: string;
}

export function ClassroomPage() {
  const navigate = useNavigate();
  const [teaching, setTeaching] = useState<Classroom[]>([]);
  const [enrolled, setEnrolled] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const stored = localStorage.getItem('pb_user');
  const user = stored ? JSON.parse(stored) : null;

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch(`${API_BASE}/classrooms/my/${user.id}`)
      .then(r => r.json())
      .then(data => { setTeaching(data.teaching); setEnrolled(data.enrolled); })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const res = await fetch(`${API_BASE}/classrooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ educator_id: user.id, name: newName, description: newDesc }),
    });
    const data = await res.json();
    setTeaching(prev => [...prev, { ...data, educator_id: user.id, description: newDesc, created_at: new Date().toISOString() }]);
    setCreateOpen(false);
    setNewName('');
    setNewDesc('');
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const res = await fetch(`${API_BASE}/classrooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode, student_id: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setEnrolled(prev => [...prev, { id: data.classroom_id, name: data.name, code: joinCode, description: '', educator_id: '', created_at: '' }]);
      setJoinOpen(false);
      setJoinCode('');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  if (!user) return null;

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
          <span className="text-sm">Classrooms</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Classrooms</h1>
          <div className="flex gap-2">
            <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <ClipboardList className="h-4 w-4" /> Join Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join a Classroom</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Class Code</Label>
                    <Input placeholder="Enter 6-character code" value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} />
                  </div>
                  <Button className="w-full" onClick={handleJoin}>Join</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" /> Create Class
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a Classroom</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Class Name</Label>
                    <Input placeholder="AP Physics 2026" value={newName} onChange={e => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optional)</Label>
                    <Input placeholder="Section 3, Period 2" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                  </div>
                  <Button className="w-full" onClick={handleCreate}>Create Classroom</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground py-12 text-center">Loading classrooms...</p>
        ) : (
          <>
            {/* Teaching */}
            {teaching.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Teaching
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {teaching.map(c => (
                    <Card key={c.id} className="cursor-pointer hover:ring-2 hover:ring-primary/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{c.name}</h3>
                            {c.description && <p className="text-sm text-muted-foreground mt-0.5">{c.description}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs">Educator</Badge>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Join code:</span>
                          <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{c.code}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.code)}>
                            {copiedCode === c.code ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Enrolled */}
            {enrolled.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <BookOpen className="h-4 w-4" /> Enrolled
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {enrolled.map(c => (
                    <Card key={c.id} className="cursor-pointer hover:ring-2 hover:ring-primary/50">
                      <CardContent className="p-4">
                        <h3 className="font-semibold">{c.name}</h3>
                        <Badge variant="outline" className="text-xs mt-2">Student</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {teaching.length === 0 && enrolled.length === 0 && (
              <div className="py-16 text-center">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-1">No classrooms yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a classroom as an educator, or join one with a class code.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
