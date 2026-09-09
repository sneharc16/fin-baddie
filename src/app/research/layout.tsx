export default function ResearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ margin: "0", padding: 0, maxWidth: "none" }}>
      {children}
    </div>
  );
}
