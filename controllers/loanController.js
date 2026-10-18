const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const Member = require("../models/Member");
const Book = require("../models/Book");

const LOAN_STATUSES = ["Borrowing", "Returned", "Overdue"];
const POPULATE_SELECT = "-__v -createdAt -updatedAt";

class loanController {
  async getAll(req, res) {
    try {
      const loans = await Loan.find()
        .populate("member_id", POPULATE_SELECT)
        .populate("items.book_id", POPULATE_SELECT);
      res.status(200).json(loans);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid loan id" });
      }

      const loan = await Loan.findById(id)
        .populate("member_id", POPULATE_SELECT)
        .populate("items.book_id", POPULATE_SELECT);
      if (!loan) {
        return res.status(404).json({ message: "Loan record not found" });
      }
      res.status(200).json(loan);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getByMemberId(req, res) {
    try {
      const { memberId } = req.params;

      if (!memberId || typeof memberId !== "string" || !memberId.trim()) {
        return res.status(400).json({ message: "Invalid member id" });
      }

      const loans = await Loan.aggregate([
        { $match: { member_id: memberId } },
        {
          $lookup: {
            from: "members",
            localField: "member_id",
            foreignField: "_id",
            as: "member_id",
            pipeline: [{ $project: { __v: 0, createdAt: 0, updatedAt: 0 } }],
          },
        },
        { $unwind: { path: "$member_id", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "books",
            localField: "items.book_id",
            foreignField: "_id",
            as: "item_books",
            pipeline: [{ $project: { __v: 0, createdAt: 0, updatedAt: 0 } }],
          },
        },
        {
          $project: {
            _id: 1,
            memberDetail: "$member_id",
            borrowDate: 1,
            dueDate: 1,
            returnDate: 1,
            status: 1,
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  quantity: "$$item.quantity",
                  bookDetails: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$item_books",
                          as: "b",
                          cond: { $eq: ["$$b._id", "$$item.book_id"] },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      res.status(200).json(loans);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async borrowBook(req, res) {
    const decremented = [];
    try {
      const { member_id, items, dueDate } = req.body;
      if (!member_id || !items) {
        return res
          .status(400)
          .json({ message: "member_id and items are required" });
      }
      if (typeof member_id !== "string" || !member_id.trim()) {
        return res.status(400).json({ message: "Invalid member id" });
      }
      const memberId = member_id.trim();
      if (!Array.isArray(items) || items.length === 0) {
        return res
          .status(400)
          .json({ message: "Items must be a non-empty array" });
      }
      const seenBookIds = new Set();
      for (const item of items) {
        if (!item || typeof item.book_id !== "string" || !item.book_id.trim()) {
          return res
            .status(400)
            .json({ message: "Each item must have a valid book_id" });
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1) {
          return res
            .status(400)
            .json({ message: "Quantity must be an integer greater than 0" });
        }
        const bookId = item.book_id.trim();
        if (seenBookIds.has(bookId)) {
          return res
            .status(400)
            .json({ message: "Duplicate book_id in items" });
        }
        seenBookIds.add(bookId);
      }
      let finalDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      if (dueDate !== undefined) {
        finalDueDate = new Date(dueDate);
        if (isNaN(finalDueDate.getTime())) {
          return res.status(400).json({ message: "Invalid due date" });
        }
        if (finalDueDate <= new Date()) {
          return res
            .status(400)
            .json({ message: "Due date must be in the future" });
        }
      }
      const member = await Member.collection.findOne(
        { _id: memberId },
        { projection: { __v: 0, createdAt: 0, updatedAt: 0 } },
      );
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (!member.isActive) {
        return res.status(400).json({ message: "Member is not active" });
      }
      const bookMap = new Map();
      for (const item of items) {
        const bookId = item.book_id.trim();
        const book = await Book.collection.findOne(
          { _id: bookId },
          { projection: { __v: 0, createdAt: 0, updatedAt: 0 } },
        );
        if (!book) {
          return res.status(404).json({ message: `Book not found: ${bookId}` });
        }
        if (book.availableCopies < item.quantity) {
          return res.status(400).json({
            message: `Not enough available copies for book "${book.title}"`,
          });
        }
        bookMap.set(bookId, book);
      }
      for (const item of items) {
        const bookId = item.book_id.trim();
        const result = await Book.collection.updateOne(
          { _id: bookId, availableCopies: { $gte: item.quantity } },
          {
            $inc: { availableCopies: -item.quantity },
            $set: { updatedAt: new Date() },
          },
        );
        if (result.modifiedCount === 0) {
          for (const d of decremented) {
            await Book.collection.updateOne(
              { _id: d.book_id },
              { $inc: { availableCopies: d.quantity } },
            );
          }
          return res.status(400).json({
            message: `Not enough available copies for book ${bookId}`,
          });
        }
        decremented.push({ book_id: bookId, quantity: item.quantity });
      }
      const newLoan = await Loan.create({
        member_id: memberId,
        items: items.map((i) => ({
          book_id: i.book_id.trim(),
          quantity: i.quantity,
        })),
        borrowDate: new Date(),
        dueDate: finalDueDate,
        status: "Borrowing",
      });
      const loanObj = newLoan.toObject();
      const populatedLoan = {
        ...loanObj,
        member_id: member,
        items: loanObj.items.map((i) => ({
          ...i,
          book_id: bookMap.get(String(i.book_id)) || null,
        })),
      };

      res
        .status(201)
        .json({ message: "Create successfully", data: populatedLoan });
    } catch (error) {
      for (const d of decremented) {
        await Book.collection.updateOne(
          { _id: d.book_id },
          { $inc: { availableCopies: d.quantity } },
        );
      }
      res.status(500).json({ message: error.message });
    }
  }

  async returnBook(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid loan id" });
      }

      const objectId = new mongoose.Types.ObjectId(id);

      if (status === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      if (typeof status !== "string" || status.trim() !== "Returned") {
        return res.status(400).json({ message: "Status must be 'Returned'" });
      }

      const loan = await Loan.collection.findOne({ _id: objectId });
      if (!loan) {
        return res.status(404).json({ message: "Loan record not found" });
      }

      if (loan.status === "Returned") {
        return res
          .status(400)
          .json({ message: "This loan has already been returned" });
      }

      const returnDate = new Date();
      await Loan.collection.updateOne(
        { _id: objectId },
        {
          $set: {
            status: "Returned",
            returnDate: returnDate,
            updatedAt: returnDate,
          },
        },
      );

      if (loan.items && Array.isArray(loan.items)) {
        for (const item of loan.items) {
          const bookObjectId = mongoose.Types.ObjectId.isValid(item.book_id)
            ? new mongoose.Types.ObjectId(item.book_id)
            : item.book_id;

          await Book.collection.updateOne(
            { _id: bookObjectId },
            { $inc: { availableCopies: item.quantity } },
          );
        }
      }
      const populatedLoan = await Loan.aggregate([
        { $match: { _id: objectId } },
        {
          $lookup: {
            from: "members",
            let: { loanMemberId: { $toString: "$member_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$_id" }, "$$loanMemberId"],
                  },
                },
              },
              { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
            ],
            as: "member_id",
          },
        },
        { $unwind: { path: "$member_id", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "books",
            let: { itemBookIds: "$items.book_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      { $toString: "$_id" },
                      {
                        $map: {
                          input: "$$itemBookIds",
                          as: "bId",
                          in: { $toString: "$$bId" },
                        },
                      },
                    ],
                  },
                },
              },
              { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
            ],
            as: "item_books",
          },
        },
        {
          $project: {
            _id: 1,
            member_id: 1,
            borrowDate: 1,
            dueDate: 1,
            returnDate: 1,
            status: 1,
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  quantity: "$$item.quantity",
                  book: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$item_books",
                          as: "b",
                          cond: {
                            $eq: [
                              { $toString: "$$b._id" },
                              { $toString: "$$item.book_id" },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      res.status(200).json({
        message: "Book returned successfully",
        data: populatedLoan[0] || null,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { dueDate, status } = req.body;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid loan id" });
      }

      const objectId = new mongoose.Types.ObjectId(id);

      if (dueDate === undefined || status === undefined) {
        return res.status(400).json({
          message: "Missing required fields (dueDate and status are required)",
        });
      }

      const existingLoan = await Loan.collection.findOne({ _id: objectId });
      if (!existingLoan) {
        return res.status(404).json({ message: "Loan record not found" });
      }

      if (existingLoan.status === "Returned") {
        return res
          .status(400)
          .json({ message: "Cannot update a returned loan" });
      }

      const newDueDate = new Date(dueDate);
      if (isNaN(newDueDate.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
      }

      const borrowDate = new Date(existingLoan.borrowDate);
      if (newDueDate <= borrowDate) {
        return res
          .status(400)
          .json({ message: "Due date must be after borrow date" });
      }

      if (
        typeof status !== "string" ||
        !LOAN_STATUSES.includes(status.trim())
      ) {
        return res.status(400).json({
          message: `Status must be one of: ${LOAN_STATUSES.join(", ")}`,
        });
      }

      const cleanStatus = status.trim();
      if (cleanStatus === "Returned") {
        return res.status(400).json({
          message: "Use PUT /api/loans/:id/return to return a loan",
        });
      }

      const now = new Date();
      await Loan.collection.updateOne(
        { _id: objectId },
        {
          $set: {
            dueDate: newDueDate,
            status: cleanStatus,
            updatedAt: now,
          },
        },
      );
      const updatedLoan = await Loan.aggregate([
        { $match: { _id: objectId } },
        {
          $lookup: {
            from: "members",
            let: { loanMemberId: { $toString: "$member_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [{ $toString: "$_id" }, "$$loanMemberId"],
                  },
                },
              },
              { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
            ],
            as: "member_id",
          },
        },
        { $unwind: { path: "$member_id", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "books",
            let: { itemBookIds: "$items.book_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [
                      { $toString: "$_id" },
                      {
                        $map: {
                          input: "$$itemBookIds",
                          as: "bId",
                          in: { $toString: "$$bId" },
                        },
                      },
                    ],
                  },
                },
              },
              { $project: { __v: 0, createdAt: 0, updatedAt: 0 } },
            ],
            as: "item_books",
          },
        },
        {
          $project: {
            _id: 1,
            member_id: 1,
            borrowDate: 1,
            dueDate: 1,
            returnDate: 1,
            status: 1,
            items: {
              $map: {
                input: "$items",
                as: "item",
                in: {
                  quantity: "$$item.quantity",
                  book: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$item_books",
                          as: "b",
                          cond: {
                            $eq: [
                              { $toString: "$$b._id" },
                              { $toString: "$$item.book_id" },
                            ],
                          },
                        },
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        },
      ]);

      res.status(200).json({
        message: "Update successfully",
        data: updatedLoan[0] || null,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid loan id" });
      }

      const del = await Loan.findByIdAndDelete(id);
      if (!del) {
        return res.status(404).json({ message: "Cannot find loan to delete" });
      }
      if (del.status !== "Returned") {
        for (const item of del.items) {
          await Book.updateOne(
            { _id: item.book_id },
            { $inc: { availableCopies: item.quantity } },
          );
        }
      }

      res.status(200).json({ message: "Delete successfully", data: del });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new loanController();
