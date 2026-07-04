import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Nilecon HR</h1>
        <p className="mt-1 text-sm text-slate-500">WFH &amp; Leave Management</p>

        <div className="mt-8 space-y-3">
          <Link
            to="/employee"
            className="flex items-center justify-between rounded-2xl bg-line px-5 py-4 text-white transition hover:bg-line-dark"
          >
            <span className="font-semibold">Employee (LINE)</span>
            <span aria-hidden>→</span>
          </Link>
          <Link
            to="/hr"
            className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white transition hover:bg-slate-800"
          >
            <span className="font-semibold">HR / Admin Console</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
