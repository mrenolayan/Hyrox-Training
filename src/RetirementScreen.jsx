// Static retirement screen. No props, no data fetching, no network calls.
// This is the entire UI for the retired legacy deployments — see src/main.jsx.
export default function RetirementScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#07070e",
        color: "#eceefa",
        fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "#7c7ca6",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          RPM Athletics
        </div>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: "-0.5px",
            color: "#eceefa",
            marginBottom: 12,
          }}
        >
          This app has retired
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.5, color: "#b4b4d6", marginBottom: 28 }}>
          Your training has moved to RPM Athletics.
        </p>

        <a
          href="https://rpmathletics.com"
          style={{
            display: "block",
            background: "#f0c020",
            color: "#07070e",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            padding: "14px 20px",
            borderRadius: 10,
            marginBottom: 22,
          }}
        >
          Go to RPM Athletics
        </a>

        <p style={{ fontSize: 12, lineHeight: 1.5, color: "#7c7ca6" }}>
          Sign in with the email your coach has on file. You'll get a 6-digit code by email.
        </p>
      </div>
    </div>
  );
}
