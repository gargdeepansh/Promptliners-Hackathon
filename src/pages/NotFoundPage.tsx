import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-6 py-20 flex flex-col items-center justify-center text-center gap-4">
        <span className="font-mono text-3xl font-bold text-muted">404</span>
        <h1 className="text-xl font-bold text-ink">Page not found</h1>
        <p className="text-xs text-muted max-w-sm leading-relaxed">
          The requested page does not exist. Use the link below to return to Sortie home.
        </p>

        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-ink text-surface text-xs font-semibold rounded-[6px] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Home</span>
        </Link>
      </main>

      <Footer />
    </div>
  );
}
