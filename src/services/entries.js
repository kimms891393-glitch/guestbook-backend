import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../utils/http.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  normalizeMessage,
  normalizeName,
  normalizePassword
} from '../utils/validate.js';

const emptyStore = () => ({
  nextId: 1,
  items: []
});

const toPublic = (entry) => ({
  id: entry.id,
  name: entry.name,
  message: entry.message,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt
});

export const createEntryStore = (dbPath) => {
  const isMemory = dbPath === ':memory:';
  let store = emptyStore();
  // shortcut: one process owns the JSON file; use sqlite if several servers write
  let writes = Promise.resolve();

  const load = async () => {
    if (isMemory) {
      return;
    }

    try {
      const raw = await readFile(dbPath, 'utf8');
      store = JSON.parse(raw);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }

      store = emptyStore();
    }
  };

  const persist = async () => {
    if (isMemory) {
      return;
    }

    await mkdir(path.dirname(dbPath), { recursive: true });
    const tmpPath = `${dbPath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    await rename(tmpPath, dbPath);
  };

  const withLock = (work) => {
    const run = writes.then(work);
    writes = run.catch(() => {});
    return run;
  };

  const findById = (id) => store.items.find((item) => item.id === id);

  const list = async ({ page, limit }) => {
    const sorted = [...store.items].sort((a, b) => b.id - a.id);
    const total = sorted.length;
    const start = (page - 1) * limit;
    const items = sorted.slice(start, start + limit).map(toPublic);

    return { items, page, limit, total };
  };

  const create = ({ name, message, password }) => withLock(async () => {
    const entry = {
      id: store.nextId,
      name: normalizeName(name),
      message: normalizeMessage(message),
      passwordHash: hashPassword(normalizePassword(password)),
      createdAt: new Date().toISOString(),
      updatedAt: null
    };

    store.nextId += 1;
    store.items.push(entry);

    try {
      await persist();
    } catch (error) {
      store.items.pop();
      store.nextId -= 1;
      throw error;
    }

    return toPublic(entry);
  });

  const update = (id, { name, message, password }) => withLock(async () => {
    const entry = findById(id);

    if (!entry) {
      throw new HttpError(404, '글을 찾을 수 없습니다.');
    }

    const hasName = name !== undefined;
    const hasMessage = message !== undefined;

    if (!hasName && !hasMessage) {
      throw new HttpError(400, 'name 또는 message 중 하나는 필요합니다.');
    }

    if (!verifyPassword(normalizePassword(password), entry.passwordHash)) {
      throw new HttpError(403, '비밀번호가 일치하지 않습니다.');
    }

    const previous = {
      name: entry.name,
      message: entry.message,
      updatedAt: entry.updatedAt
    };

    if (hasName) {
      entry.name = normalizeName(name);
    }

    if (hasMessage) {
      entry.message = normalizeMessage(message);
    }

    entry.updatedAt = new Date().toISOString();

    try {
      await persist();
    } catch (error) {
      entry.name = previous.name;
      entry.message = previous.message;
      entry.updatedAt = previous.updatedAt;
      throw error;
    }

    return toPublic(entry);
  });

  const remove = (id, password) => withLock(async () => {
    const entry = findById(id);

    if (!entry) {
      throw new HttpError(404, '글을 찾을 수 없습니다.');
    }

    if (!verifyPassword(normalizePassword(password), entry.passwordHash)) {
      throw new HttpError(403, '비밀번호가 일치하지 않습니다.');
    }

    const index = store.items.indexOf(entry);
    store.items.splice(index, 1);

    try {
      await persist();
    } catch (error) {
      store.items.splice(index, 0, entry);
      throw error;
    }
  });

  return {
    load,
    list,
    create,
    update,
    remove
  };
};
