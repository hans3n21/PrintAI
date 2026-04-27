import { describe, expect, it } from "vitest";
import { getGenerateErrorResponse } from "../generateErrors";

describe("getGenerateErrorResponse", () => {
  it("turns OpenAI safety rejections into a user-facing 400 response", () => {
    const error = new Error(
      "400 Your request was rejected by the safety system. request ID req_123. safety_violations=[violence]."
    );

    expect(getGenerateErrorResponse(error)).toEqual({
      status: 400,
      body: {
        code: "image_safety_rejected",
        error:
          "Der Bildwunsch wurde vom Safety-System abgelehnt. Bitte formuliere ihn etwas harmloser, z. B. ohne Gewalt, Verletzungen, Waffen oder bedrohliche Szene.",
        safety_violations: ["violence"],
      },
    });
  });

  it("keeps unexpected errors as 500 responses", () => {
    expect(getGenerateErrorResponse(new Error("Storage upload failed"))).toEqual({
      status: 500,
      body: { error: "Storage upload failed" },
    });
  });
});
