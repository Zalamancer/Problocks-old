import { Button } from '@/components/ui/button';
import {
  Atom, Cpu, FlaskConical, Cog, Dna, Calculator, Code, Globe, Flame,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: Flame },
  { id: 'physics', name: 'Physics', icon: Atom },
  { id: 'circuits', name: 'Circuits', icon: Cpu },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical },
  { id: 'engineering', name: 'Engineering', icon: Cog },
  { id: 'biology', name: 'Biology', icon: Dna },
  { id: 'math', name: 'Math', icon: Calculator },
  { id: 'cs', name: 'CS', icon: Code },
  { id: 'earth', name: 'Earth Science', icon: Globe },
];

interface CategoryBarProps {
  active: string;
  onSelect: (id: string) => void;
}

export function CategoryBar({ active, onSelect }: CategoryBarProps) {
  return (
    <div className="border-b bg-card/50">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-2">
        {CATEGORIES.map(cat => (
          <Button
            key={cat.id}
            variant={active === cat.id ? 'default' : 'ghost'}
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => onSelect(cat.id)}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
