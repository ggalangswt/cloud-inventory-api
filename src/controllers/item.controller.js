const MAX_SQL_INT = 2_147_483_647;
const ITEM_CONDITIONS = new Set(['good', 'damaged', 'maintenance']);

export function validateItemId(req, res, next, rawId) {
  const id = Number(rawId);
  if (!/^[1-9]\d*$/.test(rawId) || id > MAX_SQL_INT) {
    return res.status(400).json({ error: 'Invalid item ID' });
  }

  res.locals.itemId = id;
  next();
}

export function validateItem(req, res, next) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
  const { quantity, item_condition } = req.body ?? {};

  if (
    !name || [...name].length > 100 ||
    !category || [...category].length > 50 ||
    !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_SQL_INT ||
    !ITEM_CONDITIONS.has(item_condition)
  ) {
    return res.status(400).json({ error: 'Invalid item payload' });
  }

  res.locals.item = { name, category, quantity, item_condition };
  next();
}

export function createItemController(pool) {
  return {
    async create(req, res) {
      const item = res.locals.item;
      const [result] = await pool.execute(
        'INSERT INTO items (name, category, quantity, item_condition) VALUES (?, ?, ?, ?)',
        [item.name, item.category, item.quantity, item.item_condition],
      );

      res.status(201).json({ id: result.insertId, ...item });
    },

    async list(req, res) {
      const [rows] = await pool.execute(
        'SELECT id, name, category, quantity, item_condition, created_at, updated_at FROM items ORDER BY id',
      );

      res.json(rows);
    },

    async update(req, res) {
      const id = res.locals.itemId;
      const item = res.locals.item;
      const [result] = await pool.execute(
        'UPDATE items SET name = ?, category = ?, quantity = ?, item_condition = ? WHERE id = ?',
        [item.name, item.category, item.quantity, item.item_condition, id],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({ id, ...item });
    },

    async remove(req, res) {
      const [result] = await pool.execute('DELETE FROM items WHERE id = ?', [res.locals.itemId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.status(204).end();
    },
  };
}
