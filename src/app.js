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
    const contract = await Contract.findOne({ where: { id, [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }] } })
    if (!contract) return res.status(404).end()
    res.json(contract)

})
/**
* @returns list of contracts belonging to a user 
 */
app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const contracts = await Contract.findAll({ where: { [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }], [Op.not]: [{ status: "terminated" }] } });
    if (!contracts) return res.status(404).end()
    res.json(contracts)
})
/**
 * @returns  all unpaid jobs for a user 
 */

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { Job } = req.app.get('models')
    const { Contract } = req.app.get('models')
    const { id } = req.params
    //search for active contracts for the profile ID
    const contracts = await Contract.findAll({ attributes: ['id'], where: { [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }], [Op.not]: [{ status: "terminated" }] } });
    //find jobs for the list of contracts    
    const jobs = await Job.findAll({ where: { paid: true, ContractId: [2, 3, 8] } });

    if (!jobs) return res.status(404).end()
    res.json(jobs)
})
/**
 * Pay for a job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { Job } = req.app.get('models')
    const { job_id } = req.params
    const job = await Job.findOne({ where: {id: job_id}});
    if(req.profile.balance > job.price){
        console.log("TODO,payment")
        req.profile.balance = req.profile.balance -job.price;
        const payment = await Job.findOne({ where: {id: job_id}});

    }

    if (!job) return res.status(404).end()
    res.json(job)
})
module.exports = app;
