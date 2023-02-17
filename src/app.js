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
    const { id } = req.params
    //search for active contracts for the profile ID
    const contracts = await Contract.findAll({ attributes: ['id'], where: { [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }], [Op.not]: [{ status: "terminated" }] } });
    //console.log("contracts",JSON.stringify(contracts));
    let contractsList =[];
    for(i =0;i<contracts.length;i++){
        contractsList.push(contracts[i].id)
    }
     console.log("contracts",JSON.stringify(contractsList));

    //find jobs for the list of contracts    
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
    console.log("Job found:", JSON.stringify(job));

    if (req.profile.balance >= job.price) {
        const contract = await Contract.findOne({ where: { id: job.ContractId } });
        console.log("contract found:", JSON.stringify(contract));

        const contractor = await Profile.findOne({ where: { id: contract.ContractorId } });
        console.log("job.price:", JSON.stringify(job.price));

        clientBalance = req.profile.balance - job.price;
        contractorBalance = contractor.balance + job.price;
        console.log("Balance:", clientBalance, contractorBalance);

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


            // If the execution reaches this line, no errors were thrown.
            // We commit the transaction.
            console.log("here");
            await t.commit();
            if (!clientBalanceUpdate) return res.status(404).end()
            res.json(clientBalanceUpdate)

        } catch (error) {

            // If the execution reaches this line, an error was thrown.
            // We rollback the transaction.
            await t.rollback();

        }
    }
    else {
        res.json("Cannot complete transaction due to insufficient funds")

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
    const contracts = await Contract.findAll({ attributes: ['id'], where: {  ClientId: userId , [Op.not]: [{ status: "terminated" }] }});
    console.log("contracts",JSON.stringify(contracts));
    let contractsList =[];
    for(i =0;i<contracts.length;i++){
        contractsList.push(contracts[i].id)
    }
     console.log("contracts",JSON.stringify(contractsList));

    //find jobs for the list of contracts    
    const jobs = await Job.findAll({ where: { paid: null, ContractId: contractsList } });

    const amountToPay= req.body.amountToPay
    console.log("Jobs found:", JSON.stringify(jobs));
    let jobTotalSum = 0;

    for (i = 0; i < jobs.length; i++) {
        jobTotalSum = jobTotalSum + jobs[i].price;
    }
    console.log("jobtotalsum",0.25*jobTotalSum);

    if ((amountToPay <=(0.25*jobTotalSum))) {
        const client = await Profile.findOne({ where: { id: userId } });
        console.log("Profile found:", JSON.stringify(client));
        clientBalance = client.balance + amountToPay;
        console.log("Balance:", clientBalance);
        const balanceUpdate = await Profile.update({ balance: clientBalance },{ where: { id: userId } });
        if (!balanceUpdate) return res.status(404).end()
        res.json(balanceUpdate)
        
    }
    else{
        res.json("Cannot complete transaction as amount exceeds 25% of jobs to be paid")

    }


     


})

app.get('/admin/best-profession?start=<date>&end=<date>', async (req, res) => {
    const { Contract } = req.app.get('models')
    const { id } = req.params;
    const contract = await Contract.findOne({ where: { id, [Op.or]: [{ ContractorId: req.profile.id }, { ClientId: req.profile.id }] } })
    if (!contract) return res.status(404).end()
    res.json(contract)

})
/**
 * Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range
 */
app.get('/admin/best-clients', async (req, res) => {
    const { Job } = req.app.get('models')
    const { Profile } = req.app.get('models')
    const { Contract } = req.app.get('models')  
    const clients = await Profile.findAll({ attributes: ['id','firstName','lastName'], where: {type:'client' }}) 
    console.log("clients",JSON.stringify(clients));

    let clientArray =[]
  
    for(i =0;i<clients.length;i++){
        let contractsList =[];
        let sumOfJobTotal = 0;
        const contractsforUser = await Contract.findAll({ where: { ClientId:clients[i].id} })
       
        for(i =0;i<contractsforUser.length;i++){
            contractsList.push(contractsforUser[i].id)     
        }
         console.log("contracts",JSON.stringify(contractsList));
    
        //find jobs for the list of contracts    
        let jobs = await Job.findAll({ where: { paid: true, ContractId: contractsList } });
        for(i =0;i<jobs.length;i++){
            sumOfJobTotal=  sumOfJobTotal +jobs[i].price;
        }
        console.log("sumOfJobTotal",JSON.stringify(sumOfJobTotal));
        topClientInfo ={ "id": clients[i].id,"fullName": firstName + ' '+ lastName,paid:sumOfJobTotal  }
        console.log("topClientInfo",topClientInfo);

        
    
    }
    
    // if (!clientArray) return res.status(404).end()
    // res.json(clientArray)

})



module.exports = app;
