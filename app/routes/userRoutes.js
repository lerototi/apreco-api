const { Router } = require("express");
const { authenticate } = require("../middleware/auth");
const userController = require("../controllers/userController");

const router = Router();

router.get("/me", authenticate, userController.getMe);
router.put("/me/role", authenticate, userController.updateMyRole);
router.put("/me/profile", authenticate, userController.updateMyProfile);
router.get("/:id", authenticate, userController.getById);

module.exports = router;
