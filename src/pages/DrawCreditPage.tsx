"use client";

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CreditLineSelector } from "@/components/CreditLineSelector";
import { AmountInput } from "@/components/AmountInput";
import { PreviewSection } from "@/components/PreviewSection";
import { ConfirmationStep } from "@/components/ConfirmationStep";
import { TransactionStatus } from "@/components/TransactionStatus";
import { CreditLine, DrawStep, Transaction } from "@/types/draw-credit.types";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";

const drawSteps = [
  { id: "select", label: "Select line" },
  { id: "amount", label: "Enter amount" },
  { id: "preview", label: "Preview" },
  { id: "confirm", label: "Confirm" },
] as const;

type ProgressStep = (typeof drawSteps)[number]["id"];

export default function DrawCreditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeTransaction = location.state?.transaction as Transaction | undefined;
  const [step, setStep] = useState<DrawStep>(
    routeTransaction ? "status" : "select",
  );
  const [selectedCreditLine, setSelectedCreditLine] =
    useState<CreditLine | null>(null);
  const [amount, setAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(
    routeTransaction ?? null,
  );

  const handleSelectCreditLine = (creditLine: CreditLine) => {
    setSelectedCreditLine(creditLine);
    setAmount(0);
    setStep("amount");
  };

  const handleAmountNext = (selectedAmount: number) => {
    setAmount(selectedAmount);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setIsLoading(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const succeeded = Math.random() > 0.2;
    const newTransaction: Transaction = {
      id: `TXN-${Date.now()}`,
      creditLineId: selectedCreditLine!.id,
      amount,
      status: succeeded ? "success" : "error",
      message: succeeded ? undefined : "Insufficient funds available",
      timestamp: new Date(),
    };

    setTransaction(newTransaction);
    setIsLoading(false);
    setStep("status");

    if (newTransaction.status === "success") {
      navigate("/draw-credit/success", {
        replace: true,
        state: { transaction: newTransaction },
      });
    }
  };

  const handleNewDraw = () => {
    navigate("/draw-credit", { replace: true });
    setStep("select");
    setSelectedCreditLine(null);
    setAmount(0);
    setTransaction(null);
  };

  const handleBack = () => {
    if (step === "amount") {
      setStep("select");
      setSelectedCreditLine(null);
    } else if (step === "confirm") {
      setStep("amount");
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  const currentProgressStep: ProgressStep =
    step === "confirm" ? "confirm" : step === "amount" ? "preview" : "select";
  const activeStepIndex = drawSteps.findIndex(
    (drawStep) => drawStep.id === currentProgressStep,
  );

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {step !== "status" && (
          <header className="card" aria-label="Draw credit progress">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase text-muted">
                Draw Credit
              </p>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                Request funds from an approved line
              </h1>
            </div>
            <ol className="mt-6 grid gap-3 sm:grid-cols-4">
              {drawSteps.map((drawStep, index) => {
                const isActive = index === activeStepIndex;
                const isComplete = index < activeStepIndex;

                return (
                  <li
                    key={drawStep.id}
                    className={`rounded-lg border px-3 py-3 ${
                      isActive
                        ? "border-blue-400 bg-blue-500/10"
                        : isComplete
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-border bg-background/60"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span className="text-xs font-semibold uppercase text-muted">
                      Step {index + 1}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {drawStep.label}
                    </p>
                  </li>
                );
              })}
            </ol>
          </header>
        )}

        {step === "select" && (
          <div className="card card-large" style={{ maxWidth: "none", margin: 0 }}>
            <section aria-labelledby="select-credit-line-heading">
              <CreditLineSelector
                creditLines={mockCreditLines}
                onSelect={handleSelectCreditLine}
              />
            </section>
          </div>
        )}

        {step === "amount" && selectedCreditLine && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
            <section className="card" style={{ margin: 0 }}>
              <AmountInput
                creditLine={selectedCreditLine}
                onAmountChange={setAmount}
                onNext={handleAmountNext}
                onBack={handleBack}
              />
            </section>
            <aside className="card lg:sticky lg:top-6" style={{ margin: 0 }}>
              <PreviewSection creditLine={selectedCreditLine} amount={amount} />
            </aside>
          </div>
        )}

        {step === "confirm" && selectedCreditLine && (
          <div className="card card-large" style={{ maxWidth: "none", margin: 0 }}>
            <section aria-labelledby="confirm-draw-heading">
              <ConfirmationStep
                creditLine={selectedCreditLine}
                amount={amount}
                onConfirm={handleConfirm}
                onBack={handleBack}
                onCancel={handleCancel}
                isLoading={isLoading}
              />
            </section>
          </div>
        )}

        {step === "status" && transaction && (
          <div className="card card-large" style={{ maxWidth: "none", margin: 0 }}>
            <TransactionStatus
              transaction={transaction}
              onNewDraw={handleNewDraw}
            />
          </div>
        )}

        {step === "status" && !transaction && (
          <div className="card card-large" style={{ maxWidth: "none", margin: 0 }}>
            <div className="space-y-4 text-center">
              <h2 className="text-2xl font-bold text-foreground">
                Draw status unavailable
              </h2>
              <p className="text-muted">
                Start a new request to draw from an approved credit line.
              </p>
              <button
                type="button"
                onClick={handleNewDraw}
                className="rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-500"
              >
                Start new draw
              </button>
            </div>
          </div>
        )}

        {step !== "status" && (
          <div className="flex flex-col gap-2 text-center text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p>Need help? Contact support at 1-800-CREDIT-1</p>
            <button
              type="button"
              onClick={handleCancel}
              className="font-semibold text-foreground underline-offset-4 hover:text-blue-400 hover:underline"
            >
              Cancel draw
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
