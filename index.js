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
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  },
  secure: !process.env.SMTP_INSECURE, // secure:true for port 465, secure:false for port 587
  tls: {
    // do not fail on invalid certs
    rejectUnauthorized: !process.env.SMTP_IGNORE_TLS
  }
})

const SentEmail = definition.model({
  name: "SentEmail",
  properties: {
    email: {
      type: Object
    },
    error: {
      type: Object
    },
    smtp: {
      type: Object
    }
  }
})

definition.trigger({
  name: "sendEmail",
  properties: {
    emailId: {
      type: String
    },
    email: {
      type: Object,
      validation: ['nonEmpty']
    }
  },
  async execute(props, context, emit) {
    const emailId = props.emailId || app.generateUid()
    const email = props.email
    if(!email) throw new Error('email must be defined')

    if(email.to.match(/@test\.com>?$/)) {
      console.log("TEST EMAIL TO", email.to)
      emit({
        type: 'sent',
        emailId,
        email: email,
        smtp: {
          test: true
        }
      })
      return
    }

    try {
      console.log("SEND EMAIL", email)
      const info = await smtp.sendMail(email)
      console.log("EMAIL SENT!", info)
      emit({
        type: 'sent',
        emailId,
        email: email,
        smtp: {
          messageId: info.messageId,
          response: info.response
        }
      })
    } catch(error) {
      console.error("EMAIL ERROR", error)
      emit({
        type: 'error',
        emailId,
        email: email,
        error: error
      })
    }
  }
})

definition.event({
  name: "sent",
  properties: {
    emailId: {
      type: String
    },
    email: {
      type: Object
    },
    smtp: {
      type: Object
    }
  },
  async execute(event) {
    await SentEmail.create({ id: event.emailId, email: event.email, smtp: event.smtp })
  }
})


definition.event({
  name: "error",
  properties: {
    emailId: {
      type: String
    },
    email: {
      type: Object
    },
    error: {
      type: Object
    }
  },
  async execute(event) {
    await SentEmail.create({ id: event.emailId, email: event.email, error: event.error })
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
