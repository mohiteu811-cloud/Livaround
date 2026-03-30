'use client';

import { useState } from 'react';
import { CheckCircle2, Handshake, TrendingUp, Shield, DollarSign } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://livaroundbackend-production.up.railway.app';

const promotionOptions = [
  { value: 'social_media', label: 'Social Media' },
  { value: 'blog_content', label: 'Blog / Content' },
  { value: 'direct_outreach', label: 'Direct Outreach' },
  { value: 'property_management', label: 'Property Management Consultant' },
  { value: 'real_estate', label: 'Real Estate Agent' },
  { value: 'other', label: 'Other' },
];

interface RegistrationResult {
  referralCode: string;
  referralLink: string;
  partnerToken: string;
  commissionRate: number;
}

export default function PartnerJoinPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    paypalEmail: '',
    country: '',
    promotionMethod: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RegistrationResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/partner/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Welcome to LivAround Partners!</h1>
            <p className="text-slate-400 mb-6">You&apos;re now a Referral Partner earning 15% commission.</p>

            <div className="bg-slate-800 rounded-xl p-5 text-left mb-6 space-y-3">
              <div>
                <p className="text-xs text-slate-500">Your Referral Code</p>
                <p className="text-lg font-mono font-bold text-brand-400">{result.referralCode}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Your Referral Link</p>
                <p className="text-sm text-slate-300 break-all">{result.referralLink}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(result.referralLink)}
                className="w-full mt-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Copy Referral Link
              </button>
            </div>

            <a
              href={`/partners/dashboard?token=${result.partnerToken}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Partner Dashboard
            </a>

            <p className="text-xs text-slate-500 mt-4">
              Check your email for a welcome message with your quick-start guide.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Hero */}
      <div className="bg-gradient-to-b from-brand-600/20 to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto">
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold">
                  L
                </div>
                <span className="font-bold text-xl text-slate-100">LivAround</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-100 mb-4">
              Earn Money Referring Property Managers
            </h1>
            <p className="text-lg text-slate-400">
              Join the LivAround Partner Program and earn up to 25% recurring commission
              for every customer you refer. No account needed — sign up in 60 seconds.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Benefits */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-100">Why Partner With Us?</h2>

            <div className="space-y-4">
              {[
                {
                  icon: DollarSign,
                  title: '15% Recurring Commission',
                  desc: 'Earn 15% of every monthly subscription payment from customers you refer. Not just once — every month they stay.',
                },
                {
                  icon: TrendingUp,
                  title: 'Tier Upgrades to 25%',
                  desc: 'Hit 10+ active customers and your commission rate automatically increases to 25% as a Channel Partner.',
                },
                {
                  icon: Shield,
                  title: '30-Day Cookie Window',
                  desc: 'Your referral link sets a 30-day cookie. If someone signs up within 30 days of clicking your link, you get credit.',
                },
                {
                  icon: Handshake,
                  title: 'Real-Time Dashboard',
                  desc: 'Track clicks, signups, conversions, and earnings in real-time. Monthly PayPal payouts with just a $25 minimum.',
                },
              ].map((benefit) => (
                <div key={benefit.title} className="flex gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-600/20">
                    <benefit.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{benefit.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Tier table */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
              <h3 className="font-semibold text-slate-200 mb-3">Commission Tiers</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500">
                    <th className="pb-2 text-left font-medium">Tier</th>
                    <th className="pb-2 text-left font-medium">Commission</th>
                    <th className="pb-2 text-left font-medium">Requirement</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5">Referral Partner</td>
                    <td className="py-2.5 text-emerald-400 font-medium">15%</td>
                    <td className="py-2.5 text-slate-400">Sign up</td>
                  </tr>
                  <tr className="border-b border-slate-800/50">
                    <td className="py-2.5">Channel Partner</td>
                    <td className="py-2.5 text-emerald-400 font-medium">25%</td>
                    <td className="py-2.5 text-slate-400">10+ active customers, &lt;30% churn</td>
                  </tr>
                  <tr>
                    <td className="py-2.5">Strategic Partner</td>
                    <td className="py-2.5 text-emerald-400 font-medium">5% network override</td>
                    <td className="py-2.5 text-slate-400">Application + admin approval</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Registration Form */}
          <div>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 md:p-8 sticky top-8">
              <h2 className="text-xl font-bold text-slate-100 mb-1">Join the Partner Program</h2>
              <p className="text-sm text-slate-400 mb-6">Free to join. Start earning in minutes.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 px-3 py-2.5 text-sm"
                    placeholder="John Smith"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 px-3 py-2.5 text-sm"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">PayPal Email (for payouts)</label>
                  <input
                    type="email"
                    required
                    value={form.paypalEmail}
                    onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 px-3 py-2.5 text-sm"
                    placeholder="john@paypal.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Country</label>
                  <input
                    type="text"
                    required
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 px-3 py-2.5 text-sm"
                    placeholder="United States"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">How do you plan to promote LivAround?</label>
                  <select
                    required
                    value={form.promotionMethod}
                    onChange={(e) => setForm({ ...form, promotionMethod: e.target.value })}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 px-3 py-2.5 text-sm cursor-pointer"
                  >
                    <option value="" disabled>Select a method...</option>
                    {promotionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating your partner account...
                    </>
                  ) : (
                    'Join Partner Program'
                  )}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  By signing up, you agree to our partner terms. No LivAround account required.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
