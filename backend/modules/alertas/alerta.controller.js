// Handlers HTTP de alertas.
const alertaService = require('./alerta.service');
const { asyncHandler } = require('../../utils/errors');

exports.alertas = asyncHandler(async (req, res) => {
  res.json(await alertaService.alertas({ dias: req.query.dias }));
});
