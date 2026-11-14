export function getPrimaryMuscle(muscle: string): "胸" | "背" | "腿" | "肩" | "游泳" {
  if (!muscle) return "胸";
  if (muscle.includes("胸")) return "胸";
  if (muscle.includes("背")) return "背";
  if (muscle.includes("腿")) return "腿";
  if (muscle.includes("肩")) return "肩";
  if (muscle.includes("泳")) return "游泳";
  return "胸";
}

export function getMuscleBadgeColor(muscle: string): string {
  const pm = getPrimaryMuscle(muscle);
  switch (pm) {
    case "胸":
      return "bg-red-500/20 text-red-300 border-red-500/40";
    case "背":
      return "bg-blue-500/20 text-blue-300 border-blue-500/40";
    case "腿":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    case "肩":
      return "bg-purple-500/20 text-purple-300 border-purple-500/40";
    case "游泳":
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
    default:
      return "bg-gray-500/20 text-gray-300 border-gray-500/40";
  }
}

export function cleanSessionTitle(title: string, targetMuscle?: string): string {
  if (!title) return "";
  return title.replace(/\(([^)]+)\)/, (_, rawInside) => {
    const muscle = targetMuscle || rawInside;
    const pm = getPrimaryMuscle(muscle);
    return `(${pm})`;
  });
}
