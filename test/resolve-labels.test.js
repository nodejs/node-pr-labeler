'use strict'

const { test } = require('node:test')
const { resolveLabels } = require('./_resolve-labels-helper')

// Helper function for testing resolved labels
function testLabel (labelDescription, files, expectedLabels, branch) {
  test(labelDescription, (t) => {
    const labels = resolveLabels(files, branch)
    t.assert.deepStrictEqual(labels, expectedLabels)
  })
}

// Test cases for common label resolutions
testLabel('label: "needs-ci" when ./test/ and ./doc/ files changed', [
  'test/debugger/test-debugger-pid.js',
  'doc/api/fs.md'
], ['needs-ci'])

testLabel('label: "needs-ci" when ./test/ and ./lib/ files changed', [
  'lib/punycode.js',
  'test/parallel/test-assert.js'
], ['needs-ci'])

testLabel('label: "doc" when only ./doc/ files changed', [
  'doc/api/fs.md',
  'doc/api/http.md',
  'doc/onboarding.md'
], ['doc'])

testLabel('label: "doc" and "crypto" when webcrypto docs changed', [
  'doc/api/webcrypto.md'
], ['doc', 'crypto'])

testLabel('label: "doc" & "deprecations" when ./doc/api/deprecations.md changed', [
  'doc/api/deprecations.md'
], ['doc', 'deprecations'])

testLabel('label: "c++" when ./src/* changed', [
  'src/node.cc'
], ['needs-ci', 'c++'])

// Test cases for src subsystem changes
const srcCases = [
  ['buffer',
    ['base64.h',
      'node_buffer.cc',
      'node_buffer.h',
      'string_bytes.cc',
      'string_bytes.h',
      'string_search.cc',
      'string_search.h']],
  ['cares', ['cares_wrap.cc']],
  ['child_process', ['process_wrap.cc', 'spawn_sync.cc', 'spawn_sync.h']],
  ['crypto',
    ['node_crypto.cc',
      'node_crypto.h',
      'node_crypto_bio.cc',
      'node_crypto_bio.h',
      'node_crypto_clienthello-inl.h',
      'node_crypto_clienthello.cc',
      'node_crypto_clienthello.h',
      'node_crypto_groups.h']],
  ['dgram', ['udp_wrap.cc', 'udp_wrap.h']],
  ['fs',
    ['fs_event_wrap.cc',
      'node_file.cc',
      'node_file.h',
      'node_stat_watcher.cc',
      'node_stat_watcher.h']],
  ['http_parser', ['node_http_parser.cc', 'node_http_parser.h']],
  ['i18n-api', ['node_i18n.cc', 'node_i18n.h']],
  ['libuv', ['uv.cc']],
  ['net',
    ['connect_wrap.cc',
      'connect_wrap.h',
      'connection_wrap.cc',
      'connection_wrap.h',
      'pipe_wrap.cc',
      'pipe_wrap.h',
      'tcp_wrap.cc',
      'tcp_wrap.h']],
  ['os', ['node_os.cc']],
  ['process', ['node_main.cc', 'signal_wrap.cc']],
  ['timers', ['timer_wrap.cc']],
  ['tracing',
    ['tracing/agent.cc',
      'tracing/agent.h',
      'tracing/node_trace_buffer.cc',
      'tracing/node_trace_buffer.h',
      'tracing/node_trace_writer.cc',
      'tracing/node_trace_writer.h',
      'tracing/trace_event.cc',
      'tracing/trace_event.h']],
  ['tty', ['tty_wrap.cc', 'tty_wrap.h']],
  ['whatwg-url', ['node_url.cc', 'node_url.h']],
  ['util', ['node_util.cc']],
  ['vm', ['node_contextify.cc']],
  ['zlib', ['node_zlib.cc']]
]

srcCases.forEach(([label, files]) => {
  files.forEach((file) => {
    testLabel(`label: "${label}" when ./src/${file} changed`, [
      `src/${file}`
    ], ['needs-ci', 'c++', label])
  })
})

// Other subsystem tests
testLabel('label: not "c++" when ./src/node_version.h changed', [
  'src/node_version.h'
], ['needs-ci'])

testLabel('label: "inspector" when ./src/inspector_* changed', [
  'src/inspector_socket.cc'
], ['needs-ci', 'c++', 'inspector'])

// Test cases for deps subsystem changes
const depsCases = [
  [['v8 engine'], ['deps/v8/src/arguments.cc']],
  [['libuv'], ['deps/uv/src/fs-poll.c']],
  [['wasi'], ['deps/uvwasi/src/uvwasi.c']],
  [['dependencies', 'openssl'], ['deps/openssl/openssl/ssl/ssl_rsa.c']]
]

depsCases.forEach(([label, files]) => {
  testLabel(`label: "${label[1] || label[0]}" when ${files.join(' and ')} changed`, files, ['needs-ci', ...label])
})

// Planned tests
testLabel('label: "repl" when ./lib/repl.js changed', [
  'lib/repl.js', 'test/debugger/test-debugger-pid.js'
], ['needs-ci', 'repl'])

testLabel('label: "lib / src" when 4 or more JS sub-systems changed', [
  'lib/assert.js', 'lib/dns.js', 'lib/repl.js', 'lib/process.js', 'lib/module.js'
], ['needs-ci', 'lib / src'])

testLabel('label: "lib / src" when 4 or more native files have been changed', [
  'node.gyp',
  'src/cares_wrap.cc',
  'src/fs_event_wrap.cc',
  'src/node.cc',
  'src/node_api.cc',
  'src/node_buffer.cc',
  'src/node_config.cc',
  'src/node_constants.cc',
  'src/node_contextify.cc',
  'src/node_file.cc',
  'src/node_file.h',
  'src/node_http_parser.cc',
  'src/node_http_parser.h',
  'src/node_i18n.cc',
  'src/node_revert.cc',
  'src/node_serdes.cc',
  'src/node_zlib.cc',
  'src/process_wrap.cc',
  'src/signal_wrap.cc',
  'src/string_bytes.cc',
  'src/timer_wrap.cc',
  'src/uv.cc'
], ['needs-ci', 'c++', 'lib / src'])

testLabel('label: not "lib / src" when only deps have been changed', [
  'deps/v8/test/cctest/interpreter/bytecode_expectations/ArrayLiterals.golden',
  'deps/v8/test/cctest/interpreter/bytecode_expectations/ArrayLiteralsWide.golden',
  'deps/v8/test/cctest/interpreter/bytecode_expectations/AssignmentsInBinaryExpression.golden',
  'deps/v8/test/cctest/interpreter/bytecode_expectations/BasicBlockToBoolean.golden',
  'deps/v8/test/cctest/interpreter/bytecode_expectations/BasicLoops.golden'
], ['needs-ci', 'v8 engine'])

testLabel('label: "JS sub-systems when less than 4 sub-systems have changed', [
  'lib/assert.js',
  'lib/dns.js',
  'lib/repl.js',
  'lib/process.js'
], ['needs-ci', 'assert', 'dns', 'repl', 'process'])

testLabel('label: "meta" when meta-info files have changed', [
  '.gitattributes',
  '.gitignore',
  '.mailmap',
  'AUTHORS',
  'LICENSE',
  'CHANGELOG.md',
  'CODE_OF_CONDUCT.md',
  'GOVERNANCE.md',
  'ROADMAP.md',
  'WORKING_GROUPS.md'
], ['meta', 'doc'])

testLabel('label: "doc" when top-level .md files have changed', [
  'BUILDING.md',
  'README.md'
], ['build', 'doc'])

testLabel('label: not "doc" when other top-level files have been changed', [
  'LICENSE',
  'configure',
  '.mailmap'
], ['meta', 'build', 'needs-ci'])

testLabel('label: version labels (old)', [
  'common.gypi'
], ['build', 'needs-ci', 'v0.12'], 'v0.12')

testLabel('label: version labels (old, staging)', [
  'common.gypi'
], ['build', 'needs-ci', 'v0.12'], 'v0.12-staging')

testLabel('label: version labels (new)', [
  'deps/v8/include/v8-version.h',
  'deps/v8/src/crankshaft/hydrogen.cc',
  'deps/v8/test/mjsunit/regress/regress-5033.js'
], ['needs-ci', 'v8 engine', 'v20.x'], 'v20.x')

testLabel('label: version labels (new, staging)', [
  'deps/v8/include/v8-version.h',
  'deps/v8/src/crankshaft/hydrogen.cc',
  'deps/v8/test/mjsunit/regress/regress-5033.js'
], ['needs-ci', 'v8 engine', 'v20.x'], 'v20.x-staging')

testLabel('label: no version labels (master)', [
  'deps/v8/include/v8-version.h',
  'deps/v8/src/crankshaft/hydrogen.cc',
  'deps/v8/test/mjsunit/regress/regress-5033.js'
], ['needs-ci', 'v8 engine'], 'master')

testLabel('label: build label (windows)', [
  'vcbuild.bat'
], ['build', 'windows', 'needs-ci'])

testLabel('label: doc label for non-subsystem API doc changes', [
  'doc/api/_toc.md',
  'doc/api/all.md'
], ['doc'])

testLabel('label: "tools" when eslint-related tools have been changed', [
  '.eslintignore',
  '.editorconfig',
  '.eslintrc.yaml',
  '.remarkrc'
], ['tools'])

testLabel('label: specific benchmark changes', [
  'benchmark/fixtures/alice.html',
  'benchmark/misc/freelist.js'
], ['benchmark'])

testLabel('label: specific benchmark changes in assert', [
  'benchmark/assert/deepequal-buffer.js'
], ['benchmark', 'assert'])

testLabel('label: "build" when ./android-configure has been changed', [
  'android-configure'
], ['build', 'needs-ci'])

testLabel('label: "http2" and other labels for http2 changes', [
  'lib/http2.js',
  'lib/internal/http2/core.js',
  'deps/nghttp2/lib/nghttp2_buf.c'
], ['needs-ci', 'http2'])

testLabel('label: "c++" and other labels for http2 changes in src/', [
  'src/node_http2.cc',
  'src/node_http2.h',
  'src/node_http2_core.h',
  'src/node_http2_core-inl.h'
], ['needs-ci', 'c++', 'http2'])

testLabel('label: "build" for http2 build changes', [
  'deps/nghttp2/nghttp2.gyp'
], ['needs-ci', 'build', 'http2'])

testLabel('label: "doc" for http2 doc changes', [
  'doc/api/http2.md'
], ['doc', 'http2'])

testLabel('label: "async_hooks" for async_hooks changes in lib/', [
  'lib/async_hooks.js'
], ['needs-ci', 'async_hooks'])

testLabel('label: "async_hooks" for async_hooks test changes', [
  'test/async-hooks/test-connection.ssl.js'
], ['needs-ci', 'test', 'async_hooks'])

testLabel('label: "report" for src/ node_report changes', [
  'src/node_report.cc',
  'src/node_report.h'
], ['needs-ci', 'c++', 'report'])

testLabel('label: "wasi" for wasi-related changes in lib/', [
  'lib/wasi.js'
], ['needs-ci', 'wasi'])

testLabel('label: "worker" for worker-related changes in lib/', [
  'lib/worker_threads.js',
  'lib/internal/worker.js',
  'lib/internal/worker/io.js'
], ['needs-ci', 'worker'])
