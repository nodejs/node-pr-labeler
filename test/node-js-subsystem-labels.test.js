/* eslint-disable no-multi-spaces */
'use strict'

const { test } = require('node:test')

const { resolveLabels } = require('./_resolve-labels-helper')

test('label: lib oddities', (t) => {
  process.env.MAX_LABELS_LIMIT = 1000

  t.afterEach(() => {
    delete process.env.MAX_LABELS_LIMIT
  })

  const libFiles = [
    'lib/_debug_agent.js',
    'lib/_http_agent.js',
    'lib/_http_client.js',
    'lib/_http_common.js',
    'lib/_http_incoming.js',
    'lib/_http_outgoing.js',
    'lib/_http_server.js',
    'lib/_stream_duplex.js',
    'lib/_stream_passthrough.js',
    'lib/_stream_readable.js',
    'lib/_stream_transform.js',
    'lib/_stream_wrap.js',
    'lib/_stream_writable.js',
    'lib/_tls_common.js',
    'lib/_tls_legacy.js',
    'lib/_tls_wrap.js',
    'lib/constants.js',
    'lib/punycode.js', // ignored
    'lib/sys.js', // ignored
    'lib/internal/process',
    'lib/internal/socket_list.js',
    'lib/internal/v8_prof_polyfill.js',
    'lib/internal/v8_prof_processor.js'
  ]

  const labels = resolveLabels(libFiles)

  t.assert.deepStrictEqual(labels, [
    'needs-ci',       // lib/
    'debug',       // _debug_agent
    'http',           // _http_*
    'stream',         // _stream_*
    'tls',            // _tls_*
    'lib / src',      // constants
    'process',        // internal/process/
    'net',            // socket_list
    'tools'           // v8_prof_*
  ])
})

test('label: lib internals oddities duplicates', (t) => {
  const libFiles = [
    'lib/internal/bootstrap_node.js',
    'lib/internal/linkedlist.js',
    'lib/internal/streams'
  ]

  const labels = resolveLabels(libFiles)

  t.assert.deepStrictEqual(labels, [
    'needs-ci',  // lib/
    'lib / src', // bootstrap_node
    'timers',    // linkedlist
    'streams'     // internal/streams/
  ])
})

test('label: lib/ paths', (t) => {
  const libFiles = [
    'lib/assert.js',
    'lib/buffer.js',
    'lib/child_process.js',
    'lib/cluster.js',
    'lib/console.js',
    'lib/crypto.js',
    'lib/dgram.js',
    'lib/dns.js',
    'lib/domain.js',
    'lib/events.js',
    'lib/fs.js',
    'lib/http.js',
    'lib/https.js',
    'lib/module.js',
    'lib/net.js',
    'lib/os.js',
    'lib/path.js',
    'lib/process.js',
    'lib/querystring.js',
    'lib/readline.js',
    'lib/repl.js',
    'lib/stream.js',
    'lib/string_decoder.js',
    'lib/timers.js',
    'lib/tls.js',
    'lib/tty.js',
    'lib/url.js',
    'lib/util.js',
    'lib/v8.js',
    'lib/vm.js',
    'lib/zlib.js'
  ]

  libFiles.forEach((filepath) => {
    const expected = /lib\/(_)?(\w+)\.js/.exec(filepath)[2]
    const labels = resolveLabels([filepath])

    t.assert.strictEqual(labels.shift(), 'needs-ci')
    t.assert.deepStrictEqual(labels, [expected], `${filepath} got "${expected}" label`)
  })
})

test('label: lib/internals/ paths', (t) => {
  const libFiles = [
    'lib/internal/child_process.js',
    'lib/internal/cluster.js',
    'lib/internal/module.js',
    'lib/internal/net.js',
    'lib/internal/process.js',
    'lib/internal/readline.js',
    'lib/internal/repl.js',
    'lib/internal/util.js'
  ]

  libFiles.forEach((filepath) => {
    const expected = /lib\/internal\/(\w+)\.js/.exec(filepath)[1]
    const labels = resolveLabels([filepath])

    t.assert.strictEqual(labels.shift(), 'needs-ci')
    t.assert.deepStrictEqual(labels, [expected], `${filepath} got "${expected}" label`)
  })
})

test('label: add subsystem when ./doc/api/<subsystem>.md has been changed', (t) => {
  const labels = resolveLabels([
    'doc/api/fs.md'
  ])

  t.assert.deepStrictEqual(labels, ['doc', 'fs'])
})

test('label: only "doc" with multiple API doc files changed', (t) => {
  const labels = resolveLabels([
    'doc/api/fs.md',
    'doc/api/stream.md'
  ])

  t.assert.deepStrictEqual(labels, ['doc'])
})

test('label: "doc,module" when doc/api/modules.md was changed', (t) => {
  const labels = resolveLabels([
    'doc/api/modules.md'
  ])

  t.assert.deepStrictEqual(labels, ['doc', 'module'])
})

test('label: appropriate labels for files in internal subdirectories', (t) => {
  const labels = resolveLabels([
    'lib/internal/cluster/master.js',
    'lib/internal/process/next_tick.js'
  ])

  t.assert.deepStrictEqual(labels, ['needs-ci', 'cluster', 'process'])
})
