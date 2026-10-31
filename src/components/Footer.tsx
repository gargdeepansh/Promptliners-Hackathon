import { Link } from 'react-router-dom';
import { siteConfig } from '../config/site';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-line bg-surface py-6 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-4">
        <div className="flex items-center gap-6">
          <Link
            to="/terms"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[4px]"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[4px]"
          >
            Privacy
          </Link>
          <a
            href={`mailto:${siteConfig.contactEmail}`}
            className="hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-[4px]"
          >
            {siteConfig.contactEmail}
          </a>
        </div>
        <div className="font-mono tabular-nums">
          Copyright {currentYear} {siteConfig.operatorName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
