'use strict'

const { test } = require('node:test')
const { default: fetchMock } = require('fetch-mock')
const mocked = fetchMock.sandbox()
const github = require('@actions/github')

const nodeRepo = require('../lib/node-repo')
const client = github.getOctokit('fake-token', {
  request: {
    fetch: mocked
  }
})

const readFixture = require('./read-fixture')

test('fetchExistingLabels(): yields an array of existing label names', async (t) => {
  const labelsFixture = readFixture('repo-labels.json')
  const owner = 'nodejs'
  const repo = 'node3'

  mocked.get({
    url: `begin:https://api.github.com/repos/${owner}/${repo}/labels`,
    response: {
      status: 200,
      body: labelsFixture.data
    }
  })

  const existingLabels = await nodeRepo._fetchExistingLabels({ owner, repo, client })
  t.assert.ok(existingLabels.includes('cluster'))
})

test('fetchExistingLabels(): can retrieve more than 100 labels', async (t) => {
  const labelsFixturePage1 = readFixture('repo-labels.json')
  const labelsFixturePage2 = readFixture('repo-labels-page-2.json')
  const owner = 'nodejs'
  const repo = 'node4'
  const headers = {
    Link: `<https://api.github.com/repos/${owner}/${repo}/labels?page=2>; rel="next"`
  }

  mocked.get({
    url: `https://api.github.com/repos/${owner}/${repo}/labels?per_page=100`,
    response: {
      status: 200,
      body: labelsFixturePage1.data,
      headers
    }
  })

  mocked.get({
    url: `https://api.github.com/repos/${owner}/${repo}/labels?page=2`,
    response: {
      status: 200,
      body: labelsFixturePage2.data
    }
  })

  const existingLabels = await nodeRepo._fetchExistingLabels({ owner, repo, client })
  t.assert.ok(existingLabels.includes('cluster'))
  t.assert.ok(existingLabels.includes('windows'))
})
