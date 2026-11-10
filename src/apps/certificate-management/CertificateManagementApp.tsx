import { useNavigate, useSearchParams } from 'react-router-dom';
import './index.css';
import './i18n';
import App, { type AppMode } from './App';

export default function CertificateManagementApp() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const modeParam = searchParams.get('mode') as AppMode | null;

  return (
    <App
      externalMode={modeParam}
      onExternalModeSync={(nextMode) => {
        setSearchParams({ mode: nextMode }, { replace: true });
      }}
      onBackToRoot={() => navigate('/')}
    />
  );
}
