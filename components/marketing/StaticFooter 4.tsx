import MarketingSiteFooter from "./MarketingSiteFooter";

export default function StaticFooter() {
  return (
    <footer
      className="mt-auto"
      style={{
        borderTop: "1px solid var(--base-200)",
        background: "var(--base-100)",
      }}
    >
      <MarketingSiteFooter />
    </footer>
  );
}
