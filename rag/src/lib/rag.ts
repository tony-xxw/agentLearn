import { Embeddings } from "@langchain/core/embeddings";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ChatOpenAI } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "@langchain/classic/document_loaders/fs/text";
import { pipeline, env } from "@xenova/transformers";
import * as path from "path";
import * as fs from "fs";
import { writeFile } from "fs/promises";

// 配置 transformers.js 使用本地缓存
env.localModelPath = path.resolve(process.cwd(), "models");
env.allowRemoteModels = true; // 允许首次运行时远程下载

class LocalHuggingFaceEmbeddings extends Embeddings {
  private model: string;
  private cacheDir: string;
  private pipeline: any;

  constructor(model: string = "Xenova/bge-small-zh-v1.5") {
    super({});
    this.model = model;
    this.cacheDir = path.resolve(process.cwd(), "models");
  }

  async init() {
    if (!this.pipeline) {
      console.log(`正在初始化 LocalHuggingFaceEmbeddings，使用模型: ${this.model}`);
      // @ts-ignore
      this.pipeline = await pipeline("feature-extraction", this.model, {
        cache_dir: this.cacheDir,
        quantized: true,
      });
      console.log("LocalHuggingFaceEmbeddings 初始化成功。");
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    await this.init();
    const embeddings: number[][] = [];
    for (const doc of documents) {
      // 特征提取返回一个 Tensor，我们需要将其转换为数组并取第一个元素（CLS token 或 mean pooling，取决于模型）
      // 对于 sentence-transformers，通常会处理 pooling。transform.js 的 feature-extraction 输出是 [batch_size, seq_len, hidden_size] 或 [batch_size, hidden_size]
      // 我们假设 pipeline 直接返回 embedding 或我们需要处理它。
      // 然而，@xenova/transformers 对 sentence-transformers 模型的 feature-extraction 如果配置了，通常默认做 mean pooling，
      // 或者我们需要处理它。暂时假设标准行为：
      const output = await this.pipeline(doc, { pooling: "mean", normalize: true });
      embeddings.push(Array.from(output.data));
    }
    return embeddings;
  }

  async embedQuery(document: string): Promise<number[]> {
    await this.init();
    const output = await this.pipeline(document, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }
}

class RAGEngine {
  private vectorStore: Milvus | MemoryVectorStore | null = null;
  private embeddings: LocalHuggingFaceEmbeddings;
  private llm: ChatOpenAI;
  public isMemoryStore: boolean = false;
  private collectionName = "rag_collection";
  private uploadedDocuments: Array<{ filename: string; uploadedAt: string; chunks: number }> = [];

  constructor() {
    this.embeddings = new LocalHuggingFaceEmbeddings();
    this.llm = new ChatOpenAI({
      modelName: "doubao-seed-1-6-flash-250828",
      openAIApiKey: process.env.DEEPSEEK_API_KEY || "dummy", // 如果未设置则使用 fallback
      configuration: {
        baseURL: "https://sg.uiuiapi.com/v1",
      },
    });
  }

  async init() {
    if (this.vectorStore) return; // 已经初始化

    console.log("正在初始化 RAG 引擎...");
    try {
      // 尝试连接到 Milvus
      // 注意：如果集合不存在或连接失败，Milvus.fromExistingCollection 可能会抛出异常
      // 我们将尝试连接/检查可用性。
      // langchain Milvus 类没有简单的“connect”方法，通常是在操作时连接。
      // 我们假设我们要检查是否可以使用 Milvus。

      // 为了演示，我们将尝试加载现有集合。
      // 如果失败，我们捕获并降级到内存。
      // 然而，通常我们在有文档或想要查询时初始化 vectorStore。
      // 让我们尝试设置一个指向该集合的 Milvus 实例。
      this.vectorStore = await Milvus.fromExistingCollection(
        this.embeddings,
        {
          collectionName: this.collectionName,
          clientConfig: {
            address: process.env.MILVUS_ADDRESS || "localhost:19530",
          },
        }
      )
      this.isMemoryStore = false;
      console.log("[RAG Init] 成功连接到现有的 Milvus 集合。");

    } catch (e: any) {
      // 如果集合不存在是正常的，会在第一次上传文档时自动创建
      if (e.message?.includes("Collection not found")) {
        console.log("[RAG Init] 未找到集合，将在首次上传文档时创建。");
        // 这里我们暂时认为连接成功，只是集合不存在
        // 但我们需要一个 Milvus 实例来调用 addDocuments，或者等到 addDocument 时再创建
        // LangChain 的 fromExistingCollection 失败时通常不会返回实例
        // 所以这里我们什么都不做，留给 addDocument 去处理创建
        // 但是为了标记我们想用 Milvus，我们需要一个状态。
        // 实际上，如果 fromExistingCollection 失败且不是因为网络原因，我们可能无法获得 vectorStore 实例。
        // 我们需要区分“无法连接”和“集合不存在”。

        // 简单策略：如果连接失败，尝试创建 MilvusClient 检查连接
        const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
        const client = new MilvusClient("localhost:19530");
        try {
          await client.checkHealth();
          console.log("[RAG Init] Milvus 连接正常，但集合不存在，将在首次上传时创建。");
          this.isMemoryStore = false;
        } catch (healthError) {
          console.warn("[RAG Init] 无法连接到 Milvus，回退到 MemoryVectorStore。", healthError);
          this.isMemoryStore = true;
        } finally {
          await client.closeConnection();
        }

      } else {
        console.warn("[RAG Init] 连接 Milvus 失败，回退到 MemoryVectorStore:", e.message);
        this.isMemoryStore = true;
      }

      if (this.isMemoryStore) {
        console.log("[RAG Init] 使用 MemoryVectorStore (内存版)。");
      }
    }
  }

  async addDocument(file: string | Buffer, filename?: string) {
    let filePath = "";
    if (Buffer.isBuffer(file)) {
      if (!filename) {
        throw new Error("Filename is required when uploading a buffer.");
      }
      // 将 Buffer 写入临时文件
      const tempDir = path.resolve(process.cwd(), "temp_uploads");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      filePath = path.join(tempDir, filename);
      await writeFile(filePath, file);
      console.log(`已将 Buffer 写入临时文件: ${filePath}`);
    } else {
      filePath = file as string;
    }

    console.log(`正在处理文档: ${filePath}`);

    // 1. 加载
    let loader;
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".csv") {
      loader = new CSVLoader(filePath);
    } else if (ext === ".pdf") {
      loader = new PDFLoader(filePath);
    } else {
      loader = new TextLoader(filePath);
    }
    const docs = await loader.load();
    console.log(`从 ${filePath} 加载了 ${docs.length} 个文档`);

    // 2. 切分
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });
    const splitDocs = await splitter.splitDocuments(docs);
    console.log(`切分为 ${splitDocs.length} 个块`);

    // 记录上传的文档
    this.uploadedDocuments.push({
      filename: filename || path.basename(filePath),
      uploadedAt: new Date().toISOString(),
      chunks: splitDocs.length,
    });

    // 3. 嵌入 & 存储
    try {
      if (!this.vectorStore || this.isMemoryStore) {
        // 如果我们在内存模式或 vectorStore 为空，尝试先初始化 Milvus（如果未显式指定为内存模式）（重试逻辑）
        // 但根据要求：如果 init 失败，isMemoryStore 为 true。
        // 我们将尊重 isMemoryStore 标志。

        if (!this.isMemoryStore) {
          // 尝试创建 Milvus 集合
          try {
            console.log("正在尝试创建 Milvus 集合...");
            this.vectorStore = await Milvus.fromDocuments(splitDocs, this.embeddings, {
              collectionName: this.collectionName,
              clientConfig: {
                address: "localhost:19530",
              },
            });
            console.log("已创建 Milvus 集合并存储文档。");
          } catch (e) {
            console.warn("创建 Milvus 集合失败，降级使用 MemoryVectorStore。", e);
            this.isMemoryStore = true;
            this.vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, this.embeddings);
          }
        } else {
          // 已经在内存模式
          if (this.vectorStore instanceof MemoryVectorStore) {
            await this.vectorStore.addDocuments(splitDocs);
          } else {
            this.vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, this.embeddings);
          }
          console.log("已将文档存储在 MemoryVectorStore 中。");
        }
      } else {
        // vectorStore 存在（Milvus 或 Memory）
        await this.vectorStore.addDocuments(splitDocs);
        console.log("已将文档添加到现有向量存储中。");
      }
    } catch (error) {
      console.error("存储文档时出错:", error);
      // 如果一切都失败，进行最终降级
      if (!this.isMemoryStore) {
        console.log("Milvus 发生严重错误，切换到 MemoryStore。");
        this.isMemoryStore = true;
        this.vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, this.embeddings);
      }
    }
  }

  async reset() {
    console.log("正在重置知识库...");
    this.uploadedDocuments = [];

    // 对于 MemoryVectorStore，直接重新实例化
    if (this.isMemoryStore || this.vectorStore instanceof MemoryVectorStore) {
      this.vectorStore = null;
      console.log("内存向量库已重置。");
      return;
    }

    // 对于 Milvus 模式
    let client: any = null;
    try {
      const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
      client = new MilvusClient({ address: "localhost:19530" });
      await client.dropCollection({ collection_name: this.collectionName });
      this.vectorStore = null;
      console.log(`Milvus 集合 ${this.collectionName} 已被删除并重置。`);
    } catch (error) {
      console.error("重置 Milvus 集合失败:", error);
    } finally {
      if (client) {
        await client.closeConnection();
      }
    }
  }

  async getDocuments(page: number = 1, pageSize: number = 10) {
    if (this.isMemoryStore) {
      console.warn("MemoryVectorStore 不支持 getDocuments 操作。");
      return { total: 0, documents: [] };
    }

    let client: any = null;
    try {
      const { MilvusClient } = await import("@zilliz/milvus2-sdk-node");
      client = new MilvusClient({ address: "localhost:19530" });

      // 健康检查
      console.log("[RAG getDocuments] 正在检查 Milvus 健康状态...");
      const health = await client.checkHealth();
      if (!health.isHealthy) {
        throw new Error("Milvus is not healthy");
      }

      // 集合检查
      console.log(`[RAG getDocuments] 检查集合是否存在: ${this.collectionName}`);
      const hasCol = await client.hasCollection({ collection_name: this.collectionName });
      if (!hasCol.value) {
        console.warn(`[RAG getDocuments] 集合 ${this.collectionName} 不存在，返回空列表。`);
        return { total: 0, documents: [] };
      }

      // 确保集合已加载到内存
      console.log(`[RAG getDocuments] 正在加载集合 ${this.collectionName}...`);
      await client.loadCollectionSync({ collection_name: this.collectionName });

      // 获取总数
      console.log("[RAG getDocuments] 获取集合统计信息...");
      const stats = await client.getCollectionStatistics({ collection_name: this.collectionName });
      const rowCountStat = stats.stats.find((s: any) => s.key === "row_count");
      const total = rowCountStat ? parseInt(rowCountStat.value, 10) : 0;
      console.log(`[RAG getDocuments] 集合文档总数: ${total}`);

      // 分页查询
      const offset = (page - 1) * pageSize;
      let pkField = "langchain_primaryid";

      console.log(`[RAG getDocuments] 执行分页查询 (offset: ${offset}, limit: ${pageSize}, pkField: ${pkField})...`);
      let queryResult = await client.query({
        collection_name: this.collectionName,
        filter: `${pkField} >= 0`,
        output_fields: ["*"],
        limit: pageSize,
        offset: offset,
      });

      // 主键兼容性处理
      if (queryResult.status && queryResult.status.error_code !== "Success") {
        console.warn(`[RAG getDocuments] 初始查询失败 (Error Code: ${queryResult.status.error_code})，尝试自动探测主键...`);

        const desc = await client.describeCollection({ collection_name: this.collectionName });

        if (!desc || !desc.schema || !desc.schema.fields) {
          console.error("[RAG getDocuments] 无法获取集合 Schema 信息", desc);
          return { total, documents: [] };
        }

        const pkSchema = desc.schema.fields.find((f: any) => f.is_primary_key === true);
        if (pkSchema && pkSchema.name !== pkField) {
          pkField = pkSchema.name;
          console.log(`[RAG getDocuments] 检测到新的主键字段: ${pkField} (Type: ${pkSchema.data_type})`);

          const filter = pkSchema.data_type === "Int64" ? `${pkField} >= 0` : `${pkField} != ""`;
          console.log(`[RAG getDocuments] 使用新过滤器重试查询: ${filter}`);

          queryResult = await client.query({
            collection_name: this.collectionName,
            filter: `${pkField} != ""`, // 对于字符串主键（如 uuid）可能需要不同的过滤条件，这里假设非空或 >= 0
            output_fields: ["*"],
            limit: pageSize,
            offset: offset,
          });
          // 如果还是失败（例如类型不匹配导致 filter 报错），可以尝试不带 filter，Milvus SDK 会抛错，但我们可以根据情况调整
          if (queryResult.status && queryResult.status.error_code !== "Success" && pkSchema.data_type === "Int64") {
            queryResult = await client.query({
              collection_name: this.collectionName,
              filter: `${pkField} >= 0`,
              output_fields: ["*"],
              limit: pageSize,
              offset: offset,
            });
          }
        }
      }

      return {
        total,
        documents: queryResult.data || [],
      };
    } catch (error) {
      console.error("[RAG getDocuments] 获取文档列表失败:", error);
      return { total: 0, documents: [] };
    } finally {
      if (client) {
        await client.closeConnection();
      }
    }
  }

  async search(query: string, k: number = 3) {
    if (!this.vectorStore) {
      throw new Error("Vector store not initialized.");
    }
    return await this.vectorStore.similaritySearch(query, k);
  }
}

// 单例模式
let ragEngineInstance: RAGEngine | null = null;

export const getRAGEngine = async () => {
  // @ts-ignore
  if (global.ragEngineInstance) {
    // @ts-ignore
    return global.ragEngineInstance as RAGEngine;
  }

  if (!ragEngineInstance) {
    ragEngineInstance = new RAGEngine();
    await ragEngineInstance.init();
    // @ts-ignore
    global.ragEngineInstance = ragEngineInstance;
  }
  return ragEngineInstance;
};
