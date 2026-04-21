export default function CheckEmailPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <div className="text-3xl mb-4">✉️</div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Check your email
          </h1>
          <p className="text-sm text-slate-500">
            We sent you a sign-in link. Click it to continue.
          </p>
        </div>
      </div>
    </main>
  );
}
