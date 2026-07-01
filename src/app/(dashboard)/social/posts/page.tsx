import type { Metadata } from "next";
import { PostsClient } from "./posts-client";

export const metadata: Metadata = { title: "All posts — Genalot" };

export default function PostsPage() {
  return <PostsClient />;
}
