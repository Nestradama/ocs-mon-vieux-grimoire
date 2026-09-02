const fs = require('fs');
const Book = require('../models/Book');
const { IMAGES_DIR } = require('../middleware/multer-config');
// GET /api/books — return all books
exports.getAllBooks = async (req, res) => {
  try {
    const books = await Book.find();
    res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// GET /api/books/bestrating — return top 3 books by averageRating
exports.getBestRated = async (req, res) => {
  try {
    const books = await Book.find()
      .sort({ averageRating: -1 }) // descending: highest first
      .limit(3);
    res.status(200).json(books);
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong' });
  }
};

// GET /api/books/:id — return a single book
exports.getBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    return res.status(200).json(book);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// POST /api/books — create a book - Multipart
exports.createBook = async (req, res) => {
  try {
    let bookData;
    try {
      bookData = JSON.parse(req.body.book);
    } catch (err) {
      return res.status(400).json({ message: 'Invalid data format' });
    }
    // takes userId from auth middleware
    bookData.userId = req.auth.userId;

    if (req.file) {
      bookData.imageUrl = `${req.protocol}://${req.get('host')}/images/${req.optimizedFilename}`;
    }

    const book = new Book(bookData);
    await book.save();
    res.status(201).json(book);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// PUT /api/books/:id — update a book
exports.updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    let updateData;

    if (req.file) {
      try {
        updateData = JSON.parse(req.body.book);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid book data format' });
      }
    } else {
      updateData = req.body;
    }

    updateData.userId = req.auth.userId;

    if (req.file) {
      updateData.imageUrl = `${req.protocol}://${req.get('host')}/images/${req.optimizedFilename}`;
    }

    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    return res.status(200).json(updatedBook);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// DELETE /api/books/:id — delete a book
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Book.findByIdAndDelete(req.params.id);
    if (book.imageUrl) {
      const filename = book.imageUrl.split('/').pop();
      fs.unlink(`${IMAGES_DIR}/${filename}`, (err) => {
        if (err) console.error('Image deletion failed:', err);
      });
    }

    return res.status(200).json({ message: 'Book deleted' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// POST /api/books/:id/rating — rate a book
exports.rateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // The frontend sends: { userId: "WhateverValue", rating: 3 }
    const { rating } = req.body;
    const { userId } = req.auth;

    const grade = Number(rating);

    if (!Number.isInteger(grade) || grade < 0 || grade > 5) {
      return res.status(400).json({ message: 'Rating must be an integer between 0 and 5' });
    }

    const alreadyRated = book.ratings.find(
      (r) => r.userId === userId,
    );

    if (alreadyRated) {
      alreadyRated.grade = grade;
    } else {
      book.ratings.push({ userId, grade });
    }

    const total = book.ratings.reduce((sum, r) => sum + r.grade, 0);
    book.averageRating = Math.round(total / book.ratings.length);

    await book.save();

    return res.status(200).json(book);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid book id' });
    }
    return res.status(500).json({ message: 'Something went wrong' });
  }
};
