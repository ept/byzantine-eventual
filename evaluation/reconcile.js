// Simulates a system with two nodes that have diverged and are reconciling
// their sets of messages.

const { Replica } = require('./replica')

const BYTES_PER_UPDATE = 1000, BITS_PER_HASH = 256, MESSAGE_OVERHEAD = 100

// true runs in deterministic mode, false randomises the run.
// The randomisation only affects the Bloom filter.
const DETERMINISTIC = false

// The reconciliation runs with 3 * numUpdates broadcast events: the two nodes
// have numUpdates messages in common, one node has added numUpdates messages
// since the last sync, and the other node has also added numUpdates messages
// since the last sync. Thus, we expect 2 * numUpdates messages to be exchanged
// during reconciliation.
function runAlgorithm(version, numUpdates) {
  const replica1 = DETERMINISTIC ? new Replica('a') : new Replica(`a ${Math.random()}`)
  const replica2 = DETERMINISTIC ? new Replica('b') : new Replica(`b ${Math.random()}`)
  for (let i = 0; i < numUpdates; i++) replica1.generateUpdate()
  replica1.reconcileV2(replica2)
  for (let i = 0; i < numUpdates; i++) replica1.generateUpdate()
  for (let i = 0; i < numUpdates; i++) replica2.generateUpdate()

  const stats = version === 1 ? replica1.reconcileV1(replica2) : replica1.reconcileV2(replica2)
  const bytes = BYTES_PER_UPDATE * stats.updates +
    Math.ceil((BITS_PER_HASH * stats.hashes + (stats.bloomBits || 0)) / 8) +
    stats.messages * MESSAGE_OVERHEAD
  return {bytes, roundtrips: stats.roundtrips}
}

for (let numUpdates of [1, 3, 10, 30, 100, 300, 1000]) {
  const v1 = runAlgorithm(1, numUpdates), v2 = runAlgorithm(2, numUpdates)
  console.log(`${numUpdates} ${v1.bytes / 1000} ${v1.roundtrips} ${v2.bytes / 1000} ${v2.roundtrips}`)
}
