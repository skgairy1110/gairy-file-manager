import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteFile, renameFile, moveFile } from "@/lib/blob";

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  try {
    await deleteFile(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to delete file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, pathname, newName, destPrefix } = body as {
      action?: "rename" | "move";
      pathname?: string;
      newName?: string;
      destPrefix?: string;
    };

    if (!pathname) {
      return NextResponse.json({ error: "Missing pathname." }, { status: 400 });
    }

    if (action === "rename") {
      if (!newName || !newName.trim()) {
        return NextResponse.json({ error: "New name is required." }, { status: 400 });
      }
      const result = await renameFile(pathname, newName);
      return NextResponse.json(result);
    }

    if (action === "move") {
      if (destPrefix === undefined) {
        return NextResponse.json({ error: "Destination folder is required." }, { status: 400 });
      }
      const result = await moveFile(pathname, destPrefix);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
