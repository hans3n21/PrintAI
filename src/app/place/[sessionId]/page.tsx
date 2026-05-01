import { PlacePageClient } from "./PlacePageClient";

export default async function PlacePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <PlacePageClient sessionId={sessionId} />;
}
