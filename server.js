// this package will load the .env file into the process.environment
require("dotenv").config({});

const express = require("express");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const serverPort = 8080;
const path = require("path");

let sequelize;

// if our code is in development (local on our PC)
// then use sqlite
if (process.env.NODE_ENV === "development") {
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "sample.db",
  });
}
// otherwise, if it is in production (on HEROKU)
// then use PostgreSQL
else {
  // get the database, user and password through an db connection URL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    protocol: "postgres",
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  });
}

const Book = sequelize.define("book", {
  title: Sequelize.STRING,
  content: Sequelize.TEXT,
});

const Chapter = sequelize.define("chapter", {
  title: Sequelize.STRING,
  content: Sequelize.TEXT,
});

Book.hasMany(Chapter);

const app = express();

// allows us to deliver static resources from our server
// -> whenever the server will receive a request is going to wonder if it can deliver a static resource in response
// -> these static resources are going to be delivered as files from a folder called "public"
// -> path.join(__dirname, "public") -> concatenate the current directory name (no matter the path separator the OS uses) with the folder public
app.use(express.static(path.join(__dirname, "public")));

// allows cross-origin resource sharing
// -> when I load a resource from a particular server that is its origin
// -> normally we are not going to be able to record resources from a different server unless we have this middleware (cors())
// -> this allows us to deploy the app to Heroku
// app.use(cors());

app.use(express.json());

// this will create our tables
app.get("/sync", async (req, res) => {
  try {
    await sequelize.sync({ force: true });
    res.status(201).json({ message: "tables created" });
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// get the book table
app.get("/books", async (req, res) => {
  try {
    // find all books (similar to SELECT * from BOOK)
    const books = await Book.findAll();
    res.status(200).json(books);
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// add data to the book tables
app.post("/books", async (req, res) => {
  try {
    // get the book that was sent into the request body
    const book = req.body;

    // create a book object from the book from the req.body
    // -> this will call
    //  - build (builds the book object in memory and if some validation does not pass we will get an error) and
    //  - save (constructs a SQL query and runs it against the db)
    await Book.create(book);
    res.status(201).json({ message: "book created" });
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// get the data of a certain book element (based on its id)
app.get("/books/:bid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid, {
      include: Chapter,
    });

    // if the book exists
    if (book) {
      // send it to the client
      res.status(200).json(book);
    } else {
      // otherwise send a client error
      res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// update the data of a certain book element (based on its id)
app.put("/books/:bid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    // if the book exists
    if (book) {
      // update only the specified fields ("title" and "content") of the book based on the req.body
      await book.update(req.body, {
        fields: ["title", "content"],
      });

      // if the book exists, send a status code and the message "accepted" stating that the update was accepted
      res.status(202).json({ message: "accepted" });
    } else {
      // otherwise send a client error
      res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// delete the data of a certain book element (based on its id)
app.delete("/books/:bid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    // if the book exists
    if (book) {
      // delete the book
      await book.destroy();

      // if the book exists, send a status code and the message "accepted" stating that the update was accepted
      res.status(202).json({ message: "accepted" });
    } else {
      // otherwise send a client error
      res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// get all the chapters of a particular book
app.get("books/:bid/chapters", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    if (book) {
      const chapters = await book.getChapters();
      res.status(200).json(chapters);
    } else {
      // otherwise send a client error
      res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// post chapters to a particular book
app.post("books/:bid/chapters", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    if (book) {
      const chapter = req.body;
      chapter.bookId = book.id;
      await Chapter.create(chapter);

      res.status(200).json({ message: "created" });
    } else {
      // otherwise send a client error
      res.status(404).json({ message: "not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// get a particular chapter of a particular book
app.get("books/:bid/chapters/:cid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    if (book) {
      const chapters = await book.getChapters({
        where: {
          id: req.params.cid,
        },
      });
      const chapter = chapters.shift();

      if (chapter) {
        res.status(200).json(chapter);
      } else {
        res.status(404).json({ message: "chapter not found" });
      }
    } else {
      res.status(404).json({ message: "book not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// update a chapter of a particular book
app.put("books/:bid/chapters/:cid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    if (book) {
      const chapters = await book.getChapters({
        where: {
          id: req.params.cid,
        },
      });
      const chapter = chapters.shift();

      if (chapter) {
        await chapter.update(req.body);
        res.status(200).json({ message: "accepted" });
      } else {
        res.status(404).json({ message: "chapter not found" });
      }
    } else {
      res.status(404).json({ message: "book not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

// delete a chapter of a particular book
app.delete("books/:bid/chapters/:cid", async (req, res) => {
  try {
    // find the book that has the id specified in the path
    const book = await Book.findByPk(req.params.bid);

    if (book) {
      const chapters = await book.getChapters({
        where: {
          id: req.params.cid,
        },
      });
      const chapter = chapters.shift();

      if (chapter) {
        await chapter.destroy();
        res.status(200).json({ message: "accepted" });
      } else {
        res.status(404).json({ message: "chapter not found" });
      }
    } else {
      res.status(404).json({ message: "book not found" });
    }
  } catch (err) {
    console.warn(err);
    res.status(500).json({ message: "some error occured" });
  }
});

app.listen(serverPort, () => {
  console.log("Server started on port " + serverPort);
});
