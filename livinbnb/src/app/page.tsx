import UrlImportForm from '@/components/UrlImportForm';
import ListingsBoard from '@/components/ListingsBoard';
import DemandTicker from '@/components/DemandTicker';
import { ArrowRight, Globe2, Users, Zap, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">
            livin<span className="text-sand-500">bnb</span>
          </span>
          <a href="#get-started" className="text-sm font-medium text-slate-600 hover:text-sand-500 transition-colors">
            Join waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center bg-gradient-to-b from-sand-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-sand-100 text-sand-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            Now in early access — join the waitlist
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-slate-900 leading-tight mb-6">
            Home exchange,{' '}
            <span className="text-sand-500">without the back-and-forth</span>
          </h1>
          <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop sending dozens of individual swap requests. Livinbnb matches you in 2, 3, and 4-way circular exchanges —
            so everyone gets where they want to go.
          </p>

          {/* Exchange diagram */}
          <div className="flex items-center justify-center gap-0 mb-12 flex-wrap">
            <ExchangeNode flag="🇮🇳" city="Goa" arrow="→" label="A" />
            <ExchangeNode flag="🇬🇧" city="London" arrow="→" label="B" />
            <ExchangeNode flag="🇪🇸" city="Barcelona" arrow="→" label="C" />
            <ExchangeNode flag="🇮🇳" city="Goa" arrow="" label="A" dim />
          </div>

          <a
            href="#get-started"
            className="inline-flex items-center gap-2 bg-sand-500 hover:bg-sand-600 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-colors shadow-lg shadow-sand-200"
          >
            List your home for free <ArrowRight className="w-4 h-4" />
          </a>
          <p className="text-sm text-slate-400 mt-4">No credit card · Takes 2 minutes</p>
          <DemandTicker />
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">How it works</h2>
          <p className="text-center text-slate-500 mb-16 max-w-xl mx-auto">
            Three steps to your next home exchange — no cold messaging strangers.
          </p>
          <div className="grid md:grid-cols-3 gap-10">
            <Step
              number="01"
              icon={<Globe2 className="w-6 h-6" />}
              title="Link your listing"
              description="Paste your Airbnb or HomeExchange URL. We import your property details instantly — no re-uploading photos."
            />
            <Step
              number="02"
              icon={<MapPin />}
              title="Tell us where you're headed"
              description="Add your destination and travel window. Long stays, short trips — any duration works."
            />
            <Step
              number="03"
              icon={<Users className="w-6 h-6" />}
              title="We find your circle"
              description="Our algorithm finds 2, 3, or 4-way exchange loops where everyone wins. You get notified with a complete match — not a maybe."
            />
          </div>
        </div>
      </section>

      {/* Why Livinbnb */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">
                Why not just use HomeExchange?
              </h2>
              <div className="flex flex-col gap-5">
                <ComparisonRow
                  bad="Send 50 individual requests, hope someone wants exactly what you have"
                  good="One profile, automated circular matching"
                />
                <ComparisonRow
                  bad="Only 1:1 direct swaps — severely limits who you can match with"
                  good="3 and 4-way loops multiply your match options by 10×"
                />
                <ComparisonRow
                  bad="Annual subscription before you've even found a match"
                  good="Free to list. Only pay when you have a confirmed exchange"
                />
                <ComparisonRow
                  bad="Rebuild your profile from scratch"
                  good="Borrow your Airbnb reviews and listing instantly"
                />
              </div>
            </div>
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-sand-500 mb-1">3×</div>
                <div className="text-slate-500 text-sm">more matches vs. 1:1 swaps</div>
              </div>
              <div className="flex flex-col gap-4">
                <Stat label="Avg. time to first match" value="< 2 weeks" />
                <Stat label="Supported exchange chains" value="2 · 3 · 4-way" />
                <Stat label="Platform links supported" value="Airbnb + HomeExchange" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Form */}
      <section id="get-started" className="py-24 px-6 bg-white">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            List your home. Find your exchange.
          </h2>
          <p className="text-slate-500">
            Your home goes on the public board instantly — the more homes listed, the more exchange routes we find.
          </p>
        </div>
        <UrlImportForm />
      </section>

      {/* Public listings board */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Homes on the exchange</h2>
            <p className="text-slate-500 text-sm max-w-lg mx-auto">
              Real homes from real people — click any listing to see the full property on Airbnb or HomeExchange.
              List yours above to appear here.
            </p>
          </div>
          <ListingsBoard />
        </div>
      </section>

      {/* Trust bar */}
      <section className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8">
          <TrustItem icon={<ShieldCheck className="w-5 h-5 text-green-500" />} label="Verified Airbnb profiles" />
          <TrustItem icon={<ShieldCheck className="w-5 h-5 text-green-500" />} label="Identity verification" />
          <TrustItem icon={<ShieldCheck className="w-5 h-5 text-green-500" />} label="Exchange contracts included" />
          <TrustItem icon={<ShieldCheck className="w-5 h-5 text-green-500" />} label="No-match, no-charge" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-100 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Livinbnb. Home exchange, reimagined.
      </footer>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ExchangeNode({
  flag, city, arrow, label, dim,
}: {
  flag: string; city: string; arrow: string; label: string; dim?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1 ${dim ? 'opacity-40' : ''}`}>
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border border-slate-100 flex flex-col items-center justify-center gap-0.5 text-center">
          <span className="text-2xl">{flag}</span>
          <span className="text-xs font-medium text-slate-600 leading-tight">{city}</span>
        </div>
        <span className="text-xs text-slate-400 mt-1 font-mono">{label}</span>
      </div>
      {arrow && (
        <span className="text-sand-400 font-bold text-xl mx-1">{arrow}</span>
      )}
    </div>
  );
}

function Step({
  number, icon, title, description,
}: {
  number: string; icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-4xl font-bold text-sand-100 font-mono">{number}</span>
        <div className="w-10 h-10 rounded-xl bg-sand-50 flex items-center justify-center text-sand-500">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function MapPin() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 13 6 13s6-7.75 6-13c0-3.314-2.686-6-6-6z" />
      <circle cx="12" cy="8" r="2.5" />
    </svg>
  );
}

function ComparisonRow({ bad, good }: { bad: string; good: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div className="flex gap-2 text-slate-400">
        <span className="flex-shrink-0 mt-0.5 text-red-400">✕</span>
        <span>{bad}</span>
      </div>
      <div className="flex gap-2 text-slate-700">
        <span className="flex-shrink-0 mt-0.5 text-green-500">✓</span>
        <span>{good}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function TrustItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      {icon}
      <span>{label}</span>
    </div>
  );
}
