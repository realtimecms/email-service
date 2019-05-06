const test = require('blue-tape')
const r = require('rethinkdb')
const testUtils = require('rethink-event-sourcing/tape-test-utils.js')
const crypto = require('crypto')

test('Email service', t => {
  t.plan(4)

  let conn

  testUtils.connectToDatabase(t, r, (connection) => conn = connection)

  let testId = crypto.randomBytes(24).toString('hex')

  t.test('push email event', t => {
    t.plan(1)

    testUtils.pushEvents(t, r, 'email', [
      {
        type: "sent",
        testId,
        email: {
          from: '"Mr. Panda 🐼" <panda@semgregate.com>',
          to: 'm8@em8.pl',
          subject: 'Hello 😊️', // Subject line
          text: 'Email working!', // plain text body
          html: '<b>Email working!</b>' // html body
        }
      }
    ])

  })

  t.test('wait for email sent', t => {
    t.plan(1)
    t.timeoutAfter(5000)

    r.table("email_events").filter({testId}).changes({include_initial:true}).run(conn).then(
      cursor => {
        if(! cursor) t.fail("no cursor")
        cursor.each((err, change) => {
          if(err) return cursor.close()
          let {new_val} = change
          if(new_val.sent) t.pass('email sent!')
        })
      }
    )

  })


  t.test('close connection', t => {
    conn.close(() => {
      t.pass('closed')
      t.end()
    })
  })

})