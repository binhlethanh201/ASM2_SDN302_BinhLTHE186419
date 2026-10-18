const express = require("express");
const router = express.Router();
const loanController = require("../controllers/loanController");

router.get("/", loanController.getAll);
router.get("/member/:memberId", loanController.getByMemberId); 
router.get("/:id", loanController.getById);
router.post("/", loanController.borrowBook);
router.put("/:id/return", loanController.returnBook);
router.put("/:id", loanController.update);
// router.delete("/:id", loanController.delete);

module.exports = router;