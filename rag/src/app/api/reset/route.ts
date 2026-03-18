
import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const rag = await getRAGEngine();
    await rag.reset();

    return NextResponse.json({
      success: true,
      message: "知识库已重置",
    });
  } catch (error: any) {
    console.error("重置失败:", error);
    return NextResponse.json(
      { error: error.message || "重置过程中发生错误" },
      { status: 500 }
    );
  }
}
