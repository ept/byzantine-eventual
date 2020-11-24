const { Replica } = require('./replica')
const assert = require('assert')

function reconcile(a, b, i) {
  switch (i) {
    case 0: a.reconcileV1(b); break
    case 1: b.reconcileV1(a); break
    case 2: a.reconcileV2(b); break
    case 3: b.reconcileV2(a); break
  }
}

describe('Replica', () => {
  it('should generate updates', () => {
    const a = new Replica('a')
    a.generateUpdate()
    assert.deepStrictEqual(a.updates, [{id: 'a:1', pred: [], succ: []}])
  })

  it('should find all successors', () => {
    const a = new Replica('a'), b = new Replica('b')
    a.generateUpdate()
    b.addUpdate(a.updates[0])
    a.generateUpdate()
    b.generateUpdate()
    a.addUpdate(b.updates[1])
    a.generateUpdate()
    assert.deepStrictEqual(a.updates, [
      {id: 'a:1', pred: [],             succ: ['a:2', 'b:1']},
      {id: 'a:2', pred: ['a:1'],        succ: ['a:3']},
      {id: 'b:1', pred: ['a:1'],        succ: ['a:3']},
      {id: 'a:3', pred: ['a:2', 'b:1'], succ: []}
    ])
    assert.deepStrictEqual(a.allSuccessors(['a:1']), [
      {id: 'a:1', pred: [],             succ: ['a:2', 'b:1']},
      {id: 'a:2', pred: ['a:1'],        succ: ['a:3']},
      {id: 'b:1', pred: ['a:1'],        succ: ['a:3']},
      {id: 'a:3', pred: ['a:2', 'b:1'], succ: []}
    ])
  })

  it('should do fast-forward reconciliation', () => {
    for (let i = 0; i < 2; i++) {
      const a = new Replica('a'), b = new Replica('b')
      a.generateUpdate()
      b.addUpdate(a.updates[0])
      a.generateUpdate()
      a.generateUpdate()
      a.generateUpdate()
      assert.deepStrictEqual(b.updates.map(u => u.id), ['a:1'])
      reconcile(a, b, i)
      assert.deepStrictEqual(b.updates.map(u => u.id), ['a:1', 'a:2', 'a:3', 'a:4'])
    }
  })

  it('should reconcile diverged states', () => {
    for (let i = 0; i < 2; i++) {
      const a = new Replica('a'), b = new Replica('b')
      a.generateUpdate()
      b.addUpdate(a.updates[0])
      a.generateUpdate()
      a.generateUpdate()
      b.generateUpdate()
      b.generateUpdate()
      assert.deepStrictEqual(a.updates.map(u => u.id), ['a:1', 'a:2', 'a:3'])
      reconcile(a, b, i)
      assert.deepStrictEqual(a.updates.map(u => u.id), ['a:1', 'a:2', 'a:3', 'b:1', 'b:2'])
    }
  })

  it('should produce stats in V1 mode', () => {
    const a = new Replica('a'), b = new Replica('b')
    for (let i = 0; i < 50; i++) a.generateUpdate()
    for (let i = 0; i < 50; i++) b.generateUpdate()
    assert.deepStrictEqual(a.reconcileV1(b), {hashes: 200, updates: 100, messages: 202, roundtrips: 51})
    for (let i = 0; i < 50; i++) a.generateUpdate()
    for (let i = 0; i < 50; i++) b.generateUpdate()
    assert.deepStrictEqual(a.reconcileV1(b), {hashes: 204, updates: 100, messages: 202, roundtrips: 51})
  })

  it('should produce stats in V2 mode', () => {
    const a = new Replica('a'), b = new Replica('b')
    for (let i = 0; i < 50; i++) a.generateUpdate()
    for (let i = 0; i < 50; i++) b.generateUpdate()
    assert.deepStrictEqual(a.reconcileV2(b), {hashes: 2, bloomBits: 1024, updates: 100, messages: 4, roundtrips: 1})
    for (let i = 0; i < 50; i++) a.generateUpdate()
    for (let i = 0; i < 50; i++) b.generateUpdate()
    assert.deepStrictEqual(a.reconcileV2(b), {hashes: 10, bloomBits: 1024, updates: 100, messages: 4, roundtrips: 1})
  })

  it('should sync between multiple replicas', () => {
    const a = new Replica('a'), b = new Replica('b'), c = new Replica('c'), d = new Replica('d')
    a.generateUpdate()
    b.generateUpdate()
    c.generateUpdate()
    d.generateUpdate()
    assert.deepEqual(a.reconcileV2(b).updates, 2) // A from a to b,     B from b to a
    assert.deepEqual(a.reconcileV2(c).updates, 3) // A,B from a to c,   C from c to a
    assert.deepEqual(a.reconcileV2(d).updates, 4) // A,B,C from a to d, D from d to a
    assert.deepEqual(a.reconcileV2(b).updates, 2) // C,D from a to b
    assert.deepEqual(a.reconcileV2(c).updates, 1) // D from a to c
    assert.deepEqual(a.reconcileV2(d).updates, 0)
    assert.deepEqual(a.reconcileV2(b).updates, 0)
    assert.deepEqual(a.reconcileV2(c).updates, 0)
  })
})
