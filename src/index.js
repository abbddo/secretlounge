import dude from 'debug-dude'
const { /*debug,*/ log, info /*, warn, error*/ } = dude('bot')

import { version } from '../package.json'
info(`secretlounge v${version} starting`)

import config from '../config.json'

import { connect } from 'coffea'
const networks = connect(config)

import { getUser, addUser, delUser, getUsers, setRank } from './db'
import { NOT_IN_CHAT } from './messages'
import { RANKS, getRank } from './ranks'

const sendToAll = (rawEvent) => {
  let evt
  if (typeof rawEvent === 'string') evt = { type: 'message', text: rawEvent }
  else evt = rawEvent

  getUsers().map((user) => {
    if (config.debug || user.id !== evt.user) { // don't relay back to sender
      networks.send({ ...evt, chat: user.id })
    }
  })
}

const relay = (type) => {
  networks.on(type, (evt, reply) => {
    if (evt && evt.text && evt.text.charAt(0) !== '/') { // don't parse commands again
      if (getUser(evt.user)) { // make sure user is in the group chat
        // otherwise, relay event to all users
        sendToAll(evt)
      } else {
        reply(NOT_IN_CHAT)
      }
    }
  })
}

['message', 'audio', 'document', 'photo', 'sticker', 'video', 'voice'].map(relay)

const getUsername = (user) => {
  const rank = user.rank > 0 ? ' (' + getRank(user.rank) + ')' : ''
  return '@' + user.username + rank
}

const getUsernameFromEvent = (evt) => evt.raw && evt.raw.from && evt.raw.from.username

const commands = (cmd, evt, reply) => {
  switch (cmd) {
    case 'stop':
      if (!getUser(evt.user)) reply(NOT_IN_CHAT)
      else delUser(evt.user)
      sendToAll('@' + getUsernameFromEvent(evt) + ' left the chat')
      break
    case 'users':
      const users = getUsers()
      reply(users.length + ' users: ' + users.map(getUsername).join(', '))
      break
    case 'sign':
    case 's':
      sendToAll({
        type: 'message',
        user: evt.user,
        text: evt.args.join(' ') + '<b> ~' + getUsernameFromEvent(evt) + '</b>',
        options: {
          parse_mode: 'HTML'
        }
      })
      break
    case 'info':
      const user = getUser(evt.user)
      reply({
        type: 'message',
        user: evt.user,
        text: `<b>id:</b> ${user.id}, <b>username:</b> @${user.username}, <b>rank:</b> ${user.rank} (${getRank(user.rank)})`,
        options: {
          parse_mode: 'HTML'
        }
      })
      break
  }
}

networks.on('command', (evt, reply) => {
  log('Received command event: %o', evt)

  const cmd = evt.cmd.toLowerCase()

  if (cmd === 'start') {
    if (getUser(evt.user)) return reply('You\'re already in the chat!')
    else {
      const username = getUsernameFromEvent(evt)
      addUser(evt.user, username)
      sendToAll('@' + username + ' joined the chat')

      // make first user admin
      if (getUsers().length === 1) setRank(evt.user, RANKS.admin)

      return reply('Welcome to real time /b/ - NO SPAMMING')
    }
  } else {
    if (!getUser(evt.user)) return reply(NOT_IN_CHAT)
    commands(cmd, evt, reply)
  }
})
