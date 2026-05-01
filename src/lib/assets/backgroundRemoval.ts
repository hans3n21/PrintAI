import { trimTransparentPng } from "./trimTransparentPng";

const REMOVE_BG_API_URL = "https://api.remove.bg/v1.0/removebg";

function getRemoveBgApiKey() {
  return process.env.REMOVE_BG_API_KEY?.trim() || null;
}

async function responseText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export async function removeBackgroundFromPng(input: Buffer): Promise<Buffer | null> {
  const apiKey = getRemoveBgApiKey();
  if (!apiKey) return null;

  const formData = new FormData();
  formData.append("image_file", new Blob([input], { type: "image/png" }), "design.png");
  formData.append("format", "png");
  formData.append("size", "auto");

  const response = await fetch(REMOVE_BG_API_URL, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const details = await responseText(response);
    throw new Error(
      `Remove.bg background removal failed (${response.status})${details ? `: ${details}` : ""}`
    );
  }

  return trimTransparentPng(Buffer.from(await response.arrayBuffer()));
}
