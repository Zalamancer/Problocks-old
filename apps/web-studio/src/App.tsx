import { StudioProvider } from './store/StudioProvider';
import { StudioLayout } from './components/studio/StudioLayout';

export function App() {
  return (
    <StudioProvider>
      <div className="h-screen w-screen overflow-hidden">
        <StudioLayout />
      </div>
    </StudioProvider>
  );
}
