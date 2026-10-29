
export default function App() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-indigo-600">
            MyApp
          </h1>

          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
            Get Started
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-4xl font-bold text-slate-900">
          Welcome to React + Tailwind
        </h2>

        <p className="mt-4 max-w-xl text-lg text-slate-600">
          Build responsive and maintainable user interfaces
          using reusable React components and Tailwind CSS.
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-800">
            Your first component
          </h3>

          <p className="mt-2 text-slate-600">
            Your project is ready for development.
          </p>
        </div>
      </main>
    </div>
  )
}
