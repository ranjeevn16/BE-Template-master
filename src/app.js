const express = require('express');
const bodyParser = require('body-parser');
const { sequelize } = require('./model')
const { Op } = require("sequelize");
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const { id } = req.params;
    console.log(JSON.stringify(req.profile));

    const contract = await Contract.findOne({ where: { id, [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }] } })
    if (!contract) return res.status(404).end()
    res.json(contract)

})
module.exports = app;
