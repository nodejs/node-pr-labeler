'use strict'

const github = require('@actions/github')
const core = require('@actions/core')

const token = core.getInput('repo-token', { required: true })

module.exports = github.getOctokit(token)
