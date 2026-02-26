import { CreditLine } from "@/types/draw-credit.types";

export const mockCreditLines: CreditLine[] = [
  {
    id: "cl-001",
    name: "Business Line of Credit",
    limit: 50000,
    available: 35000,
    utilization: 30,
  },
  {
    id: "cl-002",
    name: "Equipment Finance",
    limit: 100000,
    available: 45000,
    utilization: 55,
  },
  {
    id: "cl-003",
    name: "Working Capital",
    limit: 75000,
    available: 12000,
    utilization: 84,
  },
];
