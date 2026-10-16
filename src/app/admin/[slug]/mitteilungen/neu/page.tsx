import { getDb } from "@/lib/db";
import { requireActor } from "@/lib/server/context";
import { listCategories } from "@/lib/services/directory";
import { can } from "@/lib/auth/permissions";
import { MessageForm } from "@/components/message-form";
import { PageTitle } from "@/components/ui";
import { saveMessageAction } from "../../actions";

export const metadata = { title: "Neue Mitteilung" };

export default async function NewMessage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor } = await requireActor(slug);
  const cats = await listCategories(await getDb(), tenant.id);
  return (
    <div className="max-w-4xl">
      <PageTitle sub="Wird zunächst als Entwurf gespeichert – nichts wird ohne ausdrückliche Veröffentlichung sichtbar.">Neue Mitteilung</PageTitle>
      <MessageForm
        action={saveMessageAction.bind(null, slug, null)}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        isNew
        canPublish={can(actor, "message.publish")}
        locked={false}
        initial={{ title: "", body: "", categoryId: "", priority: "normal", visibility: "", publishAt: "", expiresAt: "", linkUrl: "", pushEnabled: false, pushTitle: "", pushBody: "" }}
      />
    </div>
  );
}
