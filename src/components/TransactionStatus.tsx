import { Transaction } from "@/types/draw-credit.types";
import { CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";

interface TransactionStatusProps {
  transaction: Transaction;
  onNewDraw: () => void;
}

export function TransactionStatus({
  transaction,
  onNewDraw,
}: TransactionStatusProps) {
  const statusConfig = {
    pending: {
      icon: Clock,
      title: "Processing",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      message: "Your draw request is being processed.",
    },
    success: {
      icon: CheckCircle2,
      title: "Draw Successful",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      message: "Funds have been disbursed to your account.",
    },
    error: {
      icon: AlertCircle,
      title: "Draw Failed",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      message: transaction.message || "An error occurred during processing.",
    },
  };

  const config = statusConfig[transaction.status];
  const Icon = config.icon;

  return (
    <div className="space-y-8 text-center">
      <div className="flex justify-center">
        <div className={`${config.bgColor} p-8 rounded-full`}>
          <Icon className={`w-16 h-16 ${config.color}`} />
        </div>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-foreground mb-3">
          {config.title}
        </h2>
        <p className="text-muted text-lg">{config.message}</p>
      </div>

      <div className="bg-surface p-6 rounded-xl border border-border space-y-4 text-left">
        <div>
          <p className="text-sm text-muted font-medium mb-2">Transaction ID</p>
          <p className="font-mono text-sm text-foreground bg-background p-3 rounded border border-border">
            {transaction.id}
          </p>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted font-medium mb-2">Amount Drawn</p>
          <p className="text-2xl font-bold text-foreground">
            ${transaction.amount.toLocaleString()}
          </p>
        </div>
        {transaction.timestamp && (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted font-medium mb-2">Time</p>
            <p className="text-sm text-foreground">
              {transaction.timestamp.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {transaction.status === "success" && (
        <div className="bg-green-500/10 border-2 border-green-500/30 rounded-lg p-4">
          <p className="text-sm text-green-500 font-medium">
            Funds will be deposited to your account within 1-2 business days.
          </p>
        </div>
      )}

      <button
        onClick={onNewDraw}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/40 transition-all font-semibold flex items-center justify-center gap-2"
      >
        <RotateCcw className="w-5 h-5" />
        Make Another Draw
      </button>
    </div>
  );
}
