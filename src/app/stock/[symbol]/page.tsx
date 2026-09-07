import { StockDetailScreen } from "@/components/stock/stock-detail-screen";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <StockDetailScreen symbol={decodeURIComponent(symbol)} />;
}
