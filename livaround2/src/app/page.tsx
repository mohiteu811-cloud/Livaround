import Link from 'next/link'
import { CheckCircle, Star, Video, ArrowRight, Shield } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0D0D1A] text-white">
      <div className="max-w-lg mx-auto px-6 py-16 flex flex-col gap-16">

        {/* Hero */}
        <div className="flex flex-col gap-6">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            North Goa · London · Barcelona
          </div>
          <h1 className="text-5xl font-bold leading-tight">
            Live<span className="text-emerald-400">Around</span>
          </h1>
          <p className="text-xl text-white/70 leading-relaxed">
            The only short-term rental platform where guests are accountable for how they leave.
          </p>
        </div>

        {/* Features */}
        <div className="flex flex-col gap-4">
          {[
            {
              icon: Video,
              title: 'Dual-Verified Checkout',
              desc: 'Guests and hosts both record a walkthrough. Every checkout is on record.',
              color: 'text-blue-400',
            },
            {
              icon: Star,
              title: 'Checkout Score',
              desc: 'Guests build a verifiable score based on how they leave properties — not just how they behave.',
              color: 'text-amber-400',
            },
            {
              icon: Shield,
              title: 'Host-Led Platform',
              desc: 'Hosts filter guests by Checkout Score. Only high-scoring guests can book premium properties.',
              color: 'text-emerald-400',
            },
            {
              icon: CheckCircle,
              title: 'Multi-Way Home Exchange',
              desc: '3 and 4-way home swaps. A goes to London, B goes to Barcelona, C goes to Goa.',
              color: 'text-purple-400',
            },
          ].map((f) => (
            <div key={f.title} className="bg-white/5 rounded-2xl p-5 flex gap-4 border border-white/10">
              <f.icon size={22} className={`${f.color} flex-shrink-0 mt-0.5`} />
              <div>
                <p className="font-semibold mb-1">{f.title}</p>
                <p className="text-sm text-white/60">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link
            href="/checkout/demo-booking-id"
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-6 py-4 rounded-2xl transition-colors"
          >
            Try Checkout Verification <ArrowRight size={18} />
          </Link>
          <p className="text-center text-white/40 text-xs">
            Superhost-only launch · North Goa, India
          </p>
        </div>

      </div>
    </main>
  )
}
