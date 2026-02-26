import { useState } from "react";
import { motion } from "framer-motion";
import {
    TrendingUp,
    ShieldCheck,
    Cpu,
    RefreshCcw,
    Wallet,
    BarChart3,
    CreditCard,
    LineChart,
    Building2,
    Code2,
    Users,
} from "lucide-react";

export default function LandingPage() {
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);

    const faqs = [
        {
            q: "What determines my credit limit?",
            a: "Your limit is calculated from on-chain behavioral signals including transaction history, repayment patterns, liquidity activity, and protocol interactions.",
        },
        {
            q: "Is collateral required?",
            a: "No. Creditra uses adaptive behavioral analysis instead of fixed overcollateralization.",
        },
        {
            q: "How is risk priced?",
            a: "Risk is algorithmically evaluated and dynamically priced based on evolving behavioral signals.",
        },
        {
            q: "What happens if I default?",
            a: "Default events affect your evolving credit score and reduce future credit access.",
        },
        {
            q: "Is Creditra custodial?",
            a: "No. Creditra operates using smart contracts and remains non-custodial.",
        },
    ];

    const features = [
        { title: "Dynamic Credit Limits", icon: TrendingUp },
        { title: "No Overcollateralization", icon: ShieldCheck },
        { title: "Algorithmic Risk Pricing", icon: Cpu },
        { title: "Continuous Credit Evolution", icon: RefreshCcw },
    ];

    const steps = [
        { label: "Connect Wallet", icon: Wallet },
        { label: "Behavior Analysis", icon: BarChart3 },
        { label: "Risk Engine", icon: Cpu },
        { label: "Credit Line Issued", icon: CreditCard },
        { label: "Score Evolves", icon: LineChart },
    ];

    const useCases = [
        { label: "SaaS Founders", icon: Building2 },
        { label: "API Providers", icon: Code2 },
        { label: "DAO Contributors", icon: Users },
    ];

    return (
        <div className="bg-[#0d1117] text-[#f0f6fc] min-h-screen font-sans">
            {/* HEADER */}
            <header className="border-b border-[#21262d]">
                <div className="max-w-300 mx-auto flex items-center justify-between h-18 px-6">
                    <div className="text-xl font-semibold tracking-tight">
                        Creditra
                    </div>

                    <nav className="hidden md:flex gap-8 text-[#8b949e]">
                        <a href="#how" className="hover:text-white transition">
                            How It Works
                        </a>
                        <a
                            href="#usecases"
                            className="hover:text-white transition"
                        >
                            Use Cases
                        </a>
                        <a href="#faq" className="hover:text-white transition">
                            FAQ
                        </a>
                    </nav>

                    <button className="bg-[#58a6ff] hover:bg-[#79c0ff] px-5 py-2 rounded-lg transition text-black font-medium">
                        Connect Wallet
                    </button>
                </div>
            </header>

            {/* HERO */}
            <section className="relative overflow-hidden">
                <div className="max-w-300 mx-auto px-6 py-24 grid md:grid-cols-2 gap-16 items-center">
                    <div>
                        <h1 className="text-4xl font-semibold leading-tight mb-6">
                            Adaptive Credit Without Overcollateralization
                        </h1>

                        <p className="text-[#8b949e] text-lg mb-8">
                            Credit limits that evolve with your on-chain
                            behavior. No locked capital. No static risk models.
                            Just programmable credit.
                        </p>

                        <div className="flex gap-4 flex-wrap">
                            <button className="bg-[#58a6ff] hover:bg-[#79c0ff] text-black px-6 py-3 rounded-lg font-medium transition">
                                Connect Wallet
                            </button>

                            <button className="border border-[#30363d] px-6 py-3 rounded-lg hover:bg-[#161b22] transition">
                                <a href="#how">Learn More</a>
                            </button>
                        </div>
                    </div>

                    {/* Animated Adaptive Credit Card */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                        className="bg-[#161b22] border border-[#21262d] rounded-xl p-8 shadow-lg"
                    >
                        <p className="text-[#8b949e] mb-4">
                            Dynamic Credit Limit
                        </p>

                        <div className="w-full h-4 bg-[#21262d] rounded">
                            <motion.div
                                initial={{ width: "20%" }}
                                animate={{ width: "85%" }}
                                transition={{ duration: 3 }}
                                className="h-4 bg-[#58a6ff] rounded"
                            />
                        </div>

                        <p className="mt-6 text-3xl font-semibold">$48,750</p>
                    </motion.div>
                </div>
            </section>

            {/* FEATURES */}
            <section className="py-24">
                <div className="max-w-300 mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-16 text-center">
                        Credit That Adapts to You
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map(({ title, icon: Icon }, i) => (
                            <div
                                key={i}
                                className="bg-[#161b22] border border-[#21262d] rounded-xl p-8 hover:-translate-y-1 transition hover:shadow-[0_0_20px_rgba(88,166,255,0.15)]"
                            >
                                <div className="w-10 h-10 mb-6 flex items-center justify-center rounded-lg bg-[#58a6ff]/10">
                                    <Icon
                                        className="text-[#58a6ff]"
                                        size={20}
                                    />
                                </div>

                                <h3 className="font-semibold mb-4">{title}</h3>
                                <p className="text-[#8b949e] text-sm">
                                    Powered by real-time on-chain behavioral
                                    analysis and adaptive models.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section id="how" className="py-24 bg-[#0b0f14]">
                <div className="max-w-300 mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-16 text-center">
                        How Adaptive Credit Works
                    </h2>

                    <div className="grid md:grid-cols-5 gap-6 text-center">
                        {steps.map(({ label, icon: Icon }, i) => (
                            <div key={i} className="relative">
                                <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-6 flex flex-col items-center gap-4">
                                    <Icon
                                        className="text-[#58a6ff]"
                                        size={22}
                                    />
                                    <span>{label}</span>
                                </div>

                                {i < 4 && (
                                    <div className="hidden md:block absolute top-1/2 -right-4.5 w-4 h-0.5 bg-[#58a6ff]" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* USE CASES */}
            <section id="usecases" className="py-24">
                <div className="max-w-300 mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-16 text-center">
                        Built for Real Builders
                    </h2>

                    <div className="grid md:grid-cols-3 gap-8">
                        {useCases.map(({ label, icon: Icon }, i) => (
                            <div
                                key={i}
                                className="bg-[#161b22] border border-[#21262d] rounded-xl p-8"
                            >
                                <div className="w-10 h-10 mb-6 flex items-center justify-center rounded-lg bg-[#58a6ff]/10">
                                    <Icon
                                        className="text-[#58a6ff]"
                                        size={20}
                                    />
                                </div>

                                <h3 className="font-semibold mb-4">{label}</h3>
                                <p className="text-[#8b949e] text-sm">
                                    Access adaptive capital aligned with your
                                    on-chain activity.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="py-24 bg-[#0b0f14]">
                <div className="max-w-200 mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-12 text-center">
                        Frequently Asked Questions
                    </h2>

                    {faqs.map((item, index) => (
                        <div
                            key={index}
                            className="border border-[#21262d] rounded-lg mb-4"
                        >
                            <button
                                className="w-full text-left p-5 flex justify-between items-center"
                                onClick={() =>
                                    setOpenFAQ(openFAQ === index ? null : index)
                                }
                            >
                                {item.q}
                                <span>{openFAQ === index ? "−" : "+"}</span>
                            </button>

                            {openFAQ === index && (
                                <div className="px-5 pb-5 text-[#8b949e]">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="py-24 text-center">
                <div className="max-w-200 mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-8">
                        Capital Should Work as Hard as You Do
                    </h2>

                    <button className="bg-[#58a6ff] hover:bg-[#79c0ff] text-black px-8 py-4 rounded-lg font-medium transition">
                        Connect Wallet
                    </button>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-[#21262d] py-12 text-[#8b949e]">
                <div className="max-w-300 mx-auto px-6 grid md:grid-cols-3 gap-8">
                    <div>
                        <h4 className="text-white mb-4 font-medium">Product</h4>
                        <p>How It Works</p>
                        <p>Dashboard</p>
                        <p>Docs</p>
                    </div>

                    <div>
                        <h4 className="text-white mb-4 font-medium">Legal</h4>
                        <p>Terms</p>
                        <p>Privacy Policy</p>
                    </div>

                    <div>
                        <h4 className="text-white mb-4 font-medium">Network</h4>
                        <p>Built on Stellar</p>
                        <p>Smart Contract Secured</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
