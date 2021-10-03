if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
var cors = require('cors');
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
    console.log("Connected");
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

app.use(cors())
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
  res.render('dashboard.ejs', { name: req.user.name, admin: req.user.admin, apartment: req.user.apartment })
})

app.get('/water_booking', checkAuthenticated,  (req, res) => {    
  res.render('water_booking.ejs', { name: req.user.name, admin: req.user.admin, apartment: req.user.apartment })
})


app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.get('/register', checkAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.get('/users', checkNotAuthenticated, async (req, res) => {
  const db = await mongodb.MongoClient.connect('mongodb://localhost:27017/').catch(err => {
    console.log(err)
    res.status(400).send("Error fetching residents");
  });
    try {
      console.log('querying for residents in apartment: ' + req.header('apartment') );
      residents = await db.db("amplify").collection('residents').find({ "apartment": req.header('apartment') }).toArray();            
      var users = []
      for(var i = 0; i < residents.length; i++) {
        var user = {
          id: residents[i]._id,
          name: residents[i].name
        }
        users.push(user)
      }
      res.status(200).send(JSON.stringify(users));
    } catch (err) {
      console.log(err)
      res.status(400).send("Error fetching residents");
    } finally {
      db.close();
    }
})

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}))

app.post('/register', checkAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    resident = {
      user: {
        username: req.body.username,
        password: hashedPassword,
      },
      name: req.body.name,
      apartment: req.user.apartment,
      doorNumber: req.body.doorNumber,
      admin: false
    }

    mongodb.MongoClient.connect('mongodb://localhost:27017/', function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("residents").insertOne(resident, function (err, result) {
        if (err) {
          req.flash('info','user not added')
          res.redirect('/register')          
        } else {
          console.log(`Added a new resident`)
          req.flash('info','user added successfully')
          res.redirect('/register')          
        }
      });
    });

  } catch {
    req.flash('info','error, please try again')
    res.redirect('/register')
  }
})

app.post('/su/register_admin', checkNotAuthenticated, async (req, res) => {
  try {
    if(req.header('Authorization') !== 'qwerty12345') {
      res.status(400).send("Unauthorized");
      return;
    }
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    resident = {
      user: {
        username: req.body.username,
        password: hashedPassword,
      },
      name: req.body.name,
      apartment: req.body.apartment,
      doorNumber: req.body.doorNumber,
      admin: true
    }

    mongodb.MongoClient.connect('mongodb://localhost:27017/', function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("residents").insertOne(resident, function (err, result) {
        if (err) {
          res.status(400).send("Error creating apartment admin account");
        } else {
          res.status(200).send(`Apartment admin account created successfully`);
        }
      });
    });

  } catch {
    res.status(400).send("Error creating apartment admin account");
  }
})

app.post('/water_booking',checkAuthenticated, (req,res) => {
  console.log('processing new water booking expense')
  try {
    expense = {
      expense_type: "Water Booking",
      paid_by_ID: req.body.paid_by.split('|')[0],
      paid_by: req.body.paid_by.split('|')[1],
      date_paid: req.body.date_paid,
      water_quantity: req.body.water_quantity,
      amount_paid: req.body.amount_paid,
      apartment: req.user.apartment,
      booking_done: false
    }

    mongodb.MongoClient.connect('mongodb://localhost:27017/', function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("expenses").insertOne(expense, function (err, result) {
        if (err) {
          req.flash('info','expense not added')
          res.redirect('/water_booking')          
        } else {
          console.log(`Added a new resident`)
          req.flash('info','expense added successfully')
          res.redirect('/water_booking')          
        }
      });
    });

  } catch {
    req.flash('info','error, please try again')
    res.redirect('/water_booking')
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