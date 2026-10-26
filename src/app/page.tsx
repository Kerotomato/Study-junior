import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

export default async function Home() {
  const me = await requireProfile();
  redirect(me.role === "child" ? "/child" : "/parent");
}
