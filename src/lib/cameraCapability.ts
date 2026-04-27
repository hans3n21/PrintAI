export type CameraCapability = "unknown" | "supported" | "unsupported";

export function getDesktopCaptureLabel(capability: CameraCapability) {
  if (capability === "supported") return "Webcam verwenden";
  if (capability === "unsupported") return "Webcam nicht erkannt";
  return "Webcam öffnen";
}

export function detectCameraCapability(mediaDevices: MediaDevices | undefined): CameraCapability {
  if (!mediaDevices) return "unknown";
  return typeof mediaDevices.getUserMedia === "function" ? "supported" : "unsupported";
}
