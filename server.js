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
    const db = await mongodb.MongoClient.connect(process.env.MONGODB_HOST).catch(err => { throw err });
    try {
      return await db.db("amplify").collection('residents').findOne({ "user.username": username });
    } catch (err) {
      throw err;
    } finally {
      db.close();
    }
  },
  async id => {
    const db = await mongodb.MongoClient.connect(process.env.MONGODB_HOST).catch(err => { throw err });
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


app.get('/',checkAuthenticated, (req,res) => {
  res.render('expenditure.ejs', { 
    id: req.user._id, 
    secret: process.env.API_SECRET, 
    name: req.user.name, 
    admin: req.user.admin, 
    apartment: req.user.apartment, 
    doorNumber: req.user.doorNumber,
    contact: req.user.contact
   })
})

app.get('/new_expense', checkAuthenticated,  (req, res) => {    
  res.render('expenses.ejs', { 
    name: req.user.name, 
    secret: process.env.API_SECRET, 
    admin: req.user.admin, 
    apartment: req.user.apartment,
    doorNumber: req.user.doorNumber,
    contact: req.user.contact
  })
})

app.get('/water_reading', checkAuthenticated, (req,res) => {
  res.render('water_reading.ejs',{ 
    name: req.user.name, 
    secret: process.env.API_SECRET, 
    admin: req.user.admin, 
    apartment: req.user.apartment,
    doorNumber: req.user.doorNumber,
    contact: req.user.contact
   })
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.get('/register', checkAuthenticated, (req, res) => {
  res.render('register.ejs', { 
    name: req.user.name, 
    admin: req.user.admin, 
    apartment: req.user.apartment,
    doorNumber: req.user.doorNumber,
    contact: req.user.contact
  })
})

app.get('/users', async (req, res) => {
  if(req.header('Authorization') !== process.env.API_SECRET) {
    res.status(400).send("Unauthorized");
    return;
  }
  const db = await mongodb.MongoClient.connect(process.env.MONGODB_HOST).catch(err => {
    res.status(400).send("Error fetching residents");
  });
    try {
      residents = await db.db("amplify").collection('residents').find({ "apartment": req.header('apartment') }).toArray();            
      var users = []
      for(var i = 0; i < residents.length; i++) {
        var user = {
          id: residents[i]._id,
          name: residents[i].name,
          contact: residents[i].contact
        }
        users.push(user)
      }
      res.status(200).send(JSON.stringify(users));
    } catch (err) {
      res.status(400).send("Error fetching residents");
    } finally {
      db.close();
    }
})

app.get('/expenses', async (req, res) => {
  if(req.header('Authorization') !== process.env.API_SECRET) {
    res.status(400).send("Unauthorized");
    return;
  }
  const db = await mongodb.MongoClient.connect(process.env.MONGODB_HOST).catch(err => {
    res.status(400).send("Error fetching expenses");
  });
    try {      
      expenses = await db.db("amplify").collection('expenses').find({ "apartment": req.header('apartment') }).toArray();    
      var responseList = []
      for(var i = 0; i < expenses.length; i++) {
        var expense = {
          type: expenses[i].expense_type,
          date: expenses[i].date_paid,
          amount: expenses[i].amount_paid,
          paidByID: expenses[i].paid_by_ID,
          paidBy: expenses[i].paid_by,
          description: expenses[i].description,
          individualAmt: expenses[i].individual_amount,
          waterQty: expenses[i].water_quantity,
          readings: expenses[i].readings,
          contact: expenses[i].contact
        }
        responseList.push(expense)
      }
      res.status(200).send(JSON.stringify(responseList));
    } catch (err) {
      res.status(400).send("Error fetching residents");
    } finally {
      db.close();
    }
})

app.get('/bookings', async (req, res) => {
  if(req.header('Authorization') !== process.env.API_SECRET) {
    res.status(400).send("Unauthorized");
    return;
  }
  const db = await mongodb.MongoClient.connect(process.env.MONGODB_HOST).catch(err => {
    res.status(400).send("Error fetching water bookings");
  });
    try {
      bookings = await db.db("amplify").collection('expenses').find({ "apartment": req.header('apartment'), "expense_type": "waterBookings", "readings": {$exists: false} }).toArray();            
      var responseList = []
      for(var i = 0; i < bookings.length; i++) {
        var booking = {
          id: bookings[i]._id,
          date: bookings[i].date_paid,
          paidBy: bookings[i].paid_by,
          waterQty: bookings[i].water_quantity,
          totalAmt: bookings[i].amount_paid,
          contact: bookings[i].contact
        }
        responseList.push(booking)
      }
      res.status(200).send(JSON.stringify(responseList));
    } catch (err) {
      res.status(400).send("Error fetching water bookings");
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
      contact: req.body.contact,
      admin: false
    }

    mongodb.MongoClient.connect(process.env.MONGODB_HOST, function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("residents").insertOne(resident, function (err, result) {
        if (err) {
          req.flash('info','user not added')
          res.redirect('/register')          
        } else {          
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

app.post('/su/register_admin', async (req, res) => {
  try {
    if(req.header('Authorization') !== process.env.API_SECRET) {
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
      contact: req.body.contact,
      admin: true
    }

    mongodb.MongoClient.connect(process.env.MONGODB_HOST, function (err, db) {
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

app.post('/new_expense',checkAuthenticated, (req,res) => {
  try {    
    expense = {
      expense_type: req.body.expense_type,
      date_paid: req.body.date_paid,
      amount_paid: req.body.amount_paid,
      apartment: req.user.apartment,
      description: req.body.desc,
      contact: req.body.contact
    }

    if(req.body.expense_type != 'corpusFunds') {
      expense.paid_by_ID = req.body.paid_by.split('|')[0];
      expense.paid_by = req.body.paid_by.split('|')[1];
    }

    if(req.body.expense_type == 'waterBookings'){    
      expense.water_quantity= req.body.water_quantity;
    } else {
      expense.individual_amount = req.body.amount_paid / req.body.residents_count;
    }

    mongodb.MongoClient.connect(process.env.MONGODB_HOST, function (err, db) {
      if (err) throw err;
      var dbo = db.db("amplify");
      dbo.collection("expenses").insertOne(expense, function (err, result) {
        if (err) {
          req.flash('info','expense not added')
          res.redirect('/new_expense')          
        } else {
          req.flash('info','expense added successfully')
          res.redirect('/new_expense')          
        }
      });
    });

  } catch {
    req.flash('info','error, please try again')
    res.redirect('/new_expense')
  }
})

app.post('/water_reading',checkAuthenticated, (req,res) => {
  try {            
    bookingId = req.body.booking;            
    booking = {};
    bookings = JSON.parse(req.body.bookings);
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].id == bookingId) {
        booking = bookings[i];
      } 
    }
    totalAmt = booking.totalAmt;
    waterQty = booking.waterQty;
    residents = JSON.parse(req.body.residents);
    readings = {};
    totalReadings=0;
    for (var i = 0; i < residents.length; i++) {
      residentId = residents[i].id;
      residentName = residents[i].name;
      readingAmt = req.body[residentId];
      totalReadings += parseInt(readingAmt); 
      amount_payable = (readingAmt/waterQty) * totalAmt;
      reading = {
        "name": residentName,
        "reading": readingAmt,
        "amount": amount_payable
      }
      readings[residentId] = reading;
    }
    if(totalReadings>waterQty){
      req.flash('info','Invalid water readings')
      res.redirect('/water_reading')
    } else {
      mongodb.MongoClient.connect(process.env.MONGODB_HOST, function (err, db) {
        if (err) throw err;
        var dbo = db.db("amplify");
        var query = { "_id": new mongodb.ObjectId(bookingId) };
        var updated = {$set: {readings: readings}};
        dbo.collection("expenses").updateOne(query, updated, function (err, result) {
          if (err) {
            req.flash('info','water readings not added')
            res.redirect('/water_reading')          
          } else {
            req.flash('info','water readings added successfully')
            res.redirect('/water_reading')          
          }
        });
      });
    }
  } catch(err) {    
    req.flash('info','error, please try again')
    res.redirect('/water_reading')
  }
})

app.get('/logout', (req, res) => {
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