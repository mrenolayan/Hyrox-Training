export const palettes = {
  dark: {
    bg: "#07070e", headerBg: "linear-gradient(180deg, #0c0c1e 0%, #07070e 100%)",
    card: "#0f0f1e", inset: "#0a0a14",
    border: "#22223a", border2: "#3a3a55",
    faint: "#7c7ca6", dim: "#9c9cc0", body: "#b4b4d6", strong: "#dcdcf0", text: "#eceefa",
    amberBg: "#150e00", amberBorder: "#4a3000", amberText: "#b0a078",
  },
  light: {
    bg: "#f4f4f7", headerBg: "linear-gradient(180deg, #ffffff 0%, #f4f4f7 100%)",
    card: "#ffffff", inset: "#ebebf0",
    border: "#d8d8e2", border2: "#bcbccc",
    faint: "#62627a", dim: "#4c4c64", body: "#34344c", strong: "#1a1a2c", text: "#0e0e16",
    amberBg: "#fff6e0", amberBorder: "#e0c070", amberText: "#6a5a20",
  },
};
export const autoTheme = () => {
  const h = new Date().getHours();
  return h >= 7 && h < 19 ? "light" : "dark";
};
