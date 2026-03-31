import  { useState } from "react";
import { Search, ChevronDown } from "lucide-react";

const categories = [
  { title: "Getting Started", desc: "Learn the basics" },
  { title: "How Credit Works", desc: "Understand the system" },
  { title: "Managing Credit", desc: "Control your credit lines" },
  { title: "Troubleshooting", desc: "Fix common issues" },
  { title: "API Docs", desc: "Developer integration" },
  { title: "FAQ", desc: "Quick answers" },
];

const faqs = [
  { q: "What is Creditra?", a: "Creditra is a decentralized credit platform." },
  { q: "How do repayments work?", a: "You repay based on your credit agreement." },
];

export default function HelpCenter() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">Help Center</h1>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white shadow rounded-2xl p-4 mb-10">
          <Search className="text-gray-400" />
          <input
            className="w-full outline-none"
            placeholder="Search for help..."
          />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {categories.map((cat, i) => (
            <div
              key={i}
              className="p-6 bg-white rounded-2xl shadow hover:shadow-lg transition"
            >
              <h3 className="text-xl font-semibold">{cat.title}</h3>
              <p className="text-gray-500">{cat.desc}</p>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-2xl font-bold mb-4">FAQ</h2>
          {faqs.map((item, i) => (
            <div key={i} className="border-b py-3">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex justify-between w-full text-left"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`transition ${openIndex === i ? "rotate-180" : ""}`}
                />
              </button>
              {openIndex === i && (
                <p className="text-gray-600 mt-2">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
