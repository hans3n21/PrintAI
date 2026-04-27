const STYLE_REPLIES = ["Cartoon/witzig", "Modern/clean", "Vintage", "Minimalistisch"];
const GROUP_REPLIES = ["Nur für mich", "Für eine Gruppe"];
const YES_NO_REPLIES = ["Ja", "Nein"];

export function getQuickRepliesForAssistantReply(reply: string): string[] {
  const lower = reply.toLowerCase();

  if (asksAboutGroup(lower)) return GROUP_REPLIES;
  if (asksAboutStyle(lower)) return STYLE_REPLIES;
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
      reply.includes("welcher look"))
  );
}

function asksYesNoQuestion(reply: string) {
  return (
    reply.includes("?") &&
    (reply.includes("ja oder nein") ||
      reply.includes("namen") ||
      reply.includes("soll") ||
      reply.includes("möchtest du") ||
      reply.includes("moechtest du"))
  );
}
