"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { CreditLineSelector } from "@/components/CreditLineSelector";
import { AmountInput } from "@/components/AmountInput";
import { PreviewSection } from "@/components/PreviewSection";
import { ConfirmationStep } from "@/components/ConfirmationStep";
import { TransactionStatus } from "@/components/TransactionStatus";
import { CreditLine, DrawStep, Transaction } from "@/types/draw-credit.types";
import { mockCreditLines } from "@/lib/draw-credit-mock-data";

export default function DrawCreditPage() {
  const [step, setStep] = useState<DrawStep>("select");
  const [selectedCreditLine, setSelectedCreditLine] =
    useState<CreditLine | null>(null);
  const [amount, setAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

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
    setStep("status");

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newTransaction: Transaction = {
      id: `TXN-${Date.now()}`,
      creditLineId: selectedCreditLine!.id,
      amount,
      status: Math.random() > 0.2 ? "success" : "error",
      message: Math.random() > 0.2 ? undefined : "Insufficient funds available",
      timestamp: new Date(),
    };

    setTransaction(newTransaction);
    setIsLoading(false);
  };

  const handleNewDraw = () => {
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

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          <div className="p-8 md:p-12">
            {step === "select" && (
              <CreditLineSelector
                creditLines={mockCreditLines}
                onSelect={handleSelectCreditLine}
              />
            )}

            {step === "amount" && selectedCreditLine && (
              <div className="space-y-8">
                <AmountInput
                  creditLine={selectedCreditLine}
                  onAmountChange={setAmount}
                  onNext={handleAmountNext}
                  onBack={handleBack}
                />
                <div className="border-t border-border pt-8">
                  <PreviewSection
                    creditLine={selectedCreditLine}
                    amount={amount}
                  />
                </div>
              </div>
            )}

            {step === "confirm" && selectedCreditLine && (
              <ConfirmationStep
                creditLine={selectedCreditLine}
                amount={amount}
                onConfirm={handleConfirm}
                onBack={handleBack}
                isLoading={isLoading}
              />
            )}

            {step === "status" && (isLoading || transaction) && (
              <div className="min-h-[30rem] flex items-center">
                {isLoading && (
                  <div className="space-y-8 text-center w-full">
                    <div className="flex justify-center">
                      <div className="bg-blue-500/10 p-8 rounded-full border border-blue-500/30">
                        <Clock className="w-16 h-16 text-blue-500 animate-pulse" />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-foreground mb-3">
                        Processing
                      </h2>
                      <p className="text-muted text-lg">
                        Your draw request is being processed.
                      </p>
                    </div>
                  </div>
                )}
                {transaction && !isLoading && (
                  <div className="w-full">
                    <TransactionStatus
                      transaction={transaction}
                      onNewDraw={handleNewDraw}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-muted">
          <p>Need help? Contact support at 1-800-CREDIT-1</p>
        </div>
      </div>
    </main>
  );
}
