const express = require('express');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const cors = require('cors');
const { ObjectId } = require('mongodb'); 
// Load environment variables
dotenv.config();

const app = express();

// CORS middleware using the 'cors' package
app.use(cors({
  origin: 'https://bookstore-rho-peach.vercel.app', // Replace with your allowed frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Allow credentials if needed
}));

const port = 3000;

// MongoDB connection URI and database/collection details
const uri = process.env.MONGO_URI;
const dbName = 'Edunova_DB';
const booksCollectionName = 'Books';
const usersCollectionName = 'Users';
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

    // Fetch the newly inserted book using the insertedId
    const insertedBook = { ...newBook, _id: result.insertedId };

    // Return the newly added book
    res.status(201).json(insertedBook);
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

app.get('/transactions', async (req, res) => {
  try {
    // Retrieve all transactions from the Transactions collection
    const transactions = await db.collection(transactionsCollectionName).find().toArray();

    // Check if there are any transactions
    if (transactions.length === 0) {
      return res.status(404).json({ message: 'No transactions found' });
    }

    // Prepare an array to hold the enriched transactions
    const enrichedTransactions = [];

    for (const transaction of transactions) {
      // Fetch book details by bookId
      const book = await db.collection(booksCollectionName).findOne({ _id: transaction.bookId });
      // Fetch user details by userId
      const user = await db.collection(usersCollectionName).findOne({ _id: transaction.userId });

      // Enrich the transaction with book and user names
      enrichedTransactions.push({
        _id: transaction._id,
        bookId: transaction.bookId,
        userId: transaction.userId,
        issueDate: transaction.issueDate,
        returnDate: transaction.returnDate,
        totalRent: transaction.totalRent,
        status: transaction.status,
        bookName: book ? book.name : 'Unknown Book',
        username: user ? user.name : 'Unknown User',
      });
    }

    // Send the enriched list of transactions as a response
    res.status(200).json(enrichedTransactions);
  } catch (error) {
    console.error('Error retrieving transactions:', error); // Log error for debugging
    res.status(500).json({ message: 'Error retrieving transactions', error });
  }
});


/**
 * API 1: Issue a book to a user
 * INPUT: bookName, username, issueDate (from request body)
 * OUTPUT: Insert a new transaction document in the Transactions collection
 */
app.post('/transactions/issue', async (req, res) => {
  const { bookName, username, issueDate } = req.body;

  // Validate required fields
  if (!bookName || !username || !issueDate) {
    return res.status(400).json({ message: 'bookName, username, and issueDate are required' });
  }

  try {
    // Find the book by name
    const book = await db.collection(booksCollectionName).findOne({ name: bookName });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Find the user by username
    const user = await db.collection(usersCollectionName).findOne({ name: username }); // Changed to query by username
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create a new transaction
    const transaction = {
      bookId: book._id,
      userId: user._id, // Use user._id for the transaction
      issueDate: new Date(issueDate),
      status: 'issued', // Status can be 'issued' or 'returned'
    };

    // Insert the transaction into the Transactions collection
    const result = await db.collection(transactionsCollectionName).insertOne(transaction);

    res.status(201).json({ message: 'Book issued successfully', transactionId: result.insertedId });
  } catch (error) {
    console.error('Error issuing book:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error issuing book', error });
  }
});

/**
 * API 2: Return a book and calculate rent
 * INPUT: bookName, userId, returnDate (from request body)
 * OUTPUT: Update the transaction with the return date and calculate rent based on the issue date and return date
 */
app.post('/transactions/return', async (req, res) => {
  const { transactionId, returnDate } = req.body;

  if (!transactionId || !returnDate) {
    return res.status(400).json({ message: 'transactionId and returnDate are required' });
  }

  try {
    // Find the transaction by transactionId
    const transaction = await db.collection(transactionsCollectionName).findOne({ _id: new ObjectId(transactionId) });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Find the book associated with the transaction
    const book = await db.collection(booksCollectionName).findOne({ _id: new ObjectId(transaction.bookId) });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    const issueDate = new Date(transaction.issueDate);
    const returnDateParsed = new Date(returnDate);

    // Calculate the number of days the book was rented
    const daysRented = Math.ceil((returnDateParsed - issueDate) / (1000 * 60 * 60 * 24));

    // Calculate total rent (rentPerDay * number of days rented)
    const totalRent = book.rentPerDay * daysRented;

    // Update the transaction with returnDate, totalRent, and change the status to 'returned'
    await db.collection(transactionsCollectionName).updateOne(
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
    console.error('Error returning book:', error);
    res.status(500).json({ message: 'Error returning book', error });
  }
});



/**
 * API: Get information about a book's issuance history and current status
 * INPUT: bookName
 * OUTPUT: List of users who have issued the book and the current status
 */
app.get('/transactions/book/:bookName', async (req, res) => {
  const { bookName } = req.params;

  try {
    // Find the book by name
    const book = await db.collection(booksCollectionName).findOne({ name: bookName });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Retrieve past transactions for the book
    const pastTransactions = await db.collection(transactionsCollectionName)
      .find({ bookId: book._id })
      .toArray();

    // Prepare the response for past issuers
    const pastIssuers = pastTransactions.map(transaction => ({
      userId: transaction.userId,
      issueDate: transaction.issueDate,
      returnDate: transaction.returnDate,
      status: transaction.status,
    }));

    // Check if the book is currently issued
    const currentTransaction = pastTransactions.find(transaction => transaction.status === 'issued');
    let currentUser = null;
    if (currentTransaction) {
      // Fetch user details for the current transaction
      const user = await db.collection(usersCollectionName).findOne({ _id: currentTransaction.userId });
      currentUser = user ? { userId: user._id, username: user.name } : null;
    }

    // Prepare the response
    const response = {
      totalIssuedCount: pastIssuers.length,
      pastIssuers,
      currentStatus: currentUser ? { status: 'currently issued', user: currentUser } : { status: 'not issued' },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error retrieving book issuance information:', error);
    res.status(500).json({ message: 'Error retrieving book issuance information', error });
  }
});

app.get('/transactions/rent/:bookName', async (req, res) => {
  const { bookName } = req.params;

  try {
    // Step 1: Find the book by name (case-insensitive)
    const book = await db.collection(booksCollectionName).findOne({
      name: { $regex: new RegExp(`^${bookName}$`, 'i') } // Case-insensitive match
    });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Step 2: Aggregate the total rent for the book
    const totalRentData = await db.collection(transactionsCollectionName).aggregate([
      {
        $match: { bookId: book._id, status: 'returned' } // Only returned transactions
      },
      {
        $group: {
          _id: null,
          totalRent: { $sum: '$totalRent' } // Sum the totalRent field
        }
      }
    ]).toArray();

    // Step 3: Get the total rent from the aggregation result
    const totalRent = totalRentData.length > 0 ? totalRentData[0].totalRent : 0;

    // Return the total rent
    res.status(200).json({ bookName, totalRent });
  } catch (error) {
    console.error('Error retrieving total rent:', error);
    res.status(500).json({ message: 'Error retrieving total rent', error });
  }
});

// API: Get list of books issued to a person (by name or userId)
app.get('/transactions/user/:userIdOrName', async (req, res) => {
  const { userIdOrName } = req.params;

  try {
    let user;

    // Step 1: Check if the input is a valid ObjectId (indicating it's a userId)
    if (ObjectId.isValid(userIdOrName)) {
      // Find user by userId
      user = await db.collection(usersCollectionName).findOne({ _id: new ObjectId(userIdOrName) });
    } else {
      // Find user by name (case-insensitive)
      user = await db.collection(usersCollectionName).findOne({ name: { $regex: new RegExp(`^${userIdOrName}$`, 'i') } });
    }

    // Step 2: Check if user exists
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Step 3: Find all transactions for the user
    const transactions = await db.collection(transactionsCollectionName).find({ userId: user._id }).toArray();

    if (transactions.length === 0) {
      return res.status(404).json({ message: 'No transactions found for this user' });
    }

    // Step 4: Retrieve book details for each transaction
    const issuedBooks = [];
    for (const transaction of transactions) {
      const book = await db.collection(booksCollectionName).findOne({ _id: new ObjectId(transaction.bookId) });

      if (book) {
        issuedBooks.push({
          bookId: book._id,
          bookName: book.name,
          issueDate: transaction.issueDate,
          returnDate: transaction.returnDate,
          status: transaction.status,
        });
      }
    }

    // Step 5: Return the list of issued books
    res.status(200).json({ user: { userId: user._id, username: user.name }, issuedBooks });
  } catch (error) {
    console.error('Error retrieving books for user:', error);
    res.status(500).json({ message: 'Error retrieving books for user', error });
  }
});

app.get('/transactions/issued', async (req, res) => {
  const { startDate, endDate } = req.query;

  // Validate the inputs
  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'Both startDate and endDate are required' });
  }

  try {
    // Parse the input dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Check if the date range is valid
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Find all transactions where the issueDate is within the given date range
    const transactions = await db.collection(transactionsCollectionName).find({
      issueDate: {
        $gte: start,
        $lte: end
      }
    }).toArray();

    // Prepare a list of issued books with user info
    const issuedBooks = [];

    for (const transaction of transactions) {
      // Get book details
      const book = await db.collection(booksCollectionName).findOne({ _id: transaction.bookId });
      if (!book) continue;

      // Get user details
      const user = await db.collection(usersCollectionName).findOne({ _id: transaction.userId });
      if (!user) continue;

      // Add the transaction to the result
      issuedBooks.push({
        bookName: book.name,
        bookId: book._id,
        userId: user._id,
        username: user.name,
        issueDate: transaction.issueDate,
        status: transaction.status
      });
    }

    // Return the result
    res.status(200).json({ issuedBooks });

  } catch (error) {
    console.error('Error fetching transactions in date range:', error);
    res.status(500).json({ message: 'An error occurred while fetching the transactions', error });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
