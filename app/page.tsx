import Link from "next/link";

const outcomes = [
  ["01", "See the buyer questions that matter", "Turn a website into discovery, comparison and decision questions that can put a brand on—or off—a shortlist."],
  ["02", "Measure answers, not assumptions", "Run repeatable AI-search observations and inspect the answers, competitors and cited sources behind every signal."],
  ["03", "Turn evidence into action", "Approve evidence-backed fixes, preserve a baseline and measure again after implementation."],
];

const reasons = [
  "Find where competitors enter the shortlist and your brand disappears.",
  "Identify the buyer journeys with the largest commercial gap.",
  "Trace findings back to captured answers and source evidence.",
  "Give teams an action queue instead of another vanity score.",
];

export default function Home() {
  return (
    <main className="h-screen overflow-y-auto bg-[#080d12] text-white selection:bg-[#c0fc06] selection:text-black">
      <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#080d12]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-black tracking-tight">SERO<span className="text-[#c0fc06]">Q</span></Link>
          <div className="hidden gap-7 text-sm text-zinc-400 md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#why" className="hover:text-white">Why Seroq</a>
            <a href="#workflow" className="hover:text-white">How it works</a>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-[#c0fc06]/30 bg-[#c0fc06]/10 px-4 py-2 text-sm font-semibold text-[#d7ff58]">Open Seroq</Link>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/[0.07]">
        <div className="pointer-events-none absolute left-1/2 top-10 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-[#8cff2d]/[0.07] blur-[120px]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-24 text-center sm:pt-32">
          <div className="inline-flex rounded-full border border-[#c0fc06]/20 bg-[#c0fc06]/[0.06] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#d7ff58]">AI search decision intelligence</div>
          <h1 className="mx-auto mt-7 max-w-5xl text-5xl font-black leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            Be the brand they find.
            <span className="mt-2 block bg-gradient-to-r from-[#c0fc06] via-[#70df54] to-[#13bca2] bg-clip-text text-transparent">Become the brand they choose.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-zinc-400">Seroq shows how your brand appears when buyers ask AI for recommendations—then turns the evidence into prioritized, measurable action.</p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="rounded-xl bg-[#c0fc06] px-7 py-4 text-sm font-bold text-black shadow-[0_0_34px_rgba(192,252,6,0.18)]">Start a Seroq scan →</Link>
            <a href="#product" className="rounded-xl border border-white/10 bg-white/[0.03] px-7 py-4 text-sm font-semibold text-zinc-300">See what Seroq does</a>
          </div>

          <div className="mx-auto mt-16 max-w-4xl rounded-2xl border border-white/10 bg-[#0d141a]/90 p-3 text-left shadow-2xl">
            <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 pb-3 text-[11px] uppercase tracking-[0.16em] text-zinc-600"><span className="h-2 w-2 rounded-full bg-[#c0fc06]" /> Live measurement workspace</div>
            <div className="grid gap-3 p-3 md:grid-cols-[1.15fr_.85fr]">
              <div className="rounded-xl border border-white/[0.07] bg-black/20 p-5">
                <div className="text-xs text-zinc-500">Buyer question</div>
                <div className="mt-3 text-base font-medium text-zinc-200">Which provider is best for a growing business that needs reliable automation?</div>
                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {["Quick · 3", "Standard · 5", "Full · 10"].map((item, index) => <div key={item} className={`rounded-lg border px-2 py-3 text-xs ${index === 2 ? "border-[#c0fc06]/30 bg-[#c0fc06]/[0.07] text-[#d7ff58]" : "border-white/[0.07] text-zinc-500"}`}>{item}</div>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[["64%", "Observed mentions"], ["7", "Recurring rivals"], ["18", "Source domains"], ["4", "Priority actions"]].map(([value, label]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><div className="text-2xl font-bold">{value}</div><div className="mt-2 text-xs text-zinc-500">{label}</div></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fdc38]">What Seroq does</div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">From one website to an evidence-backed growth loop.</h2>
          <p className="mt-5 leading-7 text-zinc-400">AI discovery is not one ranking. Seroq organizes different questions and answers into buyer journeys, observations, evidence and controlled next steps.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {outcomes.map(([number, title, text]) => <article key={number} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6"><div className="text-xs font-bold tracking-[0.18em] text-[#9fdc38]">{number}</div><h3 className="mt-7 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{text}</p></article>)}
        </div>
      </section>

      <section id="why" className="border-y border-white/[0.07] bg-[#0b1117]">
        <div className="mx-auto grid max-w-6xl gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fdc38]">Why would a buyer choose Seroq?</div><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Because “we are invisible” is not an actionable diagnosis.</h2><p className="mt-5 leading-7 text-zinc-400">Seroq connects the business question to the observed answer, the competitors that appeared, the evidence available and the work your team can approve.</p></div>
          <div className="space-y-3">{reasons.map((reason) => <div key={reason} className="flex gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-sm leading-6 text-zinc-300"><span className="mt-1 text-[#c0fc06]">✓</span>{reason}</div>)}</div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#9fdc38]">The Seroq workflow</div>
        <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Analyze. Measure. Improve. Measure again.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] text-left md:grid-cols-4">
          {[["1", "Analyze", "Understand the brand, offer, market and competitors."], ["2", "Measure", "Run 3, 5 or 10 commercial buyer journeys."], ["3", "Act", "Approve evidence-backed fixes in Action Center."], ["4", "Remeasure", "Compare later observations with the baseline."]].map(([number, title, text]) => <div key={number} className="bg-[#080d12] p-6"><div className="text-sm font-bold text-[#c0fc06]">{number}</div><div className="mt-8 text-lg font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-zinc-500">{text}</p></div>)}
        </div>
      </section>

      <section className="px-6 pb-24"><div className="mx-auto max-w-6xl rounded-3xl border border-[#c0fc06]/20 bg-gradient-to-br from-[#c0fc06]/[0.10] to-[#13bca2]/[0.04] px-6 py-14 text-center"><h2 className="text-3xl font-bold">Find the buyer journeys your brand is losing.</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400">Start with one website. Build the buyer map before spending on live measurement.</p><Link href="/dashboard" className="mt-7 inline-flex rounded-xl bg-[#c0fc06] px-7 py-4 text-sm font-bold text-black">Open Seroq Intelligence →</Link></div></section>
      <footer className="border-t border-white/[0.07] px-6 py-8 text-center text-xs text-zinc-600">SEROQ · AI search decision intelligence</footer>
    </main>
  );
}
