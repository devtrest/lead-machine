import { redirect } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    redirect("/user");
  }

  return (
    <AdminShell email={user.email ?? null} fullName={profile.full_name ?? null}>
      {children}
    </AdminShell>
  );
}
