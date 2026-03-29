import { StudioProvider } from './store/StudioProvider';
import { StudioLayout } from './components/studio/StudioLayout';

export function App() {
  return (
    <StudioProvider>
      <StudioLayout />
    </StudioProvider>
  );
}
