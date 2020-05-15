const { Replica } = require('./replica')

// true runs in deterministic mode, false randomises the run.
// The randomisation only affects the Bloom filter.
const DETERMINISTIC = true

const ALGORITHM_VERSION = 2 // 1 or 2

// Every pair of replicas reconciles once per round.
const NUM_ROUNDS = 100

const BITS_PER_HASH = 256, BYTES_PER_UPDATE = 400, BYTES_PER_MESSAGE = 50

const replicas = DETERMINISTIC ?
  ['a', 'b', 'c', 'd'].map(name => new Replica(name)) :
  ['a', 'b', 'c', 'd'].map(name => new Replica(`${name}${Math.random()}`))

function doUpdates(rate, offset) {
  for (let replica of replicas) {
    for (let i = offset; i < rate; i += 6) replica.generateUpdate()
  }
}


function reconcile(replica1, replica2, total) {
  const stats = ALGORITHM_VERSION === 1 ? replica1.reconcileV1(replica2) : replica1.reconcileV2(replica2)
  total.hashes += stats.hashes
  total.bloomBits += stats.bloomBits
  total.updates += stats.updates
  total.messages += stats.messages
  total.roundtrips += stats.roundtrips
  if (stats.roundtrips < total.histogram.length) total.histogram[stats.roundtrips - 1] += 1
}

console.log('updates/sec/process,payload kb/sec,' +
            `v${ALGORITHM_VERSION} total kb/sec,v${ALGORITHM_VERSION} messages/sync,v${ALGORITHM_VERSION} average round trips,` +
            (ALGORITHM_VERSION == 2 ? '1-rt count,2-rt count,3-rt count,4-rt count' : ''))

// One initial update, so that we have a head even when the update rate is zero
replicas[0].generateUpdate()

for (let rate of [0, 1, 2, 5, 10, 15, 20]) {
  let stats = {hashes: 0, bloomBits: 0, updates: 0, messages: 0, roundtrips: 0, histogram: [0, 0, 0, 0]}

  for (let round = 0; round < NUM_ROUNDS; round++) {
    doUpdates(rate, 0)
    reconcile(replicas[0], replicas[1], stats)
    doUpdates(rate, 1)
    reconcile(replicas[2], replicas[3], stats)
    doUpdates(rate, 2)
    reconcile(replicas[1], replicas[2], stats)
    doUpdates(rate, 3)
    reconcile(replicas[0], replicas[3], stats)
    doUpdates(rate, 4)
    reconcile(replicas[0], replicas[2], stats)
    doUpdates(rate, 5)
    reconcile(replicas[1], replicas[3], stats)
  }

  //reconcile(replicas[0], replicas[1], stats)
  //reconcile(replicas[0], replicas[2], stats)
  //reconcile(replicas[0], replicas[3], stats)
  //reconcile(replicas[0], replicas[1], stats)
  //reconcile(replicas[0], replicas[2], stats)

  const overhead = Math.ceil((BITS_PER_HASH * stats.hashes + (stats.bloomBits || 0)) / 8) + stats.messages * BYTES_PER_MESSAGE
  const payload = stats.updates * BYTES_PER_UPDATE
  console.log([
    rate, payload / NUM_ROUNDS / 1000, ((payload + overhead)/NUM_ROUNDS + 6 * BYTES_PER_MESSAGE) / 1000,
    stats.messages / (6 * NUM_ROUNDS), stats.roundtrips / (6 * NUM_ROUNDS)
  ].concat(ALGORITHM_VERSION == 2 ? stats.histogram : []).join(','))
}
