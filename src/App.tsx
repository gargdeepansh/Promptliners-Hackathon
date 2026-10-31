import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PlaySelectPage } from './pages/PlaySelectPage';
import { PlayGamePage } from './pages/PlayGamePage';
import { PlanReviewPage } from './pages/PlanReviewPage';
import { HistoryPage } from './pages/HistoryPage';
import { RulesPage } from './pages/RulesPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<PlaySelectPage />} />
        <Route path="/play/files" element={<PlayGamePage packType="file" />} />
        <Route path="/play/expenses" element={<PlayGamePage packType="expense" />} />
        <Route path="/plan" element={<PlanReviewPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/rules" element={<RulesPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
