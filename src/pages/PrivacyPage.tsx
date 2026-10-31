import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { siteConfig } from '../config/site';

export function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Privacy Policy</h1>
          <p className="text-xs text-muted mt-2 font-mono">
            Last updated: October 31, 2026. Effective immediately.
          </p>
        </div>

        <div className="space-y-6 text-sm text-ink leading-relaxed">
          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">1. Client-Side Data Architecture</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie operates entirely within your browser. All file and expense data stays in your
              browser unless Decision Suggestions is explicitly turned on.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              When you select a local directory or upload a bank transaction CSV, all parsing, pattern
              matching, grouping, and file operations happen directly on your device. Your file
              contents, documents, and transaction records never leave your browser unless Decision
              Suggestions is enabled, in which case only file names and merchant names from cluster
              summaries are transmitted.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">2. What Is Stored Locally and How to Clear It</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie uses your browser's local IndexedDB storage to persist:
            </p>
            <ul className="text-xs text-muted list-disc list-inside space-y-1">
              <li>Custom automation rules that you create or save during play</li>
              <li>Pending action plans that you have built during a run</li>
              <li>Past run summaries (scores, duration, item counts)</li>
              <li>Apply logs used for the local undo feature</li>
              <li>User preferences, such as whether AI suggestions are enabled</li>
            </ul>
            <p className="text-xs text-muted leading-relaxed">
              You can clear all stored local data at any time by visiting the History page and
              clicking "Clear Local History", or by using your browser's site settings to clear
              stored data for this domain.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">3. No Cookies and No Trackers</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie does not use tracking cookies, analytics scripts, advertising pixels, or
              fingerprinting mechanisms. We do not track you across sessions or across websites.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">4. Optional Gemini AI Feature and Data Transmission</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie includes an optional feature labelled "Suggest decisions. Sends file names and
              merchant names to Google's Gemini API."
            </p>
            <p className="text-xs text-muted leading-relaxed">
              This feature is disabled by default. If you explicitly enable this feature in run
              settings, Sortie sends only high-level cluster summaries to Google Gemini models via
              our server proxy.
            </p>
            <p className="text-xs text-muted leading-relaxed">
              Fields sent when enabled (batch request of up to 30 clusters at run start):
            </p>
            <ul className="text-xs text-muted list-disc list-inside space-y-1">
              <li>Cluster label and pattern (e.g., "*.png" or "Uber")</li>
              <li>Number of items in the cluster</li>
              <li>Up to 3 sample item descriptions (file names and merchant names with all amounts stripped)</li>
              <li>Calculated recurring status (yes or no)</li>
            </ul>
            <p className="text-xs text-muted leading-relaxed">
              No financial amounts, spending totals, file contents, account numbers, or entire CSV files are ever sent.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">5. Hosting Provider and Retention</h2>
            <p className="text-xs text-muted leading-relaxed">
              The static web assets for Sortie are hosted via {siteConfig.hostingProvider}. When
              you load the web page, your browser downloads the application bundle. Standard web
              server access logs (IP address, user agent) may be recorded by the hosting provider
              for infrastructure security and are retained according to their standard network
              security policies.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">6. User Rights</h2>
            <p className="text-xs text-muted leading-relaxed">
              Because your personal data is held locally on your own machine rather than on our
              servers, you maintain full and direct control over your records at all times. You may
              inspect, export, or erase your data at your discretion.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">7. Children's Privacy</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie is intended for general audiences and does not knowingly collect personal
              identifiable information from children under the age of 13.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">8. Changes to this Policy</h2>
            <p className="text-xs text-muted leading-relaxed">
              We may update this Privacy Policy from time to time to reflect functional adjustments.
              Any modifications will be posted to this page with an updated revision date.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">9. Contact</h2>
            <p className="text-xs text-muted leading-relaxed">
              For any questions regarding this Privacy Policy, please contact{' '}
              <a href={`mailto:${siteConfig.contactEmail}`} className="text-ink underline">
                {siteConfig.contactEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
