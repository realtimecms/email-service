const nodemailer = require('nodemailer')
const App = require("@live-change/framework")
const validators = require("../validation")
const app = new App()

const definition = app.createServiceDefinition({
  name: "email",
  validators
})


const smtp = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: false, // secure:true for port 465, secure:false for port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
})

definition.event({
  name: "send",
  properties: {
    id: {
      type: String
    },
    email: {
      type: Object
    },
    flags: {
      type: Object
    }
  },
  async execute({ id, email, flags }) {
    if(flags.sent) return // anti resent solution

    return new Promise((resolve, reject) => {
      if(email.to.match(/@test\.com>?$/)) {
        console.log("TEST EMAIL TO", email.to)
        service.dao.request([
          'database', 'flagLog',
          service.databaseName, service.app.splitEvents ? "events" : "email_events",
          {
            sent: true
          }
        ])
      }
      smtp.sendMail(email, (error, info) => {
        if (error) {
          service.dao.request([
            'database', 'flagLog',
            service.databaseName, service.app.splitEvents ? "events" : "email_events",
            {
              sent: true,
              smtpError: error
            }
          ])
        }
        service.dao.request([
          'database', 'flagLog',
          service.databaseName, service.app.splitEvents ? "events" : "email_events",
          {
            sent: true,
            sentTime: new Date(),
            smtp: {
              messageId: info.messageId,
              response: info.response
            }
          }
        ])
      })
    })
  }
})



module.exports = definition

async function start() {
  app.processServiceDefinition(definition, [ ...app.defaultProcessors ])
  await app.updateService(definition)//, { force: true })
  const service = await app.startService(definition, { runCommands: true, handleEvents: true })

  /*require("../config/metricsWriter.js")(definition.name, () => ({

  }))*/
}

if (require.main === module) start().catch( error => { console.error(error); process.exit(1) })

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
})

