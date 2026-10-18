import { Privacy } from "@/components/legal";
import { loadTenant } from "@/lib/server/context";

export const metadata = { title: "Datenschutz" };

export default async function TenantPrivacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  return (
    <div className="mx-auto max-w-3xl">
      <Privacy tenant={tenant} />
    </div>
  );
}
