export const LANGUAGE_COLORS: Record<string, string> = {
  Python: "#3776ab", // blue
  TypeScript: "#3178c6", // teal/blue
  Rust: "#dea584", // red/brown
  Go: "#00add8", // cyan
  JavaScript: "#f7df1e", // yellow
};

export const getLanguageColor = (lang: string | null) => {
  if (!lang) return "#808080";
  return LANGUAGE_COLORS[lang] || "#808080";
};
