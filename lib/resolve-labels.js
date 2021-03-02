'use strict'

const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')

// TODO: make configurable
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../.github/pr-labeler.yml'), 'utf8'))

function parseRegexToLabelsConfig (objectFromYaml) {
  return Object.entries(objectFromYaml)
    .map(([regexAsString, labelsAsString]) => {
      const withoutWrappingSlashes = regexAsString.substr(1, regexAsString.length - 2)
      const labels = labelsAsString.split(',').map(label => label.trim())

      return [new RegExp(withoutWrappingSlashes), labels]
    })
}

// order of entries in this map *does* matter for the resolved labels
// earlier entries override later entries
const subSystemLabelsMap = new Map(parseRegexToLabelsConfig(config.subSystemLabels))

const jsSubsystemList = [
  'debugger', 'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'crypto', 'dgram', 'dns', 'domain', 'events', 'esm', 'fs', 'http',
  'https', 'http2', 'module', 'net', 'os', 'path', 'process', 'querystring',
  'quic', 'readline', 'repl', 'report', 'stream', 'string_decoder', 'timers',
  'tls', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker', 'zlib'
]

const exclusiveLabelsMap = new Map(parseRegexToLabelsConfig(config.exlusiveLabels))

function resolveLabels (filepathsChanged, baseBranch, limitLabels = true) {
  const exclusiveLabels = matchExclusiveSubSystem(filepathsChanged)

  if (typeof baseBranch !== 'string') {
    if (typeof baseBranch === 'boolean') {
      limitLabels = baseBranch
    }
    baseBranch = ''
  }

  const labels = (exclusiveLabels.length > 0)
    ? exclusiveLabels
    : matchAllSubSystem(filepathsChanged, limitLabels)

  // Add version labels if PR is made against a version branch
  const m = /^(v\d+\.(?:\d+|x))(?:-staging|$)/.exec(baseBranch)
  if (m) {
    labels.push(m[1])
  }

  return labels
}

function hasAllSubsystems (arr) {
  return arr.every((val) => {
    return jsSubsystemList.includes(val)
  })
}

// This function is needed to help properly identify when a PR should always
// (just) be labeled as 'doc' when it is all changes in doc/api/ that do not
// match subsystem names (e.g. _toc.md, all.md)
function hasAllDocChanges (arr) {
  return arr.every((val) => {
    return /^doc\//.test(val)
  })
}

function hasAllTestChanges (arr) {
  return arr.every((val) => {
    return /^test\//.test(val)
  })
}

function matchExclusiveSubSystem (filepathsChanged) {
  const isExclusive = filepathsChanged.every(matchesAnExclusiveLabel)
  let labels = matchSubSystemsByRegex(exclusiveLabelsMap, filepathsChanged)
  const nonMetaLabels = labels.filter((label) => {
    return !/^dont-/.test(label)
  })

  // if there are multiple API doc changes, do not apply subsystem tags for now
  if (isExclusive &&
    nonMetaLabels.includes('doc') &&
    nonMetaLabels.length > 2 &&
    !hasAllTestChanges(filepathsChanged)) {
    const nonDocLabels = nonMetaLabels.filter((val) => {
      return val !== 'doc'
    })
    if (hasAllSubsystems(nonDocLabels) || hasAllDocChanges(filepathsChanged)) {
      labels = ['doc']
    } else {
      labels = []
    }
  }
  return isExclusive ? labels : []
}

function matchAllSubSystem (filepathsChanged, limitLabels) {
  return matchSubSystemsByRegex(
    subSystemLabelsMap, filepathsChanged, limitLabels)
}

function matchSubSystemsByRegex (rxLabelsMap, filepathsChanged, limitLabels) {
  const labelCount = []
  // by putting matched labels into a map, we avoid duplicate labels
  const labelsMap = filepathsChanged.reduce((map, filepath) => {
    const mappedSubSystems = mappedSubSystemsForFile(rxLabelsMap, filepath)

    if (!mappedSubSystems) {
      // short-circuit
      return map
    }

    for (let i = 0; i < mappedSubSystems.length; ++i) {
      const mappedSubSystem = mappedSubSystems[i]
      if (limitLabels && hasLibOrSrcChanges(filepathsChanged)) {
        if (labelCount.length >= 4) {
          for (const label of labelCount) {
            // don't delete the c++ label as we always want that if it has matched
            if (label !== 'c++') delete map[label]
          }
          map['lib / src'] = true
          // short-circuit
          return map
        } else {
          labelCount.push(mappedSubSystem)
        }
      }

      map[mappedSubSystem] = true
    }

    return map
  }, {})

  return Object.keys(labelsMap)
}

function hasLibOrSrcChanges (filepathsChanged) {
  return filepathsChanged.some((filepath) => filepath.startsWith('lib/') || filepath.startsWith('src/'))
}

function mappedSubSystemsForFile (labelsMap, filepath) {
  for (const [regex, labels] of labelsMap) {
    const matches = regex.exec(filepath)

    if (matches === null) {
      continue
    }

    const ret = []
    labels.forEach((label) => {
      // label names starting with $ means we want to extract a matching
      // group from the regex we've just matched against
      if (label.startsWith('$')) {
        const wantedMatchGroup = label.substr(1)
        label = matches[wantedMatchGroup]
      }
      if (!label) {
        return
      }
      // use label name as is when label doesn't look like a regex matching group
      ret.push(label)
    })
    return ret
  }
}

function matchesAnExclusiveLabel (filepath) {
  return mappedSubSystemsForFile(exclusiveLabelsMap, filepath) !== undefined
}

module.exports = resolveLabels
