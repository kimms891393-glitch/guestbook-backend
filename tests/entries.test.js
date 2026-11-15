import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

let server;
let baseUrl;

const startServer = async (dbPath = ':memory:') => {
  server = createServer({
    dbPath,
    corsOrigin: 'http://localhost:5173'
  });

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
};

const stopServer = async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  server = undefined;
};

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  const body = text === '' ? null : JSON.parse(text);

  return { status: response.status, headers: response.headers, body };
};

const createEntry = async (payload) => {
  return request('/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

beforeEach(() => startServer());
afterEach(stopServer);

describe('GET /entries', () => {
  it('빈 목록을 최신순 형식으로 반환한다', async () => {
    const { status, body } = await request('/entries');

    assert.equal(status, 200);
    assert.deepEqual(body, {
      items: [],
      page: 1,
      limit: 20,
      total: 0
    });
  });

  it('최신 글이 앞에 오고 비밀번호는 응답에 없다', async () => {
    await createEntry({ name: '철수', message: '첫번째', password: '1234' });
    await createEntry({ name: '영희', message: '두번째', password: 'abcd' });

    const { status, body } = await request('/entries');

    assert.equal(status, 200);
    assert.equal(body.total, 2);
    assert.equal(body.items[0].name, '영희');
    assert.equal(body.items[1].name, '철수');
    assert.equal(body.items[0].updatedAt, null);
    assert.equal(body.items[0].password, undefined);
    assert.equal(body.items[0].passwordHash, undefined);
  });

  it('page와 limit으로 페이지를 나눈다', async () => {
    await createEntry({ name: '하나', message: '1', password: '1234' });
    await createEntry({ name: '둘', message: '2', password: '1234' });
    await createEntry({ name: '셋', message: '3', password: '1234' });

    const { body } = await request('/entries?page=2&limit=2');

    assert.equal(body.page, 2);
    assert.equal(body.limit, 2);
    assert.equal(body.total, 3);
    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].name, '하나');
  });
});

describe('POST /entries', () => {
  it('글을 만들고 201과 Entry를 반환한다', async () => {
    const { status, body } = await createEntry({
      name: ' 철수 ',
      message: ' 안녕하세요! ',
      password: '1234'
    });

    assert.equal(status, 201);
    assert.equal(body.name, '철수');
    assert.equal(body.message, '안녕하세요!');
    assert.equal(typeof body.id, 'number');
    assert.equal(typeof body.createdAt, 'string');
    assert.equal(body.updatedAt, null);
    assert.ok(body.createdAt.endsWith('Z'));
    assert.equal(body.password, undefined);
  });

  it('입력 제한을 벗어나면 400을 반환한다', async () => {
    const { status, body } = await createEntry({
      name: '',
      message: '안녕하세요!',
      password: '1234'
    });

    assert.equal(status, 400);
    assert.equal(typeof body.error, 'string');
  });

  it('잘못된 JSON이면 400을 반환한다', async () => {
    for (const payload of ['{bad', 'null', '[]', '1']) {
      const { status, body } = await request('/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      assert.equal(status, 400, payload);
      assert.equal(typeof body.error, 'string');
    }
  });

  it('본문이 너무 크면 400을 반환한다', async () => {
    const { status, body } = await request('/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'x'.repeat(9000)
    });

    assert.equal(status, 400);
    assert.equal(typeof body.error, 'string');
  });
});

describe('저장', () => {
  it('파일을 저장하고 다시 읽는다', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'guestbook-'));
    const dbPath = path.join(dir, 'guestbook.json');

    try {
      await stopServer();
      await startServer(dbPath);
      await createEntry({ name: '철수', message: '안녕하세요!', password: '1234' });
      await stopServer();
      await startServer(dbPath);

      const { status, body } = await request('/entries');
      assert.equal(status, 200);
      assert.equal(body.total, 1);
      assert.equal(body.items[0].name, '철수');
      assert.equal(body.items[0].passwordHash, undefined);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('PATCH /entries/:id', () => {
  it('비밀번호가 맞으면 글을 수정한다', async () => {
    const created = await createEntry({
      name: '철수',
      message: '안녕하세요!',
      password: '1234'
    });

    const { status, body } = await request(`/entries/${created.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '1234', message: '수정된 내용' })
    });

    assert.equal(status, 200);
    assert.equal(body.message, '수정된 내용');
    assert.equal(body.name, '철수');
    assert.equal(typeof body.updatedAt, 'string');
  });

  it('비밀번호가 틀리면 403을 반환한다', async () => {
    const created = await createEntry({
      name: '철수',
      message: '안녕하세요!',
      password: '1234'
    });

    const { status, body } = await request(`/entries/${created.body.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '9999', message: '수정된 내용' })
    });

    assert.equal(status, 403);
    assert.equal(typeof body.error, 'string');
  });

  it('없는 글이면 404를 반환한다', async () => {
    const { status, body } = await request('/entries/999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '1234', message: '수정된 내용' })
    });

    assert.equal(status, 404);
    assert.equal(typeof body.error, 'string');
  });
});

describe('DELETE /entries/:id', () => {
  it('비밀번호가 맞으면 204로 삭제한다', async () => {
    const created = await createEntry({
      name: '철수',
      message: '안녕하세요!',
      password: '1234'
    });

    const deleted = await request(`/entries/${created.body.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '1234' })
    });

    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, null);

    const list = await request('/entries');
    assert.equal(list.body.total, 0);
  });

  it('비밀번호가 틀리면 403을 반환한다', async () => {
    const created = await createEntry({
      name: '철수',
      message: '안녕하세요!',
      password: '1234'
    });

    const { status } = await request(`/entries/${created.body.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' })
    });

    assert.equal(status, 403);
  });
});

describe('공통', () => {
  it('없는 경로는 404를 반환한다', async () => {
    const { status, body } = await request('/unknown');

    assert.equal(status, 404);
    assert.equal(typeof body.error, 'string');
  });

  it('프론트엔드 출처에 CORS를 허용한다', async () => {
    const { status, headers } = await request('/entries', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST'
      }
    });

    assert.equal(status, 204);
    assert.equal(headers.get('access-control-allow-origin'), 'http://localhost:5173');
  });
});
