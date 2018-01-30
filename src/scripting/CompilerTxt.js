const isJSON = require('is-json')
const _ = require('lodash')

const Capabilities = require('../Capabilities')
const CompilerBase = require('./CompilerBase')
const { ConvoHeader, Convo } = require('./Convo')

module.exports = class CompilerTxt extends CompilerBase {
  constructor (caps = {}) {
    super(caps)

    this.eol = caps[Capabilities.SCRIPTING_TXT_EOL]
  }

  Validate () {
    return super.Validate().then(() => {
      this._AssertCapabilityExists(Capabilities.SCRIPTING_TXT_EOL)
    })
  }

  GetHeaders (scriptData) {
    return new Promise((resolve) => {
      let lines = scriptData.split(this.eol)

      let header = {
      }

      if (lines && !lines[0].startsWith('#')) {
        header.name = lines[0]
      }
      resolve(new ConvoHeader(header))
    })
  }

  Compile (scriptData) {
    let lines = scriptData.split(this.eol)

    let convo = {
      header: {},
      conversation: []
    }

    let currentLines = []
    let currentSender = null
    let currentChannel = null

    let parseMsg = (lines) => {
      if (!lines) return null

      let content = lines.join(' ')
      if (isJSON(content)) {
        return JSON.parse(content)
      } else {
        return lines.join(this.eol)
      }
    }

    let pushPrev = () => {
      if (currentSender && currentLines) {
        const convoStep = {
          sender: currentSender,
          channel: currentChannel
        }
        let msg = parseMsg(currentLines)
        if (_.isString(msg)) {
          convoStep.messageText = msg
        } else {
          convoStep.sourceData = msg
        }
        convo.conversation.push(convoStep)
      } else if (!currentSender && currentLines) {
        convo.header.name = currentLines[0]
        if (currentLines.length > 1) {
          convo.header.description = currentLines.slice(1).join(this.eol)
        }
      }
    }

    lines.forEach((line) => {
      line = line.trim()
      if (!line) {
      } else if (line.startsWith('#')) {
        pushPrev()

        currentSender = line.substr(1)
        currentChannel = null
        if (currentSender.indexOf(' ') > 0) {
          currentChannel = currentSender.substr(currentSender.indexOf(' ') + 1).trim()
          currentSender = currentSender.substr(0, currentSender.indexOf(' ')).trim()
        }
        currentLines = []
      } else {
        currentLines.push(line)
      }
    })
    pushPrev()

    return Promise.resolve([ new Convo(convo) ])
  }

  Decompile (convos) {
    if (convos.length > 1) {
      return Promise.reject(new Error('only one convo per script'))
    }

    const convo = convos[0]

    let script = ''

    if (convo.header.name) {
      script += convo.header.name + this.eol
    }
    if (convo.header.description) {
      script += convo.header.description + this.eol
    }

    convo.conversation.forEach((set) => {
      if (!set.messageText && !set.sourceData) return

      script += this.eol

      script += '#' + set.sender
      if (set.channel) {
        script += ' ' + set.channel
      }
      script += this.eol

      if (set.messageText) {
        script += set.messageText + this.eol
      } else if (set.sourceData) {
        script += JSON.stringify(set.sourceData, null, 2) + this.eol
      }
    })
    return Promise.resolve(script)
  }
}