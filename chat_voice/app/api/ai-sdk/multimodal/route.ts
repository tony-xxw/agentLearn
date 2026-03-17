export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1];
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const text = `这是一个测试回复。我收到了你的消息: "${lastMessage.content}"`;
      const chunks = text.split('');
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise(r => setTimeout(r, 50));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
