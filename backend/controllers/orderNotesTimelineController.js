'use strict';

const OrderEvent = require('../models/OrderEvent');
const OrderNote = require('../models/OrderNote');
const {
  ensureOrderOperationAccess,
} = require('../services/orderRouteAccessService');
const {
  listOrderNotesPage,
  listOrderTimelinePage,
} = require('../services/orderActivityQueryService');

async function listOrderNotes(req, res) {
  try {
    const orderId = req.params.id;

    if (
      !(await ensureOrderOperationAccess(req, res, orderId, {
        requireWholeOrder: true,
      }))
    ) {
      return;
    }

    const result = await listOrderNotesPage(
      { orderId, query: req.query },
      { OrderNoteModel: OrderNote }
    );

    res.json({ data: result.items, pagination: result.pagination });
  } catch (error) {
    console.error('GET /orders/:id/notes', error);
    res.status(500).json({ error: 'No se pudieron obtener las notas' });
  }
}

async function createOrderNote(req, res) {
  try {
    const orderId = req.params.id;
    const text = String(req.body?.text || '').trim().slice(0, 2000);
    const pinned = Boolean(req.body?.pinned);
    const author = {
      name: String(req.adminUsername || req.adminProfile?.displayName || 'admin'),
      id: String(req.adminUserId || ''),
    };

    if (
      !(await ensureOrderOperationAccess(req, res, orderId, {
        requireWholeOrder: true,
      }))
    ) {
      return;
    }

    if (!text) {
      return res.status(400).json({ error: 'El texto de la nota es obligatorio' });
    }

    const note = await OrderNote.create({ orderId, text, pinned, author });

    await OrderEvent.create({
      orderId,
      type: 'note_created',
      message: `Nota creada${pinned ? ' (fijada)' : ''}`,
      meta: { noteId: note._id, author },
    });

    return res.status(201).json({ ok: true, note });
  } catch (error) {
    console.error('POST /orders/:id/notes', error);
    return res.status(500).json({ error: 'No se pudo crear la nota' });
  }
}

async function updateOrderNote(req, res) {
  try {
    const { id: orderId, noteId } = req.params;

    if (
      !(await ensureOrderOperationAccess(req, res, orderId, {
        requireWholeOrder: true,
      }))
    ) {
      return;
    }

    const patch = {};

    if (typeof req.body?.text === 'string') {
      const text = req.body.text.trim().slice(0, 2000);
      if (!text) {
        return res.status(400).json({
          error: 'NOTE_TEXT_REQUIRED',
          message: 'El texto de la nota es obligatorio.',
        });
      }
      patch.text = text;
    }

    if (typeof req.body?.pinned === 'boolean') patch.pinned = req.body.pinned;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error: 'NOTE_PATCH_REQUIRED',
        message: 'No se recibieron cambios válidos para la nota.',
      });
    }

    const note = await OrderNote.findOneAndUpdate(
      { _id: noteId, orderId },
      { $set: patch },
      { new: true }
    ).lean();

    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    await OrderEvent.create({
      orderId,
      type: 'note_updated',
      message: 'Nota actualizada',
      meta: { noteId },
    });

    return res.json({ ok: true, note });
  } catch (error) {
    console.error('PATCH /orders/:id/notes/:noteId', error);
    return res.status(500).json({ error: 'No se pudo actualizar la nota' });
  }
}

async function deleteOrderNote(req, res) {
  try {
    const { id: orderId, noteId } = req.params;

    if (
      !(await ensureOrderOperationAccess(req, res, orderId, {
        requireWholeOrder: true,
      }))
    ) {
      return;
    }

    const result = await OrderNote.deleteOne({ _id: noteId, orderId });

    if (!result.deletedCount) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    await OrderEvent.create({
      orderId,
      type: 'note_deleted',
      message: 'Nota eliminada',
      meta: { noteId },
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /orders/:id/notes/:noteId', error);
    return res.status(500).json({ error: 'No se pudo eliminar la nota' });
  }
}

async function listOrderTimeline(req, res) {
  try {
    const orderId = req.params.id;

    if (
      !(await ensureOrderOperationAccess(req, res, orderId, {
        requireWholeOrder: true,
      }))
    ) {
      return;
    }

    const result = await listOrderTimelinePage(
      { orderId, query: req.query },
      { OrderEventModel: OrderEvent }
    );

    return res.json({ data: result.items, pagination: result.pagination });
  } catch (error) {
    console.error('GET /orders/:id/timeline', error);
    return res.status(500).json({ error: 'No se pudo obtener el timeline' });
  }
}

module.exports = {
  createOrderNote,
  deleteOrderNote,
  listOrderNotes,
  listOrderTimeline,
  updateOrderNote,
};
