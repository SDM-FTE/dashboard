import queue from '../lib/jad-queue.js';

const service = queue.createQueueService();

export default async (request) => {
  const url = new URL(request.url);
  const event = {
    path: url.pathname,
    httpMethod: request.method,
    headers: { ...Object.fromEntries(request.headers), host: url.host },
    queryStringParameters: Object.fromEntries(url.searchParams),
    body: request.method === 'POST' ? await request.text() : '',
    modernRuntime: true,
  };
  const result = await service.publicRequest(event);
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
};

export const config = {
  path: ['/api/jad-applications', '/.netlify/functions/jad-applications'],
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
