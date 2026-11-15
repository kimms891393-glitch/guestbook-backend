import http from 'node:http';
import { createEntryStore } from './services/entries.js';
import {
  HttpError,
  parseJson,
  readBody,
  sendEmpty,
  sendJson
} from './utils/http.js';
import { parseId, parseLimit, parsePage } from './utils/validate.js';

const matchEntry = (pathname) => {
  const match = pathname.match(/^\/entries\/(\d+)$/);
  return match ? match[1] : null;
};

export const createServer = ({ dbPath, corsOrigin }) => {
  const store = createEntryStore(dbPath);
  let ready = store.load();

  const sendError = (res, error) => {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message }, corsOrigin);
      return;
    }

    console.error(error);
    sendJson(res, 500, { error: '서버 오류가 발생했습니다.' }, corsOrigin);
  };

  const server = http.createServer(async (req, res) => {
    try {
      await ready;

      const url = new URL(req.url, 'http://localhost');
      const { pathname, searchParams } = url;

      if (req.method === 'OPTIONS') {
        sendEmpty(res, 204, corsOrigin);
        return;
      }

      if (req.method === 'GET' && pathname === '/entries') {
        const result = await store.list({
          page: parsePage(searchParams.get('page') ?? undefined),
          limit: parseLimit(searchParams.get('limit') ?? undefined)
        });
        sendJson(res, 200, result, corsOrigin);
        return;
      }

      if (req.method === 'POST' && pathname === '/entries') {
        const body = parseJson(await readBody(req));
        const entry = await store.create(body);
        sendJson(res, 201, entry, corsOrigin);
        return;
      }

      const entryId = matchEntry(pathname);

      if (req.method === 'PATCH' && entryId) {
        const body = parseJson(await readBody(req));
        const entry = await store.update(parseId(entryId), body);
        sendJson(res, 200, entry, corsOrigin);
        return;
      }

      if (req.method === 'DELETE' && entryId) {
        const body = parseJson(await readBody(req));
        await store.remove(parseId(entryId), body.password);
        sendEmpty(res, 204, corsOrigin);
        return;
      }

      throw new HttpError(404, '경로를 찾을 수 없습니다.');
    } catch (error) {
      sendError(res, error);
    }
  });

  return server;
};
