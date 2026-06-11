interface RecapPageProps {
  params: Promise<{ slug: string }>;
}

export default async function RecapPage({ params }: RecapPageProps) {
  const { slug } = await params;

  // TODO: Fetch recap by share_slug from Supabase, render the recap body
  // with social preview cards, and log a recap_event (open).

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          textAlign: "center",
          borderBottom: "1px solid #A07A2C",
          paddingBottom: "2rem",
          marginBottom: "2rem",
        }}
      >
        <h1
          style={{
            fontFamily: "'Cinzel Decorative', serif",
            fontSize: "1.3rem",
            color: "#A07A2C",
            letterSpacing: "0.15em",
          }}
        >
          Previously on…
        </h1>
      </div>

      <p style={{ color: "#ECE3CF", opacity: 0.6, textAlign: "center" }}>
        Recap <code>{slug}</code> — coming soon.
      </p>
    </main>
  );
}
