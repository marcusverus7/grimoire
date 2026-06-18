export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          backgroundColor: "#7A2418",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "2px solid #C9A24A",
          marginBottom: "1.5rem",
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: "bold",
            color: "#F5EFDE",
            fontFamily: "serif",
          }}
        >
          G
        </span>
      </div>
      <h1
        style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: "1.5rem",
          color: "#A07A2C",
          letterSpacing: "0.2em",
          marginBottom: "0.5rem",
        }}
      >
        THE GRIMOIRE ARCHIVE
      </h1>
      <p style={{ color: "#ECE3CF", opacity: 0.7, maxWidth: 400, marginBottom: "2rem" }}>
        Campaign recaps — relive every session. Share links will appear here
        at <code>/r/[slug]</code>.
      </p>

      <div style={{ maxWidth: 500, marginBottom: "2rem" }}>
        <p style={{ color: "#ECE3CF", marginBottom: "1.5rem", fontSize: "0.95rem" }}>
          To get started:
        </p>
        <ol
          style={{
            color: "#ECE3CF",
            opacity: 0.8,
            textAlign: "left",
            display: "inline-block",
            fontSize: "0.9rem",
            lineHeight: "1.8",
          }}
        >
          <li style={{ marginBottom: "0.5rem" }}>Create a campaign in Grimoire mobile app</li>
          <li style={{ marginBottom: "0.5rem" }}>Run sessions and capture notes</li>
          <li style={{ marginBottom: "0.5rem" }}>Generate a recap and share the link</li>
          <li>View your recap here</li>
        </ol>
      </div>

      <a
        href="/r/demo"
        style={{
          display: "inline-block",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#A07A2C",
          color: "#2C2014",
          textDecoration: "none",
          borderRadius: "2px",
          fontWeight: "600",
          fontSize: "0.95rem",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "#C9A24A";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.backgroundColor = "#A07A2C";
        }}
      >
        View Demo Recap →
      </a>
    </main>
  );
}
