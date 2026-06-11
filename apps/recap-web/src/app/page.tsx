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
      <p style={{ color: "#ECE3CF", opacity: 0.7, maxWidth: 400 }}>
        Campaign recaps — relive every session. Share links will appear here
        at <code>/r/[slug]</code>.
      </p>
    </main>
  );
}
