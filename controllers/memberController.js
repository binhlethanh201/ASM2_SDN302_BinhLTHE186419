const mongoose = require("mongoose");
const Member = require("../models/Member");

const MEMBERSHIP_TYPES = ["Student", "Teacher", "Guest"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(0|\+84)\d{9}$/;

class memberController {
  async getAll(req, res) {
    try {
      const members = await Member.find();
      res.status(200).json(members);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid member id" });
      }
      const member = await Member.collection.findOne({_id: id});
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }
      res.status(200).json(member);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async createMember(req, res) {
    try {
      const { fullName, email, phone, membershipType, isActive } = req.body;
      if (
        fullName === undefined ||
        email === undefined ||
        phone === undefined ||
        membershipType === undefined ||
        isActive === undefined
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (
        typeof fullName !== "string" ||
        !fullName.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof phone !== "string" ||
        !phone.trim() ||
        typeof membershipType !== "string" ||
        !membershipType.trim()
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const cleanName = fullName.trim().replace(/\s+/g, " ");
      if (cleanName.length < 2 || cleanName.length > 100) {
        return res
          .status(400)
          .json({ message: "Full name must be between 2 and 100 characters" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      const cleanPhone = phone.replace(/[\s.-]/g, "");
      if (!PHONE_REGEX.test(cleanPhone)) {
        return res.status(400).json({
          message:
            "Phone must be a valid number (e.g. 0912345678 or +84912345678)",
        });
      }
      const cleanType = membershipType.trim();
      if (!MEMBERSHIP_TYPES.includes(cleanType)) {
        return res.status(400).json({
          message: `Membership type must be one of: ${MEMBERSHIP_TYPES.join(", ")}`,
        });
      }
      if (typeof isActive !== "boolean") {
        return res
          .status(400)
          .json({ message: "isActive must be a boolean (true or false)" });
      }
      const existingEmail = await Member.findOne({ email: cleanEmail });
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }
      const newMember = await Member.create({
        fullName: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        membershipType: cleanType,
        isActive,
      });

      res.status(201).json({ message: "Create successfully", data: newMember });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: error.message });
    }
  }

  async updateMember(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid member id" });
      }

      const { fullName, email, phone, membershipType, isActive } = req.body;
      const existingMember = await Member.findById(id);
      if (!existingMember) {
        return res
          .status(404)
          .json({ message: "Cannot find member to update" });
      }
      if (
        fullName === undefined ||
        email === undefined ||
        phone === undefined ||
        membershipType === undefined ||
        isActive === undefined
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (
        typeof fullName !== "string" ||
        !fullName.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof phone !== "string" ||
        !phone.trim() ||
        typeof membershipType !== "string" ||
        !membershipType.trim()
      ) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const cleanName = fullName.trim().replace(/\s+/g, " ");
      if (cleanName.length < 2 || cleanName.length > 100) {
        return res
          .status(400)
          .json({ message: "Full name must be between 2 and 100 characters" });
      }
      const cleanEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(cleanEmail)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      const cleanPhone = phone.replace(/[\s.-]/g, "");
      if (!PHONE_REGEX.test(cleanPhone)) {
        return res.status(400).json({
          message:
            "Phone must be a valid number (e.g. 0912345678 or +84912345678)",
        });
      }
      const cleanType = membershipType.trim();
      if (!MEMBERSHIP_TYPES.includes(cleanType)) {
        return res.status(400).json({
          message: `Membership type must be one of: ${MEMBERSHIP_TYPES.join(", ")}`,
        });
      }
      if (typeof isActive !== "boolean") {
        return res
          .status(400)
          .json({ message: "isActive must be a boolean (true or false)" });
      }
      const duplicateEmail = await Member.findOne({
        email: cleanEmail,
        _id: { $ne: id },
      });
      if (duplicateEmail) {
        return res
          .status(400)
          .json({ message: "Email already exists in another member" });
      }
      const update = await Member.findByIdAndUpdate(
        id,
        {
          fullName: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          membershipType: cleanType,
          isActive,
        },
        { new: true, runValidators: true },
      );

      res.status(200).json({ message: "Update successfully", data: update });
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ message: "Email already exists in another member" });
      }
      res.status(500).json({ message: error.message });
    }
  }

  async deleteMember(req, res) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid member id" });
      }
      const del = await Member.findByIdAndDelete(id);
      if (!del) {
        return res
          .status(404)
          .json({ message: "Cannot find member to delete" });
      }
      res.status(200).json({ message: "Delete successfully", data: del });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new memberController();