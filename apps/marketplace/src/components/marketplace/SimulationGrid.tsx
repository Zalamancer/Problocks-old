import { useEffect, useState, useMemo } from 'react';
import { fetchSimulations, type Simulation } from '@/lib/api';
import { SimulationCard } from './SimulationCard';
import { SimulationGridSkeleton } from './SimulationSkeleton';
import { getHardwareProfile, type DeviceTier } from '@/lib/hardware';

const CATEGORY_GRADIENTS: Record<string, string> = {
  physics: 'linear-gradient(135deg, #2d1b69, #11998e)',
  circuits: 'linear-gradient(135deg, #1f1c2c, #928dab)',
  chemistry: 'linear-gradient(135deg, #134e5e, #71b280)',
  engineering: 'linear-gradient(135deg, #4a1942, #c74b50)',
  biology: 'linear-gradient(135deg, #56ab2f, #a8e063)',
  math: 'linear-gradient(135deg, #667eea, #764ba2)',
  cs: 'linear-gradient(135deg, #fc5c7d, #6a82fb)',
  earth: 'linear-gradient(135deg, #373b44, #4286f4)',
  general: 'linear-gradient(135deg, #1a1a2e, #16213e)',
};

interface SimulationGridProps {
  category: string;
  search: string;
}

export function SimulationGrid({ category, search }: SimulationGridProps) {
  const [sims, setSims] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const hw = useMemo(() => getHardwareProfile(), []);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      fetchSimulations({
        category: category === 'all' ? undefined : category,
        search: search || undefined,
        limit: 20,
      })
        .then(setSims)
        .catch(() => setSims([]))
        .finally(() => setLoading(false));
    }, search ? 300 : 0);

    return () => clearTimeout(timeout);
  }, [category, search]);

  if (loading) {
    return <SimulationGridSkeleton />;
  }

  if (sims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="text-lg font-medium">No simulations found</span>
        <span className="mt-1 text-sm text-muted-foreground">
          {search ? `No results for "${search}"` : 'Be the first to publish in this category!'}
        </span>
      </div>
    );
  }

  const featured = sims.slice(0, 3);
  const rest = sims.slice(3);

  return (
    <>
      {hw.tier === 'low' && (
        <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-200">
          Lite mode — showing games optimized for your device. Some 3D games may be hidden.
        </div>
      )}
      {!search && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold">
            {category === 'all' ? 'Featured Simulations' : `Top ${category.charAt(0).toUpperCase() + category.slice(1)}`}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map(sim => (
              <SimulationCard
                key={sim.id}
                sim={sim}
                thumbnail={CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general}
                featured
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {search ? `Results for "${search}"` : 'All Simulations'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {sims.length} simulation{sims.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(search ? sims : rest).map(sim => (
            <SimulationCard
              key={sim.id}
              sim={sim}
              thumbnail={CATEGORY_GRADIENTS[sim.category] ?? CATEGORY_GRADIENTS.general}
            />
          ))}
        </div>
      </section>
    </>
  );
}
