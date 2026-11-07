// Handlers HTTP do dashboard.
const repository = require('./dashboard.repository');
const { asyncHandler } = require('../../utils/errors');

exports.summary = asyncHandler(async (req, res) => {
  res.json(await repository.summary(req.user.id));
});
