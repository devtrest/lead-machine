import { redirect } from "next/navigation";

// Generate leads was merged into the campaigns page so users create + monitor
// runs in the same place. Old bookmarks land here and get bounced to /user/jobs.
export default function GeneratePage() {
  redirect("/user/jobs");
}
