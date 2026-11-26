import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const item = { name: "Director's projector", category: 'Electronics', quantity: 3, item_condition: 'good' };

test('POST /items creates an item using parameterized SQL', async (t) => {
  const execute = t.mock.fn(async () => [{ insertId: 7 }]);
  const response = await request(createApp({ execute }))
    .post('/items')
    .send({ ...item, name: `  ${item.name}  ` })
    .expect(201);

  assert.deepEqual(response.body, { id: 7, ...item });
  assert.deepEqual(execute.mock.calls[0].arguments, [
    'INSERT INTO items (name, category, quantity, item_condition) VALUES (?, ?, ?, ?)',
    [item.name, item.category, item.quantity, item.item_condition],
  ]);
});

test('GET /items returns the rows with their timestamps', async (t) => {
  const rows = [{ id: 7, ...item, created_at: '2026-11-26 10:00:00', updated_at: '2026-11-26 10:00:00' }];
  const execute = t.mock.fn(async () => [rows]);
  const response = await request(createApp({ execute })).get('/items').expect(200);

  assert.deepEqual(response.body, rows);
  assert.deepEqual(execute.mock.calls[0].arguments, [
    'SELECT id, name, category, quantity, item_condition, created_at, updated_at FROM items ORDER BY id',
  ]);
});

test('GET /items returns an empty array for an empty inventory', async () => {
  await request(createApp({ execute: async () => [[]] })).get('/items').expect(200, []);
});

test('PUT /items/:id accepts zero quantity and returns the updated fields', async (t) => {
  const update = { ...item, quantity: 0, item_condition: 'maintenance' };
  const execute = t.mock.fn(async () => [{ affectedRows: 1 }]);
  const response = await request(createApp({ execute })).put('/items/7').send(update).expect(200);

  assert.deepEqual(response.body, { id: 7, ...update });
  assert.deepEqual(execute.mock.calls[0].arguments, [
    'UPDATE items SET name = ?, category = ?, quantity = ?, item_condition = ? WHERE id = ?',
    [update.name, update.category, update.quantity, update.item_condition, 7],
  ]);
});

test('PUT /items/:id succeeds when MySQL reports a matched but unchanged row', async () => {
  const execute = async () => [{ affectedRows: 1, changedRows: 0 }];
  await request(createApp({ execute })).put('/items/7').send(item).expect(200, { id: 7, ...item });
});

test('DELETE /items/:id deletes the item and returns no response body', async (t) => {
  const execute = t.mock.fn(async () => [{ affectedRows: 1 }]);
  const response = await request(createApp({ execute })).delete('/items/7').expect(204);

  assert.equal(response.text, '');
  assert.deepEqual(execute.mock.calls[0].arguments, ['DELETE FROM items WHERE id = ?', [7]]);
});

test('PUT and DELETE return 404 for a missing item', async () => {
  const api = request(createApp({ execute: async () => [{ affectedRows: 0 }] }));
  const expected = { error: 'Item not found' };

  await api.put('/items/7').send(item).expect(404, expected);
  await api.delete('/items/7').expect(404, expected);
});

test('POST and PUT reject invalid payloads before executing SQL', async (t) => {
  const execute = t.mock.fn();
  const api = request(createApp({ execute }));
  const invalidPayloads = [
    {},
    [],
    { ...item, name: '   ' },
    { ...item, name: 'a'.repeat(101) },
    { ...item, category: '   ' },
    { ...item, category: 'a'.repeat(51) },
    { ...item, quantity: -1 },
    { ...item, quantity: 1.5 },
    { ...item, quantity: '3' },
    { ...item, quantity: 2_147_483_648 },
    { ...item, item_condition: 'Good' },
  ];

  for (const payload of invalidPayloads) {
    await api.post('/items').send(payload).expect(400, { error: 'Invalid item payload' });
    await api.put('/items/7').send(payload).expect(400, { error: 'Invalid item payload' });
  }
  assert.equal(execute.mock.callCount(), 0);
});

test('PUT and DELETE reject invalid IDs before executing SQL', async (t) => {
  const execute = t.mock.fn();
  const api = request(createApp({ execute }));

  for (const id of ['0', '-1', '1.5', 'abc', '2147483648', '1%0A']) {
    await api.put(`/items/${id}`).send(item).expect(400, { error: 'Invalid item ID' });
    await api.delete(`/items/${id}`).expect(400, { error: 'Invalid item ID' });
  }
  assert.equal(execute.mock.callCount(), 0);
});

test('POST /items returns a JSON error for malformed JSON', async () => {
  await request(createApp({}))
    .post('/items')
    .set('Content-Type', 'application/json')
    .send('{"name":')
    .expect(400, { error: 'Invalid request' });
});

test('POST /items returns 413 for a large JSON body', async () => {
  await request(createApp({}))
    .post('/items')
    .send({ ...item, name: 'x'.repeat(102_401) })
    .expect(413, { error: 'Request body too large' });
});

test('POST /items returns 415 for an unsupported JSON character set', async () => {
  await request(createApp({}))
    .post('/items')
    .set('Content-Type', 'application/json; charset=iso-8859-1')
    .send(JSON.stringify(item))
    .expect(415, { error: 'Unsupported request encoding' });
});

test('CRUD database errors return a generic 500 response', async () => {
  const execute = async () => { throw new Error('Example private driver detail'); };
  await request(createApp({ execute })).get('/items').expect(500, { error: 'Internal server error' });
});

test('GET /health checks API liveness without touching the database', async (t) => {
  const query = t.mock.fn();
  const execute = t.mock.fn();

  await request(createApp({ query, execute })).get('/health').expect(200, { status: 'ok' });
  assert.equal(query.mock.callCount(), 0);
  assert.equal(execute.mock.callCount(), 0);
});

test('GET /health/db checks database connectivity with SELECT 1', async (t) => {
  const query = t.mock.fn(async () => [[{ '1': 1 }]]);
  await request(createApp({ query })).get('/health/db').expect(200, { status: 'ok' });
  assert.deepEqual(query.mock.calls[0].arguments, ['SELECT 1']);
});

test('GET /health/db returns 503 without exposing driver details', async () => {
  const query = async () => { throw new Error('Example private driver detail'); };
  await request(createApp({ query })).get('/health/db').expect(503, { error: 'Database unavailable' });
});

test('GET /items/:id is outside the four inventory operations', async () => {
  await request(createApp({})).get('/items/7').expect(404, { error: 'Route not found' });
});

test('GET /docs opens Swagger UI with the inventory OpenAPI definition', async () => {
  const api = request(createApp({}));
  await api.get('/docs').expect(301).expect('Location', '/docs/');
  await api.get('/docs/').expect(200).expect('Content-Type', /html/).expect(/Swagger UI/);
  await api.get('/docs/swagger-ui-init.js').expect(200).expect(/Cloud Inventory API/);
});
