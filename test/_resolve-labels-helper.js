'use strict'

const fs = require('fs')
const path = require('path')

const actualResolveLabels = require('../lib/resolve-labels')

const config = fs.readFileSync(path.join(__dirname, '../.github/pr-labels.yml'), 'utf8')
const defaultBaseBranch = 'master'

exports.resolveLabels = (filepathsChanged, baseBranch, limitLabels) => actualResolveLabels(filepathsChanged, baseBranch || defaultBaseBranch, config, limitLabels)
