const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const passport    = require("passport");
const cookieParser = require("cookie-parser");
const LocalStrategy = require("passport-local");
const flash        = require("connect-flash");
const User        = require("./models/user");
const Comment     = require("./models/comment");
const session = require("express-session");
const app = express();
const middleware = require("./middleware");
const indexRoutes = require("./routes/index");
const ObjectID = require('mongoose').mongo.ObjectId;
const mongoURI = 'mongodb://localhost:27017/430-Project';

mongoose.connect(mongoURI, {useNewUrlParser: true });
mongoose.set('useCreateIndex', true);
app.use(bodyParser.urlencoded({extended: true}));
app.use(require("express-session")({
  secret: "Once again!",
  resave: false,
  saveUninitialized: false
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + "/public"))
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req, res, next){
  res.locals.currentUser = req.user;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});
// Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
app.use(cookieParser('secret'));
app.use("/", indexRoutes);
// Mongo URI

// Create mongo connection

const conn = mongoose.connection;

app.use(bodyParser.urlencoded({extended: true}));
// Init gfs
let gfs;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });

app.get('/', (req, res) => {
  res.render('landing');
});

app.get('/index', (req, res) => {
  res.render('index');
});

app.get('/upload', (req, res) => {
  res.render('Upload');
});

// @route GET /
// @Get all Results
app.get('/Results', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render('Results', { files: false });
    } else {
      files.map(file => {
        if (
          file.contentType === 'image/jpeg' ||
          file.contentType === 'image/png'
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render('Results', { files: files });
    }
  });
});

// @route POST /upload
// @desc  Uploads file to DB + add tag
app.post('/upload', middleware.isLoggedIn, upload.single('file'), (req, res) => {
  gfs.files.update(
    {_id: req.file.id},
    {$set : { metadata:
      { tags : req.body.tag,
        author : req.user.username,
        description: req.body.description
     }
     }
    }
  );

  req.flash("success"," Image Upload Successfully");
  res.redirect('/');
});
//
app.get('/Tag-Search',(req, res) => {
  res.render('Tag-search-form');
});

// search image by tag
app.post('/Tag-Result', upload.single("file"), (req, res) => {

  gfs.files.find({"metadata.tags": req.body.tag}).toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      res.render('Tag-Results', { files: false });
    } else {
      files.map(file => {
        if (
          file.contentType === 'image/jpeg' ||
          file.contentType === 'image/png'
        ) {
          file.isImage = true;
        } else {
          file.isImage = false;
        }
      });
      res.render('Tag-Results', { files: files });
    }
  });

});
//Show User-info
app.get('/user-info/:userid', (req, res) => {
  conn.db.collection('users').find({_id: req.params.id}, (err, user) => {
    res.render('user-info', { user : user});
  });
}); 

//Show all user for admin
app.get('/user/All', (req, res) => {
  conn.db.collection('users').find().toArray((err, users) => {
    res.render('All-user-info', {users: users});
  });
}); 
//add new comment
app.post('/:filename/new-comments', middleware.isLoggedIn, (req, res) => {
  var newComment = new Comment({
    comment: req.body.comment,
    user: req.user.username,
    filename: req.params.filename
    });
    Comment.create(newComment);
    req.flash('success', 'comment create successfully!');
    res.redirect('/');
});


//show more info
app.get('/image-info/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    conn.db.collection('comments').find({ filename: req.params.filename }).toArray((err, allcomments) => {
      res.render('image-info',{file: file , comments: allcomments});
    });
  });
});

// API
app.get('/API', (req, res) => {
  gfs.files.find().toArray((err, files) => {
    // Check if files
    if (!files || files.length === 0) {
      return res.status(404).json({
        err: 'No files exist'
      });
    }

    // Files exist
    return res.json(files);
  });
});


// @route GET /image/:filename
// @desc Display Image
app.get('/image/:filename', (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    // Check if file
    if (!file || file.length === 0) {
      return res.status(404).json({
        err: 'No file exists'
      });
    }

    // Check if image
    if (file.contentType === 'image/jpeg' || file.contentType === 'image/png') {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({
        err: 'Not an image'
      });
    }
  });
});

// @route DELETE /files/:id
// @desc  Delete file
app.delete('/files/:id', middleware.isLoggedIn, (req, res) => {
  gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
    if (err) {
      return res.status(404).json({ err: err });
    }
    req.flash('success', 'Photo deleted successfully!');
    res.redirect('/');
  });
});

const port = 443
const https = require('https')
const fs = require('fs')

app.get('/', (req, res) => {
  res.send('We are using HTTPS connection!')
})
https.createServer({
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.cert')
}, app).listen(443, () => {
  console.log(`Web app Began Run on port ${port}!`)
})
