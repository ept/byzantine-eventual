// Simulates a system with four replicas, which all generate operations, and which reconcile
// periodically. This program takes less than a minute to run on my laptop.
//
// The simulation accounts for the number of bytes sent over the network to represent payloads (i.e.
// updates) and overheads (hashes, Bloom filters, and fixed per-message overheads). It varies the
// rate at which operations are generated, and prints out one line for each rate. The output has
// the following columns:
//
//  1. average number of updates per reconciliation
//  2. average payload kilobytes per reconciliation
//  3. algorithm 1: average number of kilobytes transmitted per reconciliation
//  4. algorithm 1: average number of messages sent per reconciliation
//  5. algorithm 1: average number of round trips per reconciliation
//  6. algorithm 2: average number of kilobytes transmitted per reconciliation
//  7. algorithm 2: average number of messages sent per reconciliation
//  8. algorithm 2: average number of round trips per reconciliation
//  9. algorithm 2: number of reconciliations that completed in one round trip
// 10. algorithm 2: number of reconciliations that completed in two round trips
// 11. algorithm 2: number of reconciliations that completed in three round trips
// 12. algorithm 2: number of reconciliations that completed in four round trips

const { Replica } = require('./replica')

// true runs in deterministic mode, false randomises the run.
// The randomisation only affects the Bloom filter.
const DETERMINISTIC = true

// Every pair of replicas reconciles once per round.
const NUM_ROUNDS = 100

const BITS_PER_HASH = 256, BYTES_PER_UPDATE = 400, BYTES_PER_MESSAGE = 50

function doUpdates(replicas, rate, offset) {
  for (let replica of replicas) {
    for (let i = offset; i < rate; i += 6) replica.generateUpdate()
  }
}


function reconcile(algorithmVersion, replica1, replica2, total) {
  const stats = algorithmVersion === 1 ? replica1.reconcileV1(replica2) : replica1.reconcileV2(replica2)
  total.hashes += stats.hashes
  total.bloomBits += stats.bloomBits
  total.updates += stats.updates
  total.messages += stats.messages
  total.roundtrips += stats.roundtrips
  if (stats.roundtrips < total.histogram.length) total.histogram[stats.roundtrips - 1] += 1
}

function runSimulation(algorithmVersion, rate) {
  const replicas = DETERMINISTIC ?
    ['a', 'b', 'c', 'd'].map(name => new Replica(name)) :
    ['a', 'b', 'c', 'd'].map(name => new Replica(`${name}${Math.random()}`))

  // One initial update, so that we have a head even when the update rate is zero
  replicas[0].generateUpdate()

  let stats = {hashes: 0, bloomBits: 0, updates: 0, messages: 0, roundtrips: 0, histogram: [0, 0, 0, 0]}

  for (let round = 0; round < NUM_ROUNDS; round++) {
    doUpdates(replicas, rate, 0)
    reconcile(algorithmVersion, replicas[0], replicas[1], stats)
    doUpdates(replicas, rate, 1)
    reconcile(algorithmVersion, replicas[2], replicas[3], stats)
    doUpdates(replicas, rate, 2)
    reconcile(algorithmVersion, replicas[1], replicas[2], stats)
    doUpdates(replicas, rate, 3)
    reconcile(algorithmVersion, replicas[0], replicas[3], stats)
    doUpdates(replicas, rate, 4)
    reconcile(algorithmVersion, replicas[0], replicas[2], stats)
    doUpdates(replicas, rate, 5)
    reconcile(algorithmVersion, replicas[1], replicas[3], stats)
  }

  const reconcs = 6 * NUM_ROUNDS
  const payload = stats.updates * BYTES_PER_UPDATE
  const overhead = Math.ceil((BITS_PER_HASH * stats.hashes + (stats.bloomBits || 0)) / 8) + stats.messages * BYTES_PER_MESSAGE
  return {
    updates: stats.updates / reconcs,
    payloadBytes: payload / reconcs,
    totalBytes: (payload + overhead) / reconcs,
    messages: stats.messages / reconcs,
    roundtrips: stats.roundtrips / reconcs,
    histogram: stats.histogram
  }
}


for (let rate of [0, 1, 2, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
  const statsV1 = runSimulation(1, rate)
  const statsV2 = runSimulation(2, rate)
  console.log([
    statsV1.updates, statsV1.payloadBytes / 1000,
    statsV1.totalBytes / 1000, statsV1.messages, statsV1.roundtrips,
    statsV2.totalBytes / 1000, statsV2.messages, statsV2.roundtrips
  ].concat(statsV2.histogram).join(' '))
}
