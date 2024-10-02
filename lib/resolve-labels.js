'use strict'

const yaml = require('js-yaml')

const ciNeededFolderRx = /^(deps|lib|src|test)\//

function parseRegexToLabelsConfig (objectFromYaml) {
  return Object.entries(objectFromYaml)
    .map(([regexAsString, labelsAsString]) => {
      const withoutWrappingSlashes = regexAsString.substr(1, regexAsString.length - 2)
      const labels = labelsAsString.split(',').map(label => label.trim())

      return [new RegExp(withoutWrappingSlashes), labels]
    })
}

function resolveLabels (filepathsChanged, baseBranch, configAsString) {
  const config = yaml.load(configAsString)
  const exclusiveLabelsMap = new Map(parseRegexToLabelsConfig(config.exlusiveLabels))
  const subSystemLabelsMap = new Map(parseRegexToLabelsConfig(config.subSystemLabels))
  const allJsSubSystems = config.allJsSubSystems

  const exclusiveLabels = matchExclusiveSubSystem(filepathsChanged, exclusiveLabelsMap, allJsSubSystems)
  const labels = (exclusiveLabels.length > 0)
    ? exclusiveLabels
    : matchAllSubSystem(filepathsChanged, subSystemLabelsMap)

  // Add version labels if PR is made against a version branch
  const m = /^(v\d+\.(?:\d+|x))(?:-staging|$)/.exec(baseBranch)
  if (m) {
    labels.push(m[1])
  }

  return labels
}

function hasAllSubsystems (labels, allJsSubSystems) {
  return labels.every((label) => allJsSubSystems.includes(label))
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

function matchExclusiveSubSystem (filepathsChanged, exclusiveLabelsMap, allJsSubSystems) {
  const isExclusive = filepathsChanged.every(matchesAnExclusiveLabel, exclusiveLabelsMap)
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
    if (hasAllSubsystems(nonDocLabels, allJsSubSystems) || hasAllDocChanges(filepathsChanged)) {
      labels = ['doc']
    } else {
      labels = []
    }
  }
  return isExclusive ? labels : []
}

function matchAllSubSystem (filepathsChanged, subSystemLabelsMap) {
  return matchSubSystemsByRegex(
    subSystemLabelsMap, filepathsChanged)
}

function matchSubSystemsByRegex (rxLabelsMap, filepathsChanged) {
  const labelsCountLimit = process.env.MAX_LABELS_LIMIT || 4
  const labelCount = new Set()

  // by putting matched labels into a map, we avoid duplicate labels
  const labelsMap = filepathsChanged.reduce((map, filepath) => {
    if (ciNeededFolderRx.test(filepath) && !map['needs-ci']) {
      map['needs-ci'] = true
    }

    const mappedSubSystems = mappedSubSystemsForFile(rxLabelsMap, filepath)

    if (!mappedSubSystems) {
      // short-circuit
      return map
    }

    for (let i = 0; i < mappedSubSystems.length; ++i) {
      const mappedSubSystem = mappedSubSystems[i]
      if (hasLibOrSrcChanges(filepathsChanged)) {
        if (labelCount.size >= labelsCountLimit) {
          for (const label of labelCount.values()) {
            // don't delete the `c++` or `needs-ci` labels as we always want those if they have matched
            if (label !== 'c++' && label !== 'needs-ci') delete map[label]
          }
          map['lib / src'] = true
          // short-circuit
          return map
        } else {
          labelCount.add(mappedSubSystem)
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
  return mappedSubSystemsForFile(this, filepath) !== undefined
}

module.exports = resolveLabels
