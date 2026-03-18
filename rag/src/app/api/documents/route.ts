
import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");

    const rag = await getRAGEngine();
    const result = await rag.getDocuments(page, pageSize);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("获取文档列表失败:", error);
    return NextResponse.json(
      { error: error.message || "获取文档列表时发生错误" },
      { status: 500 }
    );
  }
}
