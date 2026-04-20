const { auth } = require("../config/firebase");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    req.user = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido." });
  }
}

module.exports = { authenticate };
