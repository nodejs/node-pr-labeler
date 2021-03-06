'use strict'

/* eslint-disable camelcase */

const core = require('@actions/core')
const LRU = require('lru-cache')
const Aigle = require('aigle')

const githubClient = require('./github-client')
const resolveLabels = require('./resolve-labels')
const existingLabelsCache = new LRU({ max: 1, maxAge: 1000 * 60 * 60 })

const fiveSeconds = 5 * 1000

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function deferredResolveLabelsThenUpdatePr (options) {
  const timeoutMillis = (options.timeoutInSec || 0) * 1000
  await sleep(timeoutMillis)
  return resolveLabelsThenUpdatePr(options)
}

async function resolveLabelsThenUpdatePr (options) {
  const times = options.retries || 5
  const interval = options.retryInterval || fiveSeconds
  const retry = fn => Aigle.retry({ times, interval }, fn)

  const filepathsChanged = await retry(() => listFiles({
    owner: options.owner,
    repo: options.repo,
    pull_number: options.prId
  }))
  core.debug('Fetching PR files for labelling')

  const resolvedLabels = resolveLabels(filepathsChanged, options.baseBranch)

  return fetchExistingThenUpdatePr(options, resolvedLabels)
}

async function fetchExistingThenUpdatePr (options, labels) {
  try {
    const existingLabels = await fetchExistingLabels(options)
    const labelsToAdd = stringsInCommon(existingLabels, labels)
    core.debug('Resolved labels: ' + labels)
    core.debug('Resolved labels to add: ' + labelsToAdd)
    core.debug('Resolved existing labels: ' + existingLabels)

    return updatePrWithLabels(options, labelsToAdd)
  } catch (err) {
    core.error('Error retrieving existing repo labels: ' + err)

    return updatePrWithLabels(options, labels)
  }
}

async function updatePrWithLabels (options, labels) {
  // no need to request github if we didn't resolve any labels
  if (!labels.length) {
    return
  }

  core.debug('Trying to add labels: ' + labels)

  try {
    await githubClient.issues.addLabels({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.prId,
      labels: labels
    })

    core.info('Added labels: ' + labels)
  } catch (err) {
    core.error('Error while adding labels: ' + err)
  }
}

async function fetchExistingLabels (options) {
  const cacheKey = `${options.owner}:${options.repo}`

  if (existingLabelsCache.has(cacheKey)) {
    return existingLabelsCache.get(cacheKey)
  }

  const labelsResult = await fetchLabelPages(options)
  const existingLabels = labelsResult.data || labelsResult || []
  const existingLabelNames = existingLabels.map((label) => label.name)

  // cache labels so we don't have to fetch these *all the time*
  existingLabelsCache.set(cacheKey, existingLabelNames)
  core.debug('Filled existing repo labels cache: ' + existingLabelNames)

  return existingLabelNames
}

async function fetchLabelPages (options) {
  // the github client API is somewhat misleading,
  // this fetches *all* repo labels not just for an issue
  const listLabelsOptions = await githubClient.issues.listLabelsForRepo.endpoint.merge({
    owner: options.owner,
    repo: options.repo,
    per_page: 100
  })

  return await githubClient.paginate(listLabelsOptions)
}

function stringsInCommon (arr1, arr2) {
  const loweredArr2 = arr2.map((str) => str.toLowerCase())
  // we want the original string cases in arr1, therefore we don't lowercase them
  // before comparing them cause that would wrongly make "V8" -> "v8"
  return arr1.filter((str) => loweredArr2.indexOf(str.toLowerCase()) !== -1)
}

async function listFiles ({ owner, repo, pull_number }) {
  try {
    const response = await githubClient.pulls.listFiles({
      owner,
      repo,
      pull_number
    })
    return response.data.map(({ filename }) => filename)
  } catch (err) {
    core.error('Error retrieving files from GitHub: ' + err)
    throw err
  }
}

exports.fetchExistingThenUpdatePr = fetchExistingThenUpdatePr
exports.resolveLabelsThenUpdatePr = deferredResolveLabelsThenUpdatePr

// exposed for testability
exports._fetchExistingLabels = fetchExistingLabels
