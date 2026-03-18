
import { NextRequest, NextResponse } from "next/server";
import { getRAGEngine } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "未找到文件" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    const rag = await getRAGEngine();
    await rag.addDocument(buffer, filename);

    // 获取该文档的 chunk 数量，这里我们可以从 getDocuments 获取最新的一条，或者 addDocument 返回（目前 addDocument 返回 void）
    // 我们修改后的 addDocument 并没有返回值，但我们可以假设成功。
    // 为了返回 chunks 数量，我们可以查询一下或者简化返回。
    // 也可以修改 addDocument 返回 chunks 数量，但为了保持接口改动最小，我们这里查询一下最新的文档。
    const docs = await rag.getDocuments(1, 1000); // 假设并发不高，取最新的
    const latest = docs.documents.find(d => d.filename === filename);
    const chunks = latest ? latest.chunks : 0;

    return NextResponse.json({
      success: true,
      message: "文档上传并处理成功",
      chunks: chunks,
    });
  } catch (error: any) {
    console.error("上传失败:", error);
    return NextResponse.json(
      { error: error.message || "上传处理过程中发生错误" },
      { status: 500 }
    );
  }
}
