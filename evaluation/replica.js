const { BloomFilter } = require('bloomfilter')

//const BLOOM_BITS_PER_ENTRY = 5, BLOOM_HASHES = 3 // 10% false positive rate
const BLOOM_BITS_PER_ENTRY = 10, BLOOM_HASHES = 7 // 1% false positive rate

class Replica {
  constructor(name) {
    this.name = name
    this.updates = []
    this.updateById = {}
    this.counter = 0
    this.heads = []
    this.oldHeads = {}
  }

  generateUpdate() {
    this.addUpdate({id: `${this.name}:${++this.counter}`, pred: this.heads})
  }

  // Adds an update to this replica's set of delivered updates.
  addUpdate(update) {
    update = JSON.parse(JSON.stringify(update)) // deep clone
    update.succ = []
    if (this.updateById[update.id]) throw new RangeError('duplicate update')
    this.updateById[update.id] = update
    this.updates.push(update)
    for (let h of update.pred) {
      const pred = this.updateById[h]
      if (!pred) throw new RangeError(`unresolved predecessor: ${h}`)
      pred.succ.push(update.id)
    }
    this.heads = this.heads.filter(h => update.pred.indexOf(h) < 0).concat([update.id])
  }

  // Given an array of update IDs, returns an array containing those updates and all of their
  // successors, in causal order, with no duplicates.
  allSuccessors(ids) {
    let succs = [], want = {}
    for (let id of ids) want[id] = true
    for (let update of this.updates) {
      if (want[update.id]) {
        succs.push(update)
        for (let s of update.succ) want[s] = true
      }
    }
    return succs
  }

  // Given an array of update IDs, returns an array containing all updates that are not one of the
  // given updates or their predecessors. In other words, returns all updates that are concurrent to
  // or successors of the given IDs. Returns the result in causal order with no duplicates.
  updatesSince(oldHeads) {
    let old = {}, newUpdates = []
    for (let head of oldHeads) old[head] = true
    for (let i = this.updates.length - 1; i >= 0; i--) {
      const update = this.updates[i]
      if (old[update.id]) {
        for (let pred of update.pred) old[pred] = true
      }
    }
    for (let update of this.updates) {
      if (!old[update.id]) newUpdates.push(update)
    }
    return newUpdates
  }

  // Given an array of updates, returns an array of the IDs of their predecessors that are not known
  // to this replica.
  missingPreds(updates) {
    let need = {}, have = {}
    for (let update of updates) {
      have[update.id] = true
      for (let pred of update.pred) {
        if (!this.updateById[pred]) need[pred] = true
      }
    }
    return Object.keys(need).filter(id => !have[id])
  }

  // Reconciles this replica with replica `other` by starting from `heads` and working backwards in
  // multiple round-trips until all update IDs are resolved, and finally applying all received
  // updates to this replica. The `stats` object is updated to include various stats about the
  // reconciliation. Returns the number of round trips it took to complete the reconciliation.
  traversePredecessors(other, heads, stats, allReceived = []) {
    let missing = heads.filter(h => !this.updateById[h]), roundtrips = 0
    while (missing.length > 0) {
      let received = missing.map(h => other.updateById[h])
      roundtrips++
      stats.hashes += missing.length
      stats.updates += received.length
      stats.messages += 2
      for (let update of received) stats.hashes += update.pred.length
      allReceived.unshift(...received)
      missing = this.missingPreds(allReceived)
    }
    for (let update of allReceived) this.addUpdate(update)
    this.oldHeads[other.name] = this.heads
    return roundtrips
  }

  // Builds a Bloom filter containing this replica's updates since `oldHeads`, and checks the
  // `other` replica's recent updates against that Bloom filter. Any updates in `other` that are not
  // present in the filter, and their successors, are sent back to this replica, and used as the
  // starting points for a traversePredecessors() search. Returns the number of round trips it took.
  bloomCheck(other, oldHeads, newHeads, stats) {
    const myUpdates = this.updatesSince(oldHeads), otherUpdates = other.updatesSince(oldHeads)
    stats.bloomBits += 32 * Math.ceil(myUpdates.length * BLOOM_BITS_PER_ENTRY / 32)
    const filter = new BloomFilter(myUpdates.length * BLOOM_BITS_PER_ENTRY, BLOOM_HASHES)
    for (let update of myUpdates) filter.add(update.id)
    const bloomNegative = otherUpdates.filter(update => !filter.test(update.id))
    const received = other.allSuccessors(bloomNegative.map(update => update.id))
    stats.updates += received.length
    stats.messages += 1
    for (let update of received) {
      for (let pred of update.pred) {
        // Need to transmit hashes only if they can't be computed from another update in the same message
        if (!received.find(u => u.id === pred)) stats.hashes += 1
      }
    }
    const missing = this.missingPreds(received)
    return this.traversePredecessors(other, newHeads.concat(missing), stats, received)
  }

  // Performs the version 1 reconciliation protocol bidirectionally between this replica and
  // `other`. Returns a stats object that indicates the cost of the reconciliation.
  reconcileV1(other) {
    let stats = {hashes: 0, updates: 0, messages: 0, roundtrips: 0}
    // Send each other heads
    let recvHeads = other.heads, sendHeads = this.heads
    stats.hashes += sendHeads.length + recvHeads.length
    stats.messages += 2

    // Follow the hash chains till we have everything
    stats.roundtrips = 1 + Math.max(
      this.traversePredecessors(other, recvHeads, stats),
      other.traversePredecessors(this, sendHeads, stats)
    )
    return stats
  }

  // Performs the version 2 reconciliation protocol bidirectionally between this replica and
  // `other`. Returns a stats object that indicates the cost of the reconciliation.
  reconcileV2(other) {
    let stats = {hashes: 0, bloomBits: 0, updates: 0, messages: 0, roundtrips: 0}
    let recvHeads = other.heads, sendHeads = this.heads
    let oldHeads = this.oldHeads[other.name] || []
    stats.hashes += sendHeads.length + recvHeads.length + 2 * oldHeads.length
    stats.messages += 2
    stats.roundtrips = 1 + Math.max(
      this.bloomCheck(other, oldHeads, sendHeads, stats),
      other.bloomCheck(this, oldHeads, recvHeads, stats)
    )
    return stats
  }
}

module.exports = { Replica }
