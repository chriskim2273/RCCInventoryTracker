import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchAuditItems, getAuditItemName } from '../src/lib/auditUtils.js'

// Match the API's row cap so an unfiltered inventory lookup reproduces the bug.
function inventoryClient(items) {
  return {
    from(table) {
      assert.equal(table, 'items')
      let ids = null
      const query = {
        select() { return query },
        in(column, values) {
          assert.equal(column, 'id')
          ids = values
          return query
        },
        then(resolve, reject) {
          const data = items.filter(item => !ids || ids.includes(item.id)).slice(0, 1000)
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
}

test('audit entries resolve items beyond the first 1,000 inventory rows', async () => {
  const items = Array.from({ length: 1497 }, (_, index) => ({
    id: `item-${index + 1}`,
    name: `Inventory item ${index + 1}`,
  }))
  const logs = [{ item_id: 'item-1497' }, { item_id: 'item-1496' }, { item_id: 'item-1497' }]
  const result = await fetchAuditItems(inventoryClient(items), logs)

  assert.equal(result.get('item-1497')?.name, 'Inventory item 1497')
  assert.equal(result.get('item-1496')?.name, 'Inventory item 1496')
  assert.equal(result.size, 2)
})

test('an audit page without item IDs skips the inventory query', async () => {
  const client = { from() { assert.fail('No inventory lookup should be needed') } }
  assert.equal((await fetchAuditItems(client, [])).size, 0)
  assert.equal((await fetchAuditItems(client, [{ item_id: null }])).size, 0)
})

test('inventory lookup failures are surfaced instead of becoming unknown items', async () => {
  const error = new Error('Inventory query failed')
  const query = {
    select() { return query },
    in() { return query },
    then(resolve, reject) { return Promise.resolve({ data: null, error }).then(resolve, reject) },
  }
  await assert.rejects(fetchAuditItems({ from: () => query }, [{ item_id: 'item-1' }]), error)
})

for (const [description, log, expected] of [
  ['current item name', { item: { name: 'Current name' }, changes: { new: { name: 'Saved name' } } }, 'Current name'],
  ['saved name after an update', { changes: { old: { name: 'Old name' }, new: { name: 'Updated name' } } }, 'Updated name'],
  ['saved name after permanent deletion', { item: null, changes: { old: { name: 'Deleted item' } } }, 'Deleted item'],
  ['missing item and snapshots', { item: null, changes: null }, 'Unknown Item'],
]) {
  test(`audit heading uses the ${description}`, () => {
    assert.equal(getAuditItemName(log), expected)
  })
}
