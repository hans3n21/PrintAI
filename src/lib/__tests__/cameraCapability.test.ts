import { describe, expect, it } from "vitest";
import { detectCameraCapability, getDesktopCaptureLabel } from "../cameraCapability";

describe("cameraCapability", () => {
  it("detects webcam API support without asking for permission", () => {
    expect(
      detectCameraCapability({ getUserMedia: (() => undefined) as never } as MediaDevices)
    ).toBe("supported");
    expect(detectCameraCapability({} as MediaDevices)).toBe("unsupported");
    expect(detectCameraCapability(undefined)).toBe("unknown");
  });

  it("uses webcam wording for desktop capture states", () => {
    expect(getDesktopCaptureLabel("supported")).toBe("Webcam verwenden");
    expect(getDesktopCaptureLabel("unsupported")).toBe("Webcam nicht erkannt");
    expect(getDesktopCaptureLabel("unknown")).toBe("Webcam öffnen");
  });
});
