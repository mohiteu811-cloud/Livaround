import Link from 'next/link';

const ROLES = [
  {
    href: '/login',
    icon: '🏠',
    title: 'Host',
    description: 'Manage properties, bookings, staff and financials',
    accent: 'from-violet-600/20 to-violet-600/5 border-violet-500/30 hover:border-violet-500/60',
    badge: 'bg-violet-500/10 text-violet-300',
  },
  {
    href: '/owner/login',
    icon: '👤',
    title: 'Owner',
    description: 'View your property performance and revenue reports',
    accent: 'from-emerald-600/20 to-emerald-600/5 border-emerald-500/30 hover:border-emerald-500/60',
    badge: 'bg-emerald-500/10 text-emerald-300',
  },
  {
    href: '/worker/login',
    icon: '🔧',
    title: 'Worker',
    description: 'Access your jobs, checklists and property guides',
    accent: 'from-amber-600/20 to-amber-600/5 border-amber-500/30 hover:border-amber-500/60',
    badge: 'bg-amber-500/10 text-amber-300',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / brand */}
        <div className="text-center space-y-2">
          <div className="text-4xl font-bold text-slate-100 tracking-tight">LivAround</div>
          <p className="text-slate-400 text-sm">Select your role to continue</p>
        </div>

        {/* Role cards */}
        <div className="space-y-3">
          {ROLES.map((role) => (
            <Link
              key={role.href}
              href={role.href}
              className={`flex items-center gap-4 p-5 rounded-xl border bg-gradient-to-br ${role.accent} transition-all duration-200 group`}
            >
              <div className="text-3xl">{role.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-slate-100">{role.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${role.badge}`}>
                    Login
                  </span>
                </div>
                <p className="text-slate-400 text-sm">{role.description}</p>
              </div>
              <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
