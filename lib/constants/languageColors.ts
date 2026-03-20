export const LANGUAGE_COLORS: Record<string, string> = {
  Python: "#3776ab",
  TypeScript: "#3178c6",
  Rust: "#dea584",
  Go: "#00add8",
  JavaScript: "#f7df1e",
  Ruby: "#701516",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Swift: "#ffac45",
  Kotlin: "#A97BFF",
  PHP: "#4F5D95",
  Scala: "#c22d40",
  Dart: "#00B4AB",
  R: "#198CE7",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
};

export const getLanguageColor = (lang: string | null) => {
  if (!lang) return "#808080";
  return LANGUAGE_COLORS[lang] || "#808080";
};
