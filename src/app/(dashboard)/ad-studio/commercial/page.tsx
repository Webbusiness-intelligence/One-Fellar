import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/auth/account";
import { CommercialClient, type CommercialProduct } from "./commercial-client";
import { StudioNav } from "../studio-nav";

const BUCKET = "ad-studio";

interface ProductRow {
  id: string;
  name: string;
  ad_product_images: Array<{ storage_path: string; is_primary: boolean }>;
}

export default async function CommercialPage() {
  const ctx = await getCurrentAccount().catch(() => redirect("/login"));

  const { data } = await ctx.supabase
    .from("ad_products")
    .select("id, name, ad_product_images(storage_path, is_primary)")
    .order("created_at", { ascending: false });

  const products: CommercialProduct[] = ((data ?? []) as ProductRow[]).map((p) => {
    const imgs = p.ad_product_images ?? [];
    const primary = imgs.find((i) => i.is_primary) ?? imgs[0];
    return {
      id: p.id,
      name: p.name,
      imageUrl: primary
        ? ctx.supabase.storage.from(BUCKET).getPublicUrl(primary.storage_path).data.publicUrl
        : null,
    };
  });

  return (
    <div>
      <StudioNav active="commercial" />
      <CommercialClient products={products} />
    </div>
  );
}
