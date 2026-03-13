import { redirect } from "next/navigation";
import AdminConsoleClient from "@/app/admin/AdminConsoleClient";
import { getServerSession } from "@/lib/server/session";

export default async function AdminPage() {
  const session = await getServerSession();
  if (session.role !== "admin") {
    redirect("/login?next=/admin");
  }

  return <AdminConsoleClient />;
}
