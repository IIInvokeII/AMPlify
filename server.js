if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const bcrypt = require('bcryptjs')
const passport = require('passport')
const flash = require('express-flash')
const session = require('express-session')
const mongodb = require('mongodb')
const methodOverride = require('method-override')

const initializePassport = require('./passport-config')
initializePassport(passport,
  async username => {
    const db = await mongodb.MongoClient.connect('mongodb://localhost:27017/').catch(err => { throw err });
    try {
      return await db.db("amplify").collection('residents').findOne({ "user.username": username });
    } catch (err) {
      throw err;
    } finally {
      db.close();
    }
  },
  async id => {
    const db = await mongodb.MongoClient.connect('mongodb://localhost:27017/').catch(err => { throw err });
    try {
      return await db.db("amplify").collection('residents').findOne({ "_id": new mongodb.ObjectId(id) });
    } catch (err) {
      throw err;
    } finally {
      db.close();
    }
  }
)

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(flash())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))


app.get('/', checkAuthenticated,  (req, res) => {    
  res.render('dashboard.ejs', { name: req.user.name, admin: req.user.admin })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}))

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    resident = {
      user: {
        username: req.body.username,
        password: hashedPassword
      },
      name: req.body.name,
      apartment: req.body.apartment,
      admin: req.body.admin
    }

    mongodb.MongoClient.connect('mongodb://localhost:27017/', function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("residents").insertOne(resident, function (err, result) {
        if (err) {
          res.status(400).send("Error inserting resident info!");
        } else {
          console.log(`Added a new resident with id ${result.insertedId}`);
          res.status(204).send();
        }
      });
    });

  } catch {
    res.status(400).send('error')
  }
})

app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/login')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

app.listen(process.env.PORT)