import { Unsubscribe } from "@/components/unsubscribe/unsubscribe";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <Unsubscribe token={token} />;
}
