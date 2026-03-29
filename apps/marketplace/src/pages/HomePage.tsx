import { useState } from 'react';
import { Header } from '@/components/marketplace/Header';
import { CategoryBar } from '@/components/marketplace/CategoryBar';
import { SimulationGrid } from '@/components/marketplace/SimulationGrid';

export function HomePage() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  return (
    <>
      <Header search={search} onSearch={setSearch} />
      <CategoryBar active={category} onSelect={setCategory} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <SimulationGrid category={category} search={search} />
      </main>
    </>
  );
}
