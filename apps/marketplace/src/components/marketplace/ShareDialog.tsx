import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Share2, Copy, Check, Code, Link2 } from 'lucide-react';

interface ShareDialogProps {
  slug: string;
  name: string;
}

export function ShareDialog({ slug, name }: ShareDialogProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const playUrl = `${window.location.origin}/play/${slug}`;
  const detailUrl = `${window.location.origin}/sim/${slug}`;
  const embedCode = `<iframe src="${playUrl}" width="800" height="600" frameborder="0" allow="fullscreen" title="${name}"></iframe>`;

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Share2 className="h-4 w-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share "{name}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Link2 className="h-3 w-3" /> Direct Link</Label>
            <div className="flex gap-2">
              <Input value={detailUrl} readOnly className="text-xs" />
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(detailUrl, 'link')}>
                {copied === 'link' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Share2 className="h-3 w-3" /> Play Link</Label>
            <div className="flex gap-2">
              <Input value={playUrl} readOnly className="text-xs" />
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(playUrl, 'play')}>
                {copied === 'play' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Code className="h-3 w-3" /> Embed (for LMS / websites)</Label>
            <div className="flex gap-2">
              <Input value={embedCode} readOnly className="text-xs font-mono" />
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => copy(embedCode, 'embed')}>
                {copied === 'embed' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Paste this into Canvas, Google Classroom, Moodle, or any website.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
