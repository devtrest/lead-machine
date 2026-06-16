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
    redirect("/leadmachineadmin?next=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Strict admin-only — a non-admin who got past the login gate (e.g. role
  // demotion mid-session) is signed back out and bounced to the admin URL,
  // not the user dashboard. Admin and user surfaces are isolated; we don't
  // silently switch them between roles.
  if (profile?.role !== "admin") {
    redirect("/leadmachineadmin");
  }

  return (
    <AdminShell email={user.email ?? null} fullName={profile.full_name ?? null}>
      {children}
    </AdminShell>
  );
}
