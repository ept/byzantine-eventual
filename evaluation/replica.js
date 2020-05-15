const { BloomFilter } = require('bloomfilter')

//const BLOOM_BITS_PER_ENTRY = 5, BLOOM_HASHES = 3 // 10% false positive rate
const BLOOM_BITS_PER_ENTRY = 10, BLOOM_HASHES = 7 // 1% false positive rate

function dedupUpdates(updates) {
  let result = [], ids = {}
  for (let update of updates) {
    if (!ids[update.id]) result.push(update)
    ids[update.id] = true
  }
  return result
}

class Replica {
  constructor(name) {
    this.name = name
    this.updates = []
    this.counter = 0
    this.heads = []
    this.oldHeads = {}
  }

  updateById(id) {
    for (let update of this.updates) if (update.id === id) return update
  }

  generateUpdate() {
    this.addUpdate({id: `${this.name}:${++this.counter}`, pred: this.heads})
  }

  addUpdate(update) {
    update = JSON.parse(JSON.stringify(update)) // deep clone
    update.succ = []
    if (this.updateById(update.id)) throw new RangeError('duplicate update')
    for (let h of update.pred) this.updateById(h).succ.push(update.id)
    this.updates.push(update)
    this.heads = this.heads.filter(h => update.pred.indexOf(h) < 0).concat([update.id])
  }

  addUpdates(updates) {
    for (let update of updates) this.addUpdate(update)
  }

  allSuccessors(ids, includingSelf = false) {
    if (typeof ids === 'string') ids = [ids]
    let succs = [], want = {}
    for (let id of ids) want[id] = true
    for (let update of this.updates) {
      if (want[update.id]) {
        if (includingSelf || ids.indexOf(update.id) < 0) succs.push(update)
        for (let s of update.succ) want[s] = true
      }
    }
    return succs
  }

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

  fastForward(other, heads, stats) {
    let sent = this.allSuccessors(heads)
    if (sent.length > 0) {
      stats.updates += sent.length
      stats.messages += 1
      for (let update of sent) stats.hashes += update.pred.length
      other.addUpdates(sent)
    }
  }

  missingPreds(updates) {
    let need = {}, have = {}
    for (let update of updates) {
      have[update.id] = true
      for (let pred of update.pred) {
        if (!this.updateById(pred)) need[pred] = true
      }
    }
    return Object.keys(need).filter(id => !have[id])
  }

  traversePredecessors(other, heads, stats, allReceived = []) {
    let missing = heads.filter(h => !this.updateById(h)), roundtrips = 0
    while (missing.length > 0) {
      let received = missing.map(h => other.updateById(h))
      roundtrips++
      stats.hashes += missing.length
      stats.updates += received.length
      stats.messages += 2
      for (let update of received) stats.hashes += update.pred.length
      allReceived.unshift(...received)
      missing = this.missingPreds(allReceived)
    }
    this.addUpdates(allReceived)
    this.oldHeads[other.name] = this.heads
    return roundtrips
  }

  bloomCheck(other, oldHeads, newHeads, stats) {
    const myUpdates = this.updatesSince(oldHeads), otherUpdates = other.updatesSince(oldHeads)
    stats.bloomBits += 32 * Math.ceil(myUpdates.length * BLOOM_BITS_PER_ENTRY / 32)
    const filter = new BloomFilter(myUpdates.length * BLOOM_BITS_PER_ENTRY, BLOOM_HASHES)
    for (let update of myUpdates) filter.add(update.id)
    const bloomNegative = otherUpdates.filter(update => !filter.test(update.id))
    const received = other.allSuccessors(bloomNegative.map(update => update.id), true)
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

  reconcileV1(other) {
    let stats = {hashes: 0, updates: 0, messages: 0, roundtrips: 0}
    // Send each other heads
    let recvHeads = other.heads, sendHeads = this.heads
    stats.hashes += sendHeads.length + recvHeads.length
    stats.messages += 2

    // Immediately send any updates that succeed the received heads
    this.fastForward(other, recvHeads, stats)
    other.fastForward(this, sendHeads, stats)

    // Follow the hash chains till we have everything
    stats.roundtrips = 1 + Math.max(
      this.traversePredecessors(other, recvHeads, stats),
      other.traversePredecessors(this, sendHeads, stats)
    )
    return stats
  }

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
