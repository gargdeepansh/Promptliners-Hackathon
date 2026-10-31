import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { siteConfig } from '../config/site';

export function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Terms of Service</h1>
          <p className="text-xs text-muted mt-2 font-mono">
            Last updated: October 31, 2026. Operator: {siteConfig.operatorName}
          </p>
        </div>

        <div className="space-y-6 text-sm text-ink leading-relaxed">
          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">1. Service Description</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie provides an in-browser triage interface that groups local files and expense
              records into decision cards. Decisions made during a run assemble an action plan.
              Actions are only executed when the user initiates the Apply step.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">2. Eligibility</h2>
            <p className="text-xs text-muted leading-relaxed">
              By using Sortie, you represent that you are at least 18 years old or possess legal
              parental or guardian consent, and that you have full legal right to manipulate the
              files and financial data you process.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">3. Mandatory Plan Review Prior to Apply</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie is designed not to make destructive changes during gameplay. The game builds a
              Plan. You are solely responsible for reviewing the pending actions listed on the Plan
              Review screen before pressing Apply. Untick any items you do not wish to move or
              modify.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">4. Scope of Undo Functionality</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie provides an undo log to revert applied operations. Revert operations are best
              effort. Sortie cannot restore, track, or revert changes if files have been moved,
              renamed, deleted, or edited by other applications or processes outside of Sortie.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">5. Acceptable Use</h2>
            <p className="text-xs text-muted leading-relaxed">
              You agree to use Sortie only for lawful organizational tasks on systems and data you are
              authorized to manage. You may not attempt to reverse engineer, disrupt, or interfere
              with the integrity of the application.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">6. Disclaimer of Warranties</h2>
            <p className="text-xs text-muted leading-relaxed">
              Sortie is provided on an "as is" and "as available" basis without warranties of any
              kind, whether express or implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement. We do not
              warrant that the application will be uninterrupted or error-free.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">7. Limitation of Liability</h2>
            <p className="text-xs text-muted leading-relaxed">
              To the maximum extent permitted by applicable law, in no event shall{' '}
              {siteConfig.operatorName}, its directors, employees, or partners be liable for any
              indirect, incidental, special, consequential, or punitive damages, including loss of
              data, file corruption, or business interruption, arising from your use of the service.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">8. Termination</h2>
            <p className="text-xs text-muted leading-relaxed">
              We reserve the right to modify, suspend, or discontinue the service at any time without
              notice. You may terminate your use of Sortie at any time simply by ceasing use and
              clearing your local storage.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">9. Governing Law</h2>
            <p className="text-xs text-muted leading-relaxed">
              These Terms shall be governed and construed in accordance with the laws of{' '}
              {siteConfig.jurisdiction}, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="border border-line bg-surface rounded-[6px] p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">10. Contact Information</h2>
            <p className="text-xs text-muted leading-relaxed">
              If you have any questions about these Terms, please contact {siteConfig.operatorName} at{' '}
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
