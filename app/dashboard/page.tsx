import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import FileManager from "@/components/FileManager";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <FileManager
      userName={session.user?.name || session.user?.email || "there"}
      userImage={session.user?.image || null}
    />
  );
}
