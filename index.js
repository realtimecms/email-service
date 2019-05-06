const r = require('rethinkdb')
const nodemailer = require('nodemailer')
const evs = require('rethink-event-sourcing')({
  serviceName: 'email'
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

evs.registerEventListeners({

  sent({ id, email, sent }) {
    if(sent) return; // anti resent solution

    return new Promise((resolve, reject) => {
      if(email.to.match(/@test\.com>?$/)) {
        console.log("TEST EMAIL TO", email.to)
        return r.table("email_events").get(id).update({
          sent: true
        }).run(evs.db)
      }
      smtp.sendMail(email, (error, info) => {
        if (error) {
          return r.table("email_events").get(id).update({
            smtpError: error
          }).run(evs.db).then(
            result => reject("sendFailed")
          )
        }
        return r.table("email_events").get(id).update({
          sent: true,
          sentTime: new Date(),
          smtp: {
            messageId: info.messageId,
            response: info.response
          }
        }).run(evs.db)
      })
    })
  }

})

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
})

