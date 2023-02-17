const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, Contract } = require('./model')
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
    const contracts = await Contract.findAll({ attributes: ['id'], where: { [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }], [Op.not]: [{ status: "terminated" }] } });
    let contractsList = [];
    for (i = 0; i < contracts.length; i++) {
        contractsList.push(contracts[i].id)
    }
    const jobs = await Job.findAll({ where: { paid: null, ContractId: contractsList } });

    if (!jobs) return res.status(404).end()
    res.json(jobs)
})
/**
 * Pay for a job
 */
app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { Job } = req.app.get('models')
    const { Contract } = req.app.get('models')
    const { Profile } = req.app.get('models')
    const { job_id } = req.params

    const job = await Job.findOne({ where: { id: job_id } });

    if (req.profile.balance >= job.price) {
        const contract = await Contract.findOne({ where: { id: job.ContractId } });

        const contractor = await Profile.findOne({ where: { id: contract.ContractorId } });

        clientBalance = req.profile.balance - job.price;
        contractorBalance = contractor.balance + job.price;

        const t = await sequelize.transaction();

        try {

            // Create transactions to update contractor and client balances, contract status and job date

            const clientBalanceUpdate = await Profile.update({ balance: clientBalance }, {
                where: {
                    id: req.profile.id
                }
            }, { transaction: t });
            await Profile.update({ balance: contractorBalance }, {
                where: {
                    id: contractor.id
                }
            }, { transaction: t });
            await Contract.update({ status: 'terminated' }, {
                where: {
                    id: contract.id
                }

            }, { transaction: t });
            await Job.update({ paid: true, paymentDate: Date.now() }, {
                where: {
                    id: job.id
                }

            }, { transaction: t });

            await t.commit();
            if (!clientBalanceUpdate) return res.status(404).end()
            res.status(200).send("successfully completed transaction")


        } catch (error) {
            await t.rollback();

        }
    }
    else {
        res.res.status(500).send("Cannot complete transaction due to insufficient funds")

    }


})
/**
 * deposit money to client balance 
 * requires req.body in JSON format, example: {"amountToPay":23000}
 */
app.post('/balances/deposit/:userId', async (req, res) => {
    const { Job } = req.app.get('models')
    const { Profile } = req.app.get('models')
    const { Contract } = req.app.get('models')
    const { userId } = req.params;
    const contracts = await Contract.findAll({ attributes: ['id'], where: { ClientId: userId, [Op.not]: [{ status: "terminated" }] } });
    let contractsList = [];
    for (i = 0; i < contracts.length; i++) {
        contractsList.push(contracts[i].id)
    }

    //find jobs for the list of contracts    
    const jobs = await Job.findAll({ where: { paid: null, ContractId: contractsList } });

    const amountToPay = req.body.amountToPay
    let jobTotalSum = 0;

    for (i = 0; i < jobs.length; i++) {
        jobTotalSum = jobTotalSum + jobs[i].price;
    }

    if ((amountToPay <= (0.25 * jobTotalSum))) {
        const client = await Profile.findOne({ where: { id: userId } });
        clientBalance = client.balance + amountToPay;
        const balanceUpdate = await Profile.update({ balance: clientBalance }, { where: { id: userId } });
        if (!balanceUpdate) return res.status(404).end()
        res.status(200).send("successfully completed transaction")

    }
    else {
        res.status(500).send("Cannot complete transaction as amount exceeds 25% of jobs to be paid")

    }





})
/**
 * Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
 */
app.get('/admin/best-profession', async (req, res) => {
    const { Contract } = req.app.get('models')
    const { Job } = req.app.get('models')
    const { Profile } = req.app.get('models')
    const { id } = req.params;
    const contractors = await Profile.findAll({ where: { type: 'contractor' }, include: [{ model: Contract, as: 'Contractor', include: [{ model: Job, where: { paid: true } }] }] });
    if (!contractors) return res.status(404).end()
    res.json(contractors)

})
/**
 * returns the clients the paid the most for jobs in the query time period */
app.get('/admin/best-clients', async (req, res) => {
    const { Job } = req.app.get('models')
    const { Profile } = req.app.get('models')
    const { Contract } = req.app.get('models')
    const clients = await Profile.findAll({ attributes: ['id', 'firstName', 'lastName'], where: { type: 'client' }, include: [{ model: Contract, as: 'Client'}] })
    console.log("clients", JSON.stringify(clients));
    if (!clients) return res.status(404).end()
    res.json(clients)
})



module.exports = app;
