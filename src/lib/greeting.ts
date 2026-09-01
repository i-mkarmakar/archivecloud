function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

function getFirstName(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] || "there";
}

export function formatPersonalGreeting(
  name?: string | null,
  date = new Date(),
) {
  return `${getTimeGreeting(date)}, ${getFirstName(name)}`;
}
