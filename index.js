const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors'); // Add this

// Load environment variables
dotenv.config();

const app = express();
const port = 3000;

// Use CORS to allow cross-origin requests
app.use(cors());

// MongoDB connection URI and database/collection details
const uri = "mongodb+srv://soumya:edunova@cluster0.mv42m.mongodb.net/";
const dbName = 'Edunova_DB';
const booksCollectionName = 'Books';
const userCollectionName = 'Users';
const transactionsCollectionName = 'Transactions';

let db;
MongoClient.connect(uri)
  .then(client => {
    console.log('Connected to MongoDB');
    db = client.db(dbName);
  })
  .catch(error => console.error('Error connecting to MongoDB:', error));

// Middleware to parse JSON request bodies
app.use(express.json());

// API to list all books
app.get('/books', async (req, res) => {
  try {
    const booksCollection = db.collection(booksCollectionName);
    const books = await booksCollection.find().toArray();

    // Return the list of books as JSON
    res.status(200).json(books);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'An error occurred while fetching books' });
  }
});

// API to add a new book
app.post('/books', async (req, res) => {
  try {
    const newBook = req.body; // Book data from request body
    if (!newBook.name || !newBook.category || typeof newBook.rentPerDay !== 'number') {
      return res.status(400).json({ error: 'Invalid book data' });
    }

    const booksCollection = db.collection(booksCollectionName);
    const result = await booksCollection.insertOne(newBook);

    // Return the newly added book with its inserted ID
    res.status(201).json(result.ops[0]);
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'An error occurred while adding the book' });
  }
});


app.get('/books/search', async (req, res) => {
  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ message: 'Book name or term is required' });
  }

  try {
    // Search for books where the name matches the input term (case-insensitive)
    const books = await db.collection(booksCollectionName).find({
      name: { $regex: new RegExp(name, 'i') }  // Case-insensitive search using regular expression
    }).toArray();

    if (books.length === 0) {
      return res.status(404).json({ message: 'No books found matching the search term' });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

/**
 * API 2: Search books by rent price range
 * INPUT: rent price range (minRent, maxRent)
 * OUTPUT: List of books with rent per day in the specified range
 */
app.get('/books/rent-range', async (req, res) => {
  const { minRent, maxRent } = req.query;

  // Check if both minRent and maxRent are provided
  if (!minRent || !maxRent) {
    return res.status(400).json({ message: 'Both minRent and maxRent are required' });
  }

  try {
    // Query books where rentPerDay is within the range of minRent and maxRent
    const books = await db.collection(booksCollectionName).find({
      rentPerDay: {
        $gte: parseFloat(minRent),  // Greater than or equal to minRent
        $lte: parseFloat(maxRent)   // Less than or equal to maxRent
      }
    }).toArray();

    if (books.length === 0) {
      return res.status(404).json({ message: 'No books found in the specified rent range' });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

/**
 * API 3: Search books by category, name/term, and rent price range
 * INPUT: category, name/term, rent per day range (minRent, maxRent)
 * OUTPUT: List of books matching the category, name, and rent range
 */
app.get('/books/search', async (req, res) => {
  const { category, name, minRent, maxRent } = req.query;

  // Check if all parameters are provided
  if (!category || !name || !minRent || !maxRent) {
    return res.status(400).json({ message: 'Category, name/term, minRent, and maxRent are required' });
  }

  try {
    // Query books based on category, name/term, and rent range
    const books = await db.collection(booksCollectionName).find({
      category: category,
      name: { $regex: new RegExp(name, 'i') }, // Case-insensitive search for name/term
      rentPerDay: {
        $gte: parseFloat(minRent),  // Greater than or equal to minRent
        $lte: parseFloat(maxRent)   // Less than or equal to maxRent
      }
    }).toArray();

    if (books.length === 0) {
      return res.status(404).json({ message: 'No books found matching the criteria' });
    }

    res.status(200).json(books);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching books', error });
  }
});

/**
 * API X: Post user
 * INPUT: user details
 * OUTPUT: nothing
 */
app.post('/users', async (req, res) => {
  const { name } = req.body;

  // Validate input
  if (!name) {
    return res.status(400).json({ message: 'Name is required' });
  }

  try {
    // Insert the user into the 'user' collection
    const result = await db.collection('Users').insertOne({ name });
    res.status(201).json({ message: 'User added successfully', userId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: 'Error adding user', error });
  }
});

/**
 * API X: Get all users
 * INPUT: nothing
 * OUTPUT: list of users
 */
app.get('/users', async (req, res) => {
  try {
    const users = await db.collection('Users').find().toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
});


/**
 * API 1: Issue a book to a user
 * INPUT: bookId, userId, issueDate (from request body)
 * OUTPUT: Insert a new transaction document in the Transactions collection
 */
app.post('/transactions/issue', async (req, res) => {
  const { bookId, userId, issueDate } = req.body;

  if (!bookId || !userId || !issueDate) {
    return res.status(400).json({ message: 'bookId, userId, and issueDate are required' });
  }

  try {
    // Find the book by ID
    const book = await db.collection(booksCollectionName).findOne({ _id: ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find the user by userId
    const user = await db.collection(userCollectionName).findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new transaction
    const transaction = {
      bookId: book._id,
      userId: userId,
      issueDate: new Date(issueDate),
      status: 'issued', // Status can be 'issued' or 'returned'
    };

    // Insert the transaction into the Transactions collection
    const result = await db.collection(transactionsCollectionName).insertOne(transaction);

    res.status(201).json({ message: 'Book issued successfully', transactionId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: 'Error issuing book', error });
  }
});

/**
 * API 2: Return a book and calculate rent
 * INPUT: bookId, userId, returnDate (from request body)
 * OUTPUT: Update the transaction with the return date and calculate rent based on the issue date and return date
 */
app.post('/transactions/return', async (req, res) => {
  const { bookId, userId, returnDate } = req.body;

  if (!bookId || !userId || !returnDate) {
    return res.status(400).json({ message: 'bookId, userId, and returnDate are required' });
  }

  try {
    // Find the transaction by bookId and userId with status 'issued'
    const transaction = await db.collection(transactionsCollectionName).findOne({
      bookId: ObjectId(bookId),
      userId: userId,
      status: 'issued',
    });

    if (!transaction) {
      return res.status(404).json({ message: 'No active transaction found for this book and user' });
    }

    const issueDate = new Date(transaction.issueDate);
    const returnDateParsed = new Date(returnDate);

    // Calculate the number of days the book was rented
    const daysRented = Math.ceil((returnDateParsed - issueDate) / (1000 * 60 * 60 * 24));

    // Calculate total rent (rentPerDay * number of days rented)
    const totalRent = book.rentPerDay * daysRented;

    // Update the transaction with returnDate, totalRent, and change the status to 'returned'
    const updatedTransaction = await db.collection(transactionsCollectionName).updateOne(
      { _id: transaction._id },
      {
        $set: {
          returnDate: returnDateParsed,
          totalRent: totalRent,
          status: 'returned',
        },
      }
    );

    res.status(200).json({
      message: 'Book returned successfully',
      totalRent: totalRent,
      transactionId: transaction._id,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error returning book', error });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
