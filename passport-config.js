const LocalStrategy = require('passport-local').Strategy
const bcrypt = require('bcryptjs')

function initialize(passport, findResidentByUsername, findResidentById) {
  const authenticateUser = async (username, password, done) => {
    const resident = await findResidentByUsername(username)

    if (resident == null) {
      return done(null, false, { message: "User not found" })
    }

    try {
      if (await bcrypt.compare(password, resident.user.password)) {
        return done(null, resident)
      } else {
        return done(null, false, { message: 'Password incorrect' })
      }
    } catch (e) {
      return done(e)
    }
  }

  passport.use(new LocalStrategy({ usernameField: 'username' }, authenticateUser))
  passport.serializeUser((resident, done) => {
    done(null, resident._id)
  })
  passport.deserializeUser(async (id, done) => {
    try {
      var result = await findResidentById(id)      
      return done(null, result)
    } catch (e) {
      done(e)
    }
  })
}

module.exports = initialize