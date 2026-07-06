import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listContents, createFolder, deleteFolder, renameFolder, moveFolder } from "@/lib/blob";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefix = request.nextUrl.searchParams.get("prefix") || "";

  try {
    const data = await listContents(prefix);
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to list folder contents." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { prefix, name } = body as { prefix?: string; name?: string };
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    }
    const folder = await createFolder(prefix || "", name);
    return NextResponse.json(folder);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to create folder.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefix = request.nextUrl.searchParams.get("prefix");
  if (!prefix) {
    return NextResponse.json({ error: "Missing prefix." }, { status: 400 });
  }

  try {
    await deleteFolder(prefix);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Failed to delete folder.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action, path, newName, destPrefix } = body as {
      action?: "rename" | "move";
      path?: string;
      newName?: string;
      destPrefix?: string;
    };

    if (!path) {
      return NextResponse.json({ error: "Missing folder path." }, { status: 400 });
    }

    if (action === "rename") {
      if (!newName || !newName.trim()) {
        return NextResponse.json({ error: "New name is required." }, { status: 400 });
      }
      const newPrefix = await renameFolder(path, newName);
      return NextResponse.json({ path: newPrefix });
    }

    if (action === "move") {
      if (destPrefix === undefined) {
        return NextResponse.json({ error: "Destination folder is required." }, { status: 400 });
      }
      const newPrefix = await moveFolder(path, destPrefix);
      return NextResponse.json({ path: newPrefix });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Operation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
