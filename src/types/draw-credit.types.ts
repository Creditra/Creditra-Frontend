export interface CreditLine {
  id: string;
  name: string;
  limit: number;
  available: number;
  utilization: number;
}

export interface Transaction {
  id: string;
  creditLineId: string;
  amount: number;
  status: "pending" | "success" | "error";
  message?: string;
  timestamp?: Date;
}

export type DrawStep = "select" | "amount" | "confirm" | "status";
