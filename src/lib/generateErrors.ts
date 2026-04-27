type GenerateErrorBody = {
  error: string;
  code?: "image_safety_rejected";
  safety_violations?: string[];
};

type GenerateErrorResponse = {
  status: number;
  body: GenerateErrorBody;
};

const SAFETY_REJECTION_MESSAGE =
  "Der Bildwunsch wurde vom Safety-System abgelehnt. Bitte formuliere ihn etwas harmloser, z. B. ohne Gewalt, Verletzungen, Waffen oder bedrohliche Szene.";

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseSafetyViolations(message: string) {
  const match = /safety_violations=\[([^\]]+)\]/i.exec(message);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isImageSafetyRejection(error: unknown) {
  const message = getMessage(error);
  return /rejected by the safety system|safety_violations=/i.test(message);
}

export function getGenerateErrorResponse(error: unknown): GenerateErrorResponse {
  const message = getMessage(error);
  if (isImageSafetyRejection(error)) {
    return {
      status: 400,
      body: {
        code: "image_safety_rejected",
        error: SAFETY_REJECTION_MESSAGE,
        safety_violations: parseSafetyViolations(message),
      },
    };
  }

  return { status: 500, body: { error: message } };
}
