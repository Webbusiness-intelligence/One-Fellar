// Ad Studio shell: a premium dark canvas (scoped via .studio-dark) with a soft
// radial gradient, so every tab reads like a high-end creative tool regardless of
// the app's light/dark setting. Child surfaces use the themed tokens, which the
// .studio-dark override flips to dark automatically.

export default function AdStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="studio-dark relative -m-4 min-h-[calc(100vh-72px)] bg-[#101214] p-4 text-foreground sm:-m-6 sm:p-6"
    >
      {children}
    </div>
  );
}
