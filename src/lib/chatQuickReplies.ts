const STYLE_REPLIES = ["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"];
const GROUP_REPLIES = ["Nur für mich", "Für eine Gruppe"];
const YES_NO_REPLIES = ["Ja", "Nein"];
const CONFIRM_REPLIES = ["Bestätigen"];
const TEXT_REPLIES = ["Denk dir was aus", "Witzig", "Kurz & clean"];

export function getQuickRepliesForAssistantReply(reply: string): string[] {
  const lower = reply.toLowerCase();

  if (asksAboutGroup(lower)) return GROUP_REPLIES;
  if (asksAboutStyle(lower)) return STYLE_REPLIES;
  if (asksAboutTextOrSlogan(lower)) return TEXT_REPLIES;
  if (asksAboutConfirmation(lower)) return CONFIRM_REPLIES;
  if (asksYesNoQuestion(lower)) return YES_NO_REPLIES;

  return [];
}

function asksAboutGroup(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("gruppe") ||
      reply.includes("allein") ||
      reply.includes("nur für dich") ||
      reply.includes("nur fuer dich"))
  );
}

function asksAboutStyle(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("welchen stil") ||
      reply.includes("welche stilrichtung") ||
      reply.includes("stilrichtung") ||
      reply.includes("bestimmten stil") ||
      reply.includes("stil im kopf") ||
      reply.includes("cartoon oder") ||
      reply.includes("cartoon oder modern") ||
      reply.includes("welcher look"))
  );
}

function asksAboutConfirmation(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("passt das so") ||
      reply.includes("stimmt das so") ||
      reply.includes("soll ich das so übernehmen") ||
      reply.includes("soll ich das so uebernehmen") ||
      reply.includes("bestätigen") ||
      reply.includes("bestaetigen"))
  );
}

function asksAboutTextOrSlogan(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("slogan") ||
      reply.includes("spruch") ||
      reply.includes("text") ||
      reply.includes("schriftzug"))
  );
}

function asksYesNoQuestion(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("ja oder nein") || reply.includes("ja/nein"))
  );
}
