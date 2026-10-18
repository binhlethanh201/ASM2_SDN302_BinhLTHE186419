const mongoose = require("mongoose");
const Book = require("../models/Book");

class bookController {
  async getAll(req, res) {
    try {
      const books = await Book.find();
      res.status(200).json(books);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const book = await Book.collection.findOne({ _id: id });
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }
      res.status(200).json(book);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async createBook(req, res) {
    try {
      const {
        title,
        author,
        category,
        isbn,
        publishedYear,
        totalCopies,
        availableCopies,
      } = req.body;

      if (
        !title ||
        !author ||
        !category ||
        !isbn ||
        publishedYear === undefined ||
        totalCopies === undefined ||
        availableCopies === undefined
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof author !== "string" ||
        !author.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof isbn !== "string" ||
        !isbn.trim()
      ) {
        return res.status(400).json({
          message: "Missing required fields",
        });
      }

      if (isbn.trim().startsWith("-")) {
        return res
          .status(400)
          .json({ message: "ISBN cannot be a negative number" });
      }

      const cleanIsbn = isbn.replace(/-/g, "").trim();

      const existingIsbn = await Book.findOne({ isbn: cleanIsbn });
      if (existingIsbn) {
        return res.status(400).json({ message: "ISBN already exists" });
      }

      const currentYear = new Date().getFullYear();
      if (
        !Number.isInteger(publishedYear) ||
        publishedYear < 1 ||
        publishedYear > currentYear
      ) {
        return res.status(400).json({
          message: `Published year must be a valid year between 1 and ${currentYear}`,
        });
      }

      if (!Number.isInteger(totalCopies) || totalCopies < 0) {
        return res
          .status(400)
          .json({ message: "Total copies must be a non-negative integer" });
      }

      if (!Number.isInteger(availableCopies) || availableCopies < 0) {
        return res
          .status(400)
          .json({ message: "Available copies must be a non-negative integer" });
      }

      if (availableCopies > totalCopies) {
        return res.status(400).json({
          message: "Available copies cannot be greater than total copies",
        });
      }

      const newProduct = await Book.create({
        title: title.trim(),
        author: author.trim(),
        category: category.trim(),
        isbn: cleanIsbn,
        publishedYear,
        totalCopies,
        availableCopies,
      });

      res
        .status(201)
        .json({ message: "Create successfully", data: newProduct });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async updateBook(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid book id" });
      }

      const {
        title,
        author,
        category,
        isbn,
        publishedYear,
        totalCopies,
        availableCopies,
      } = req.body;
      const existingBook = await Book.findById(id);
      if (!existingBook) {
        return res.status(404).json({ message: "Cannot find book to update" });
      }
      if (
        !title ||
        !author ||
        !category ||
        !isbn ||
        publishedYear === undefined ||
        totalCopies === undefined ||
        availableCopies === undefined
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof author !== "string" ||
        !author.trim() ||
        typeof category !== "string" ||
        !category.trim() ||
        typeof isbn !== "string" ||
        !isbn.trim()
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (isbn.trim().startsWith("-")) {
        return res
          .status(400)
          .json({ message: "ISBN cannot be a negative number" });
      }

      const cleanIsbn = isbn.replace(/-/g, "").trim();
      const duplicateIsbn = await Book.findOne({
        isbn: cleanIsbn,
        _id: { $ne: id },
      });
      if (duplicateIsbn) {
        return res
          .status(400)
          .json({ message: "ISBN already exists in another book" });
      }
      const currentYear = new Date().getFullYear();
      if (
        !Number.isInteger(publishedYear) ||
        publishedYear < 1 ||
        publishedYear > currentYear
      ) {
        return res.status(400).json({
          message: `Published year must be a valid year between 1 and ${currentYear}`,
        });
      }

      if (!Number.isInteger(totalCopies) || totalCopies < 0) {
        return res
          .status(400)
          .json({ message: "Total copies must be a non-negative integer" });
      }

      if (!Number.isInteger(availableCopies) || availableCopies < 0) {
        return res
          .status(400)
          .json({ message: "Available copies must be a non-negative integer" });
      }

      if (availableCopies > totalCopies) {
        return res.status(400).json({
          message: "Available copies cannot be greater than total copies",
        });
      }
      const update = await Book.findByIdAndUpdate(
        id,
        {
          title: title.trim(),
          author: author.trim(),
          category: category.trim(),
          isbn: cleanIsbn,
          publishedYear,
          totalCopies,
          availableCopies,
        },
        { new: true, runValidators: true },
      );

      res.status(200).json({ message: "Update successfully", data: update });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  async deleteBook(req, res) {
    try {
      const { id } = req.params;
      const del = await Book.findOneAndDelete({ _id: id });
      if (!del) {
        return res.status(404).json({ message: "Cannot find book to delete" });
      }
      res.status(200).json({ message: "Delete successfully", data: del });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new bookController();
