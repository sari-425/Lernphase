import { Imprint } from "@/components/legal";
import { loadTenant } from "@/lib/server/context";

export const metadata = { title: "Impressum" };

export default async function TenantImprintPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  return (
    <div className="mx-auto max-w-3xl">
      <Imprint tenant={tenant} />
    </div>
  );
}
