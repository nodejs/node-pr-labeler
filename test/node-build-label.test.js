'use strict'

const { test } = require('node:test')

const { resolveLabels } = require('./_resolve-labels-helper')

test('label: "build" when build related files has been changed', (t) => {
  const buildRelatedFiles = [
    'configure',
    'node.gyp',
    'common.gypi',
    'BSDmakefile',
    'Makefile',
    'tools/Makefile',
    'tools/install.py',
    'tools/create_android_makefiles',
    'tools/getnodeversion.py',
    'tools/js2c.py',
    'tools/utils.py',
    'tools/configure.d/nodedownload.py'
  ]

  buildRelatedFiles.forEach((filepath) => {
    const labels = resolveLabels([filepath])

    t.assert.ok(labels.includes('build'), filepath + ' should have "build" label')
    t.assert.ok(labels.includes('needs-ci'), filepath + ' should have "needs-ci" label')
  })
})

test('labels: not "build" when Makefile in ./deps has been changed', (t) => {
  const labels = resolveLabels([
    'deps/v8/Makefile'
  ])

  t.assert.ok(!labels.includes('build'))
  t.assert.ok(labels.includes('needs-ci'))
})
