import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatINRFromPaise, formatPercentage } from "@/lib/format/market";

export function Price({ pricePaise, changePercent, large = false }: { pricePaise: number; changePercent: number; large?: boolean }) {
  const direction = changePercent > 0 ? "up" : changePercent < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className={`price-block ${large ? "price-large" : ""}`}>
      <span className="price-value">{formatINRFromPaise(pricePaise)}</span>
      <span className={`price-change price-${direction}`} aria-label={`Day change ${formatPercentage(changePercent)}`}>
        <Icon size={15} aria-hidden="true" /> {formatPercentage(changePercent)}
      </span>
    </div>
  );
}
