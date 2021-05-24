'use strict'

const github = require('@actions/github')
const core = require('@actions/core')
const nodeRepo = require('./lib/node-repo')

async function run () {
  try {
    const token = core.getInput('repo-token', { required: true })
    const configPath = core.getInput('configuration-path', { required: true })
    const pullRequest = github.context.payload.pull_request

    if (!pullRequest) {
      throw new Error('Could not resolve pull request number, is Action triggered by something else than a pull request?')
    }

    const client = github.getOctokit(token)
    const { owner, repo } = github.context.repo
    const prId = pullRequest.number
    const baseBranch = pullRequest.base.ref
    const configAsString = await fetchConfig(client, owner, repo, configPath)

    await nodeRepo.resolveLabelsThenUpdatePr({
      baseBranch,
      client,
      configAsString,
      owner,
      repo,
      prId
    })
  } catch (error) {
    core.error(error)
    core.setFailed(error.message)
  }
}

async function fetchConfig (
  client,
  owner,
  repo,
  filepath
) {
  const response = await client.repos.getContent({
    owner,
    repo,
    path: filepath,
    ref: github.context.payload.pull_request.base.repo.default_branch
  })

  return Buffer.from(response.data.content, response.data.encoding).toString()
}

run()
