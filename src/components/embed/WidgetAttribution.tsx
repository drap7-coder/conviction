export function WidgetAttribution({ href }: { href: string }) {
  return (
    <footer className="embed-attribution">
      <span>Market information may be delayed.</span>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Powered by IQBulls
      </a>
    </footer>
  );
}
