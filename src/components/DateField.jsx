import { useEffect, useLayoutEffect, useRef, useState } from "react";

const formatLongDate = (iso) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "Select date";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const buildMonthCells = (year, month) => {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = new Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
};

// Tap-to-open calendar dropdown, anchored below the field. Continuous
// month-scroll (not paged) — the visible window grows as the athlete scrolls
// toward either edge, so there's no hard date-range restriction.
export default function DateField({ value, onChange, T }) {
  const [open, setOpen] = useState(false);
  const [monthsBefore, setMonthsBefore] = useState(3);
  const [monthsAfter, setMonthsAfter] = useState(15);
  const wrapRef = useRef(null);
  const scrollRef = useRef(null);
  const prevScrollHeight = useRef(0);

  const anchor = new Date((value || new Date().toISOString().slice(0, 10)) + "T12:00:00");
  const anchorYear = anchor.getFullYear();
  const anchorMonth = anchor.getMonth();
  const todayISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Jump to the selected (or today's) month whenever the picker opens.
  useLayoutEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    const target = el?.querySelector('[data-current-month="true"]');
    if (el && target) el.scrollTop = target.offsetTop;
  }, [open]);

  // Preserve scroll position when new months are prepended above the viewport.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !prevScrollHeight.current) return;
    el.scrollTop += el.scrollHeight - prevScrollHeight.current;
    prevScrollHeight.current = 0;
  }, [monthsBefore]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 40 && monthsBefore < 60) {
      prevScrollHeight.current = el.scrollHeight;
      setMonthsBefore((n) => n + 6);
    }
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40 && monthsAfter < 60) {
      setMonthsAfter((n) => n + 6);
    }
  }

  const months = [];
  for (let i = -monthsBefore; i <= monthsAfter; i++) {
    const d = new Date(anchorYear, anchorMonth + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box",
        background: T.inset, border: `1px solid ${T.border2}`, borderRadius: 10,
        padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: "inherit", cursor: "pointer",
      }}>
        <span style={{ fontSize: 14 }}>📅</span>
        <span style={{ flex: 1, textAlign: "center" }}>{formatLongDate(value)}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", left: 0, zIndex: 20,
          background: T.card, border: `1px solid ${T.border2}`, borderRadius: 12,
          width: "100%", maxWidth: 300, boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        }}>
          <div style={{
            position: "absolute", top: -8, left: 24, width: 0, height: 0,
            borderLeft: "8px solid transparent", borderRight: "8px solid transparent",
            borderBottom: `8px solid ${T.card}`,
          }} />
          <div style={{
            position: "sticky", top: 0, zIndex: 1, background: T.card,
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            padding: "10px 10px 8px", borderBottom: `1px solid ${T.border}`,
            borderTopLeftRadius: 12, borderTopRightRadius: 12,
          }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((w, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: T.dim, textAlign: "center" }}>{w}</div>
            ))}
          </div>
          <div ref={scrollRef} onScroll={handleScroll} style={{
            position: "relative", maxHeight: 300, overflowY: "auto", padding: "4px 10px 10px",
          }}>
            {months.map(({ year, month }) => {
              const isAnchorMonth = year === anchorYear && month === anchorMonth;
              return (
                <div key={`${year}-${month}`} data-current-month={isAnchorMonth ? "true" : undefined}>
                  <div style={{ fontSize: 10, color: T.faint, fontWeight: 700, letterSpacing: "0.04em", margin: "10px 2px 4px" }}>
                    {year} {MONTH_NAMES[month].toUpperCase()}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                    {buildMonthCells(year, month).map((day, i) => {
                      if (day == null) return <div key={i} />;
                      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const isSelected = iso === value;
                      const isToday = iso === todayISO;
                      return (
                        <button type="button" key={i} onClick={() => { onChange(iso); setOpen(false); }} style={{
                          width: "100%", aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                          border: "none", borderRadius: "50%", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                          background: isSelected ? "#60a5fa" : "transparent",
                          color: isSelected ? "#07070e" : isToday ? "#60a5fa" : T.body,
                          fontWeight: isSelected || isToday ? 700 : 500,
                        }}>{day}</button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <div style={{ position: "sticky", bottom: 0, height: 20, background: `linear-gradient(to bottom, transparent, ${T.card})`, pointerEvents: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}
