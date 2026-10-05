'use strict'

/* eslint-disable camelcase */

const { setTimeout } = require('node:timers/promises')

const resolveLabels = require('./resolve-labels')

let _core
async function getGHCore () {
  _core ??= await import('@actions/core')
  return _core
}

const fiveSeconds = 5 * 1000

async function retry ({ times = 1, interval }, fn) {
  const errors = []
  for (let i = 0; i < times; i++) {
    try {
      await fn()
      break
    } catch (err) {
      errors.push(err)
    }
    await setTimeout(interval)
  }
  throw new AggregateError(errors, `Failed after ${times} attempts`)
}

async function resolveLabelsThenUpdatePr (options) {
  const times = options.retries || 5
  const interval = options.retryInterval || fiveSeconds

  const filepathsChanged = await retry({ times, interval }, () => listFiles({
    client: options.client,
    owner: options.owner,
    repo: options.repo,
    pull_number: options.prId
  }))
  const core = await getGHCore()
  core.debug('Fetching PR files for labelling')

  const resolvedLabels = resolveLabels(filepathsChanged, options.baseBranch, options.configAsString)

  return fetchExistingThenUpdatePr(options, resolvedLabels)
}

async function fetchExistingThenUpdatePr (options, labels) {
  const core = await getGHCore()
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

  const core = await getGHCore()
  core.debug('Trying to add labels: ' + labels)

  try {
    await options.client.issues.addLabels({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.prId,
      labels
    })

    core.info('Added labels: ' + labels)
  } catch (err) {
    core.error('Error while adding labels: ' + err)
  }
}

async function fetchExistingLabels (options) {
  const labelsResult = await fetchLabelPages(options)
  const existingLabels = labelsResult.data || labelsResult || []
  const existingLabelNames = existingLabels.map((label) => label.name)

  return existingLabelNames
}

async function fetchLabelPages (options) {
  // the github client API is somewhat misleading,
  // this fetches *all* repo labels not just for an issue
  const listLabelsOptions = await options.client.rest.issues.listLabelsForRepo.endpoint.merge({
    owner: options.owner,
    repo: options.repo,
    per_page: 100
  })

  return await options.client.paginate(listLabelsOptions)
}

function stringsInCommon (arr1, arr2) {
  const loweredArr2 = arr2.map((str) => str.toLowerCase())
  // we want the original string cases in arr1, therefore we don't lowercase them
  // before comparing them cause that would wrongly make "V8" -> "v8"
  return arr1.filter((str) => loweredArr2.indexOf(str.toLowerCase()) !== -1)
}

async function listFiles ({ owner, repo, pull_number, client }) {
  try {
    const response = await client.pulls.listFiles({
      owner,
      repo,
      pull_number
    })
    return response.data.map(({ filename }) => filename)
  } catch (err) {
    (await getGHCore()).error('Error retrieving files from GitHub: ' + err)
    throw err
  }
}

exports.fetchExistingThenUpdatePr = fetchExistingThenUpdatePr
exports.resolveLabelsThenUpdatePr = resolveLabelsThenUpdatePr

// exposed for testability
exports._fetchExistingLabels = fetchExistingLabels
