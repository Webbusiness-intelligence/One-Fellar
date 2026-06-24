import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { AdStudioClient } from "../ad-studio-client";
import { StudioNav } from "../studio-nav";

const BUCKET = "ad-studio";

interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  ad_product_images: Array<{ storage_path: string; is_primary: boolean }>;
}

export default async function QuickAdsPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_products")
    .select("id, name, description, ad_product_images(storage_path, is_primary)")
    .order("created_at", { ascending: false });

  const products = ((data ?? []) as ProductRow[]).map((p) => {
    const imgs = p.ad_product_images ?? [];
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      imageUrl: primary
        ? ctx.supabase.storage.from(BUCKET).getPublicUrl(primary.storage_path).data.publicUrl
        : null,
    };
  });

  return (
    <div>
      <StudioNav active="quick" />
      <AdStudioClient initialProducts={products} />
    </div>
  );
}
