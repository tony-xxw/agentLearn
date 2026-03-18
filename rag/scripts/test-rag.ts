
import { getRAGEngine } from "../src/lib/rag";
import * as path from "path";

async function main() {
  console.log("正在启动 RAG 引擎测试...");

  try {
    const rag = await getRAGEngine();
    console.log("RAGEngine 实例已获取。");

    // await rag.init(); // 已经在 getRAGEngine 中初始化
    // console.log("RAGEngine initialized.");

    console.log("正在测试 Embeddings...");
    // @ts-ignore - 访问私有属性进行测试
    const embeddings = rag.embeddings;
    const vector = await embeddings.embedQuery("Hello world");
    console.log(`已生成 Embedding。长度: ${vector.length}`);

    if (vector.length > 0) {
      console.log("Embedding 测试通过。");
    } else {
      console.error("Embedding 测试失败: 向量为空。");
    }

    // 测试 addDocument
    console.log("正在测试 addDocument...");
    const absPath = path.resolve(process.cwd(), "test_docs/test.txt");

    try {
      await rag.addDocument(absPath);
      console.log("addDocument 测试通过。");

      // 测试搜索
      console.log("正在测试搜索...");
      const results = await rag.search("What is RAG?");
      console.log(`搜索返回了 ${results.length} 个结果。`);
      if (results.length > 0) {
        console.log("第一个结果:", results[0].pageContent);
        console.log("搜索测试通过。");
      } else {
        console.warn("搜索测试警告: 未找到结果 (如果阈值严格可能是符合预期的)。");
      }

    } catch (e) {
      console.error("addDocument/搜索 失败:", e);
    }

    // 检查降级
    if (rag.isMemoryStore) {
      console.log("MemoryVectorStore 降级已激活 (如果 Milvus 未运行则符合预期)。");
    } else {
      console.log("已连接到 Milvus。");
    }

  } catch (error) {
    console.error("测试失败，错误:", error);
    process.exit(1);
  }
}

main();
