
try {
    const memory = require("langchain/vectorstores/memory");
    console.log("Found langchain/vectorstores/memory");
} catch (e) {
    console.log("Failed langchain/vectorstores/memory: " + e.message);
}

try {
    const textLoader = require("langchain/document_loaders/fs/text");
    console.log("Found langchain/document_loaders/fs/text");
} catch (e) {
    console.log("Failed langchain/document_loaders/fs/text: " + e.message);
}

try {
    const textLoaderCommunity = require("@langchain/community/document_loaders/fs/text");
    console.log("Found @langchain/community/document_loaders/fs/text");
} catch (e) {
    console.log("Failed @langchain/community/document_loaders/fs/text: " + e.message);
}
