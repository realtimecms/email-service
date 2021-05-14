const nodemailer = require('nodemailer')
const validators = require("../validation")
const app = require("@live-change/framework").app()

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
    const doSendEmail = async () => { // async it can be very slow :/
      try {
        console.log("SEND EMAIL", email);
        const info = await smtp.sendMail(email)
        emit({
          type: 'sent',
          emailId,
          email: email,
          smtp: {
            messageId: info.messageId,
            response: info.response
          }
        })
        console.log("EMAIL SENT!", info)
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
    doSendEmail()
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

definition.action({
  name: "sendContactFormMail",
  properties: {
    from: {  type: String, validation: ['nonEmpty'] },
    name: { type: String, validation: ['nonEmpty']},
    subject: {  type: String, validation: ['nonEmpty'] },
    text: {  type: String, validation: ['nonEmpty'] },
    html: {  type: String },
  },
  async execute({ from, name, subject, text, html }, {client, service}, emit) {
    if(!html) {
      const encodedStr = text.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
        return '&#'+i.charCodeAt(0)+';'
      })
      const multiline = encodedStr.replace(/\n/gi, /*'↵*/'<br>')
      const withLinks = multiline.replace(
          /(?![^<]*>|[^<>]*<\/)((https?:)\/\/[a-z0-9&#%=.\/?_,-]+)/gi, '<a href="$1" target="_blank">$1</a>')
      html = withLinks
    }

    await service.trigger({
      type:"sendEmail",
      email: {
        from: `${name} <${process.env.CONTACT_FORM_FROM_EMAIL}>`,
        to: `${ process.env.CONTACT_FORM_TARGET_NAME} <${process.env.CONTACT_FORM_TARGET_EMAIL}>`,
        subject: subject,
        text,
        html,
        replyTo: `${name} <${from}>`
      }
    })
  }
})


module.exports = definition

async function start() {
  process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  })

  app.processServiceDefinition(definition, [ ...app.defaultProcessors ])
  await app.updateService(definition)//, { force: true })
  const service = await app.startService(definition, { runCommands: true, handleEvents: true })

  /*require("../config/metricsWriter.js")(definition.name, () => ({

  }))*/
}

if (require.main === module) start().catch( error => { console.error(error); process.exit(1) })

