import { Router } from 'express';
import { createItemController, validateItem, validateItemId } from '../controllers/item.controller.js';

export function createItemRouter(pool) {
  const router = Router();
  const controller = createItemController(pool);

  router.param('id', validateItemId);
  router.post('/', validateItem, controller.create);
  router.get('/', controller.list);
  router.put('/:id', validateItem, controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
