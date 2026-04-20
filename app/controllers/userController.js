const User = require("../models/user");

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "Perfil não encontrado." });
    }
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar perfil." });
  }
}

async function updateMyRole(req, res) {
  const { role } = req.body;

  if (!role || !User.isValidRole(role)) {
    return res.status(400).json({
      error: `Role inválido. Valores aceitos: ${User.VALID_ROLES.join(", ")}`,
    });
  }

  try {
    const result = await User.updateRole(req.user.uid, role);
    return res.json({ message: "Perfil atualizado.", ...result });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar perfil." });
  }
}

async function updateMyProfile(req, res) {
  const { profile } = req.body;

  if (!profile || typeof profile !== "object") {
    return res.status(400).json({ error: "Dados de perfil inválidos." });
  }

  try {
    const user = await User.findById(req.user.uid);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const profileData = User.sanitizeProfile(user.role, profile);
    const result = await User.updateProfile(req.user.uid, profileData);
    return res.json({ message: "Perfil atualizado.", ...result });
  } catch (error) {
    return res.status(500).json({ error: "Erro ao atualizar perfil." });
  }
}

async function getById(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }
    return res.json(User.toPublicProfile(user));
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar usuário." });
  }
}

module.exports = { getMe, updateMyRole, updateMyProfile, getById };
